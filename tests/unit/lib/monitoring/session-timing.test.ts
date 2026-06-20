import { describe, it, expect } from 'vitest'
import {
  computeSessionEndMs,
  computeDurationMs,
  isStaleGap,
  type SessionEndReason,
} from '@/lib/monitoring/session-timing'

const IDLE = 5 * 60 * 1000 // 5 min
const T0 = 1_700_000_000_000 // base epoch ms

describe('session-timing', () => {
  describe('computeSessionEndMs', () => {
    describe('clôtures inactives (idle / blur / stale) — borne à la dernière activité', () => {
      const inactiveReasons: SessionEndReason[] = ['idle', 'blur', 'stale']

      it.each(inactiveReasons)(
        'should credit only up to lastActive when reason is "%s" (retire la fenêtre d\'inactivité)',
        (reason) => {
          // Arrange — l'utilisateur a été actif il y a 5 min, idle détecté maintenant
          const lastActiveMs = T0
          const nowMs = T0 + IDLE

          // Act
          const end = computeSessionEndMs({ reason, nowMs, lastActiveMs, idleTimeoutMs: IDLE })

          // Assert — la fin = dernière activité, PAS "now" (les 5 min sont retirées)
          expect(end).toBe(lastActiveMs)
        }
      )

      it('should exclude OS sleep entirely (gros saut d\'horloge)', () => {
        // Arrange — actif à T0, machine en veille 8h, réveil + idle
        const lastActiveMs = T0
        const nowMs = T0 + 8 * 60 * 60 * 1000

        // Act
        const end = computeSessionEndMs({ reason: 'idle', nowMs, lastActiveMs, idleTimeoutMs: IDLE })

        // Assert — on ne crédite rien du sommeil
        expect(end).toBe(lastActiveMs)
      })

      it('should never exceed now even if lastActive is in the future (garde-fou horloge)', () => {
        // Arrange — lastActive aberrant (postérieur à now)
        const lastActiveMs = T0 + 10_000
        const nowMs = T0

        // Act
        const end = computeSessionEndMs({ reason: 'blur', nowMs, lastActiveMs, idleTimeoutMs: IDLE })

        // Assert
        expect(end).toBe(nowMs)
      })
    })

    describe('clôtures actives (page / unload / flush) — instant présent plafonné', () => {
      const activeReasons: SessionEndReason[] = ['page', 'unload', 'flush']

      it.each(activeReasons)(
        'should credit now when active and recent for reason "%s"',
        (reason) => {
          // Arrange — activité il y a 2s, clôture active
          const lastActiveMs = T0
          const nowMs = T0 + 2_000

          // Act
          const end = computeSessionEndMs({ reason, nowMs, lastActiveMs, idleTimeoutMs: IDLE })

          // Assert — on crédite l'instant présent
          expect(end).toBe(nowMs)
        }
      )

      it('should cap at lastActive + idleTimeout on a clock jump (neutralise la veille)', () => {
        // Arrange — flush qui tombe au réveil, 8h après la dernière activité
        const lastActiveMs = T0
        const nowMs = T0 + 8 * 60 * 60 * 1000

        // Act
        const end = computeSessionEndMs({ reason: 'flush', nowMs, lastActiveMs, idleTimeoutMs: IDLE })

        // Assert — plafonné, on ne crédite jamais 8h
        expect(end).toBe(lastActiveMs + IDLE)
      })
    })
  })

  describe('computeDurationMs', () => {
    it('should return the positive delta', () => {
      expect(computeDurationMs(T0, T0 + 90_000)).toBe(90_000)
    })

    it('should clamp negative durations to 0 (fin avant début)', () => {
      expect(computeDurationMs(T0 + 5_000, T0)).toBe(0)
    })

    it('should return 0 for a zero-length session', () => {
      expect(computeDurationMs(T0, T0)).toBe(0)
    })

    it('should round to an integer (colonne integer)', () => {
      expect(computeDurationMs(T0, T0 + 1234.6)).toBe(1235)
    })
  })

  describe('isStaleGap', () => {
    it('should be false when active recently', () => {
      expect(isStaleGap({ nowMs: T0 + 60_000, lastActiveMs: T0, idleTimeoutMs: IDLE })).toBe(false)
    })

    it('should be false exactly at the threshold (strict)', () => {
      expect(isStaleGap({ nowMs: T0 + IDLE, lastActiveMs: T0, idleTimeoutMs: IDLE })).toBe(false)
    })

    it('should be true past the threshold (réveil de veille)', () => {
      expect(isStaleGap({ nowMs: T0 + IDLE + 1, lastActiveMs: T0, idleTimeoutMs: IDLE })).toBe(true)
    })
  })

  describe('scénario bout-en-bout — temps d\'écran réel', () => {
    it('compte le travail réel et exclut une pause non détectée', () => {
      // Arrange — session démarrée à T0, vraie dernière activité à T0+20min,
      // puis l'utilisateur s'absente ; idle détecté à T0+25min.
      const startMs = T0
      const lastActiveMs = T0 + 20 * 60 * 1000
      const idleDetectedAt = lastActiveMs + IDLE

      // Act
      const end = computeSessionEndMs({
        reason: 'idle',
        nowMs: idleDetectedAt,
        lastActiveMs,
        idleTimeoutMs: IDLE,
      })
      const duration = computeDurationMs(startMs, end)

      // Assert — 20 min créditées, pas 25
      expect(duration).toBe(20 * 60 * 1000)
    })
  })
})
