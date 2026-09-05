import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET } from '../../../../app/api/portal-external/me/library/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

const INTERVENTION = 'i0000000-0000-4000-8000-000000000004'

function get(headers: Record<string, string> = portalHeaders()) {
  return new NextRequest('http://localhost/api/portal-external/me/library', { headers })
}

const assignment = {
  role: 'primary',
  is_primary: true,
  price_response: 'accepted',
  price_responded_at: '2026-09-01T08:00:00.000Z',
  price_accepted_amount: '320.00',
  price_refused_reason: null,
  work_started_at: '2026-09-02T07:10:00.000Z',
  payment_status: 'paid',
  paid_at: '2026-09-20T00:00:00.000Z',
  intervention: {
    id: INTERVENTION,
    id_inter: 'GMBS-2026-0904',
    date: '2026-09-02',
    date_prevue: '2026-09-02',
    adresse: '12 rue des Lilas',
    code_postal: '75011',
    ville: 'Paris',
    latitude: null,
    longitude: null,
    contexte_intervention: 'Fuite',
    consigne_intervention: null,
    consigne_second_artisan: null,
    assigned_user_id: null,
    is_active: true,
    statut: { code: 'INTER_TERMINEE', label: 'Terminée', color: '#10B981' },
    metier: { label: 'Plomberie' },
    tenant: null,
    agence: { label: 'Paris 11' },
  },
}

function plannedClient(attachments: unknown[]) {
  return createPlannedClient({
    artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
    intervention_artisans: [{ data: [assignment], error: null }],
    intervention_costs: [{ data: [{ intervention_id: INTERVENTION, amount: '320.00', artisan_order: 1 }], error: null }],
    intervention_attachments: [
      // 1er appel : les photos de l'enrichissement de la liste des missions.
      { data: [], error: null },
      // 2e appel : les pièces de la bibliothèque.
      { data: attachments, error: null },
    ],
    artisan_reports: [{ data: [], error: null }],
    intervention_status_transitions: [{ data: [], error: null }],
  })
}

describe('GET /api/portal-external/me/library', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('should refuse a request without an artisan token', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(
      createPlannedClient({ artisan_portal_tokens: [{ data: null, error: null }] }),
    )
    const response = await GET(get())
    expect(response.status).toBe(401)
  })

  it('should return the devis and the artisan own invoices, grouped by mission', async () => {
    const client = plannedClient([
      {
        id: 'doc-devis',
        intervention_id: INTERVENTION,
        kind: 'devis',
        filename: 'devis.pdf',
        mime_type: 'application/pdf',
        file_size: 1200,
        created_at: '2026-08-30T09:00:00.000Z',
        url: 'http://storage.local/documents/devis.pdf',
      },
      {
        id: 'doc-facture',
        intervention_id: INTERVENTION,
        kind: 'facturesArtisans',
        filename: 'facture.pdf',
        mime_type: 'application/pdf',
        file_size: 900,
        created_at: '2026-09-21T09:00:00.000Z',
        url: 'http://storage.local/documents/facture.pdf',
      },
    ])
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const response = await GET(get())
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.counts).toEqual({ devis: 1, factures: 1 })
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0].intervention.id_inter).toBe('GMBS-2026-0904')
    expect(body.groups[0].documents.map((d: { id: string }) => d.id)).toEqual(['doc-devis', 'doc-facture'])
    // Le montant est SON coût SST, et le libellé de paiement vient du CRM.
    expect(body.groups[0].payment).toMatchObject({ state: 'paid', amount: 320 })
    expect(body.groups[0].payment.label).toContain('Payé le')
  })

  it('should ask the database for the two allowed kinds only', async () => {
    const client = plannedClient([])
    h.createServerSupabaseAdmin.mockReturnValue(client)
    await GET(get())

    const libraryCall = client.calls.filter((c) => c.table === 'intervention_attachments').at(-1)
    const inKind = libraryCall?.filters.find((f) => f[0] === 'in' && f[1] === 'kind')
    expect(inKind?.[2]).toEqual(['devis', 'facturesArtisans'])
  })

  it('should never leak a facturesGMBS row returned by mistake', async () => {
    const client = plannedClient([
      {
        id: 'doc-gmbs',
        intervention_id: INTERVENTION,
        kind: 'facturesGMBS',
        filename: 'facture-client.pdf',
        mime_type: 'application/pdf',
        file_size: 900,
        created_at: '2026-09-21T09:00:00.000Z',
        url: 'http://storage.local/documents/facture-client.pdf',
      },
    ])
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const response = await GET(get())
    const body = await response.json()
    expect(JSON.stringify(body)).not.toContain('facturesGMBS')
    expect(body.groups).toEqual([])
  })
})
