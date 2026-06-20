import { describe, it, expect } from 'vitest'
import {
  computeActiveIntervals,
  totalActiveMs,
  activeMsByPage,
  MAX_ACTIVE_GAP_MS,
  type ActivityEvent,
} from '@/lib/monitoring/active-time'

const T0 = 1_700_000_000_000
const S = 1000
const MIN = 60_000

/** Fabrique un événement (session 's1' par défaut). */
function ev(
  offsetMs: number,
  kind: ActivityEvent['kind'],
  page: string | null = 'dashboard',
  opts: { sessionId?: string; interventionId?: string | null } = {}
): ActivityEvent {
  return {
    sessionId: opts.sessionId ?? 's1',
    kind,
    pageName: page,
    interventionId: opts.interventionId ?? null,
    occurredAtMs: T0 + offsetMs,
  }
}

describe('active-time', () => {
  describe('computeActiveIntervals', () => {
    it('crédite des heartbeats continus (chaque écart ≤ MAX_GAP)', () => {
      // Arrange — battements à 0/60/120/180s
      const events = [
        ev(0, 'connect'),
        ev(60 * S, 'heartbeat'),
        ev(120 * S, 'heartbeat'),
        ev(180 * S, 'heartbeat'),
      ]

      // Act
      const total = totalActiveMs(computeActiveIntervals(events))

      // Assert — 3 écarts de 60s = 180s (le dernier heartbeat ne crédite rien)
      expect(total).toBe(180 * S)
    })

    it('exclut la veille / le sommeil (gros écart → plafonné à MAX_GAP)', () => {
      // Arrange — actif puis 8h sans heartbeat, reconnexion
      const events = [
        ev(0, 'heartbeat'),
        ev(8 * 60 * MIN, 'connect'), // réveil 8h plus tard
        ev(8 * 60 * MIN + 60 * S, 'heartbeat'),
      ]

      // Act
      const intervals = computeActiveIntervals(events)
      const total = totalActiveMs(intervals)

      // Assert — l'écart de 8h est plafonné à MAX_GAP, pas 8h
      expect(total).toBe(MAX_ACTIVE_GAP_MS + 60 * S)
    })

    it('ne crédite pas la période d\'inactivité après un marqueur idle', () => {
      // Arrange — actif, idle, longue absence, retour actif
      const events = [
        ev(0, 'heartbeat'),
        ev(60 * S, 'heartbeat'),
        ev(120 * S, 'idle'), // STOP : l'écart suivant n'est pas crédité
        ev(600 * S, 'visible'), // retour 8 min plus tard
        ev(660 * S, 'heartbeat'),
      ]

      // Act
      const total = totalActiveMs(computeActiveIntervals(events))

      // Assert — 60 (0→60) + 60 (60→120) + 0 (idle) + 60 (visible→hb) = 180s
      expect(total).toBe(180 * S)
    })

    it('attribue le temps à la bonne page lors d\'un changement de page', () => {
      // Arrange — pageA puis bascule pageB
      const events = [
        ev(0, 'heartbeat', 'dashboard'),
        ev(30 * S, 'page', 'interventions'),
        ev(90 * S, 'heartbeat', 'interventions'),
      ]

      // Act
      const byPage = activeMsByPage(computeActiveIntervals(events))

      // Assert — [0,30) sur dashboard, [30,90) sur interventions
      expect(byPage).toEqual([
        { pageName: 'interventions', durationMs: 60 * S },
        { pageName: 'dashboard', durationMs: 30 * S },
      ])
    })

    it('attribue le temps à l\'intervention ouverte', () => {
      // Arrange — heartbeat avec intervention active
      const events = [
        ev(0, 'page', 'interventions', { interventionId: 'inter-42' }),
        ev(60 * S, 'heartbeat', 'interventions', { interventionId: 'inter-42' }),
        ev(120 * S, 'heartbeat', 'interventions', { interventionId: null }),
      ]

      // Act
      const intervals = computeActiveIntervals(events)

      // Assert — les 2 premiers intervalles portent l'intervention
      expect(intervals[0].interventionId).toBe('inter-42')
      expect(intervals[1].interventionId).toBe('inter-42')
      expect(intervals.find((i) => i.interventionId === null)).toBeUndefined()
    })

    it('traite les sessions indépendamment (reconnexion = nouveau session_id)', () => {
      // Arrange — deux sessions distinctes
      const events = [
        ev(0, 'connect', 'dashboard', { sessionId: 'sA' }),
        ev(60 * S, 'heartbeat', 'dashboard', { sessionId: 'sA' }),
        ev(0, 'connect', 'dashboard', { sessionId: 'sB' }),
        ev(60 * S, 'heartbeat', 'dashboard', { sessionId: 'sB' }),
      ]

      // Act
      const total = totalActiveMs(computeActiveIntervals(events))

      // Assert — 60s par session = 120s
      expect(total).toBe(120 * S)
    })

    it('ignore les marqueurs d\'arrêt en tête et les écarts nuls', () => {
      const events = [
        ev(0, 'disconnect'), // stop : ne crédite rien
        ev(0, 'connect'), // même instant → écart nul avec le suivant
        ev(0, 'heartbeat'),
        ev(60 * S, 'heartbeat'),
      ]
      // Seul l'écart 0→60 (du connect/heartbeat à T0) compte une fois : 60s
      expect(totalActiveMs(computeActiveIntervals(events))).toBe(60 * S)
    })

    it('retourne un tableau vide sans événement', () => {
      expect(computeActiveIntervals([])).toEqual([])
    })
  })
})
