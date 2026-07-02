/**
 * Bilan S1 — décision de visibilité PURE (sans I/O), testée unitairement.
 * Le rôle « dev » a toujours accès, quelle que soit la configuration.
 */

export const BILAN_S1_PAGE_KEY = "bilan-s1"

/** Rôles proposables dans le panneau (dev est implicite et verrouillé). */
export const GRANTABLE_ROLES = ["admin", "manager", "gestionnaire"] as const
export type GrantableRole = (typeof GRANTABLE_ROLES)[number]

/** Durée par défaut d'une ouverture temporaire (heures). */
export const DEFAULT_TEMP_HOURS = 4
export const MAX_TEMP_HOURS = 168 // 7 jours

export type PageVisibilityConfig = {
  allowedRoles: string[]
  allowedUserIds: string[]
  /** ISO ; null = permanent. Passé cette date, retour au dev-only. */
  expiresAt: string | null
  updatedAt: string | null
}

export const EMPTY_VISIBILITY: PageVisibilityConfig = {
  allowedRoles: [],
  allowedUserIds: [],
  expiresAt: null,
  updatedAt: null,
}

const normalizeRole = (role: string) => role.toLowerCase().trim()

export function isDevUser(roles: string[]): boolean {
  return roles.some((role) => normalizeRole(role) === "dev")
}

/** La configuration est-elle encore en vigueur (non expirée) ? */
export function isConfigActive(config: PageVisibilityConfig, nowMs: number): boolean {
  if (!config.expiresAt) return true
  const expires = Date.parse(config.expiresAt)
  return Number.isFinite(expires) && nowMs < expires
}

/**
 * L'utilisateur peut-il voir la page ?
 * - dev : toujours ;
 * - sinon : la config doit être active ET (rôle autorisé OU id autorisé).
 */
export function canViewBilan(
  user: { id: string; roles: string[] },
  config: PageVisibilityConfig,
  nowMs: number
): boolean {
  if (isDevUser(user.roles)) return true
  if (!isConfigActive(config, nowMs)) return false
  const allowedRoles = new Set(config.allowedRoles.map(normalizeRole))
  if (user.roles.some((role) => allowedRoles.has(normalizeRole(role)))) return true
  return config.allowedUserIds.includes(user.id)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valide et normalise une demande de modification de visibilité.
 * Retourne la config à écrire, ou une erreur lisible.
 */
export function sanitizeVisibilityRequest(
  body: { roles?: unknown; userIds?: unknown; temporary?: unknown; hours?: unknown },
  nowMs: number
): { ok: true; allowedRoles: GrantableRole[]; allowedUserIds: string[]; expiresAt: string | null } | { ok: false; error: string } {
  const rawRoles = Array.isArray(body.roles) ? body.roles : []
  const roles: GrantableRole[] = []
  for (const role of rawRoles) {
    if (typeof role !== "string") return { ok: false, error: "roles doit contenir des chaînes" }
    const normalized = normalizeRole(role)
    if (normalized === "dev") continue // dev est implicite
    if (!(GRANTABLE_ROLES as readonly string[]).includes(normalized)) {
      return { ok: false, error: `Rôle inconnu : ${role}` }
    }
    if (!roles.includes(normalized as GrantableRole)) roles.push(normalized as GrantableRole)
  }

  const rawUserIds = Array.isArray(body.userIds) ? body.userIds : []
  const userIds: string[] = []
  for (const id of rawUserIds) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return { ok: false, error: "userIds doit contenir des UUID valides" }
    }
    if (!userIds.includes(id)) userIds.push(id)
  }

  let expiresAt: string | null = null
  if (body.temporary === true) {
    const hours = typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : DEFAULT_TEMP_HOURS
    if (hours < 1 || hours > MAX_TEMP_HOURS) {
      return { ok: false, error: `La durée doit être comprise entre 1 et ${MAX_TEMP_HOURS} heures` }
    }
    expiresAt = new Date(nowMs + hours * 3_600_000).toISOString()
  }

  return { ok: true, allowedRoles: roles, allowedUserIds: userIds, expiresAt }
}
