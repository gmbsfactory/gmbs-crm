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
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com https://vercel.live wss://vercel.live; worker-src 'self' blob:; frame-src 'self' https://*.supabase.co blob: https://vercel.live; frame-ancestors 'none';",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

/**
 * `headers()` lit `NEXT_PUBLIC_SUPABASE_URL` à chaque appel : on la fixe donc
 * explicitement pour ne pas dépendre du `.env` de la machine qui lance les
 * tests. Une URL distante correspond au déploiement réel.
 */
async function headersAvecSupabase(url: string): Promise<HeaderGroup[]> {
  const precedent = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  try {
    const config = await import('../../../next.config.mjs')
    return await config.default.headers()
  } finally {
    if (precedent === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = precedent
  }
}

const cspDe = (groupes: HeaderGroup[]): string =>
  groupes
    .find((g) => g.source === '/(.*)')!
    .headers.find((h) => h.key === 'Content-Security-Policy')!.value

describe('SEC-004 – Security HTTP Headers', () => {
  let headerGroups: HeaderGroup[]

  beforeAll(async () => {
    headerGroups = await headersAvecSupabase('https://projet-distant.supabase.co')
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

/**
 * La démo locale est un build de production qui pointe vers une Supabase sur
 * 127.0.0.1 : sans dérogation, la CSP coupe le CRM de sa propre base (REST et
 * websocket Realtime). La dérogation se déduit de l'URL configurée, jamais de
 * NODE_ENV — sinon elle disparaît dès qu'on compile.
 */
describe('SEC-004 – dérogation Supabase locale', () => {
  const LOCALES = [
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'ws://127.0.0.1:54321',
    'ws://localhost:54321',
  ]

  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])(
    'autorise la base locale quand NEXT_PUBLIC_SUPABASE_URL vaut %s',
    async (url) => {
      const csp = cspDe(await headersAvecSupabase(url))
      for (const origine of LOCALES) expect(csp).toContain(origine)
    },
  )

  it("n'autorise aucune origine locale face à une Supabase distante", async () => {
    const csp = cspDe(await headersAvecSupabase('https://projet-distant.supabase.co'))
    for (const origine of LOCALES) expect(csp).not.toContain(origine)
    expect(csp).toBe(EXPECTED_HEADERS['Content-Security-Policy'])
  })

  it("n'autorise aucune origine locale quand l'URL est absente ou illisible", async () => {
    for (const url of ['', 'pas-une-url']) {
      const csp = cspDe(await headersAvecSupabase(url))
      expect(csp).toBe(EXPECTED_HEADERS['Content-Security-Policy'])
    }
  })
})
