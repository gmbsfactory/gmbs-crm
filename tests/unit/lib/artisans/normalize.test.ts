import { describe, it, expect } from 'vitest'
import { normalizeArtisanData } from '@/lib/artisans/normalize'

describe('artisans/normalize', () => {
  const createNearbyArtisan = (overrides: Record<string, any> = {}) => ({
    id: 'art-1',
    displayName: 'DUPONT Jean',
    lat: 48.8566,
    lng: 2.3522,
    prenom: 'Jean',
    nom: 'Dupont',
    raison_sociale: 'Entreprise DUPONT',
    telephone: '0612345678',
    telephone2: '0123456789',
    email: 'jean@dupont.fr',
    statut_id: 'stat-1',
    distanceKm: 12.5,
    adresse: '123 Rue de la Paix',
    codePostal: '75001',
    ville: 'Paris',
    ...overrides,
  })

  const createSearchResult = (overrides: Record<string, any> = {}) => ({
    id: 'art-2',
    prenom: 'Marie',
    nom: 'Martin',
    plain_nom: 'MARTIN Marie',
    raison_sociale: 'Martin SARL',
    telephone: '0698765432',
    telephone2: null,
    email: 'marie@martin.fr',
    statut_id: 'stat-2',
    distanceKm: 5.3,
    numero_associe: 'A98765',
    adresse_intervention: '456 Avenue B',
    code_postal_intervention: '69001',
    ville_intervention: 'Lyon',
    adresse_siege_social: '789 Blvd C',
    code_postal_siege_social: '69002',
    ville_siege_social: 'Lyon 2',
    metiers: [
      { is_primary: true, metier: { id: 'met-1', code: 'PLB', label: 'Plombier' } },
      { is_primary: false, metier: { id: 'met-2', code: 'ELC', label: 'Électricien' } },
    ],
    status: { label: 'Expert', color: '#22c55e' },
    ...overrides,
  })

  describe('NearbyArtisan normalization', () => {
    it('should normalize basic fields', () => {
      const data = normalizeArtisanData(createNearbyArtisan())
      expect(data.prenom).toBe('Jean')
      expect(data.nom).toBe('Dupont')
      expect(data.raison_sociale).toBe('Entreprise DUPONT')
      expect(data.telephone).toBe('0612345678')
      expect(data.email).toBe('jean@dupont.fr')
      expect(data.distanceKm).toBe(12.5)
    })

    it('should extract plain_nom from displayName', () => {
      const data = normalizeArtisanData(createNearbyArtisan())
      expect(data.plain_nom).toBe('DUPONT Jean')
    })

    it('should extract address from NearbyArtisan', () => {
      const data = normalizeArtisanData(createNearbyArtisan())
      expect(data.address.street).toBe('123 Rue de la Paix')
      expect(data.address.postalCode).toBe('75001')
      expect(data.address.city).toBe('Paris')
      expect(data.address.source).toBe('intervention')
    })

    it('should set address source to null when no address', () => {
      const data = normalizeArtisanData(createNearbyArtisan({
        adresse: null, codePostal: null, ville: null,
      }))
      expect(data.address.source).toBeNull()
    })

    it('should not extract metier from NearbyArtisan', () => {
      const data = normalizeArtisanData(createNearbyArtisan())
      expect(data.primaryMetier).toBeNull()
    })

    it('should resolve status from refData', () => {
      const refData = {
        statuts: [{ id: 'stat-1', code: 'EXPERT', label: 'Expert', color: '#22c55e' }],
      }
      const data = normalizeArtisanData(createNearbyArtisan(), { refData })
      expect(data.statusInfo).toEqual({ label: 'Expert', color: '#22c55e' })
    })

    it('should set statusInfo null without refData', () => {
      const data = normalizeArtisanData(createNearbyArtisan())
      expect(data.statusInfo).toBeNull()
    })

    it('should extract photoProfilMetadata', () => {
      const metadata = { hash: 'abc', sizes: {}, mime_preferred: 'image/webp', baseUrl: '/photo.jpg' }
      const data = normalizeArtisanData(createNearbyArtisan({ photoProfilMetadata: metadata }))
      expect(data.photoProfilMetadata).toEqual(metadata)
    })
  })

  describe('ArtisanSearchResult normalization', () => {
    it('should normalize basic fields', () => {
      const data = normalizeArtisanData(createSearchResult())
      expect(data.prenom).toBe('Marie')
      expect(data.nom).toBe('Martin')
      expect(data.plain_nom).toBe('MARTIN Marie')
      expect(data.numero_associe).toBe('A98765')
    })

    it('should extract primary metier', () => {
      const data = normalizeArtisanData(createSearchResult())
      expect(data.primaryMetier).toEqual({ id: 'met-1', code: 'PLB', label: 'Plombier' })
    })

    it('should extract status from search result', () => {
      const data = normalizeArtisanData(createSearchResult())
      expect(data.statusInfo).toEqual({ label: 'Expert', color: '#22c55e' })
    })

    it('should use intervention address by default', () => {
      const data = normalizeArtisanData(createSearchResult())
      expect(data.address.street).toBe('456 Avenue B')
      expect(data.address.postalCode).toBe('69001')
      expect(data.address.city).toBe('Lyon')
      expect(data.address.source).toBe('intervention')
    })

    it('should use siege address when prioritized', () => {
      const data = normalizeArtisanData(createSearchResult(), { addressPriority: 'siege' })
      expect(data.address.street).toBe('789 Blvd C')
      expect(data.address.city).toBe('Lyon 2')
      expect(data.address.source).toBe('siege')
    })

    it('should fallback to intervention when siege prioritized but not available', () => {
      const artisan = createSearchResult({
        adresse_siege_social: null,
        ville_siege_social: null,
        code_postal_siege_social: null,
      })
      const data = normalizeArtisanData(artisan, { addressPriority: 'siege' })
      expect(data.address.source).toBe('intervention')
    })

    it('should fallback to siege when intervention not available', () => {
      const artisan = createSearchResult({
        adresse_intervention: null,
        ville_intervention: null,
        code_postal_intervention: null,
      })
      const data = normalizeArtisanData(artisan)
      expect(data.address.source).toBe('siege')
    })

    it('should set empty address when neither available', () => {
      const artisan = createSearchResult({
        adresse_intervention: null,
        ville_intervention: null,
        code_postal_intervention: null,
        adresse_siege_social: null,
        ville_siege_social: null,
        code_postal_siege_social: null,
      })
      const data = normalizeArtisanData(artisan)
      expect(data.address.source).toBeNull()
      expect(data.address.street).toBeNull()
    })
  })

  describe('null/undefined field handling', () => {
    it('should handle all null fields in NearbyArtisan', () => {
      const artisan = createNearbyArtisan({
        prenom: undefined,
        nom: undefined,
        raison_sociale: undefined,
        telephone: undefined,
        telephone2: undefined,
        email: undefined,
        statut_id: undefined,
        distanceKm: undefined,
        displayName: undefined,
      })
      const data = normalizeArtisanData(artisan)
      expect(data.prenom).toBeNull()
      expect(data.nom).toBeNull()
      expect(data.telephone).toBeNull()
      expect(data.email).toBeNull()
      expect(data.plain_nom).toBeNull()
    })
  })
})
