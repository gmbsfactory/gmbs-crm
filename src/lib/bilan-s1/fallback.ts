import { GIT_SNAPSHOT } from "@/lib/bilan-s1/constants"
import type { BilanMetrics } from "@/types/bilan-s1"

/**
 * Instantané du jeu 02/07 ~01h20 (Paris) : affiché avec un badge « hors
 * ligne » si la route métriques est injoignable, pour que la page reste
 * présentable en réunion quoi qu'il arrive.
 */
export const FALLBACK_METRICS: BilanMetrics = {
  generatedAt: "2026-07-02T01:24:00+02:00",
  windowStart: "2026-06-28T22:00:00.000Z",
  windowEnd: "2026-07-01T23:24:00.000Z",
  cappedAtFridayNoon: false,
  counts: {
    actionsTotal: 2511,
    actionsInterventions: 2466,
    actionsArtisans: 45,
    interventionsCreees: 171,
    changementsStatut: 420,
    commentaires: 293,
    documents: 159,
    emails: 44,
  },
  perDay: [
    { day: "lun 29/06", actions: 1079 },
    { day: "mar 30/06", actions: 800 },
    { day: "mer 01/07", actions: 617 },
    { day: "jeu 02/07", actions: 15 },
    { day: "ven 03/07", actions: 0 },
  ],
  perUser: [
    { user: "Tim D", actions: 411 },
    { user: "Adam I", actions: 391 },
    { user: "Clément C", actions: 362 },
    { user: "Yazid A", actions: 322 },
    { user: "Andréa G", actions: 277 },
    { user: "Soufian B", actions: 184 },
    { user: "Badr B", actions: 162 },
    { user: "Dimitri M", actions: 161 },
    { user: "Metehan K", actions: 160 },
    { user: "André B", actions: 48 },
    { user: "Fahim B", actions: 33 },
  ],
  screen: {
    totalHours: 55.6,
    events: 31118,
    perUser: [
      { user: "Tim D", hours: 6.8 },
      { user: "Adam I", hours: 6.4 },
      { user: "Yazid A", hours: 6.0 },
      { user: "Clément C", hours: 5.9 },
      { user: "Metehan K", hours: 5.7 },
      { user: "Andréa G", hours: 4.8 },
      { user: "Badr B", hours: 4.6 },
      { user: "Fahim B", hours: 4.3 },
      { user: "Soufian B", hours: 4.1 },
      { user: "André B", hours: 3.3 },
      { user: "Dimitri M", hours: 2.8 },
    ],
  },
  git: { ...GIT_SNAPSHOT, lastCommit: { ...GIT_SNAPSHOT.lastCommit } },
  gitSource: "snapshot",
  errors: [],
}

export const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("fr-FR")

export const frDecimal = (n: number): string => String(n).replace(".", ",")
