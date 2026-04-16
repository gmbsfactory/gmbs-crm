import { describe, it, expect } from 'vitest'
import { convertInterventionToSearchRecord } from '@/lib/api/search-utils'

describe('search-utils', () => {
  describe('convertInterventionToSearchRecord', () => {
    const baseIntervention = {
      id: 'int-1',
      id_inter: 'INT-001',
      agence_id: 'ag-1',
      statut_id: 'st-1',
      metier_id: 'met-1',
      assigned_user_id: 'usr-1',
      contexte_intervention: 'Fuite eau',
      consigne_intervention: 'Appeler avant',
      commentaire_agent: 'Urgent',
      adresse: '10 Rue A',
      code_postal: '75001',
      ville: 'Paris',
      date: '2024-01-15',
      date_prevue: '2024-01-16',
      due_date: '2024-01-20',
      numero_sst: 'SST-001',
      pourcentage_sst: 30,
      tenant: {
        id: 't-1',
        firstname: 'Jean',
        lastname: 'Dupont',
        telephone: '0612345678',
        telephone2: null,
        email: 'jean@test.fr',
        adresse: '11 Rue B',
        code_postal: '75002',
        ville: 'Paris',
      },
      owner: {
        id: 'o-1',
        owner_firstname: 'Marie',
        owner_lastname: 'Martin',
        telephone: '0698765432',
        telephone2: null,
        email: 'marie@test.fr',
        adresse: '12 Rue C',
        code_postal: '75003',
        ville: 'Paris',
      },
      status: { id: 'st-1', code: 'DEMANDE', label: 'Demandé' },
      assigned_user: {
        id: 'usr-1',
        firstname: 'Pierre',
        lastname: 'Durand',
        username: 'pdurand',
        code_gestionnaire: 'PD',
        color: '#FF0000',
        avatar_url: null,
      },
      metier: { id: 'met-1', code: 'PLB', label: 'Plomberie' },
      artisans: [
        {
          is_primary: true,
          role: 'principal',
          artisan: { id: 'art-1', prenom: 'Luc', nom: 'Blanc', numero_associe: 'A001', telephone: '0601010101', telephone2: null },
        },
        {
          is_primary: false,
          role: 'secondaire',
          artisan: { id: 'art-2', prenom: 'Eve', nom: 'Noir', numero_associe: 'A002', telephone: '0602020202', telephone2: null },
        },
      ],
      payments: [{ id: 'pay-1', amount: 100 }],
    }

    it('should map basic fields correctly', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.id).toBe('int-1')
      expect(record.id_inter).toBe('INT-001')
      expect(record.agence_id).toBe('ag-1')
      expect(record.statut_id).toBe('st-1')
      expect(record.adresse).toBe('10 Rue A')
      expect(record.ville).toBe('Paris')
      expect(record.numero_sst).toBe('SST-001')
      expect(record.pourcentage_sst).toBe(30)
    })

    it('should map tenant correctly', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.tenant).toEqual({
        id: 't-1',
        firstname: 'Jean',
        lastname: 'Dupont',
        telephone: '0612345678',
        telephone2: null,
        email: 'jean@test.fr',
        adresse: '11 Rue B',
        code_postal: '75002',
        ville: 'Paris',
      })
    })

    it('should map owner correctly', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.owner).toEqual({
        id: 'o-1',
        owner_firstname: 'Marie',
        owner_lastname: 'Martin',
        telephone: '0698765432',
        telephone2: null,
        email: 'marie@test.fr',
        adresse: '12 Rue C',
        code_postal: '75003',
        ville: 'Paris',
      })
    })

    it('should set tenant to null when not present', () => {
      const record = convertInterventionToSearchRecord({ ...baseIntervention, tenant: null })
      expect(record.tenant).toBeNull()
    })

    it('should set owner to null when not present', () => {
      const record = convertInterventionToSearchRecord({ ...baseIntervention, owner: null })
      expect(record.owner).toBeNull()
    })

    it('should map assigned_user correctly', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.assigned_user).toEqual({
        id: 'usr-1',
        firstname: 'Pierre',
        lastname: 'Durand',
        username: 'pdurand',
        code_gestionnaire: 'PD',
        color: '#FF0000',
        avatar_url: null,
      })
    })

    it('should set assigned_user to null when not present', () => {
      const record = convertInterventionToSearchRecord({ ...baseIntervention, assigned_user: null })
      expect(record.assigned_user).toBeNull()
    })

    it('should map intervention_artisans from artisans field', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.intervention_artisans).toHaveLength(2)
      expect(record.intervention_artisans[0].is_primary).toBe(true)
      expect(record.intervention_artisans[0].artisan.nom).toBe('Blanc')
    })

    it('should set primaryArtisan to primary artisan', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.primaryArtisan?.id).toBe('art-1')
      expect(record.primaryArtisan?.nom).toBe('Blanc')
    })

    it('should fallback primaryArtisan to first artisan if no primary', () => {
      const intervention = {
        ...baseIntervention,
        artisans: [
          { is_primary: false, role: 'secondaire', artisan: { id: 'art-2', prenom: 'Eve', nom: 'Noir' } },
        ],
      }
      const record = convertInterventionToSearchRecord(intervention)
      expect(record.primaryArtisan?.id).toBe('art-2')
    })

    it('should set primaryArtisan to null when no artisans', () => {
      const record = convertInterventionToSearchRecord({ ...baseIntervention, artisans: [] })
      expect(record.primaryArtisan).toBeNull()
    })

    it('should use intervention_artisans field as fallback', () => {
      const intervention = {
        ...baseIntervention,
        artisans: undefined,
        intervention_artisans: [
          { is_primary: true, role: 'principal', artisan: { id: 'art-3', prenom: 'Max', nom: 'Roux' } },
        ],
      }
      const record = convertInterventionToSearchRecord(intervention)
      expect(record.intervention_artisans).toHaveLength(1)
      expect(record.primaryArtisan?.id).toBe('art-3')
    })

    it('should handle artisans without artisan sub-object (flat format)', () => {
      const intervention = {
        ...baseIntervention,
        artisans: [
          { is_primary: true, role: 'principal', id: 'art-4', prenom: 'Bob', nom: 'Vert', numero_associe: 'A004', telephone: '0604040404', telephone2: null },
        ],
      }
      const record = convertInterventionToSearchRecord(intervention)
      expect(record.intervention_artisans[0].artisan.id).toBe('art-4')
      expect(record.intervention_artisans[0].artisan.nom).toBe('Vert')
    })

    it('should map payments', () => {
      const record = convertInterventionToSearchRecord(baseIntervention)
      expect(record.payments).toEqual([{ id: 'pay-1', amount: 100 }])
    })
  })
})
