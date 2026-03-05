import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== HOISTED MOCKS (available before vi.mock factories) =====

const {
  mockGetUser,
  mockFrom,
  mockRpc,
  mockBearerFrom,
  mockCreateServerSupabase,
  mockCookies,
  mockAdminModule,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()

  const mockSupabaseClient = {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }

  const mockCreateServerSupabase = vi.fn(() => mockSupabaseClient)
  const mockBearerFrom = vi.fn()
  const mockCookies = vi.fn()

  // Mutable reference so we can set supabaseAdmin to null per-test
  const mockAdminModule = {
    value: { rpc: mockRpc } as any,
    mockRpc,
  }

  return {
    mockGetUser,
    mockFrom,
    mockRpc,
    mockBearerFrom,
    mockCreateServerSupabase,
    mockCookies,
    mockAdminModule,
  }
})

// ===== MODULE MOCKS =====

vi.mock('@/lib/supabase/server-ssr', () => ({
  createSSRServerClient: mockCreateServerSupabase,
}))

vi.mock('@/lib/supabase-admin', () => ({
  get supabaseAdmin() {
    return mockAdminModule.value
  },
}))

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      body,
      status: init?.status || 200,
    }),
  },
}))

// ===== IMPORT AFTER MOCKS =====

import { getAuthenticatedUser, requirePermission, requireAnyPermission } from '@/lib/api/permissions'

// ===== HELPERS =====

function createRequest(url = 'http://localhost/api/test'): Request {
  return new Request(url)
}

/**
 * Setup mocks for an authenticated user with roles resolved via auth_user_mapping
 */
function setupAuthenticatedUser(options: {
  token?: string | null
  userId?: string
  email?: string
  publicUserId?: string
  roles?: string[]
  rpcResponse?: { data: any; error: any }
}) {
  const {
    token = 'test-token',
    userId = 'auth-user-id',
    email = 'test@example.com',
    publicUserId = 'public-user-1',
    roles = ['admin'],
    rpcResponse = { data: [], error: null },
  } = options

  mockBearerFrom.mockReturnValue(token)

  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email } },
    error: null,
  })

  // Build user_roles from role names
  const userRoles = roles.map((name) => ({ roles: { name } }))

  // Mock from() chain for auth_user_mapping (first call returns the mapping)
  mockFrom.mockImplementation((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            table === 'auth_user_mapping'
              ? {
                  public_user_id: publicUserId,
                  users: {
                    id: publicUserId,
                    user_roles: userRoles,
                  },
                }
              : null,
          error: null,
        }),
      })),
    })),
  }))

  mockRpc.mockResolvedValue(rpcResponse)
}

// ===== TESTS =====

