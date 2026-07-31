import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { DAILY_SESSION_COOKIE } from '@/lib/auth/session-expiry'

const mockPathname = vi.hoisted(() => ({ current: '/interventions' }))

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
}))

import { useDailySessionGuard } from '@/hooks/useDailySessionGuard'

/** Remplace window.location par un double dont on observe les navigations. */
function stubLocation(pathname = '/interventions', search = '') {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, search, assign, href: `https://crm.test${pathname}${search}` },
  })
  return assign
}

function setCookie(value: string | null) {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => (value === null ? '' : `${DAILY_SESSION_COOKIE}=${value}`),
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function yesterday() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

describe('useDailySessionGuard', () => {
  let assign: ReturnType<typeof stubLocation>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.current = '/interventions'
    assign = stubLocation()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not redirect when the daily session matches today', () => {
    setCookie(today())

    renderHook(() => useDailySessionGuard())

    expect(assign).not.toHaveBeenCalled()
  })

  it('should redirect to the login portal when the session dates from the previous day', () => {
    // Le scénario du 31/07 : onglet laissé ouvert la nuit.
    setCookie(yesterday())

    renderHook(() => useDailySessionGuard())

    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('expired=daily'))
  })

  it('should preserve the current page as redirect target', () => {
    setCookie(yesterday())
    assign = stubLocation('/interventions', '?view=market')

    renderHook(() => useDailySessionGuard())

    expect(assign).toHaveBeenCalledWith(expect.stringContaining('redirect='))
  })

  it('should redirect when the cookie is missing entirely', () => {
    setCookie(null)

    renderHook(() => useDailySessionGuard())

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('should stay silent on public paths', () => {
    // La page de login ne doit pas se rediriger vers elle-même.
    mockPathname.current = '/login'
    setCookie(yesterday())

    renderHook(() => useDailySessionGuard())

    expect(assign).not.toHaveBeenCalled()
  })

  it('should redirect when the tab becomes visible again with a stale session', () => {
    setCookie(today())
    renderHook(() => useDailySessionGuard())
    expect(assign).not.toHaveBeenCalled()

    // La nuit passe : le cookie porte désormais une date révolue.
    setCookie(yesterday())
    document.dispatchEvent(new Event('visibilitychange'))

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('should redirect only once even if several wake signals fire', () => {
    setCookie(yesterday())

    renderHook(() => useDailySessionGuard())
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('should catch the day rolling over while the tab stays visible', () => {
    vi.useFakeTimers()
    setCookie(today())

    renderHook(() => useDailySessionGuard())
    expect(assign).not.toHaveBeenCalled()

    // Minuit UTC passe (2 h du matin à Paris en été) sur un écran resté affiché.
    setCookie(yesterday())
    vi.advanceTimersByTime(60 * 1000)

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('should stop listening after unmount', () => {
    setCookie(today())
    const { unmount } = renderHook(() => useDailySessionGuard())

    unmount()
    setCookie(yesterday())
    document.dispatchEvent(new Event('visibilitychange'))

    expect(assign).not.toHaveBeenCalled()
  })
})
