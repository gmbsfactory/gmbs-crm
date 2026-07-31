import { describe, it, expect } from 'vitest'
import {
  DAILY_SESSION_COOKIE,
  buildLoginUrl,
  getSessionDateString,
  isDailySessionExpired,
  isPublicPath,
  isSessionUnavailableError,
  readDailySessionDate,
} from '@/lib/auth/session-expiry'

describe('session-expiry', () => {
  describe('getSessionDateString', () => {
    it('should return the UTC day, matching the middleware calculation', () => {
      expect(getSessionDateString(new Date('2026-07-31T09:23:00Z'))).toBe('2026-07-31')
    })

    it('should follow UTC, not local time, near midnight', () => {
      // 00h30 à Paris en été = 22h30 UTC la veille : le jour UTC est encore le 30.
      expect(getSessionDateString(new Date('2026-07-30T22:30:00Z'))).toBe('2026-07-30')
    })
  })

  describe('readDailySessionDate', () => {
    it('should extract the cookie value among others', () => {
      const cookies = `theme=dark; ${DAILY_SESSION_COOKIE}=2026-07-31; sb-token=abc`
      expect(readDailySessionDate(cookies)).toBe('2026-07-31')
    })

    it('should return null when the cookie is absent', () => {
      expect(readDailySessionDate('theme=dark; sb-token=abc')).toBeNull()
    })

    it('should return null on an empty cookie string', () => {
      expect(readDailySessionDate('')).toBeNull()
    })

    it('should return null when the cookie has an empty value', () => {
      expect(readDailySessionDate(`${DAILY_SESSION_COOKIE}=`)).toBeNull()
    })

    it('should not match a cookie whose name merely ends with the key', () => {
      expect(readDailySessionDate(`old_${DAILY_SESSION_COOKIE}=2026-07-30`)).toBeNull()
    })
  })

  describe('isDailySessionExpired', () => {
    const now = new Date('2026-07-31T07:23:00Z')

    it('should return false when the cookie carries the current UTC day', () => {
      expect(isDailySessionExpired(`${DAILY_SESSION_COOKIE}=2026-07-31`, now)).toBe(false)
    })

    it('should return true for a session opened the day before', () => {
      // Le scénario du 31/07 : onglet laissé ouvert la nuit, cookie de la veille.
      expect(isDailySessionExpired(`${DAILY_SESSION_COOKIE}=2026-07-30`, now)).toBe(true)
    })

    it('should return true when the cookie is missing', () => {
      expect(isDailySessionExpired('theme=dark', now)).toBe(true)
    })
  })

  describe('isSessionUnavailableError', () => {
    it('should detect the auth lock timeout as surfaced by the API layer', () => {
      const error = new Error(
        'Erreur lors de la récupération des statuts: AbortError: signal is aborted without reason'
      )
      expect(isSessionUnavailableError(error)).toBe(true)
    })

    it('should detect the raw DOMException shape', () => {
      const error = new Error('signal is aborted without reason')
      error.name = 'AbortError'
      expect(isSessionUnavailableError(error)).toBe(true)
    })

    it('should detect an expired JWT', () => {
      expect(isSessionUnavailableError({ message: 'JWT expired' })).toBe(true)
    })

    it('should detect an invalid refresh token', () => {
      expect(isSessionUnavailableError({ message: 'Invalid Refresh Token: Already Used' })).toBe(true)
    })

    it('should ignore a deliberate request cancellation', () => {
      // Recherche d'adresse, compteurs de vues, déconnexion : ces abandons sont
      // volontaires et ne doivent pas passer pour une session expirée.
      const error = new Error('The user aborted a request.')
      error.name = 'AbortError'
      expect(isSessionUnavailableError(error)).toBe(false)
    })

    it('should ignore the logout cancellation reason', () => {
      expect(isSessionUnavailableError(new Error('Logout initiated'))).toBe(false)
    })

    it('should ignore an ordinary error', () => {
      expect(isSessionUnavailableError(new Error('Network request failed'))).toBe(false)
    })

    it('should ignore null and undefined', () => {
      expect(isSessionUnavailableError(null)).toBe(false)
      expect(isSessionUnavailableError(undefined)).toBe(false)
    })
  })

  describe('isPublicPath', () => {
    it('should recognise the login page', () => {
      expect(isPublicPath('/login')).toBe(true)
    })

    it('should recognise the artisan portal', () => {
      expect(isPublicPath('/portail/abc123')).toBe(true)
    })

    it('should reject an authenticated route', () => {
      expect(isPublicPath('/interventions')).toBe(false)
    })

    it('should reject null', () => {
      expect(isPublicPath(null)).toBe(false)
    })
  })

  describe('buildLoginUrl', () => {
    it('should carry the daily expiry flag understood by the login page', () => {
      expect(buildLoginUrl('/interventions')).toContain('expired=daily')
    })

    it('should preserve the current page and its query string', () => {
      const url = buildLoginUrl('/interventions', '?view=market')
      expect(url).toContain('redirect=%2Finterventions%3Fview%3Dmarket')
    })

    it('should not redirect back to a public path', () => {
      expect(buildLoginUrl('/login')).not.toContain('redirect=')
    })

    it('should not redirect back to the root', () => {
      expect(buildLoginUrl('/')).not.toContain('redirect=')
    })
  })
})
