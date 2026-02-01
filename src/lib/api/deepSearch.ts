// DeepSearch placeholder (AI powered search) used by cmd+k / global search.

export type DeepSearchResult<T> = {
  id: string
  score: number
  payload: T
}

export async function deepSearchArtisans(query: string): Promise<DeepSearchResult<unknown>[]> {
  if (!query) return []

  console.debug("[deepSearch] deepSearchArtisans placeholder", { query })
  return []
}

export async function deepSearchInterventions(query: string): Promise<DeepSearchResult<unknown>[]> {
  if (!query) return []

  console.debug("[deepSearch] deepSearchInterventions placeholder", { query })
  return []
}
