/**
 * Calcul du temps d'écran « actif » à partir d'un JOURNAL D'ÉVÉNEMENTS
 * horodaté serveur (architecture cible — précise et auditable).
 *
 * Ce module est la SOURCE DE VÉRITÉ de l'algorithme : la fonction SQL
 * `monitoring_active_intervals` (migration 99034) en est la transcription
 * exacte. Les tests de ce module documentent le comportement attendu côté
 * serveur (cf. CLAUDE.md : calcul métier critique, 100 %).
 *
 * Principe (bornage par heartbeat) :
 * - Le client n'émet QUE des événements (jamais de durée).
 * - Tant qu'il est réellement actif, il émet un `heartbeat` régulier (preuve
 *   de vie). Sur les transitions, il émet `page` / `idle` / `hidden` / etc.
 * - Le serveur parcourt les événements d'une même session ordonnés par
 *   `occurred_at` et crédite, pour chaque marqueur ACTIF, l'écart jusqu'à
 *   l'événement suivant — plafonné à `MAX_ACTIVE_GAP_MS`.
 *
 * Conséquences automatiques :
 * - Veille / sommeil / crash → pas de heartbeat → l'écart dépasse MAX_GAP →
 *   on ne crédite qu'un MAX_GAP (≤ ~90 s), jamais des heures fantômes.
 * - Période d'inactivité (après un marqueur `idle`/`hidden`/`blur`) → non
 *   créditée (un marqueur d'arrêt ne crédite pas l'écart qui le suit).
 * - Reconnexions → nouveau `sessionId`, calculées et visibles.
 */

/** Intervalle max crédité pour un seul marqueur actif (borne anti-veille/crash). */
export const MAX_ACTIVE_GAP_MS = 90_000 // 1,5 × le heartbeat client (60 s)

export type ActivityEventKind =
  | 'connect'
  | 'heartbeat'
  | 'page'
  | 'idle'
  | 'hidden'
  | 'visible'
  | 'focus'
  | 'blur'
  | 'disconnect'

/** Marqueurs « actifs » : l'écart qui les suit est crédité (borné). */
const ACTIVE_KINDS: ReadonlySet<ActivityEventKind> = new Set<ActivityEventKind>([
  'connect',
  'heartbeat',
  'page',
  'visible',
  'focus',
])

export interface ActivityEvent {
  sessionId: string
  kind: ActivityEventKind
  pageName: string | null
  interventionId: string | null
  /** Horodatage SERVEUR (epoch ms). */
  occurredAtMs: number
}

export interface ActiveInterval {
  pageName: string | null
  interventionId: string | null
  startMs: number
  endMs: number
  durationMs: number
}

/**
 * Convertit un flux d'événements en intervalles actifs crédités.
 * Chaque session est traitée indépendamment (tri par `occurredAtMs`).
 */
export function computeActiveIntervals(
  events: ActivityEvent[],
  maxGapMs: number = MAX_ACTIVE_GAP_MS
): ActiveInterval[] {
  // Regrouper par session
  const bySession = new Map<string, ActivityEvent[]>()
  for (const e of events) {
    const arr = bySession.get(e.sessionId)
    if (arr) arr.push(e)
    else bySession.set(e.sessionId, [e])
  }

  const intervals: ActiveInterval[] = []

  for (const sessionEvents of bySession.values()) {
    // Tri stable par horodatage serveur
    const ordered = [...sessionEvents].sort((a, b) => a.occurredAtMs - b.occurredAtMs)

    for (let i = 0; i < ordered.length - 1; i++) {
      const cur = ordered[i]
      const next = ordered[i + 1]

      // Seuls les marqueurs actifs créditent l'écart qui les suit
      if (!ACTIVE_KINDS.has(cur.kind)) continue

      const gap = next.occurredAtMs - cur.occurredAtMs
      if (gap <= 0) continue // ignore les égalités / désordres résiduels

      const durationMs = Math.min(gap, maxGapMs)
      intervals.push({
        pageName: cur.pageName,
        interventionId: cur.interventionId,
        startMs: cur.occurredAtMs,
        endMs: cur.occurredAtMs + durationMs,
        durationMs,
      })
    }
  }

  return intervals
}

/** Temps actif total (ms) sur un ensemble d'intervalles. */
export function totalActiveMs(intervals: ActiveInterval[]): number {
  return intervals.reduce((sum, i) => sum + i.durationMs, 0)
}

/** Temps actif agrégé par page (ms), trié décroissant. */
export function activeMsByPage(
  intervals: ActiveInterval[]
): Array<{ pageName: string | null; durationMs: number }> {
  const byPage = new Map<string | null, number>()
  for (const i of intervals) {
    byPage.set(i.pageName, (byPage.get(i.pageName) ?? 0) + i.durationMs)
  }
  return Array.from(byPage.entries())
    .map(([pageName, durationMs]) => ({ pageName, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
}