describe('permissions - getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset supabaseAdmin to a valid admin client by default
    mockAdminModule.value = { rpc: mockRpc }
  })

  // ----- Cas non authentifié -----

  describe('Cas non authentifié', () => {
    it('retourne null quand aucun token n\'est présent (header ni cookie)', async () => {
      mockBearerFrom.mockReturnValue(null)
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      })

      const result = await getAuthenticatedUser(createRequest())
      expect(result).toBeNull()
    })

    it('retourne null quand auth.getUser échoue', async () => {
      mockBearerFrom.mockReturnValue('test-token')
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const result = await getAuthenticatedUser(createRequest())
      expect(result).toBeNull()
    })

    it('retourne null quand le publicUserId n\'est pas trouvé (mapping + fallback)', async () => {
      mockBearerFrom.mockReturnValue('test-token')
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'auth-id', email: 'test@test.com' } },
        error: null,
      })

      // Both mapping and fallback return null
      mockFrom.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      }))

      const result = await getAuthenticatedUser(createRequest())
      expect(result).toBeNull()
    })
  })

  // ----- Cas nominal : RPC réussit avec des permissions -----

  describe('Cas nominal - RPC réussit avec des permissions', () => {
    it('charge les permissions depuis la DB quand RPC réussit', async () => {
      setupAuthenticatedUser({
        roles: ['admin'],
        rpcResponse: {
          data: [
            { permission_key: 'read_interventions' },
            { permission_key: 'write_interventions' },
            { permission_key: 'read_artisans' },
          ],
          error: null,
        },
      })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      expect(result!.permissions.has('read_interventions')).toBe(true)
      expect(result!.permissions.has('write_interventions')).toBe(true)
      expect(result!.permissions.has('read_artisans')).toBe(true)
      expect(result!.permissions.size).toBe(3)
    })

    it('ne charge PAS les ROLE_PERMISSIONS quand RPC réussit (même si les permissions DB sont restreintes)', async () => {
      // User has admin role, but DB only gives read_interventions
      // Should NOT add all admin ROLE_PERMISSIONS
      setupAuthenticatedUser({
        roles: ['admin'],
        rpcResponse: {
          data: [{ permission_key: 'read_interventions' }],
          error: null,
        },
      })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      expect(result!.permissions.size).toBe(1)
      expect(result!.permissions.has('read_interventions')).toBe(true)
      // Admin role-based permissions should NOT be loaded
      expect(result!.permissions.has('manage_settings')).toBe(false)
      expect(result!.permissions.has('view_admin')).toBe(false)
      expect(result!.permissions.has('delete_interventions')).toBe(false)
    })

    it('filtre les permission_keys invalides retournées par RPC', async () => {
      setupAuthenticatedUser({
        rpcResponse: {
          data: [
            { permission_key: 'read_interventions' },
            { permission_key: 'INVALID_KEY' },
            { permission_key: '' },
            { permission_key: null },
            {},
          ],
          error: null,
        },
      })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      expect(result!.permissions.size).toBe(1)
      expect(result!.permissions.has('read_interventions')).toBe(true)
    })
  })

  // ----- Cas fail-secure : RPC échoue → deny-all -----

  describe('Cas fail-secure - RPC échoue (SEC-006)', () => {
    it('SÉCURITÉ: permissions VIDES (deny-all) quand RPC échoue, PAS de fallback vers ROLE_PERMISSIONS', async () => {
      setupAuthenticatedUser({
        roles: ['admin'],
        rpcResponse: {
          data: null,
          error: { message: 'Database connection failed', code: '500' },
        },
      })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      expect(result!.id).toBe('public-user-1')

      // FAIL-SECURE: permissions MUST be EMPTY when RPC fails
      // The system must NOT fall back to ROLE_PERMISSIONS on DB error
      // because that could grant elevated permissions if the DB is compromised
      expect(result!.permissions.size).toBe(0)

      // Explicitly verify no admin role-based permissions leaked
      expect(result!.permissions.has('read_interventions')).toBe(false)
      expect(result!.permissions.has('write_interventions')).toBe(false)
      expect(result!.permissions.has('manage_settings')).toBe(false)
      expect(result!.permissions.has('view_admin')).toBe(false)
      expect(result!.permissions.has('delete_interventions')).toBe(false)
    })

    it('SÉCURITÉ: permissions VIDES même pour un gestionnaire quand RPC échoue', async () => {
      setupAuthenticatedUser({
        roles: ['gestionnaire'],
        rpcResponse: {
          data: null,
          error: { message: 'timeout', code: 'TIMEOUT' },
        },
      })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      // Even gestionnaire role-based permissions must NOT be loaded on error
      expect(result!.permissions.size).toBe(0)
      expect(result!.permissions.has('read_interventions')).toBe(false)
    })
  })

  // ----- Cas fallback légitime : supabaseAdmin est null -----

  describe('Cas fallback légitime - supabaseAdmin est null', () => {
    beforeEach(() => {
      // Override supabaseAdmin to null (no admin client available)
      mockAdminModule.value = null
    })

    it('charge les permissions depuis ROLE_PERMISSIONS quand supabaseAdmin est null (admin)', async () => {
      setupAuthenticatedUser({ roles: ['admin'] })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      // Should use ROLE_PERMISSIONS for admin
      expect(result!.permissions.has('read_interventions')).toBe(true)
      expect(result!.permissions.has('write_interventions')).toBe(true)
      expect(result!.permissions.has('manage_settings')).toBe(true)
      expect(result!.permissions.has('view_admin')).toBe(true)
      expect(result!.permissions.has('delete_interventions')).toBe(true)
      // admin has all 15 permissions defined in ROLE_PERMISSIONS
      expect(result!.permissions.size).toBe(15)
    })

    it('charge les permissions depuis ROLE_PERMISSIONS quand supabaseAdmin est null (gestionnaire)', async () => {
      setupAuthenticatedUser({ roles: ['gestionnaire'] })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      // gestionnaire has limited permissions
      expect(result!.permissions.has('read_interventions')).toBe(true)
      expect(result!.permissions.has('write_interventions')).toBe(true)
      expect(result!.permissions.has('read_artisans')).toBe(true)
      expect(result!.permissions.has('write_artisans')).toBe(true)
      expect(result!.permissions.has('read_users')).toBe(true)
      expect(result!.permissions.size).toBe(5)
      // gestionnaire should NOT have admin permissions
      expect(result!.permissions.has('manage_settings')).toBe(false)
      expect(result!.permissions.has('view_admin')).toBe(false)
    })

    it('aucune permission pour un rôle inconnu quand supabaseAdmin est null', async () => {
      setupAuthenticatedUser({ roles: ['unknown_role'] })

      const result = await getAuthenticatedUser(createRequest())

      expect(result).not.toBeNull()
      expect(result!.permissions.size).toBe(0)
    })
  })
})

// ===== requirePermission tests =====

describe('permissions - requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminModule.value = { rpc: mockRpc }
  })

  it('retourne user quand la permission est présente', async () => {
    setupAuthenticatedUser({
      rpcResponse: {
        data: [{ permission_key: 'read_interventions' }],
        error: null,
      },
    })

    const result = await requirePermission(createRequest(), 'read_interventions')

    expect('user' in result).toBe(true)
    if ('user' in result) {
      expect(result.user.permissions.has('read_interventions')).toBe(true)
    }
  })

  it('retourne erreur 403 quand la permission est absente', async () => {
    setupAuthenticatedUser({
      rpcResponse: {
        data: [{ permission_key: 'read_interventions' }],
        error: null,
      },
    })

    const result = await requirePermission(createRequest(), 'manage_settings')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect((result.error as any).status).toBe(403)
    }
  })

  it('retourne erreur 401 quand non authentifié', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const result = await requirePermission(createRequest(), 'read_interventions')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect((result.error as any).status).toBe(401)
    }
  })
})
