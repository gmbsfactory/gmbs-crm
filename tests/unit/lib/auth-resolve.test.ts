import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

// Mock supabase-admin before importing the route
const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: mockFrom },
}))

// Import after mocks using relative path (app/ is at project root, not under src/)
const { POST } = await import('../../../app/api/auth/resolve/route')

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/resolve – anti-enumeration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 200 avec un email quand identifier est un email', async () => {
    const res = await POST(makeRequest({ identifier: 'user@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('email')
    expect(json.email).toBe('user@example.com')
  })

  it('retourne 200 avec un email quand le username existe', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { email: 'found@example.com' },
      error: null,
    })
    const res = await POST(makeRequest({ identifier: 'existinguser' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('email')
    expect(json.email).toBe('found@example.com')
  })

  it('retourne 200 avec email null quand le username n\'existe pas', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const res = await POST(makeRequest({ identifier: 'unknownuser' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('email')
    expect(json.email).toBeNull()
  })

  it('structure de réponse identique pour username trouvé et non trouvé', async () => {
    // Username trouvé
    mockMaybeSingle.mockResolvedValueOnce({
      data: { email: 'found@example.com' },
      error: null,
    })
    const resFound = await POST(makeRequest({ identifier: 'knownuser' }))
    const jsonFound = await resFound.json()

    // Username non trouvé
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const resNotFound = await POST(makeRequest({ identifier: 'missinguser' }))
    const jsonNotFound = await resNotFound.json()

    // Même statut HTTP
    expect(resFound.status).toBe(resNotFound.status)

    // Même structure (mêmes clés)
    expect(Object.keys(jsonFound).sort()).toEqual(Object.keys(jsonNotFound).sort())
  })

  it('retourne 200 sans message d\'erreur révélateur quand identifier est absent', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    const json = await res.json()
    // Pas de champ "error" ni de statut 4xx
    expect(json).not.toHaveProperty('error')
  })

  it('ne retourne jamais de statut 404', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const res = await POST(makeRequest({ identifier: 'ghost' }))
    expect(res.status).not.toBe(404)
    expect(res.status).toBe(200)
  })

  it('ne retourne jamais "not_found" dans la réponse', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const res = await POST(makeRequest({ identifier: 'ghost' }))
    const text = await res.text()
    expect(text).not.toContain('not_found')
  })
})
