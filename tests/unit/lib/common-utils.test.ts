import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase before importing
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}))

import {
  getSupabaseFunctionsUrl,
  formatFileSize,
  isValidMimeType,
  generateSecurePassword,
  isValidEmail,
  isValidUsername,
  buildUserDisplay,
  mapInterventionRecord,
  mapArtisanRecord,
  chunkArray,
} from '@/lib/api/v2/common/utils'

describe('common/utils', () => {
  describe('getSupabaseFunctionsUrl', () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    it('should use explicit functions URL if set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL = 'https://example.com/functions/v1/'
      expect(getSupabaseFunctionsUrl()).toBe('https://example.com/functions/v1')
    })

    it('should normalize 127.0.0.1 to localhost', () => {
      process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1'
      expect(getSupabaseFunctionsUrl()).toBe('http://localhost:54321/functions/v1')
    })

    it('should build URL from supabase URL', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL
      delete process.env.SUPABASE_FUNCTIONS_URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      expect(getSupabaseFunctionsUrl()).toBe('https://example.supabase.co/functions/v1')
    })

    it('should replace /rest/v1 with /functions/v1', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL
      delete process.env.SUPABASE_FUNCTIONS_URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co/rest/v1'
      expect(getSupabaseFunctionsUrl()).toBe('https://example.supabase.co/functions/v1')
    })

    it('should fallback to localhost when no env vars', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL
      delete process.env.SUPABASE_FUNCTIONS_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_URL
      expect(getSupabaseFunctionsUrl()).toBe('http://localhost:54321/functions/v1')
    })
  })

  describe('formatFileSize', () => {
    it('should return "0 Bytes" for 0', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes')
    })

    it('should format KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format MB', () => {
      expect(formatFileSize(1048576)).toBe('1 MB')
    })

    it('should format GB', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })
  })

  describe('isValidMimeType', () => {
    it('should accept valid image types', () => {
      expect(isValidMimeType('image/jpeg')).toBe(true)
      expect(isValidMimeType('image/png')).toBe(true)
      expect(isValidMimeType('image/gif')).toBe(true)
      expect(isValidMimeType('image/heic')).toBe(true)
    })

    it('should accept PDF', () => {
      expect(isValidMimeType('application/pdf')).toBe(true)
    })

    it('should accept office documents', () => {
      expect(isValidMimeType('application/msword')).toBe(true)
      expect(isValidMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
      expect(isValidMimeType('application/vnd.ms-excel')).toBe(true)
    })

    it('should accept video/mp4', () => {
      expect(isValidMimeType('video/mp4')).toBe(true)
    })

    it('should accept text/plain', () => {
      expect(isValidMimeType('text/plain')).toBe(true)
    })

    it('should reject invalid types', () => {
      expect(isValidMimeType('text/html')).toBe(false)
      expect(isValidMimeType('application/javascript')).toBe(false)
      expect(isValidMimeType('random/type')).toBe(false)
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password of default length 12', () => {
      const pwd = generateSecurePassword()
      expect(pwd.length).toBe(12)
    })

    it('should generate password of specified length', () => {
      expect(generateSecurePassword(8).length).toBe(8)
      expect(generateSecurePassword(20).length).toBe(20)
    })

    it('should only use valid characters', () => {
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
      const pwd = generateSecurePassword(100)
      for (const c of pwd) {
        expect(charset).toContain(c)
      }
    })
  })

  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.fr')).toBe(true)
      expect(isValidEmail('a@b.co')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user @example.com')).toBe(false)
    })
  })

  describe('isValidUsername', () => {
    it('should accept valid usernames', () => {
      expect(isValidUsername('john_doe')).toBe(true)
      expect(isValidUsername('user-123')).toBe(true)
      expect(isValidUsername('abc')).toBe(true)
    })

    it('should reject too short', () => {
      expect(isValidUsername('ab')).toBe(false)
    })

    it('should reject too long', () => {
      expect(isValidUsername('a'.repeat(21))).toBe(false)
    })

    it('should reject special characters', () => {
      expect(isValidUsername('user@name')).toBe(false)
      expect(isValidUsername('user name')).toBe(false)
    })
  })

  describe('buildUserDisplay', () => {
    it('should return null fields for undefined user', () => {
      const result = buildUserDisplay()
      expect(result.username).toBeNull()
      expect(result.fullName).toBeNull()
      expect(result.code).toBeNull()
      expect(result.color).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })

    it('should build display from user data', () => {
      const user = {
        username: 'jdoe',
        firstname: 'Jean',
        lastname: 'Dupont',
        code_gestionnaire: 'JD',
        color: '#ff0000',
        avatar_url: 'https://example.com/avatar.jpg',
      }
      const result = buildUserDisplay(user)
      expect(result.username).toBe('jdoe')
      expect(result.fullName).toBe('Jean Dupont')
      expect(result.code).toBe('JD')
      expect(result.color).toBe('#ff0000')
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should fallback fullName to username', () => {
      const user = { username: 'jdoe' }
      const result = buildUserDisplay(user)
      expect(result.fullName).toBe('jdoe')
    })

    it('should handle partial names', () => {
      const user = { firstname: 'Jean' }
      const result = buildUserDisplay(user)
      expect(result.fullName).toBe('Jean')
    })
  })

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5]
      expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]])
    })

    it('should handle empty array', () => {
      expect(chunkArray([], 3)).toEqual([])
    })

    it('should handle chunk size larger than array', () => {
      expect(chunkArray([1, 2], 5)).toEqual([[1, 2]])
    })

    it('should handle chunk size of 1', () => {
      expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]])
    })
  })

  describe('mapInterventionRecord', () => {
    const defaultRefs = {
      usersById: new Map(),
      agenciesById: new Map(),
      interventionStatusesById: new Map(),
      metiersById: new Map(),
    }

    it('should map basic intervention record', () => {
      const item = {
        id_inter: 'int-1',
        statut: 'DEMANDE',
        adresse: '123 Rue Test',
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.statusValue).toBe('DEMANDE')
      expect(result.adresse).toBe('123 Rue Test')
    })

    it('should resolve user from refs', () => {
      const refs = {
        ...defaultRefs,
        usersById: new Map([['user-1', {
          username: 'jdoe',
          firstname: 'Jean',
          lastname: 'Dupont',
          code_gestionnaire: 'JD',
        }]]),
      }
      const item = { assigned_user_id: 'user-1' }
      const result = mapInterventionRecord(item, refs)
      expect(result.attribueA).toBe('JD')
      expect(result.assignedUserName).toBe('Jean Dupont')
    })

    it('should resolve agency from refs', () => {
      const refs = {
        ...defaultRefs,
        agenciesById: new Map([['ag-1', { label: 'Paris', code: 'PAR', color: '#000' }]]),
      }
      const item = { agence_id: 'ag-1' }
      const result = mapInterventionRecord(item, refs)
      expect(result.agence).toBe('Paris')
      expect(result.agenceLabel).toBe('Paris')
      expect(result.agenceCode).toBe('PAR')
    })

    it('should extract artisan display name from intervention_artisans', () => {
      const item = {
        intervention_artisans: [{
          artisan_id: 'art-1',
          is_primary: true,
          artisans: { prenom: 'Pierre', nom: 'Martin', plain_nom: null, raison_sociale: null },
        }],
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.artisan).toBe('Pierre Martin')
      expect(result.artisans).toEqual(['art-1'])
    })

    it('should fallback artisan name to plain_nom then raison_sociale', () => {
      const item = {
        intervention_artisans: [{
          artisan_id: 'art-1',
          is_primary: true,
          artisans: { prenom: null, nom: null, plain_nom: 'MARTIN P.', raison_sociale: null },
        }],
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.artisan).toBe('MARTIN P.')
    })

    it('should extract costs from intervention_costs', () => {
      const item = {
        intervention_costs: [
          { cost_type: 'intervention', amount: 1000 },
          { cost_type: 'sst', amount: 500 },
          { cost_type: 'materiel', amount: 200 },
        ],
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.coutIntervention).toBe(1000)
      expect(result.coutSST).toBe(500)
      expect(result.coutMateriel).toBe(200)
    })

    it('should prefer costs_cache over computed costs', () => {
      const item = {
        costs_cache: { total_ca: 2000, total_sst: 800, total_materiel: 300, total_marge: 900 },
        intervention_costs: [{ cost_type: 'intervention', amount: 1000 }],
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.coutIntervention).toBe(2000)
      expect(result.coutSST).toBe(800)
    })

    it('should handle empty intervention_artisans', () => {
      const item = { intervention_artisans: [] }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.artisan).toBeNull()
      expect(result.artisans).toEqual([])
    })

    it('should handle status from relationship', () => {
      const item = {
        status: { id: 's-1', code: 'DEMANDE', label: 'Demandé', color: '#3B82F6', sort_order: 1 },
      }
      const result = mapInterventionRecord(item, defaultRefs)
      expect(result.statusValue).toBe('DEMANDE')
      expect(result.statusLabel).toBe('Demandé')
    })
  })

  describe('mapArtisanRecord', () => {
    const defaultRefs = {
      usersById: new Map(),
    }

    it('should map basic artisan record', () => {
      const item = { id: 'art-1', nom: 'Martin' }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.nom).toBe('Martin')
    })

    it('should extract metiers from artisan_metiers', () => {
      const item = {
        artisan_metiers: [
          { metiers: { code: 'PLB', label: 'Plombier' } },
          { metiers: { code: 'ELC', label: 'Electricien' } },
        ],
      }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.metiers).toEqual(['PLB', 'ELC'])
    })

    it('should extract zones from artisan_zones', () => {
      const item = {
        artisan_zones: [
          { zones: { id: 'z-1' } },
          { zones: { id: 'z-2' } },
        ],
      }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.zones).toEqual(['z-1', 'z-2'])
    })

    it('should extract photo profil metadata', () => {
      const item = {
        artisan_attachments: [{
          kind: 'photo_profil',
          url: 'https://storage/photo.jpg',
          content_hash: 'abc123',
          derived_sizes: { sm: 'small.jpg' },
          mime_preferred: 'image/webp',
        }],
      }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.photoProfilMetadata).toBeTruthy()
      expect(result.photoProfilMetadata.hash).toBe('abc123')
      expect(result.photoProfilBaseUrl).toBe('https://storage/photo.jpg')
    })

    it('should handle legacy metiers array', () => {
      const item = { metiers: ['PLB', 'ELC'] }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.metiers).toEqual(['PLB', 'ELC'])
    })

    it('should handle legacy zones array', () => {
      const item = { zones: ['z-1', 'z-2'] }
      const result = mapArtisanRecord(item, defaultRefs)
      expect(result.zones).toEqual(['z-1', 'z-2'])
    })

    it('should resolve gestionnaire from refs', () => {
      const refs = {
        usersById: new Map([['user-1', {
          username: 'mgr',
          firstname: 'Marie',
          lastname: 'Curie',
          code_gestionnaire: 'MC',
        }]]),
      }
      const item = { gestionnaire_id: 'user-1' }
      const result = mapArtisanRecord(item, refs)
      expect(result.attribueA).toBe('MC')
      expect(result.gestionnaireName).toBe('Marie Curie')
    })
  })
})
