import { describe, it, expect } from 'vitest'
import {
  PORTAL_LIBRARY_KINDS,
  groupLibraryDocuments,
  isPortalLibraryKind,
  type LibraryAttachmentRow,
} from '@/lib/portal-external/library'
import type { PortalInterventionListItem } from '@/lib/portal-external/interventions'

function mission(over: Partial<PortalInterventionListItem> & { id: string }): PortalInterventionListItem {
  return {
    id: over.id,
    id_inter: over.id_inter ?? 'GMBS-2026-0001',
    statut_code: over.statut_code ?? 'INTER_TERMINEE',
    statut_label: 'Terminée',
    statut_color: '#10B981',
    date_prevue: over.date_prevue ?? '2026-09-10',
    date: over.date ?? '2026-09-10',
    adresse: over.adresse ?? '1 rue de Paris',
    code_postal: '75001',
    ville: over.ville ?? 'Paris',
    latitude: null,
    longitude: null,
    metier: 'Plomberie',
    contexte: null,
    consigne: null,
    consigne_second_artisan: null,
    role: 'primary',
    tenant: null,
    cout_sst: over.cout_sst ?? 480,
    photos_count: 0,
    report: null,
    groupe: over.groupe ?? 'terminee',
    price: {
      response: null,
      responded_at: null,
      accepted_amount: null,
      amount: over.cout_sst ?? 480,
      can_accept: false,
      refused_reason: null,
    },
    work: { started_at: null, can_start: false },
    payment:
      'payment' in over
        ? over.payment ?? null
        : {
            state: 'in_progress',
            label: 'Paiement en cours',
            tone: 'info',
            amount: over.cout_sst ?? 480,
            paid_at: null,
          },
  }
}

function row(over: Partial<LibraryAttachmentRow> & { id: string; intervention_id: string }): LibraryAttachmentRow {
  return {
    id: over.id,
    intervention_id: over.intervention_id,
    kind: over.kind ?? 'devis',
    filename: over.filename ?? 'devis.pdf',
    mime_type: over.mime_type ?? 'application/pdf',
    file_size: over.file_size ?? 1024,
    created_at: over.created_at ?? '2026-09-01T10:00:00.000Z',
    url: over.url ?? 'http://storage.local/documents/devis.pdf',
  }
}

describe('portal-external/library', () => {
  describe('isPortalLibraryKind', () => {
    it('should accept only devis and facturesArtisans', () => {
      expect(PORTAL_LIBRARY_KINDS).toEqual(['devis', 'facturesArtisans'])
      expect(isPortalLibraryKind('devis')).toBe(true)
      expect(isPortalLibraryKind('facturesArtisans')).toBe(true)
    })

    it('should reject facturesGMBS, the client price', () => {
      expect(isPortalLibraryKind('facturesGMBS')).toBe(false)
      expect(isPortalLibraryKind('facturesMateriel')).toBe(false)
      expect(isPortalLibraryKind('photos')).toBe(false)
      expect(isPortalLibraryKind(null)).toBe(false)
    })
  })

  describe('groupLibraryDocuments', () => {
    it('should group documents by mission and count them', () => {
      const missions = [mission({ id: 'i-1', id_inter: 'GMBS-1' })]
      const result = groupLibraryDocuments(missions, [
        row({ id: 'd-1', intervention_id: 'i-1', kind: 'devis' }),
        row({ id: 'f-1', intervention_id: 'i-1', kind: 'facturesArtisans', filename: 'facture.pdf' }),
      ])

      expect(result.groups).toHaveLength(1)
      expect(result.groups[0].intervention).toMatchObject({ id: 'i-1', id_inter: 'GMBS-1', ville: 'Paris' })
      expect(result.groups[0].documents.map((d) => d.id)).toEqual(['d-1', 'f-1'])
      expect(result.counts).toEqual({ devis: 1, factures: 1 })
    })

    it('should NEVER expose a facturesGMBS row, even if the query returned one', () => {
      const missions = [mission({ id: 'i-1' })]
      const result = groupLibraryDocuments(missions, [
        row({ id: 'd-1', intervention_id: 'i-1', kind: 'devis' }),
        row({ id: 'gmbs-1', intervention_id: 'i-1', kind: 'facturesGMBS', filename: 'facture-client.pdf' }),
      ])

      const ids = result.groups.flatMap((g) => g.documents.map((d) => d.id))
      expect(ids).toEqual(['d-1'])
      expect(JSON.stringify(result)).not.toContain('facturesGMBS')
      expect(result.counts).toEqual({ devis: 1, factures: 0 })
    })

    it('should drop missions without any document', () => {
      const missions = [mission({ id: 'i-1' }), mission({ id: 'i-2' })]
      const result = groupLibraryDocuments(missions, [row({ id: 'd-1', intervention_id: 'i-1' })])
      expect(result.groups.map((g) => g.intervention.id)).toEqual(['i-1'])
    })

    it('should carry the artisan own amount, never a GMBS total', () => {
      const missions = [mission({ id: 'i-1', cout_sst: 320 })]
      const result = groupLibraryDocuments(missions, [row({ id: 'd-1', intervention_id: 'i-1' })])
      expect(result.groups[0].payment?.amount).toBe(320)
    })

    it('should sort missions from the most recent and devis before factures', () => {
      const missions = [
        mission({ id: 'i-old', date_prevue: '2026-01-05', date: '2026-01-05' }),
        mission({ id: 'i-new', date_prevue: '2026-09-20', date: '2026-09-20' }),
      ]
      const result = groupLibraryDocuments(missions, [
        row({ id: 'f-1', intervention_id: 'i-new', kind: 'facturesArtisans' }),
        row({ id: 'd-1', intervention_id: 'i-new', kind: 'devis' }),
        row({ id: 'd-2', intervention_id: 'i-old', kind: 'devis' }),
      ])

      expect(result.groups.map((g) => g.intervention.id)).toEqual(['i-new', 'i-old'])
      expect(result.groups[0].documents.map((d) => d.id)).toEqual(['d-1', 'f-1'])
    })

    it('should keep payment null on a mission that is not finished', () => {
      const missions = [mission({ id: 'i-1', statut_code: 'DEVIS_ENVOYE', groupe: 'a_accepter', payment: null })]
      const result = groupLibraryDocuments(missions, [row({ id: 'd-1', intervention_id: 'i-1' })])
      expect(result.groups[0].payment).toBeNull()
    })
  })
})
