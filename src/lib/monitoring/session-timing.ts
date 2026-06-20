/**
 * Calcul des durées de sessions de présence (« temps d'écran »).
 *
 * Logique extraite de `useActivityTracker` pour être testable à 100 %
 * (calcul métier critique, cf. CLAUDE.md).
 *
 * Principe : une session ne crédite QUE du temps réellement actif. On ne compte
 * jamais :
 *  - la fenêtre d'inactivité qui précède la bascule en veille (le seuil idle) ;
 *  - le temps pendant lequel la machine était en veille/sommeil (saut d'horloge) ;
 *  - le temps où la fenêtre n'était pas au premier plan.
 *
 * La borne de fin créditée dépend de la RAISON de clôture (cf. `SessionEndReason`).
 */

/** Raison de clôture d'une session — détermine la borne de fin créditée. */
export type SessionEndReason =
  /** Bascule en inactivité (souris immobile au-delà du seuil / onglet caché). */
  | 'idle'
  /** Fenêtre passée en arrière-plan (perte de focus → autre fenêtre/app). */
  | 'blur'
  /** Saut d'horloge détecté (réveil de veille) — auto-heal du flush. */
  | 'stale'
  /** Changement de page / d'intervention pendant que l'utilisateur est actif. */
  | 'page'
  /** Fermeture de l'onglet (beforeunload) ou démontage. */
  | 'unload'
  /** Rafraîchissement périodique pendant l'activité. */
  | 'flush'

/** Une clôture « inactive » borne la fin au dernier moment d'activité réelle. */
const INACTIVE_REASONS: ReadonlySet<SessionEndReason> = new Set<SessionEndReason>([
  'idle',
  'blur',
  'stale',
])

/**
 * Horodatage de fin (ms epoch) à créditer pour une session.
 *
 * - Clôture « inactive » (idle / blur / stale) : on borne au dernier moment
 *   d'activité réelle (`lastActiveMs`). Tout ce qui suit n'était pas du temps
 *   actif (inactivité, veille, fenêtre en arrière-plan).
 * - Clôture « active » (page / unload / flush) : on prend l'instant présent,
 *   MAIS plafonné à `lastActiveMs + idleTimeoutMs` pour neutraliser un saut
 *   d'horloge (veille) : au-delà du seuil idle, l'utilisateur est par définition
 *   déjà inactif, donc on ne crédite pas au-delà.
 *
 * Dans les deux cas la borne ne dépasse jamais l'instant présent (`nowMs`).
 */
export function computeSessionEndMs(params: {
  reason: SessionEndReason
  nowMs: number
  lastActiveMs: number
  idleTimeoutMs: number
}): number {
  const { reason, nowMs, lastActiveMs, idleTimeoutMs } = params

  if (INACTIVE_REASONS.has(reason)) {
    // Ne créditer que jusqu'à la dernière activité réelle (garde-fou : <= now).
    return Math.min(lastActiveMs, nowMs)
  }

  // Clôture active : instant présent, plafonné contre les sauts d'horloge.
  return Math.min(nowMs, lastActiveMs + idleTimeoutMs)
}

/** Durée créditée (ms entier), jamais négative. */
export function computeDurationMs(startMs: number, endMs: number): number {
  return Math.max(0, Math.round(endMs - startMs))
}

/**
 * Détecte un « trou » d'inactivité non capturé (typiquement un réveil de veille
 * ou une fenêtre laissée immobile) : l'écart entre maintenant et la dernière
 * activité dépasse le seuil idle alors que la session est encore ouverte.
 * Sert d'auto-heal au flush périodique.
 */
export function isStaleGap(params: {
  nowMs: number
  lastActiveMs: number
  idleTimeoutMs: number
}): boolean {
  const { nowMs, lastActiveMs, idleTimeoutMs } = params
  return nowMs - lastActiveMs > idleTimeoutMs
}
