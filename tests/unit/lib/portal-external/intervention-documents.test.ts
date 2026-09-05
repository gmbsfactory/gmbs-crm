import { describe, it, expect } from 'vitest'
import {
  PORTAL_INTERVENTION_DOCUMENT_KINDS,
  listPortalInterventionDocuments,
} from '@/lib/portal-external/interventions'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'
import type { SupabaseClient } from '@supabase/supabase-js'

const ROWS = [
  {
    id: 'ph-1',
    kind: 'photos',
    url: 'http://storage.local/documents/photo.jpg',
    filename: 'photo.jpg',
    mime_type: 'image/jpeg',
    file_size: 2048,
    created_at: '2026-09-12T10:00:00.000Z',
    created_by_display: 'Karim Benali (artisan)',
    metadata: { phase: 'avant' },
  },
  {
    id: 'dev-1',
    kind: 'devis',
    url: 'http://storage.local/documents/devis.pdf',
    filename: 'devis.pdf',
    mime_type: 'application/pdf',
    file_size: 1200,
    created_at: '2026-09-01T10:00:00.000Z',
    created_by_display: null,
    metadata: null,
  },
  {
    id: 'fac-1',
    kind: 'facturesArtisans',
    url: 'http://storage.local/documents/facture.pdf',
    filename: 'facture.pdf',
    mime_type: 'application/pdf',
    file_size: 900,
    created_at: '2026-09-22T10:00:00.000Z',
    created_by_display: null,
    metadata: null,
  },
]

describe('listPortalInterventionDocuments (lot L6)', () => {
  it('should only ask for photos, devis and facturesArtisans', async () => {
    const client = createPlannedClient({ intervention_attachments: [{ data: ROWS, error: null }] })
    await listPortalInterventionDocuments(client as unknown as SupabaseClient, 'i-1')

    const call = client.calls.find((c) => c.table === 'intervention_attachments')
    const inKind = call?.filters.find((f) => f[0] === 'in' && f[1] === 'kind')
    expect(inKind?.[2]).toEqual(['photos', 'devis', 'facturesArtisans'])
    expect(PORTAL_INTERVENTION_DOCUMENT_KINDS).toEqual(['devis', 'facturesArtisans'])
  })

  it('should enrich devis with kind, mime type, size and date', async () => {
    const client = createPlannedClient({ intervention_attachments: [{ data: ROWS, error: null }] })
    const documents = await listPortalInterventionDocuments(client as unknown as SupabaseClient, 'i-1')

    expect(documents.devis).toEqual([
      {
        id: 'dev-1',
        url: 'http://storage.local/documents/devis.pdf',
        filename: 'devis.pdf',
        kind: 'devis',
        mime_type: 'application/pdf',
        file_size: 1200,
        created_at: '2026-09-01T10:00:00.000Z',
      },
    ])
  })

  it('should expose the artisan own invoices apart from the devis', async () => {
    const client = createPlannedClient({ intervention_attachments: [{ data: ROWS, error: null }] })
    const documents = await listPortalInterventionDocuments(client as unknown as SupabaseClient, 'i-1')

    expect(documents.factures.map((f) => f.id)).toEqual(['fac-1'])
    expect(documents.photos.map((p) => p.id)).toEqual(['ph-1'])
  })

  it('should never return a facturesGMBS row', async () => {
    const client = createPlannedClient({
      intervention_attachments: [
        { data: [...ROWS, { ...ROWS[2], id: 'gmbs-1', kind: 'facturesGMBS' }], error: null },
      ],
    })
    const documents = await listPortalInterventionDocuments(client as unknown as SupabaseClient, 'i-1')
    expect(JSON.stringify(documents)).not.toContain('gmbs-1')
  })
})
