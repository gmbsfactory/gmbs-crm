import { describe, it, expect } from 'vitest'
import { buildPrompt, ACTION_LABELS, ACTION_DESCRIPTIONS } from '@/lib/ai/prompts'
import type { AnonymizedIntervention, AnonymizedArtisan } from '@/lib/ai/types'

describe('prompts', () => {
  const mockIntervention: AnonymizedIntervention = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    id_inter: 'INT-2026-042',
    contexte: 'Fuite d\'eau sous l\'evier cuisine',
    consigne: 'Remplacer le joint du robinet mitigeur',
    consigne_second_artisan: null,
    commentaire_agent: 'Client presse',
    statut_code: 'INTER_EN_COURS',
    statut_label: 'Intervention en cours',
    metier_label: 'Plomberie',
    metier_code: 'PLB',
    code_postal: '75001',
    ville: 'Paris',
    date: '2026-01-15',
    date_prevue: '2026-02-15',
    date_termine: null,
    artisan_pseudo: 'ARTISAN_XY1234',
    gestionnaire_pseudo: 'USER_AB5678',
    agence_label: 'Paris Centre',
    cout_intervention: 450,
    cout_sst: 280,
    marge: 170,
  }

  const mockArtisan: AnonymizedArtisan = {
    id: 'artisan-789',
    pseudo: 'ARTISAN_XY1234',
    metiers: ['Plomberie', 'Chauffage'],
    zone_code_postal: '75001',
    zone_ville: 'Paris',
    statut: 'ACTIF',
    nombre_interventions_actives: 5,
    siret: '12345678901234',
  }

  describe('buildPrompt', () => {
    it('should build summary prompt for intervention', () => {
      const { system, user } = buildPrompt('summary', mockIntervention)
      expect(system).toContain('CRM')
      expect(system).toContain('francais')
      expect(user).toContain('INT-2026-042')
      expect(user).toContain('Intervention en cours')
      expect(user).toContain('Plomberie')
      expect(user).toContain('75001')
      expect(user).toContain('450 EUR')
    })

    it('should build summary prompt for artisan', () => {
      const { system, user } = buildPrompt('summary', mockArtisan)
      expect(system).toContain('CRM')
      expect(user).toContain('ARTISAN_XY1234')
      expect(user).toContain('Plomberie')
      expect(user).toContain('Chauffage')
    })

    it('should build next_steps prompt', () => {
      const { user } = buildPrompt('next_steps', mockIntervention)
      expect(user).toContain('prochaines actions')
      expect(user).toContain('INTER_EN_COURS')
    })

    it('should build email_artisan prompt', () => {
      const { user } = buildPrompt('email_artisan', mockIntervention)
      expect(user).toContain('[NOM_ARTISAN]')
      expect(user).toContain('Objet')
    })

    it('should build email_client prompt', () => {
      const { user } = buildPrompt('email_client', mockIntervention)
      expect(user).toContain('[NOM_CLIENT]')
      expect(user).toContain('Objet')
    })

    it('should build find_artisan prompt', () => {
      const { user } = buildPrompt('find_artisan', mockIntervention)
      expect(user).toContain('profil')
      expect(user).toContain('Plomberie')
    })

    it('should build suggestions prompt', () => {
      const { user } = buildPrompt('suggestions', null, 'intervention_list')
      expect(user).toContain('actions utiles')
      expect(user).toContain('intervention_list')
    })

    it('should build stats_insights prompt', () => {
      const { user } = buildPrompt('stats_insights')
      expect(user).toContain('insights')
      expect(user).toContain('tendances')
    })

    it('should never include PII in prompts', () => {
      // The buildPrompt function receives already-anonymized data,
      // so it should not contain any real names or emails
      const { user } = buildPrompt('summary', mockIntervention)
      expect(user).not.toContain('jean')
      expect(user).not.toContain('dupont')
      expect(user).not.toContain('@example.com')
    })
  })

  describe('ACTION_LABELS', () => {
    it('should have labels for all action types', () => {
      const expectedActions = [
        'summary', 'next_steps', 'email_artisan', 'email_client',
        'find_artisan', 'suggestions', 'stats_insights'
      ]
      for (const action of expectedActions) {
        expect(ACTION_LABELS[action as keyof typeof ACTION_LABELS]).toBeTruthy()
      }
    })
  })

  describe('ACTION_DESCRIPTIONS', () => {
    it('should have descriptions for all action types', () => {
      const expectedActions = [
        'summary', 'next_steps', 'email_artisan', 'email_client',
        'find_artisan', 'suggestions', 'stats_insights'
      ]
      for (const action of expectedActions) {
        expect(ACTION_DESCRIPTIONS[action as keyof typeof ACTION_DESCRIPTIONS]).toBeTruthy()
      }
    })
  })
})
