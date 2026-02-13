import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapStatusToDb,
  mapStatusFromDb,
  mapRowToIntervention,
  mapRowToInterventionWithDocuments,
  buildInsertPayload,
  buildUpdatePayload,
  buildStatusUpdatePayload,
  buildDuplicateSummary,
  STATUS_TO_DB,
  DEFAULT_STATUS,
} from '@/lib/interventions/mappers'

describe('interventions/mappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mapStatusToDb', () => {
    it('should map known status to DB format', () => {
      expect(mapStatusToDb('DEMANDE')).toBe('DEMANDE')
      expect(mapStatusToDb('INTER_EN_COURS')).toBe('INTER_EN_COURS')
      expect(mapStatusToDb('INTER_TERMINEE')).toBe('INTER_TERMINEE')
    })

    it('should return default status when null/undefined', () => {
      expect(mapStatusToDb(null)).toBe(STATUS_TO_DB[DEFAULT_STATUS])
      expect(mapStatusToDb(undefined)).toBe(STATUS_TO_DB[DEFAULT_STATUS])
    })

    it('should return default status for unknown status', () => {
      expect(mapStatusToDb('UNKNOWN' as any)).toBe(STATUS_TO_DB[DEFAULT_STATUS])
    })
  })

  describe('mapStatusFromDb', () => {
    it('should map known DB status to InterventionStatusValue', () => {
      expect(mapStatusFromDb('DEMANDE')).toBe('DEMANDE')
      expect(mapStatusFromDb('INTER_EN_COURS')).toBe('INTER_EN_COURS')
    })

    it('should normalize status with accents', () => {
      expect(mapStatusFromDb('Devis envoyé')).toBe('DEVIS_ENVOYE')
    })

    it('should normalize CLOTURE variants to INTER_TERMINEE', () => {
      expect(mapStatusFromDb('CLOTURE')).toBe('INTER_TERMINEE')
      expect(mapStatusFromDb('CLOTUREE')).toBe('INTER_TERMINEE')
    })

    it('should normalize ATTENTE_ACOMPTE to ATT_ACOMPTE', () => {
      expect(mapStatusFromDb('ATTENTE_ACOMPTE')).toBe('ATT_ACOMPTE')
    })

    it('should return default for null/undefined/empty', () => {
      expect(mapStatusFromDb(null)).toBe(DEFAULT_STATUS)
      expect(mapStatusFromDb(undefined)).toBe(DEFAULT_STATUS)
      expect(mapStatusFromDb('')).toBe(DEFAULT_STATUS)
    })

    it('should return default for unknown status', () => {
      expect(mapStatusFromDb('DOES_NOT_EXIST')).toBe(DEFAULT_STATUS)
    })
  })

  describe('mapRowToIntervention', () => {
    it('should map a basic row to InterventionDTO', () => {
      const row = {
        id: 'int-1',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        commentaire_agent: 'Test intervention',
        agence: 'Paris',
        adresse: '123 Rue de la Paix',
        contexte_intervention: 'Contexte',
        consigne_intervention: 'Consigne',
        statut: 'DEMANDE',
        date_prevue: '2024-02-01',
        id_facture: 12345,
        artisan_id: 'art-1',
        attribue_a: 'user-1',
      }

      const result = mapRowToIntervention(row)

      expect(result.id).toBe('int-1')
      expect(result.name).toBe('Test intervention')
      expect(result.agency).toBe('Paris')
      expect(result.address).toBe('123 Rue de la Paix')
      expect(result.status).toBe('DEMANDE')
      expect(result.artisanId).toBe('art-1')
      expect(result.managerId).toBe('user-1')
      expect(result.isValidated).toBe(true)
      expect(result.invoice2goId).toBe('12345')
    })

    it('should derive name from contexte when commentaire is null', () => {
      const row = {
        id: 'int-2',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        commentaire_agent: null,
        contexte_intervention: 'Short context',
        statut: 'DEMANDE',
      }
      const result = mapRowToIntervention(row)
      expect(result.name).toBe('Short context')
    })

    it('should truncate long contexte to 80 chars', () => {
      const longContext = 'A'.repeat(100)
      const row = {
        id: 'int-3',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        commentaire_agent: null,
        contexte_intervention: longContext,
        statut: 'DEMANDE',
      }
      const result = mapRowToIntervention(row)
      expect(result.name.length).toBeLessThanOrEqual(80)
      expect(result.name).toContain('…')
    })

    it('should derive name from adresse when commentaire and contexte are null', () => {
      const row = {
        id: 'int-4',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        commentaire_agent: null,
        contexte_intervention: null,
        adresse: '456 Avenue des Champs',
        statut: 'DEMANDE',
      }
      const result = mapRowToIntervention(row)
      expect(result.name).toBe('456 Avenue des Champs')
    })

    it('should fallback to "Intervention" when no name source', () => {
      const row = {
        id: 'int-5',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        commentaire_agent: null,
        contexte_intervention: null,
        adresse: null,
        statut: 'DEMANDE',
      }
      const result = mapRowToIntervention(row)
      expect(result.name).toBe('Intervention')
    })

    it('should handle null invoice ID', () => {
      const row = {
        id: 'int-6',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        statut: 'DEMANDE',
        id_facture: null,
      }
      const result = mapRowToIntervention(row)
      expect(result.invoice2goId).toBeNull()
      expect(result.isValidated).toBe(false)
    })
  })

  describe('mapRowToInterventionWithDocuments', () => {
    it('should include empty documents array', () => {
      const row = {
        id: 'int-7',
        date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        statut: 'DEMANDE',
      }
      const result = mapRowToInterventionWithDocuments(row)
      expect(result.documents).toEqual([])
      expect(result.id).toBe('int-7')
    })
  })

  describe('buildInsertPayload', () => {
    it('should build payload from input', () => {
      const input = {
        name: 'New intervention',
        agency: 'Lyon',
        address: '789 Rue de Lyon',
        context: 'Context text',
        status: 'DEMANDE' as const,
        artisanId: 'art-2',
      }
      const payload = buildInsertPayload(input as any)
      expect(payload.agence).toBe('Lyon')
      expect(payload.adresse).toBe('789 Rue de Lyon')
      expect(payload.statut).toBe('DEMANDE')
      expect(payload.artisan_id).toBe('art-2')
      expect(payload.commentaire_agent).toBe('New intervention')
      expect(payload.date).toBeDefined()
      expect(payload.updated_at).toBeDefined()
    })

    it('should handle null/empty values', () => {
      const input = {
        name: '',
        agency: null,
        address: null,
      }
      const payload = buildInsertPayload(input as any)
      expect(payload.agence).toBeNull()
      expect(payload.adresse).toBe('')
      expect(payload.commentaire_agent).toBeNull()
    })
  })

  describe('buildUpdatePayload', () => {
    it('should only include provided fields', () => {
      const input = { name: 'Updated name' }
      const payload = buildUpdatePayload(input as any)
      expect(payload.commentaire_agent).toBe('Updated name')
      expect(payload.updated_at).toBeDefined()
      expect(payload.agence).toBeUndefined()
    })

    it('should return empty payload when no fields provided', () => {
      const payload = buildUpdatePayload({} as any)
      expect(Object.keys(payload)).toHaveLength(0)
    })

    it('should handle status update', () => {
      const input = { status: 'ACCEPTE' as const }
      const payload = buildUpdatePayload(input as any)
      expect(payload.statut).toBe('ACCEPTE')
    })

    it('should handle invoice ID conversion', () => {
      const input = { invoice2goId: '12345' }
      const payload = buildUpdatePayload(input as any)
      expect(payload.id_facture).toBe(12345)
    })

    it('should handle invalid invoice ID', () => {
      const input = { invoice2goId: 'invalid' }
      const payload = buildUpdatePayload(input as any)
      expect(payload.id_facture).toBeNull()
    })

    it('should handle date updates', () => {
      const input = { dueAt: '2024-06-15' }
      const payload = buildUpdatePayload(input as any)
      expect(payload.date_prevue).toBeDefined()
    })
  })

  describe('buildStatusUpdatePayload', () => {
    it('should build status update payload', () => {
      const payload = buildStatusUpdatePayload('ACCEPTE')
      expect(payload.statut).toBe('ACCEPTE')
      expect(payload.updated_at).toBeDefined()
    })

    it('should include dueAt when provided', () => {
      const payload = buildStatusUpdatePayload('INTER_EN_COURS', '2024-06-15')
      expect(payload.date_prevue).toBeDefined()
    })

    it('should include artisanId when provided', () => {
      const payload = buildStatusUpdatePayload('ACCEPTE', null, 'art-1')
      expect(payload.artisan_id).toBe('art-1')
    })

    it('should not include dueAt/artisanId when undefined', () => {
      const payload = buildStatusUpdatePayload('ACCEPTE')
      expect(payload.date_prevue).toBeUndefined()
      expect(payload.artisan_id).toBeUndefined()
    })
  })

  describe('buildDuplicateSummary', () => {
    it('should map rows to summary objects', () => {
      const rows = [
        { id: 'dup-1', adresse: '123 Rue A', contexte_intervention: null, commentaire_agent: 'Test', agence: 'Paris' },
        { id: 'dup-2', adresse: null, contexte_intervention: 'Context', commentaire_agent: null, agence_id: 'ag-1' },
      ]
      const result = buildDuplicateSummary(rows)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('dup-1')
      expect(result[0].name).toBe('Test')
      expect(result[0].agency).toBe('Paris')
      expect(result[1].name).toBe('Context')
      expect(result[1].agency).toBe('ag-1')
    })

    it('should handle empty rows', () => {
      expect(buildDuplicateSummary([])).toEqual([])
    })
  })
})
