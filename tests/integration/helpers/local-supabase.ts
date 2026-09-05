/**
 * Accès à la base Supabase LOCALE depuis les tests d'intégration.
 *
 * Deux contraintes du dépôt expliquent la forme de ce module :
 *
 * 1. `tests/setup.ts` remplace `global.fetch` par un mock — un client
 *    `@supabase/supabase-js` monté dans cet environnement n'atteindrait jamais le
 *    réseau. On parle donc directement à PostgREST avec `node:http`.
 * 2. Aucun client PostgreSQL (`pg`) n'est installé : tout passe par l'API REST
 *    locale, avec la clé `service_role` (écritures) ou la clé `anon` (tests de
 *    non-régression de sécurité).
 *
 * Les clés sont lues à l'exécution avec « supabase status -o env » : rien n'est
 * codé en dur, et si la base locale est arrêtée les suites appelantes se
 * désactivent proprement (`describe.skipIf`).
 */
import http from "node:http"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import path from "node:path"

export interface LocalSupabaseEnv {
  apiUrl: string
  anonKey: string
  serviceRoleKey: string
  jwtSecret: string
  dbUrl: string
}

// vitest est lancé depuis la racine du dépôt (`npm run test`) : cwd fait foi.
const REPO_ROOT = process.cwd()

let cachedEnv: LocalSupabaseEnv | null | undefined

/**
 * Lit « supabase status -o env ». Retourne null si la base locale est arrêtée ou
 * si la CLI n'est pas disponible : les tests appelants doivent alors se désactiver.
 */
export function readLocalSupabaseEnv(): LocalSupabaseEnv | null {
  if (cachedEnv !== undefined) return cachedEnv

  try {
    const raw = execFileSync("supabase", ["status", "-o", "env"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    })

    const values: Record<string, string> = {}
    for (const line of raw.split("\n")) {
      const match = /^([A-Z0-9_]+)="(.*)"$/.exec(line.trim())
      if (match) values[match[1]] = match[2]
    }

    if (!values.API_URL || !values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
      cachedEnv = null
      return cachedEnv
    }

    cachedEnv = {
      apiUrl: values.API_URL,
      anonKey: values.ANON_KEY,
      serviceRoleKey: values.SERVICE_ROLE_KEY,
      jwtSecret: values.JWT_SECRET ?? "",
      dbUrl: values.DB_URL ?? "",
    }
    return cachedEnv
  } catch {
    cachedEnv = null
    return cachedEnv
  }
}

/** Vrai quand la base locale répond : sert de garde aux `describe.skipIf`. */
export function isLocalSupabaseAvailable(): boolean {
  return readLocalSupabaseEnv() !== null
}

export interface RestResponse<T = unknown> {
  status: number
  body: T
  raw: string
}

interface RestOptions {
  method?: string
  /** Jeton porté par l'en-tête Authorization ; par défaut la clé `apikey` fournie. */
  token?: string
  body?: unknown
  /** `return=representation` par défaut sur les écritures. */
  prefer?: string
}

/**
 * Appelle PostgREST en `node:http`. `key` détermine le rôle PostgreSQL
 * (clé anon → rôle `anon`, clé service role → `service_role`, JWT signé → `authenticated`).
 */
export function rest<T = unknown>(
  env: LocalSupabaseEnv,
  key: string,
  pathAndQuery: string,
  options: RestOptions = {}
): Promise<RestResponse<T>> {
  const url = new URL(`${env.apiUrl}/rest/v1${pathAndQuery}`)
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${options.token ?? key}`,
    Accept: "application/json",
  }
  if (payload) {
    headers["Content-Type"] = "application/json"
    headers["Content-Length"] = String(Buffer.byteLength(payload))
  }
  if (options.prefer) headers["Prefer"] = options.prefer

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? "GET",
        headers,
      },
      (res) => {
        let raw = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          raw += chunk
        })
        res.on("end", () => {
          let body: unknown = null
          if (raw) {
            try {
              body = JSON.parse(raw)
            } catch {
              body = raw
            }
          }
          resolve({ status: res.statusCode ?? 0, body: body as T, raw })
        })
      }
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

/**
 * Forge un JWT `authenticated` signé avec le secret local. Volontairement
 * indépendant des comptes de démo : le test de non-régression du verrouillage
 * RLS doit passer même sur une base fraîchement remise à zéro sans seeds.
 */
export function signAuthenticatedToken(env: LocalSupabaseEnv, subject = crypto.randomUUID()): string {
  const base64url = (input: Buffer | string) =>
    Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const now = Math.floor(Date.now() / 1000)
  const claims = base64url(
    JSON.stringify({
      aud: "authenticated",
      role: "authenticated",
      sub: subject,
      iat: now,
      exp: now + 3600,
    })
  )
  const signature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${header}.${claims}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  return `${header}.${claims}.${signature}`
}

/** Rejoue un fichier de migration avec psql. Retourne le code de sortie. */
export function runMigration(env: LocalSupabaseEnv, relativePath: string): { code: number; output: string } {
  try {
    const output = execFileSync(
      "psql",
      [env.dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(REPO_ROOT, relativePath)],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 }
    )
    return { code: 0, output }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string; message?: string }
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`,
    }
  }
}

/** Vrai si le binaire `psql` est installé (les tests de rejeu en dépendent). */
export function isPsqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore", timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Exécute du SQL avec psql (sortie brute, sans en-têtes). Réservé aux vérifications
 * que PostgREST ne sait pas exprimer : contraintes CHECK, index uniques partiels.
 * Encapsuler les écritures dans BEGIN … ROLLBACK pour ne rien laisser derrière soi.
 */
export function runSql(env: LocalSupabaseEnv, sql: string): { code: number; output: string } {
  try {
    // `-f -` plutôt que `-c` : avec `-c`, psql n'imprime que le résultat de la
    // DERNIÈRE instruction, ce qui rendrait invisible le SELECT d'une transaction
    // terminée par ROLLBACK.
    const output = execFileSync("psql", [env.dbUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-f", "-"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    })
    return { code: 0, output: output.trim() }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string; message?: string }
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`,
    }
  }
}
