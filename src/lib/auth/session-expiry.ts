/**
 * Détection de l'expiration de session côté client.
 *
 * Deux situations distinctes sont couvertes :
 *
 * 1. **Session quotidienne périmée** — le CRM impose une reconnexion par jour
 *    (cf. `middleware.ts`). Le contrôle serveur ne s'applique qu'aux navigations
 *    vers l'app : un onglet resté ouvert depuis la veille n'en est jamais averti.
 *    On rejoue donc le même calcul côté client, au réveil de l'onglet.
 *
 * 2. **Session indisponible** — `@supabase/auth-js` sérialise tout accès à la
 *    session derrière un Navigator Lock, et abandonne au bout de
 *    `lockAcquireTimeout` (10 s). Comme chaque requête PostgREST passe par
 *    `auth.getSession()` pour poser son header `Authorization`, un refresh de
 *    token qui traîne (il retente en backoff jusqu'à ~30 s) fait échouer toutes
 *    les requêtes en attente. Sans traitement, l'écran charge indéfiniment.
 *
 * Ce module ne contient que des fonctions pures : il est utilisable côté serveur
 * comme côté client, et testable sans DOM.
 */

/** Cookie posé à la connexion (cf. `app/(auth)/login/page.tsx`) et lu par le middleware. */
export const DAILY_SESSION_COOKIE = "crm_session_date"

export type SessionExpiryReason =
  /** Le cookie de session quotidienne est absent ou date d'un autre jour. */
  | "daily-expired"
  /** La session Supabase est inaccessible (timeout du lock auth, JWT expiré). */
  | "session-unavailable"

/**
 * Date du jour au format `YYYY-MM-DD`, en **UTC**.
 *
 * Le calcul doit rester identique à celui du middleware et de la page de login,
 * sans quoi le client et le serveur ne seraient pas d'accord sur le jour courant.
 */
export function getSessionDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Extrait la valeur du cookie de session quotidienne d'une chaîne `document.cookie`. */
export function readDailySessionDate(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== DAILY_SESSION_COOKIE) continue
    const value = part.slice(separator + 1).trim()
    return value === "" ? null : value
  }
  return null
}

/**
 * `true` si la session quotidienne est périmée : cookie absent, vide, ou portant
 * une autre date que le jour courant.
 */
export function isDailySessionExpired(cookieString: string, now: Date = new Date()): boolean {
  const sessionDate = readDailySessionDate(cookieString)
  if (!sessionDate) return true
  return sessionDate !== getSessionDateString(now)
}

/**
 * Message du `DOMException` levé par le Navigator Lock de `@supabase/auth-js`
 * lorsque l'acquisition dépasse `lockAcquireTimeout` : la lib appelle
 * `abortController.abort()` **sans argument**, d'où ce libellé par défaut.
 *
 * C'est exactement ce que voit l'utilisateur, remonté par la couche API sous la
 * forme « Erreur lors de la récupération des statuts: AbortError: signal is
 * aborted without reason ».
 */
const AUTH_LOCK_TIMEOUT_MARKER = "signal is aborted without reason"

/** Erreurs Supabase qui signifient toutes « la session n'est plus exploitable ». */
const SESSION_ERROR_MARKERS = [
  AUTH_LOCK_TIMEOUT_MARKER,
  "jwt expired",
  "invalid refresh token",
  "refresh token not found",
  "refresh_token_not_found",
]

/**
 * `true` si l'erreur traduit une session inaccessible ou expirée.
 *
 * La détection se fait sur le texte : l'erreur traverse PostgREST (qui la
 * re-sérialise en `{ message }`) puis la couche API (qui la préfixe de son
 * propre contexte), et perd au passage son type d'origine.
 *
 * Volontairement restrictif : un `AbortError` seul ne suffit pas, sinon les
 * annulations volontaires de requêtes (recherche d'adresse, compteurs de vues,
 * déconnexion) seraient prises pour des expirations de session.
 */
export function isSessionUnavailableError(error: unknown): boolean {
  if (!error) return false

  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : typeof (error as { message?: unknown }).message === "string"
          ? ((error as { message: string }).message)
          : ""

  if (!text) return false

  const normalized = text.toLowerCase()
  return SESSION_ERROR_MARKERS.some((marker) => normalized.includes(marker))
}

/**
 * Chemins qui n'exigent pas de session : le garde d'expiration doit y rester
 * muet, sans quoi la page de login se redirigerait vers elle-même.
 *
 * Aligné sur la liste `publicPaths` du middleware.
 */
const PUBLIC_PATHS = [
  "/login",
  "/landingpage",
  "/set-password",
  "/auth/callback",
  "/portail",
  "/reset",
]

/** `true` si le chemin est accessible sans session authentifiée. */
export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

/**
 * URL de reconnexion.
 *
 * `expired=daily` est déjà interprété par la page de login : elle purge la
 * session Supabase et affiche le message d'expiration. `redirect` ramène
 * l'utilisateur là où il travaillait.
 */
export function buildLoginUrl(pathname: string, search: string = ""): string {
  const params = new URLSearchParams()
  params.set("expired", "daily")

  const target = `${pathname}${search}`
  if (pathname && pathname !== "/" && !isPublicPath(pathname)) {
    params.set("redirect", target)
  }

  return `/login?${params.toString()}`
}
