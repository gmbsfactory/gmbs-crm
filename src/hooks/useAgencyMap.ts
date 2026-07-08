import { useCallback, useMemo } from "react"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"

/**
 * Hook pour charger et cacher le mapping LABEL/CODE/ID → UUID des agences.
 *
 * Les filtres de vue stockent le label de l'agence (ex: "Gest and Loc"), alors
 * que la colonne DB est `agence_id` (UUID). Ce hook permet de convertir le label
 * (ou le code, ou un UUID déjà résolu) en UUID pour router le filtre agence
 * côté serveur — exactement comme `useInterventionStatusMap` le fait pour les statuts.
 *
 * Dérive les données depuis useReferenceDataQuery (TanStack Query)
 * pour bénéficier de la déduplication automatique des requêtes.
 */
export function useAgencyMap() {
  const { data, loading, error: queryError } = useReferenceDataQuery()

  const agencyMap = useMemo(() => {
    if (!data) return {}
    const map: Record<string, string> = {}
    const addMapping = (key: string | null | undefined, id: string) => {
      if (!key) return
      const upper = key.toUpperCase()
      const normalized = key
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toUpperCase()

      map[key] = id
      map[upper] = id
      map[normalized] = id
    }

    for (const agency of data.agencies) {
      // Passe-plat UUID (cas où la valeur du filtre est déjà un id) + label + code
      addMapping(agency.id, agency.id)
      addMapping(agency.label, agency.id)
      addMapping(agency.code, agency.id)
    }

    return map
  }, [data])

  const error = useMemo(
    () => (queryError ? new Error(queryError) : null),
    [queryError]
  )

  /**
   * Convertit un label/code d'agence (ou array) en UUID(s).
   * @param name - Label/code d'agence (ex: "Gest and Loc") ou array
   * @returns UUID(s) correspondant(s), en filtrant les valeurs non résolues
   */
  const nameToId = useCallback(
    (name: string | string[] | undefined): string | string[] | undefined => {
      if (!name) return undefined
      if (Array.isArray(name)) {
        return name.map((n) => agencyMap[n]).filter(Boolean)
      }
      return agencyMap[name]
    },
    [agencyMap]
  )

  return { agencyMap, loading, error, nameToId }
}
