import { describe, it, expect } from 'vitest'
import { anonymizeIntervention, anonymizeArtisan } from '@/lib/ai/anonymize'

describe('anonymize', () => {
  describe('anonymizeIntervention', () => {
    const mockIntervention = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      id_inter: 'INT-2026-042',
      contexte_intervention: 'Fuite d\'eau sous l\'evier cuisine',
      consigne_intervention: 'Remplacer le joint du robinet mitigeur',
      commentaire_agent: 'Client presse, deja 2 relances',
      statusValue: 'INTER_EN_COURS',
      statusLabel: 'Intervention en cours',
      metierLabel: 'Plomberie',
      metierCode: 'PLB',
      code_postal: '75001',
      ville: 'Paris',
      date: '2026-01-15',
      date_prevue: '2026-02-15',
      coutIntervention: 450,
      coutSST: 280,
      marge: 170,
      assigned_user_id: 'user-123',
      artisan_id: 'artisan-456',
      // PII that should NOT appear in output
      nom_client: 'Jean Dupont',
      email_client: 'jean@example.com',
      telephone_client: '0612345678',
      adresse: '42 rue de Rivoli',
    }

    it('should preserve business data', () => {
      const result = anonymizeIntervention(mockIntervention)
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.id_inter).toBe('INT-2026-042')
      expect(result.contexte).toBe('Fuite d\'eau sous l\'evier cuisine')
      expect(result.consigne).toBe('Remplacer le joint du robinet mitigeur')
      expect(result.statut_code).toBe('INTER_EN_COURS')
      expect(result.statut_label).toBe('Intervention en cours')
      expect(result.metier_label).toBe('Plomberie')
      expect(result.code_postal).toBe('75001')
      expect(result.ville).toBe('Paris')
      expect(result.cout_intervention).toBe(450)
      expect(result.cout_sst).toBe(280)
      expect(result.marge).toBe(170)
    })

    it('should pseudonymize artisan and gestionnaire IDs', () => {
      const result = anonymizeIntervention(mockIntervention)
      expect(result.artisan_pseudo).toMatch(/^ARTISAN_/)
      expect(result.gestionnaire_pseudo).toMatch(/^USER_/)
      // Should NOT contain the real IDs
      expect(result.artisan_pseudo).not.toContain('artisan-456')
      expect(result.gestionnaire_pseudo).not.toContain('user-123')
    })

    it('should NOT include PII fields', () => {
      const result = anonymizeIntervention(mockIntervention)
      const resultStr = JSON.stringify(result)
      // Should not contain client name, email, phone, or full address
      expect(resultStr).not.toContain('Jean Dupont')
      expect(resultStr).not.toContain('jean@example.com')
      expect(resultStr).not.toContain('0612345678')
      expect(resultStr).not.toContain('42 rue de Rivoli')
    })

    it('should produce deterministic pseudonyms (same input = same output)', () => {
      const result1 = anonymizeIntervention(mockIntervention)
      const result2 = anonymizeIntervention(mockIntervention)
      expect(result1.artisan_pseudo).toBe(result2.artisan_pseudo)
      expect(result1.gestionnaire_pseudo).toBe(result2.gestionnaire_pseudo)
    })

    it('should handle missing/null fields gracefully', () => {
      const sparse = { id: 'abc', id_inter: null }
      const result = anonymizeIntervention(sparse)
      expect(result.id).toBe('abc')
      expect(result.id_inter).toBeNull()
      expect(result.contexte).toBeNull()
      expect(result.artisan_pseudo).toBeNull()
      expect(result.cout_intervention).toBeNull()
    })
  })

  describe('anonymizeArtisan', () => {
    const mockArtisan = {
      id: 'artisan-789',
      prenom: 'Jean',
      nom: 'Martin',
      email: 'jean.martin@example.com',
      telephone: '0612345678',
      code_postal: '75001',
      ville: 'Paris',
      siret: '12345678901234',
      statut_code: 'ACTIF',
      activeInterventionCount: 5,
      metiers: [
        { metier: { label: 'Plomberie' } },
        { metier: { label: 'Chauffage' } },
      ],
      IBAN: 'FR7612345678901234567890123',
      adresse_siege_social: '10 rue de la Paix',
    }

    it('should preserve business data', () => {
      const result = anonymizeArtisan(mockArtisan)
      expect(result.metiers).toEqual(['Plomberie', 'Chauffage'])
      expect(result.zone_code_postal).toBe('75001')
      expect(result.zone_ville).toBe('Paris')
      expect(result.siret).toBe('12345678901234')
      expect(result.statut).toBe('ACTIF')
      expect(result.nombre_interventions_actives).toBe(5)
    })

    it('should pseudonymize the artisan identity', () => {
      const result = anonymizeArtisan(mockArtisan)
      expect(result.pseudo).toMatch(/^ARTISAN_/)
      expect(result.pseudo).not.toContain('artisan-789')
    })

    it('should NOT include PII fields', () => {
      const result = anonymizeArtisan(mockArtisan)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain('Jean')
      expect(resultStr).not.toContain('Martin')
      expect(resultStr).not.toContain('jean.martin@example.com')
      expect(resultStr).not.toContain('0612345678')
      expect(resultStr).not.toContain('FR7612345678901234567890123')
      expect(resultStr).not.toContain('10 rue de la Paix')
    })

    it('should handle empty metiers', () => {
      const artisan = { id: 'x', metiers: [] }
      const result = anonymizeArtisan(artisan)
      expect(result.metiers).toEqual([])
    })
  })
})
