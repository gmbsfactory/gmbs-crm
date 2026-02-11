import { describe, it, expect } from 'vitest'
import { getDisplayName, getAllDisplayModes } from '@/lib/artisans/display-modes'
import type { ArtisanDisplayData } from '@/lib/artisans/types'

const createMockData = (overrides: Partial<ArtisanDisplayData> = {}): ArtisanDisplayData => ({
  prenom: 'Jean',
  nom: 'Dupont',
  plain_nom: 'DUPONT Jean',
  raison_sociale: 'Entreprise DUPONT SARL',
  telephone: '06 12 34 56 78',
  telephone2: '01 23 45 67 89',
  email: 'jean@dupont.fr',
  statut_id: null,
  distanceKm: null,
  address: { street: null, postalCode: null, city: null, source: null },
  primaryMetier: null,
  statusInfo: null,
  numero_associe: null,
  photoProfilMetadata: null,
  ...overrides,
})

describe('artisans/display-modes', () => {
  describe('getDisplayName - mode "nom"', () => {
    it('should return prenom + nom', () => {
      expect(getDisplayName(createMockData(), 'nom')).toBe('Jean Dupont')
    })

    it('should fallback to plain_nom', () => {
      expect(getDisplayName(createMockData({ prenom: null, nom: null }), 'nom')).toBe('DUPONT Jean')
    })

    it('should fallback to raison_sociale', () => {
      expect(getDisplayName(createMockData({ prenom: null, nom: null, plain_nom: null }), 'nom'))
        .toBe('Entreprise DUPONT SARL')
    })

    it('should return "Artisan sans nom" as last resort', () => {
      expect(getDisplayName(createMockData({
        prenom: null, nom: null, plain_nom: null, raison_sociale: null,
      }), 'nom')).toBe('Artisan sans nom')
    })

    it('should default to "nom" mode', () => {
      expect(getDisplayName(createMockData())).toBe('Jean Dupont')
    })
  })

  describe('getDisplayName - mode "rs"', () => {
    it('should return raison_sociale first', () => {
      expect(getDisplayName(createMockData(), 'rs')).toBe('Entreprise DUPONT SARL')
    })

    it('should fallback to prenom + nom', () => {
      expect(getDisplayName(createMockData({ raison_sociale: null }), 'rs')).toBe('Jean Dupont')
    })

    it('should fallback to plain_nom', () => {
      expect(getDisplayName(createMockData({
        raison_sociale: null, prenom: null, nom: null,
      }), 'rs')).toBe('DUPONT Jean')
    })

    it('should return "Raison sociale inconnue" as last resort', () => {
      expect(getDisplayName(createMockData({
        raison_sociale: null, prenom: null, nom: null, plain_nom: null,
      }), 'rs')).toBe('Raison sociale inconnue')
    })
  })

  describe('getDisplayName - mode "tel"', () => {
    it('should return telephone first', () => {
      expect(getDisplayName(createMockData(), 'tel')).toBe('06 12 34 56 78')
    })

    it('should fallback to telephone2', () => {
      expect(getDisplayName(createMockData({ telephone: null }), 'tel')).toBe('01 23 45 67 89')
    })

    it('should return "Aucun téléphone" as last resort', () => {
      expect(getDisplayName(createMockData({
        telephone: null, telephone2: null,
      }), 'tel')).toBe('Aucun téléphone')
    })
  })

  describe('getAllDisplayModes', () => {
    it('should return all three modes', () => {
      const data = createMockData()
      const result = getAllDisplayModes(data)
      expect(result.nom).toBe('Jean Dupont')
      expect(result.rs).toBe('Entreprise DUPONT SARL')
      expect(result.tel).toBe('06 12 34 56 78')
    })
  })
})
