import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!enabled || possibleValues.length === 0) {
      return
    }

    let cancelled = false
    setIsLoading(true)

    const loadCounts = async () => {
      try {
        // Charger tous les compteurs en parallèle
        const countPromises = possibleValues.map(async (item) => {
          const count = await interventionsApi.getCountByPropertyValue(
            property,
            item.id,
            baseFilters
          )
          return { id: item.id, label: item.label, count }
        })

        const results = await Promise.all(countPromises)

        if (!cancelled) {
          const newCounts: Record<string, number> = {}
          results.forEach(({ id, count }) => {
            newCounts[id] = count
          })
          setCounts(newCounts)
        }
      } catch (error) {
        console.error(`[useFilterCounts] Erreur pour ${property}:`, error)
        if (!cancelled) {
          setCounts({})
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadCounts()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, JSON.stringify(possibleValues), JSON.stringify(baseFilters), enabled])

  return { counts, isLoading }
}
