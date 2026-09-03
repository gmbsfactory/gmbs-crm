import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET } from '../../../../app/api/portal-external/me/stream/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

/**
 * Flux SSE du CRM vers l'application artisan.
 * Le canal realtime est simule : on ne verifie ici que l'authentification,
 * les en-tetes du flux et le premier evenement « ready ».
 */

type Rappel = (status: string) => void

function clientAvecCanal(plan: Record<string, unknown>) {
  const client = createPlannedClient(plan as never) as unknown as Record<string, unknown>
  const canal = {
    on: vi.fn(() => canal),
    subscribe: vi.fn((cb: Rappel) => {
      cb('SUBSCRIBED')
      return canal
    }),
  }
  client.channel = vi.fn(() => canal)
  client.removeChannel = vi.fn()
  return { client, canal }
}

/** Lit le debut du flux SSE puis coupe la connexion. */
async function lirePremierEvenement(reponse: Response, controleur: AbortController) {
  const lecteur = reponse.body!.getReader()
  const { value } = await lecteur.read()
  controleur.abort()
  await lecteur.cancel().catch(() => {})
  return new TextDecoder().decode(value)
}

function requete(headers: Record<string, string>, signal?: AbortSignal) {
  return new NextRequest('http://localhost:3000/api/portal-external/me/stream', {
    headers,
    signal,
  })
}

describe('GET /api/portal-external/me/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.GMBS_PORTAL_KEY_ID
    delete process.env.GMBS_PORTAL_SECRET
  })

  it('should refuser sans en-têtes machine à machine', async () => {
    const reponse = await GET(requete({}))
    expect(reponse.status).toBe(401)
    await expect(reponse.json()).resolves.toEqual({ error: 'Invalid credentials' })
  })

  it('should refuser un mauvais secret', async () => {
    const reponse = await GET(requete(portalHeaders({ 'X-GMBS-Secret': 'mauvais-secret' })))
    expect(reponse.status).toBe(401)
  })

  it('should répondre 503 quand le portail n’est pas configuré', async () => {
    delete process.env.GMBS_PORTAL_KEY_ID
    const reponse = await GET(requete(portalHeaders()))
    expect(reponse.status).toBe(503)
    await expect(reponse.json()).resolves.toEqual({ error: 'Portal not configured' })
  })

  it('should ouvrir un flux text/event-stream et émettre « ready »', async () => {
    const { client, canal } = clientAvecCanal({
      artisan_portal_tokens: [{ data: validTokenRow() }],
      intervention_artisans: [{ data: [{ intervention_id: 'inter-1' }] }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const controleur = new AbortController()
    const reponse = await GET(requete(portalHeaders(), controleur.signal))

    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('Content-Type')).toContain('text/event-stream')
    expect(reponse.headers.get('Cache-Control')).toContain('no-cache')
    expect(reponse.headers.get('X-Accel-Buffering')).toBe('no')

    const debut = await lirePremierEvenement(reponse, controleur)
    expect(debut).toContain('event: ready')

    // Les quatre sources d'evenements sont bien ecoutees.
    const tables = canal.on.mock.calls.map((appel) => (appel[1] as { table: string }).table)
    expect(tables).toEqual([
      'artisan_reports',
      'artisan_attachments',
      'interventions',
      'intervention_artisans',
    ])
  })

  it('should fermer le canal quand le client se déconnecte', async () => {
    const { client } = clientAvecCanal({
      artisan_portal_tokens: [{ data: validTokenRow() }],
      intervention_artisans: [{ data: [] }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const controleur = new AbortController()
    const reponse = await GET(requete(portalHeaders(), controleur.signal))
    await lirePremierEvenement(reponse, controleur)

    await vi.waitFor(() => {
      expect((client.removeChannel as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    })
  })
})
