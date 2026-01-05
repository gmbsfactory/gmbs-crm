import { useEffect, useState, useRef, useMemo } from 'react'
import { interventionsApi } from '@/lib/api/v2'
import type { InterventionQueryParams } from '@/lib/api/v2/common/types'

type FilterProperty = 'metier' | 'agence' | 'statut' | 'user'

export function useFilterCounts(
  property: FilterProperty,
  possibleValues: Array<{ id: string; label: string }>,
  baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>,
  enabled: boolean = true
) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Utiliser useRef pour éviter les problèmes de closure avec cancelled
  const cancelledRef = useRef(false)

  // Mémoriser les clés pour éviter les re-renders inutiles
  const possibleValuesKey = useMemo(
    () => possibleValues.map(v => v.id).sort().join(','),
    [possibleValues]
  )
  const baseFiltersKey = useMemo(
    () => JSON.stringify(baseFilters || {}),
    [baseFilters]
  )

  useEffect(() => {
    console.log('[useFilterCounts] Effect triggered:', {
      property,
      enabled,
      possibleValuesLength: possibleValues.length,
      possibleValuesKey: possibleValuesKey.substring(0, 50) + '...'
    })

    if (!enabled || possibleValues.length === 0) {
      console.log('[useFilterCounts] Skipped: enabled=', enabled, 'possibleValues.length=', possibleValues.length)
      return
    }

    // Reset cancelled flag au début de chaque effet
    cancelledRef.current = false
    setIsLoading(true)

    const loadCounts = async () => {
      // Double-check au début de la fonction async
      if (cancelledRef.current) {
        console.log('[useFilterCounts] Already cancelled before starting')
        return
      }

      try {
        console.log('[useFilterCounts] Loading counts for', property, 'with', possibleValues.length, 'values')

        // Charger tous les compteurs en parallèle
        const countPromises = possibleValues.map(async (item) => {
          if (cancelledRef.current) return { id: item.id, label: item.label, count: 0 }

          const count = await interventionsApi.getCountByPropertyValue(
            property,
            item.id,
            baseFilters
          )
          console.log(`[useFilterCounts] Count for ${property} ${item.id} (${item.label}):`, count)
          return { id: item.id, label: item.label, count }
        })

        const results = await Promise.all(countPromises)

        if (!cancelledRef.current) {
          const newCounts: Record<string, number> = {}
          results.forEach(({ id, count }) => {
            newCounts[id] = count
          })
          console.log('[useFilterCounts] Final counts for', property, ':', newCounts)
          setCounts(newCounts)
        }
      } catch (error) {
        console.error(`[useFilterCounts] Erreur pour ${property}:`, error)
        if (!cancelledRef.current) {
          setCounts({})
        }
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false)
        }
      }
    }

    // Appeler loadCounts immédiatement
    loadCounts()

    return () => {
      console.log('[useFilterCounts] Cleanup called for', property)
      cancelledRef.current = true
    }
  }, [property, possibleValuesKey, baseFiltersKey, enabled, possibleValues, baseFilters])

  return { counts, isLoading }
}
