import { describe, it, expect } from 'vitest'
import { convertViewFiltersToServerFilters, convertArtisanFiltersToServerFilters } from '@/lib/filter-converter'

describe('filter-converter', () => {
  const createContext = (overrides = {}) => ({
    statusCodeToId: (code: string | string[]) => {
      const map: Record<string, string> = { DEMANDE: 'id-1', ACCEPTE: 'id-2' }
      if (Array.isArray(code)) return code.map(c => map[c]).filter(Boolean)
      return map[code]
    },
    userCodeToId: (code: string | string[]) => {
      const map: Record<string, string> = { jean: 'user-1', marie: 'user-2' }
      if (Array.isArray(code)) return code.map(c => map[c]).filter(Boolean)
      return map[code]
    },
    currentUserId: 'current-user-id',
    ...overrides,
  })

  describe('convertViewFiltersToServerFilters', () => {
    describe('statusValue filters', () => {
      it('should convert eq statusValue to server statut', () => {
        const filters = [{ property: 'statusValue', operator: 'eq', value: 'DEMANDE' }]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.statut).toBe('id-1')
        expect(clientFilters).toHaveLength(0)
      })

      it('should fallback to client when status code unknown', () => {
        const filters = [{ property: 'statusValue', operator: 'eq', value: 'UNKNOWN' }]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.statut).toBeUndefined()
        expect(clientFilters).toHaveLength(1)
      })

      it('should convert in statusValue to server statuts', () => {
        const filters = [{ property: 'statusValue', operator: 'in', value: ['DEMANDE', 'ACCEPTE'] }]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.statuts).toEqual(['id-1', 'id-2'])
        expect(clientFilters).toHaveLength(0)
      })

      it('should fallback in operator when no valid statuses', () => {
        const filters = [{ property: 'statusValue', operator: 'in', value: ['UNKNOWN'] }]
        const ctx = createContext({ statusCodeToId: () => [] })
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, ctx)
        expect(clientFilters).toHaveLength(1)
      })

      it('should fallback in operator with non-string values', () => {
        const filters = [{ property: 'statusValue', operator: 'in', value: [123, null] }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })

      it('should fallback unsupported operators to client', () => {
        const filters = [{ property: 'statusValue', operator: 'gte', value: 'DEMANDE' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })
    })

    describe('attribueA filters', () => {
      it('should convert is_empty to null user', () => {
        const filters = [{ property: 'attribueA', operator: 'is_empty', value: null }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBeNull()
      })

      it('should skip __NO_USER_USERNAME__ placeholder', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: '__NO_USER_USERNAME__' }]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBeUndefined()
        expect(clientFilters).toHaveLength(0)
      })

      it('should convert CURRENT_USER to currentUserId', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: 'CURRENT_USER' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBe('current-user-id')
      })

      it('should convert __CURRENT_USER__ to currentUserId', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: '__CURRENT_USER__' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBe('current-user-id')
      })

      it('should convert __CURRENT_USER_USERNAME__ to currentUserId', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: '__CURRENT_USER_USERNAME__' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBe('current-user-id')
      })

      it('should fallback CURRENT_USER to client when no currentUserId', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: 'CURRENT_USER' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext({ currentUserId: undefined }))
        expect(clientFilters).toHaveLength(1)
      })

      it('should convert known user code to userId', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: 'jean' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBe('user-1')
      })

      it('should fallback unknown user to client', () => {
        const filters = [{ property: 'attribueA', operator: 'eq', value: 'inconnu' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })

      it('should convert in operator with CURRENT_USER', () => {
        const filters = [{ property: 'attribueA', operator: 'in', value: ['CURRENT_USER'] }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBe('current-user-id')
      })

      it('should skip __NO_USER_USERNAME__ in in operator', () => {
        const filters = [{ property: 'attribueA', operator: 'in', value: ['__NO_USER_USERNAME__'] }]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.user).toBeUndefined()
        expect(clientFilters).toHaveLength(0)
      })

      it('should fallback in operator when no valid ids', () => {
        const ctx = createContext({ userCodeToId: () => undefined })
        const filters = [{ property: 'attribueA', operator: 'in', value: ['unknown1'] }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, ctx)
        expect(clientFilters).toHaveLength(1)
      })

      it('should fallback unsupported operators to client', () => {
        const filters = [{ property: 'attribueA', operator: 'gte', value: 'jean' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })
    })

    describe('dateIntervention filters', () => {
      it('should convert between with object {from,to}', () => {
        const filters = [{ property: 'dateIntervention', operator: 'between', value: { from: '2024-01-01', to: '2024-12-31' } }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.startDate).toBe('2024-01-01')
        expect(serverFilters.endDate).toBe('2024-12-31')
      })

      it('should convert between with array [from, to]', () => {
        const filters = [{ property: 'dateIntervention', operator: 'between', value: ['2024-01-01', '2024-12-31'] }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.startDate).toBe('2024-01-01')
        expect(serverFilters.endDate).toBe('2024-12-31')
      })

      it('should fallback between with invalid value', () => {
        const filters = [{ property: 'dateIntervention', operator: 'between', value: 'invalid' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })

      it('should convert gte to startDate', () => {
        const filters = [{ property: 'dateIntervention', operator: 'gte', value: '2024-01-01' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.startDate).toBe('2024-01-01')
      })

      it('should convert lte to endDate', () => {
        const filters = [{ property: 'dateIntervention', operator: 'lte', value: '2024-12-31' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.endDate).toBe('2024-12-31')
      })

      it('should also work with "date" property', () => {
        const filters = [{ property: 'date', operator: 'gte', value: '2024-06-01' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.startDate).toBe('2024-06-01')
      })

      it('should fallback unsupported date operators', () => {
        const filters = [{ property: 'dateIntervention', operator: 'eq', value: '2024-01-01' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })
    })

    describe('isCheck filters', () => {
      it('should convert eq boolean to server isCheck', () => {
        const filters = [{ property: 'isCheck', operator: 'eq', value: true }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.isCheck).toBe(true)
      })

      it('should fallback non-boolean isCheck to client', () => {
        const filters = [{ property: 'isCheck', operator: 'eq', value: 'yes' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })
    })

    describe('metier filters', () => {
      it('should convert eq metier', () => {
        const filters = [{ property: 'metier', operator: 'eq', value: 'PLB' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.metier).toBe('PLB')
      })

      it('should convert in metiers', () => {
        const filters = [{ property: 'metier', operator: 'in', value: ['PLB', 'ELC'] }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.metiers).toEqual(['PLB', 'ELC'])
      })

      it('should also work with metierCode property', () => {
        const filters = [{ property: 'metierCode', operator: 'eq', value: 'PLB' }]
        const { serverFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.metier).toBe('PLB')
      })

      it('should fallback in metiers with no string values', () => {
        const filters = [{ property: 'metier', operator: 'in', value: [123] }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })

      it('should fallback unsupported metier operators', () => {
        const filters = [{ property: 'metier', operator: 'gte', value: 'PLB' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
      })
    })

    describe('unsupported filters', () => {
      it('should push unknown properties to clientFilters', () => {
        const filters = [{ property: 'artisan', operator: 'eq', value: 'test' }]
        const { clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(clientFilters).toHaveLength(1)
        expect(clientFilters[0].property).toBe('artisan')
      })
    })

    describe('multiple filters', () => {
      it('should handle a mix of server and client filters', () => {
        const filters = [
          { property: 'statusValue', operator: 'eq', value: 'DEMANDE' },
          { property: 'artisan', operator: 'eq', value: 'test' },
          { property: 'isCheck', operator: 'eq', value: true },
        ]
        const { serverFilters, clientFilters } = convertViewFiltersToServerFilters(filters as any, createContext())
        expect(serverFilters.statut).toBe('id-1')
        expect(serverFilters.isCheck).toBe(true)
        expect(clientFilters).toHaveLength(1)
      })
    })
  })

  describe('convertArtisanFiltersToServerFilters', () => {
    const ctx = { currentUserId: 'current-user-id' }

    it('should convert gestionnaire_id eq with CURRENT_USER', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: 'CURRENT_USER' }]
      const { serverFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(serverFilters.gestionnaire).toBe('current-user-id')
    })

    it('should convert gestionnaire_id eq with __CURRENT_USER__', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: '__CURRENT_USER__' }]
      const { serverFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(serverFilters.gestionnaire).toBe('current-user-id')
    })

    it('should convert gestionnaire_id eq with currentUserId value', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: 'current-user-id' }]
      const { serverFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(serverFilters.gestionnaire).toBe('current-user-id')
    })

    it('should fallback CURRENT_USER to client when no currentUserId', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: 'CURRENT_USER' }]
      const { clientFilters } = convertArtisanFiltersToServerFilters(filters as any, {})
      expect(clientFilters).toHaveLength(1)
    })

    it('should convert gestionnaire_id eq with direct UUID', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: 'some-uuid' }]
      const { serverFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(serverFilters.gestionnaire).toBe('some-uuid')
    })

    it('should fallback non-string gestionnaire value to client', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'eq', value: 123 }]
      const { clientFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(clientFilters).toHaveLength(1)
    })

    it('should fallback unsupported gestionnaire operators to client', () => {
      const filters = [{ property: 'gestionnaire_id', operator: 'in', value: ['a'] }]
      const { clientFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(clientFilters).toHaveLength(1)
    })

    it('should convert statut_dossier eq', () => {
      const filters = [{ property: 'statut_dossier', operator: 'eq', value: 'complet' }]
      const { serverFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(serverFilters.statut_dossier).toBe('complet')
    })

    it('should fallback non-eq statut_dossier to client', () => {
      const filters = [{ property: 'statut_dossier', operator: 'in', value: ['a'] }]
      const { clientFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(clientFilters).toHaveLength(1)
    })

    it('should push unsupported properties to client', () => {
      const filters = [{ property: 'ville', operator: 'eq', value: 'Paris' }]
      const { clientFilters } = convertArtisanFiltersToServerFilters(filters as any, ctx)
      expect(clientFilters).toHaveLength(1)
    })
  })
})
