import { useCallback, useMemo } from "react"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"

/**
 * Hook pour charger et cacher le mapping CODE → UUID des statuts
 * Utilisé pour convertir les codes de statut (EN_COURS, TERMINE, etc.) en UUIDs pour les requêtes SQL
 *
 * Dérive les données depuis useReferenceDataQuery (TanStack Query)
 * pour bénéficier de la déduplication automatique des requêtes.
 */
export function useInterventionStatusMap() {
  const { data, loading, error: queryError } = useReferenceDataQuery()

  const statusMap = useMemo(() => {
    if (!data) return {}
    const map: Record<string, string> = {}
    const addMapping = (key: string | null | undefined, id: string) => {
      if (!key) return
      const original = key
      const upper = key.toUpperCase()
      const normalized = key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toUpperCase()

      map[original] = id
      map[upper] = id
      map[normalized] = id
    }

    for (const status of data.interventionStatuses) {
      addMapping(status.code, status.id)
      addMapping(status.label, status.id)
    }

    return map
  }, [data])

  const error = useMemo(
    () => (queryError ? new Error(queryError) : null),
    [queryError]
  )

  /**
   * Convertit un code de statut (ou array de codes) en UUID(s)
   * @param code - Code(s) de statut (ex: "INTER_EN_COURS" ou ["INTER_EN_COURS", "INTER_TERMINEE"])
   * @returns UUID(s) correspondant(s)
   */
  const codeToId = useCallback((code: string | string[] | undefined): string | string[] | undefined => {
    if (!code) return undefined
    if (Array.isArray(code)) {
      return code.map((c) => statusMap[c]).filter(Boolean)
    }
    return statusMap[code]
  }, [statusMap])

  return { statusMap, loading, error, codeToId }
}
