import { describe, it, expect } from 'vitest'
import {
  getAddressSegments,
  getFormattedAddress,
  getStatusInfo,
  getPrimaryMetier,
  getNumeroAssocie,
  getDistanceKm,
  getFormattedDistance,
  getAllPhones,
  hasPhone,
  hasEmail,
  hasAddress,
} from '@/lib/artisans/helpers'
import type { ArtisanDisplayData } from '@/lib/artisans/types'

const createMockData = (overrides: Partial<ArtisanDisplayData> = {}): ArtisanDisplayData => ({
  prenom: 'Jean',
  nom: 'Dupont',
  plain_nom: 'DUPONT Jean',
  raison_sociale: 'Entreprise DUPONT',
  telephone: '06 12 34 56 78',
  telephone2: '01 23 45 67 89',
  email: 'jean@dupont.fr',
  statut_id: 'stat-1',
  distanceKm: 12.5,
  address: {
    street: '123 Rue de la Paix',
    postalCode: '75001',
    city: 'Paris',
    source: 'intervention',
  },
  primaryMetier: { id: 'met-1', code: 'PLB', label: 'Plombier' },
  statusInfo: { label: 'Expert', color: '#22c55e' },
  numero_associe: 'A12345',
  photoProfilMetadata: null,
  ...overrides,
})

describe('artisans/helpers', () => {
  describe('getAddressSegments', () => {
    it('should return all address segments', () => {
      const data = createMockData()
      const result = getAddressSegments(data)
      expect(result.street).toBe('123 Rue de la Paix')
      expect(result.postalCode).toBe('75001')
      expect(result.city).toBe('Paris')
    })

    it('should return null segments for empty address', () => {
      const data = createMockData({
        address: { street: null, postalCode: null, city: null, source: null },
      })
      const result = getAddressSegments(data)
      expect(result.street).toBeNull()
      expect(result.postalCode).toBeNull()
      expect(result.city).toBeNull()
    })
  })

  describe('getFormattedAddress', () => {
    it('should format full address', () => {
      const data = createMockData()
      expect(getFormattedAddress(data)).toBe('123 Rue de la Paix, 75001 Paris')
    })

    it('should use custom separator', () => {
      const data = createMockData()
      expect(getFormattedAddress(data, ' - ')).toBe('123 Rue de la Paix - 75001 Paris')
    })

    it('should handle only postal code', () => {
      const data = createMockData({
        address: { street: null, postalCode: '75001', city: null, source: null },
      })
      expect(getFormattedAddress(data)).toBe('75001')
    })

    it('should handle only city', () => {
      const data = createMockData({
        address: { street: null, postalCode: null, city: 'Paris', source: null },
      })
      expect(getFormattedAddress(data)).toBe('Paris')
    })

    it('should return null for empty address', () => {
      const data = createMockData({
        address: { street: null, postalCode: null, city: null, source: null },
      })
      expect(getFormattedAddress(data)).toBeNull()
    })
  })

  describe('getStatusInfo', () => {
    it('should return status info', () => {
      const data = createMockData()
      expect(getStatusInfo(data)).toEqual({ label: 'Expert', color: '#22c55e' })
    })

    it('should return null when no status', () => {
      const data = createMockData({ statusInfo: null })
      expect(getStatusInfo(data)).toBeNull()
    })
  })

  describe('getPrimaryMetier', () => {
    it('should return primary metier', () => {
      const data = createMockData()
      expect(getPrimaryMetier(data)).toEqual({ id: 'met-1', code: 'PLB', label: 'Plombier' })
    })

    it('should return null when no metier', () => {
      const data = createMockData({ primaryMetier: null })
      expect(getPrimaryMetier(data)).toBeNull()
    })
  })

  describe('getNumeroAssocie', () => {
    it('should return numero associe', () => {
      const data = createMockData()
      expect(getNumeroAssocie(data)).toBe('A12345')
    })

    it('should return null when not set', () => {
      const data = createMockData({ numero_associe: null })
      expect(getNumeroAssocie(data)).toBeNull()
    })
  })

  describe('getDistanceKm', () => {
    it('should return distance', () => {
      const data = createMockData()
      expect(getDistanceKm(data)).toBe(12.5)
    })

    it('should return null when not set', () => {
      const data = createMockData({ distanceKm: null })
      expect(getDistanceKm(data)).toBeNull()
    })
  })

  describe('getFormattedDistance', () => {
    it('should format distance with defaults', () => {
      const data = createMockData()
      expect(getFormattedDistance(data)).toBe('12.5 km')
    })

    it('should format with custom decimals and unit', () => {
      const data = createMockData()
      expect(getFormattedDistance(data, 2, 'km')).toBe('12.50km')
    })

    it('should return null when no distance', () => {
      const data = createMockData({ distanceKm: null })
      expect(getFormattedDistance(data)).toBeNull()
    })
  })

  describe('getAllPhones', () => {
    it('should return both phones', () => {
      const data = createMockData()
      expect(getAllPhones(data)).toEqual(['06 12 34 56 78', '01 23 45 67 89'])
    })

    it('should return single phone', () => {
      const data = createMockData({ telephone2: null })
      expect(getAllPhones(data)).toEqual(['06 12 34 56 78'])
    })

    it('should return empty array when no phones', () => {
      const data = createMockData({ telephone: null, telephone2: null })
      expect(getAllPhones(data)).toEqual([])
    })
  })

  describe('hasPhone', () => {
    it('should return true when has phone', () => {
      expect(hasPhone(createMockData())).toBe(true)
    })

    it('should return true when only phone2', () => {
      expect(hasPhone(createMockData({ telephone: null }))).toBe(true)
    })

    it('should return false when no phones', () => {
      expect(hasPhone(createMockData({ telephone: null, telephone2: null }))).toBe(false)
    })
  })

  describe('hasEmail', () => {
    it('should return true when has email', () => {
      expect(hasEmail(createMockData())).toBe(true)
    })

    it('should return false when no email', () => {
      expect(hasEmail(createMockData({ email: null }))).toBe(false)
    })
  })

  describe('hasAddress', () => {
    it('should return true when has any address segment', () => {
      expect(hasAddress(createMockData())).toBe(true)
    })

    it('should return true when only city', () => {
      const data = createMockData({
        address: { street: null, postalCode: null, city: 'Paris', source: null },
      })
      expect(hasAddress(data)).toBe(true)
    })

    it('should return false when no address', () => {
      const data = createMockData({
        address: { street: null, postalCode: null, city: null, source: null },
      })
      expect(hasAddress(data)).toBe(false)
    })
  })
})
