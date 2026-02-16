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

  const userMap = useMemo(() => {
    if (!data?.users) return {}
    const map: Record<string, string> = {}
    for (const user of data.users) {
      if (user.username) map[user.username.toLowerCase()] = user.id
      if (user.firstname) map[user.firstname.toLowerCase()] = user.id
      if (user.lastname) map[user.lastname.toLowerCase()] = user.id
      if (user.code_gestionnaire) map[user.code_gestionnaire.toLowerCase()] = user.id
      const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim().toLowerCase()
      if (fullName) map[fullName] = user.id
    }
    return map
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

  return { userMap, loading, error, nameToId }
}
