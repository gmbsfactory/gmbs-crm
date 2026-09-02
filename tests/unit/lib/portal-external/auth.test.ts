import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: vi.fn(),
}))

import {
  hashPortalToken,
  resolvePortalArtisan,
  resolvePortalToken,
  safeEqual,
  validatePortalApiRequest,
} from '@/lib/portal-external/auth'
import { createPlannedClient, validTokenRow, TEST_TOKEN } from '../../../__mocks__/portal-external-client'

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/portal-external/me', { headers })
}

describe('portal-external/auth', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = 'demo-key-id'
    process.env.GMBS_PORTAL_SECRET = 'demo-secret-value'
  })

  afterEach(() => {
    process.env = { ...env }
  })

  describe('validatePortalApiRequest', () => {
    it('renvoie 503 « Portal not configured » si les variables manquent', () => {
      delete process.env.GMBS_PORTAL_SECRET
      const result = validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'demo-key-id', 'X-GMBS-Secret': 'x' }))
      expect(result).toEqual({ ok: false, status: 503, error: 'Portal not configured' })
    })

    it('renvoie 401 si les en-têtes sont absents', () => {
      expect(validatePortalApiRequest(request())).toEqual({ ok: false, status: 401, error: 'Invalid credentials' })
    })

    it('renvoie 401 si le secret est faux (même longueur)', () => {
      const result = validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'demo-key-id', 'X-GMBS-Secret': 'demo-secret-valuX' }))
      expect(result).toEqual({ ok: false, status: 401, error: 'Invalid credentials' })
    })

    it('renvoie 401 sans exception si le secret a une longueur différente', () => {
      expect(() => validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'demo-key-id', 'X-GMBS-Secret': 'court' }))).not.toThrow()
      const result = validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'demo-key-id', 'X-GMBS-Secret': 'court' }))
      expect(result).toEqual({ ok: false, status: 401, error: 'Invalid credentials' })
    })

    it('renvoie 401 si la clé est fausse même avec le bon secret', () => {
      const result = validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'autre', 'X-GMBS-Secret': 'demo-secret-value' }))
      expect(result).toEqual({ ok: false, status: 401, error: 'Invalid credentials' })
    })

    it('accepte la bonne paire clé / secret', () => {
      const result = validatePortalApiRequest(request({ 'X-GMBS-Key-Id': 'demo-key-id', 'X-GMBS-Secret': 'demo-secret-value' }))
      expect(result).toEqual({ ok: true })
    })
  })

  describe('safeEqual / hashPortalToken', () => {
    it('compare en temps constant sans lever pour des longueurs différentes', () => {
      expect(safeEqual('abc', 'abc')).toBe(true)
      expect(safeEqual('abc', 'abd')).toBe(false)
      expect(safeEqual('abc', 'abcd')).toBe(false)
      expect(safeEqual('', 'x')).toBe(false)
    })

    it('hache en SHA-256 hexadécimal (64 caractères, stable)', () => {
      const h = hashPortalToken(TEST_TOKEN)
      expect(h).toMatch(/^[0-9a-f]{64}$/)
      expect(hashPortalToken(` ${TEST_TOKEN} `)).toBe(h)
      expect(hashPortalToken('b'.repeat(64))).not.toBe(h)
    })
  })

  describe('resolvePortalToken', () => {
    it('refuse un jeton mal formé sans interroger la base', async () => {
      const client = createPlannedClient({})
      const result = await resolvePortalToken('pas-un-jeton', client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token invalid' })
      expect(client.from).not.toHaveBeenCalled()
    })

    it('renvoie « Token invalid » pour un jeton inconnu', async () => {
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: null, error: null }] })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token invalid' })
      expect(client.calls[0].filters).toContainEqual(['eq', 'token_hash', hashPortalToken(TEST_TOKEN)])
    })

    it('renvoie 503 « Portal unavailable » (et non 401) quand Supabase renvoie une erreur', async () => {
      const client = createPlannedClient({
        artisan_portal_tokens: [{ data: null, error: { message: 'connection refused', code: 'PGRST000' } }],
      })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result).toEqual({ ok: false, status: 503, error: 'Portal unavailable' })
    })

    it('renvoie « Token expired » pour un jeton expiré', async () => {
      const expired = validTokenRow({ expires_at: new Date(Date.now() - 1000).toISOString() })
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: expired, error: null }] })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token expired' })
    })

    it('renvoie « Token revoked » pour un jeton désactivé', async () => {
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow({ is_active: false }), error: null }] })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token revoked' })
    })

    it('renvoie « Token revoked » si l’artisan est désactivé', async () => {
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow({ artisan_is_active: false }), error: null }] })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token revoked' })
    })

    it('résout l’artisan et met à jour last_used_at pour un jeton valide', async () => {
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow(), error: null }, { data: null, error: null }] })
      const result = await resolvePortalToken(TEST_TOKEN, client as never)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.artisan).toEqual({
        id: 'art-1',
        prenom: 'Karim',
        nom: 'Benali',
        raison_sociale: 'BENALI PLOMBERIE',
        email: 'karim@example.invalid',
        telephone: '06 00 00 10 01',
        statut_dossier: 'INCOMPLET',
        statut_code: 'CONFIRME',
      })
      const update = client.calls.find((c) => c.table === 'artisan_portal_tokens' && c.op === 'update')
      expect(update?.payload).toEqual(expect.objectContaining({ last_used_at: expect.any(String) }))
      expect(update?.filters).toContainEqual(['eq', 'id', 'tok-1'])
    })
  })

  describe('resolvePortalArtisan', () => {
    it('lit l’en-tête X-Portal-Token', async () => {
      const client = createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow(), error: null }] })
      const result = await resolvePortalArtisan(request({ 'X-Portal-Token': TEST_TOKEN }), client as never)
      expect(result.ok).toBe(true)
    })

    it('renvoie « Token invalid » sans en-tête', async () => {
      const client = createPlannedClient({})
      const result = await resolvePortalArtisan(request(), client as never)
      expect(result).toEqual({ ok: false, status: 401, error: 'Token invalid' })
    })
  })
})
