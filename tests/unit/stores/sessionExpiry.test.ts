import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionExpiry } from '@/stores/sessionExpiry'

describe('sessionExpiry store', () => {
  beforeEach(() => {
    useSessionExpiry.getState().clear()
  })

  describe('raise', () => {
    it('should switch immediately on a daily expiry', () => {
      useSessionExpiry.getState().raise('daily-expired')

      expect(useSessionExpiry.getState().reason).toBe('daily-expired')
    })

    it('should require a second failure for an unavailable session', () => {
      const { raise } = useSessionExpiry.getState()

      raise('session-unavailable', 1_000)
      expect(useSessionExpiry.getState().reason).toBeNull()

      raise('session-unavailable', 2_000)
      expect(useSessionExpiry.getState().reason).toBe('session-unavailable')
    })

    it('should not accumulate failures spread beyond the window', () => {
      const { raise } = useSessionExpiry.getState()

      raise('session-unavailable', 0)
      // Plus de 30 s plus tard : incident distinct, le compteur repart de zéro.
      raise('session-unavailable', 60_000)

      expect(useSessionExpiry.getState().reason).toBeNull()
    })

    it('should keep the first reason once raised', () => {
      const { raise } = useSessionExpiry.getState()

      raise('daily-expired')
      raise('session-unavailable')
      raise('session-unavailable')

      expect(useSessionExpiry.getState().reason).toBe('daily-expired')
    })

    it('should let a daily expiry cut through a pending unavailable count', () => {
      const { raise } = useSessionExpiry.getState()

      raise('session-unavailable', 1_000)
      raise('daily-expired', 1_100)

      expect(useSessionExpiry.getState().reason).toBe('daily-expired')
    })
  })

  describe('clear', () => {
    it('should reset the reason', () => {
      useSessionExpiry.getState().raise('daily-expired')
      useSessionExpiry.getState().clear()

      expect(useSessionExpiry.getState().reason).toBeNull()
    })

    it('should reset the pending failure count', () => {
      const { raise, clear } = useSessionExpiry.getState()

      raise('session-unavailable', 1_000)
      clear()
      raise('session-unavailable', 2_000)

      // Le compteur est reparti de zéro : un seul échec depuis le clear.
      expect(useSessionExpiry.getState().reason).toBeNull()
    })
  })
})
