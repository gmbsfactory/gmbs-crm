import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportSessionError } from '@/lib/auth/report-session-error'
import { useSessionExpiry } from '@/stores/sessionExpiry'
import { DAILY_SESSION_COOKIE } from '@/lib/auth/session-expiry'

function setCookieDay(day: string | null) {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => (day === null ? '' : `${DAILY_SESSION_COOKIE}=${day}`),
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** L'erreur telle qu'elle remonte réellement de la couche API. */
const LOCK_TIMEOUT_ERROR = new Error(
  'Erreur lors de la récupération des statuts: AbortError: signal is aborted without reason'
)

describe('reportSessionError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionExpiry.getState().clear()
    setCookieDay(today())
  })

  it('should raise "daily-expired" when the session dates from another day', () => {
    setCookieDay('2026-07-30')

    expect(reportSessionError(LOCK_TIMEOUT_ERROR)).toBe(true)
    expect(useSessionExpiry.getState().reason).toBe('daily-expired')
  })

  it('should raise "session-unavailable" once a second failure confirms it', () => {
    // Lock auth saturé en pleine journée : un rechargement suffit, pas besoin
    // de renvoyer l'utilisateur sur le portail.
    expect(reportSessionError(LOCK_TIMEOUT_ERROR)).toBe(true)
    expect(reportSessionError(LOCK_TIMEOUT_ERROR)).toBe(true)
    expect(useSessionExpiry.getState().reason).toBe('session-unavailable')
  })

  it('should not hide the interface on a single isolated timeout', () => {
    // Une requête de fond qui bute seule sur un lock saturé ne doit pas faire
    // disparaître l'écran d'un utilisateur en train de travailler.
    expect(reportSessionError(LOCK_TIMEOUT_ERROR)).toBe(true)
    expect(useSessionExpiry.getState().reason).toBeNull()
  })

  it('should leave the state untouched for an ordinary error', () => {
    expect(reportSessionError(new Error('Network request failed'))).toBe(false)
    expect(useSessionExpiry.getState().reason).toBeNull()
  })

  it('should leave the state untouched for a deliberate cancellation', () => {
    const aborted = new Error('The user aborted a request.')
    aborted.name = 'AbortError'

    expect(reportSessionError(aborted)).toBe(false)
    expect(useSessionExpiry.getState().reason).toBeNull()
  })

  it('should keep the first reason when a burst of requests fails', () => {
    // Le référentiel lance 6 requêtes en parallèle : elles échouent toutes
    // ensemble et ne doivent pas faire osciller l'écran affiché.
    setCookieDay('2026-07-30')
    reportSessionError(LOCK_TIMEOUT_ERROR)

    setCookieDay(today())
    reportSessionError(LOCK_TIMEOUT_ERROR)

    expect(useSessionExpiry.getState().reason).toBe('daily-expired')
  })

  it('should recognise an expired JWT', () => {
    expect(reportSessionError({ message: 'JWT expired' })).toBe(true)
    expect(reportSessionError({ message: 'JWT expired' })).toBe(true)
    expect(useSessionExpiry.getState().reason).toBe('session-unavailable')
  })

  it('should switch immediately when the day has changed, without waiting for a second failure', () => {
    // Le cookie fait foi : la reconnexion est certaine, inutile de temporiser.
    setCookieDay('2026-07-30')

    reportSessionError(LOCK_TIMEOUT_ERROR)

    expect(useSessionExpiry.getState().reason).toBe('daily-expired')
  })
})
