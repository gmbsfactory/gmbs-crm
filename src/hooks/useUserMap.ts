import { useCallback, useMemo } from "react"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"

/**
 * Hook pour charger et cacher le mapping USERNAME → UUID des utilisateurs
 * Utilisé pour convertir les usernames en UUIDs pour les requêtes SQL
 *
 * Dérive les données depuis useReferenceDataQuery (TanStack Query)
 * pour bénéficier de la déduplication automatique des requêtes.
 */
export function useUserMap() {
  const { data, loading, error: queryError } = useReferenceDataQuery()

  const { userMap, byCodeGestionnaire, byUsername } = useMemo(() => {
    if (!data?.users) return { userMap: {}, byCodeGestionnaire: new Map<string, string>(), byUsername: new Map<string, string>() }
    const combinedMap: Record<string, string> = {}
    const cgMap = new Map<string, string>()
    const unMap = new Map<string, string>()
    for (const user of data.users) {
      // Only use UNIQUE fields (guaranteed by DB constraints) to avoid collisions
      if (user.code_gestionnaire) {
        const key = user.code_gestionnaire.toLowerCase()
        cgMap.set(key, user.id)
        combinedMap[key] = user.id
      }
      if (user.username) {
        const key = user.username.toLowerCase()
        unMap.set(key, user.id)
        combinedMap[key] = user.id
      }
    }
    return { userMap: combinedMap, byCodeGestionnaire: cgMap, byUsername: unMap }
  }, [data])

  const error = useMemo(
    () => (queryError ? new Error(queryError) : null),
    [queryError]
  )

  /**
   * Convertit un username (ou array de usernames) en UUID(s)
   * @param name - Username(s) (ex: "andrea" ou ["andrea", "olivier"])
   * @returns UUID(s) correspondant(s)
   */
  const nameToId = useCallback((name: string | string[] | undefined): string | string[] | undefined => {
    if (!name) return undefined
    if (Array.isArray(name)) {
      return name.map((n) => userMap[n.toLowerCase()]).filter(Boolean)
    }
    return userMap[name.toLowerCase()]
  }, [userMap])

  return { userMap, byCodeGestionnaire, byUsername, loading, error, nameToId }
}
