import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { interventionsApi } from '@/lib/api'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import type { InterventionQueryParams } from '@/lib/api/common/types'

type FilterProperty = 'metier' | 'agence' | 'statut' | 'user'

export function useFilterCounts(
  property: FilterProperty,
  possibleValues: Array<{ id: string; label: string }>,
  baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>,
  enabled: boolean = true
) {
  // Stabiliser les filtres pour la query key
  const stableFilters = useMemo(
    () => baseFilters || {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(baseFilters || {})]
  )

  const { data: groupedCounts, isLoading } = useQuery({
    queryKey: interventionKeys.filterCountsByProperty(property, stableFilters),
    queryFn: () => interventionsApi.getFilterCountsGrouped(property, baseFilters),
    enabled: enabled && possibleValues.length > 0,
    staleTime: 30_000,
  })

  // Construire le record final : pour chaque valeur possible,
  // prendre le comptage du RPC ou 0 si absent
  const counts = useMemo(() => {
    if (!groupedCounts) return {}
    const result: Record<string, number> = {}
    for (const item of possibleValues) {
      result[item.id] = groupedCounts[item.id] ?? 0
    }
    return result
  }, [groupedCounts, possibleValues])

  return { counts, isLoading }
}
