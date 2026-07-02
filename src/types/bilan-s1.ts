/**
 * Types du dashboard « Bilan S1 » (page dev-only + route API /api/bilan-s1/metrics).
 */

export type BilanCounts = {
  actionsTotal: number
  actionsInterventions: number | null
  actionsArtisans: number | null
  interventionsCreees: number | null
  changementsStatut: number | null
  commentaires: number | null
  documents: number | null
  emails: number | null
}

export type BilanPerDay = { day: string; actions: number }
export type BilanPerUser = { user: string; actions: number }

export type BilanScreenTime = {
  totalHours: number
  perUser: { user: string; hours: number }[]
  events: number
}

export type BilanGitStats = {
  commits: number
  fixes: number
  feats: number
  files: number
  insertions: number
  deletions: number
  lastCommit: { date: string; subject: string } | null
}

export type BilanMetrics = {
  generatedAt: string
  windowStart: string
  windowEnd: string
  cappedAtFridayNoon: boolean
  counts: BilanCounts
  perDay: BilanPerDay[]
  perUser: BilanPerUser[]
  /** null tant que le calcul (coûteux, caché 5 min) n'est pas prêt. */
  screen: BilanScreenTime | null
  git: BilanGitStats | null
  /** 'live' = git local (dev), 'snapshot' = relevé figé (prod Vercel sans git). */
  gitSource: "live" | "snapshot"
  errors: string[]
}
