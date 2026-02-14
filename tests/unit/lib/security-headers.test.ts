import { describe, it, expect } from 'vitest'

/**
 * SEC-004 – Verify that next.config.mjs exposes the 7 required
 * security headers on every route via the `/(.*) source pattern.
 *
 * We dynamically import the ESM config, call `headers()`, and
 * assert each header key/value individually.
 */

interface HeaderEntry {
  key: string
  value: string
}

interface HeaderGroup {
  source: string
  headers: HeaderEntry[]
}

const EXPECTED_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com; worker-src 'self' blob:; frame-src 'self' https://*.supabase.co blob:; frame-ancestors 'none';",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

describe('SEC-004 – Security HTTP Headers', () => {
  let headerGroups: HeaderGroup[]

  beforeAll(async () => {
    const config = await import('../../../next.config.mjs')
    const nextConfig = config.default
    headerGroups = await nextConfig.headers()
  })

  it('should have a catch-all /(.*) header group', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')
    expect(catchAll).toBeDefined()
  })

  it('should contain exactly 7 security headers on the catch-all route', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    expect(catchAll.headers.length).toBe(7)
  })

  it.each(Object.entries(EXPECTED_HEADERS))(
    'should set %s to the correct value',
    (headerKey, expectedValue) => {
      const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
      const header = catchAll.headers.find((h) => h.key === headerKey)
      expect(header, `Header "${headerKey}" is missing`).toBeDefined()
      expect(header!.value).toBe(expectedValue)
    },
  )

  it('X-Frame-Options should be DENY to prevent clickjacking', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    const header = catchAll.headers.find((h) => h.key === 'X-Frame-Options')!
    expect(header.value).toBe('DENY')
  })

  it('HSTS max-age should be at least 1 year (31536000 seconds)', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    const hsts = catchAll.headers.find(
      (h) => h.key === 'Strict-Transport-Security',
    )!
    const maxAgeMatch = hsts.value.match(/max-age=(\d+)/)
    expect(maxAgeMatch).not.toBeNull()
    const maxAge = parseInt(maxAgeMatch![1], 10)
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
  })

  it('HSTS should include includeSubDomains and preload', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    const hsts = catchAll.headers.find(
      (h) => h.key === 'Strict-Transport-Security',
    )!
    expect(hsts.value).toContain('includeSubDomains')
    expect(hsts.value).toContain('preload')
  })

  it('CSP should set frame-ancestors to none', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    const csp = catchAll.headers.find(
      (h) => h.key === 'Content-Security-Policy',
    )!
    expect(csp.value).toContain("frame-ancestors 'none'")
  })

  it('CSP default-src should be self', () => {
    const catchAll = headerGroups.find((g) => g.source === '/(.*)')!
    const csp = catchAll.headers.find(
      (h) => h.key === 'Content-Security-Policy',
    )!
    expect(csp.value).toContain("default-src 'self'")
  })
})
