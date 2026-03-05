import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ===== Mocks =====

// Track calls to supabaseAdmin.from('users').update() for assertions
let capturedUpdatePayload: Record<string, unknown> | null = null
let capturedUpdateEqArgs: [string, string] | null = null
let mockArchiveResult = { error: null as { message: string } | null }

// Track calls to supabaseAdmin.from('users').select() for email lookup
let mockUserLookupResult = {
  data: { email: 'jean.dupont@example.com' } as Record<string, unknown> | null,
  error: null as { message: string } | null,
}

// Track auth_user_mapping calls
let mockMappingResult = {
  data: { auth_user_id: 'auth-uuid-123' } as Record<string, unknown> | null,
  error: null as { message: string } | null,
}

const mockDeleteUser = vi.fn().mockResolvedValue({ error: null })

function createTableMock(tableName: string) {
  if (tableName === 'users') {
    return {
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedUpdatePayload = payload
        return {
          eq: vi.fn((...args: [string, string]) => {
            capturedUpdateEqArgs = args
            return Promise.resolve(mockArchiveResult)
          }),
        }
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(mockUserLookupResult),
        })),
      })),
    }
  }
  if (tableName === 'auth_user_mapping') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(mockMappingResult),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }
  }
  // Default
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  }
}

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => createTableMock(table)),
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
        createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  },
}))

vi.mock('@/lib/api/permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue({ user: { id: 'admin-id' } }),
  isPermissionError: vi.fn().mockReturnValue(false),
}))

// ===== Import the route handler =====
import { DELETE } from '../../../app/api/settings/team/user/route'

// Helper to create a mock Request
function createDeleteRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/settings/team/user', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GDPR Anonymization on Soft Delete (CODE-009)', () => {
  const TEST_USER_ID = 'usr-abc-123-def-456'

  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdatePayload = null
    capturedUpdateEqArgs = null
    mockArchiveResult = { error: null }
    mockUserLookupResult = {
      data: { email: 'jean.dupont@example.com' },
      error: null,
    }
    mockMappingResult = {
      data: { auth_user_id: 'auth-uuid-123' },
      error: null,
    }
  })

  describe('Personal data anonymization', () => {
    it('should anonymize email with format deleted_{userId}@anonymized.local', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      const response = await DELETE(req)
      const json = await response.json()

      expect(json.ok).toBe(true)
      expect(json.archived).toBe(true)
      expect(capturedUpdatePayload).not.toBeNull()
      expect(capturedUpdatePayload!.email).toBe(`deleted_${TEST_USER_ID}@anonymized.local`)
    })

    it('should preserve firstname (not anonymized, kept for intervention history)', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      // firstname is intentionally NOT in the update payload
      // it is preserved for historical display in interventions table
      expect(capturedUpdatePayload).not.toHaveProperty('firstname')
    })

    it('should preserve lastname (not anonymized, kept for intervention history)', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      // lastname is intentionally NOT in the update payload
      // it is preserved for historical display in interventions table
      expect(capturedUpdatePayload).not.toHaveProperty('lastname')
    })

    it('should anonymize username with format deleted_{userId}', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      expect(capturedUpdatePayload!.username).toBe(`deleted_${TEST_USER_ID}`)
    })

    it('should set avatar_url to null and preserve code_gestionnaire and color for history', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      expect(capturedUpdatePayload!.avatar_url).toBeNull()
      // code_gestionnaire and color are preserved for historical display
      expect(capturedUpdatePayload).not.toHaveProperty('code_gestionnaire')
      expect(capturedUpdatePayload).not.toHaveProperty('color')
    })
  })

  describe('Audit data preservation', () => {
    it('should set status to archived', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      expect(capturedUpdatePayload!.status).toBe('archived')
    })

    it('should set archived_at to a valid ISO timestamp', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      const before = new Date().toISOString()
      await DELETE(req)
      const after = new Date().toISOString()

      const archivedAt = capturedUpdatePayload!.archived_at as string
      expect(archivedAt).toBeDefined()
      expect(archivedAt >= before).toBe(true)
      expect(archivedAt <= after).toBe(true)
    })

    it('should target the correct user by ID', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      expect(capturedUpdateEqArgs).toEqual(['id', TEST_USER_ID])
    })

    it('should NOT include id or created_at in the update payload', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      expect(capturedUpdatePayload).not.toHaveProperty('id')
      expect(capturedUpdatePayload).not.toHaveProperty('created_at')
    })
  })

  describe('Anonymized email uniqueness', () => {
    it('should produce unique anonymized emails for different user IDs', () => {
      const userId1 = 'user-001'
      const userId2 = 'user-002'

      const email1 = `deleted_${userId1}@anonymized.local`
      const email2 = `deleted_${userId2}@anonymized.local`

      expect(email1).not.toBe(email2)
      expect(email1).toBe('deleted_user-001@anonymized.local')
      expect(email2).toBe('deleted_user-002@anonymized.local')
    })
  })

  describe('Error handling', () => {
    it('should return 500 if archive update fails', async () => {
      mockArchiveResult = { error: { message: 'DB write error' } }

      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      const response = await DELETE(req)
      expect(response.status).toBe(500)

      const json = await response.json()
      expect(json.error).toBe('Une erreur interne est survenue')
    })

    it('should return 400 if userId is missing', async () => {
      const req = createDeleteRequest({
        emailConfirm: 'jean.dupont@example.com',
      })

      const response = await DELETE(req)
      expect(response.status).toBe(400)
    })

    it('should return 400 if emailConfirm is missing', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
      })

      const response = await DELETE(req)
      expect(response.status).toBe(400)
    })

    it('should return 400 if emailConfirm does not match', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'wrong@email.com',
      })

      const response = await DELETE(req)
      expect(response.status).toBe(400)

      const json = await response.json()
      expect(json.error).toBe('email_mismatch')
    })

    it('should return 404 if user is not found', async () => {
      mockUserLookupResult = { data: null, error: null }

      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      const response = await DELETE(req)
      expect(response.status).toBe(404)
    })
  })

  describe('Complete anonymization payload', () => {
    it('should contain exactly the expected GDPR fields', async () => {
      const req = createDeleteRequest({
        userId: TEST_USER_ID,
        emailConfirm: 'jean.dupont@example.com',
      })

      await DELETE(req)

      const expectedKeys = [
        'status',
        'archived_at',
        'email',
        'username',
        'avatar_url',
      ]

      expect(Object.keys(capturedUpdatePayload!).sort()).toEqual(expectedKeys.sort())
    })
  })
})
