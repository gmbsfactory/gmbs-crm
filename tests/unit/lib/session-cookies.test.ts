import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SEC-010 – Verify session cookies are hardened:
 * - SameSite: strict (CSRF protection)
 * - httpOnly: true
 * - Access token maxAge: 3600 (1 hour)
 * - Refresh token maxAge: 604800 (7 days)
 * - DELETE clears cookies (maxAge: 0)
 */

const mockSet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

describe('SEC-010 – Session Cookie Hardening', () => {
  beforeEach(() => {
    mockSet.mockClear()
  })

  describe('POST /api/auth/session', () => {
    it('should set sb-access-token with sameSite strict, httpOnly, and maxAge 3600', async () => {
      const { POST } = await import(
        '../../../app/api/auth/session/route'
      )

      const req = new Request('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({
          access_token: 'test-access',
          refresh_token: 'test-refresh',
        }),
      })

      await POST(req)

      const accessCall = mockSet.mock.calls.find(
        (call: unknown[]) => call[0] === 'sb-access-token',
      )
      expect(accessCall).toBeDefined()
      const opts = accessCall![2]
      expect(opts.sameSite).toBe('strict')
      expect(opts.httpOnly).toBe(true)
      expect(opts.maxAge).toBe(3600)
    })

    it('should set sb-refresh-token with sameSite strict, httpOnly, and maxAge 604800', async () => {
      const { POST } = await import(
        '../../../app/api/auth/session/route'
      )

      const req = new Request('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({
          access_token: 'test-access',
          refresh_token: 'test-refresh',
        }),
      })

      await POST(req)

      const refreshCall = mockSet.mock.calls.find(
        (call: unknown[]) => call[0] === 'sb-refresh-token',
      )
      expect(refreshCall).toBeDefined()
      const opts = refreshCall![2]
      expect(opts.sameSite).toBe('strict')
      expect(opts.httpOnly).toBe(true)
      expect(opts.maxAge).toBe(604800)
    })

    it('should return 400 if tokens are missing', async () => {
      const { POST } = await import(
        '../../../app/api/auth/session/route'
      )

      const req = new Request('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/auth/session', () => {
    it('should clear cookies with maxAge 0 and sameSite strict', async () => {
      const { DELETE } = await import(
        '../../../app/api/auth/session/route'
      )

      await DELETE()

      expect(mockSet).toHaveBeenCalledTimes(2)

      const accessCall = mockSet.mock.calls.find(
        (call: unknown[]) => call[0] === 'sb-access-token',
      )
      expect(accessCall).toBeDefined()
      expect(accessCall![1]).toBe('')
      expect(accessCall![2].sameSite).toBe('strict')
      expect(accessCall![2].httpOnly).toBe(true)
      expect(accessCall![2].maxAge).toBe(0)

      const refreshCall = mockSet.mock.calls.find(
        (call: unknown[]) => call[0] === 'sb-refresh-token',
      )
      expect(refreshCall).toBeDefined()
      expect(refreshCall![1]).toBe('')
      expect(refreshCall![2].sameSite).toBe('strict')
      expect(refreshCall![2].httpOnly).toBe(true)
      expect(refreshCall![2].maxAge).toBe(0)
    })
  })
})
