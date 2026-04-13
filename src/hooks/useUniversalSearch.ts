"use client"

import * as React from "react"
import { universalSearch } from "@/lib/api/search"
import type { GroupedSearchResults } from "@/types/search"

const SEARCH_DEBOUNCE_MS = 300

export interface UseUniversalSearchReturn {
  query: string
  setQuery: (value: string) => void
  results: GroupedSearchResults | null
  isSearching: boolean
  error: string | null
  clearSearch: () => void
  loadMore: (type: "artisan" | "intervention") => Promise<void>
  isLoadingMore: boolean
}

export function useUniversalSearch(): UseUniversalSearchReturn {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GroupedSearchResults | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const latestRequestRef = React.useRef(0)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultsRef = React.useRef<GroupedSearchResults | null>(null)

  const handleQueryChange = React.useCallback((nextQuery: string) => {
    setQuery(nextQuery)
  }, [])

  const clearSearch = React.useCallback(() => {
    latestRequestRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setQuery("")
    resultsRef.current = null
    setResults(null)
    setIsSearching(false)
    setError(null)
  }, [])

  React.useEffect(() => {
    const trimmed = query.trim()

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (trimmed.length < 2) {
      latestRequestRef.current += 1
      resultsRef.current = null
      setResults(null)
      setIsSearching(false)
      setError(null)
      return
    }

    setIsSearching(true)
    const requestId = ++latestRequestRef.current

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await universalSearch(trimmed)
        if (latestRequestRef.current === requestId) {
          resultsRef.current = response
          setResults(response)
          setError(null)
        }
      } catch (err) {
        console.error("[useUniversalSearch] search error", err)
        // Log more details about the error
        if (err && typeof err === "object") {
          // Try to serialize the error to see its actual structure
          let errorSerialized: any
          try {
            errorSerialized = JSON.stringify(err, Object.getOwnPropertyNames(err))
          } catch {
            errorSerialized = String(err)
          }
          
          console.error("[useUniversalSearch] error details:", {
            message: (err as any).message,
            code: (err as any).code,
            details: (err as any).details,
            hint: (err as any).hint,
            stack: (err as any).stack,
            errorType: typeof err,
            errorConstructor: (err as any)?.constructor?.name,
            errorKeys: Object.keys(err),
            errorString: String(err),
            serialized: errorSerialized,
            query: trimmed,
          })
        } else {
          console.error("[useUniversalSearch] error is not an object:", {
            error: err,
            errorType: typeof err,
            errorString: String(err),
            query: trimmed,
          })
        }
        if (latestRequestRef.current === requestId) {
          resultsRef.current = null
          setResults(null)
          const errorMessage = err instanceof Error 
            ? err.message 
            : err && typeof err === "object" && "message" in err
            ? String((err as any).message)
            : err && typeof err === "object" && "details" in err
            ? String((err as any).details)
            : "Erreur lors de la recherche"
          setError(errorMessage)
        }
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsSearching(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [query])

  const loadMore = React.useCallback(async (type: "artisan" | "intervention") => {
    if (isLoadingMore) {
      return
    }

    const currentResults = resultsRef.current
    if (!currentResults) {
      return
    }
    
    const currentItems = type === "artisan" 
      ? currentResults.artisans.items 
      : currentResults.interventions.items
    
    if (currentItems.length === 0) {
      return
    }

    const hasMoreForType = type === "artisan" 
      ? currentResults.artisans.hasMore 
      : currentResults.interventions.hasMore

    if (!hasMoreForType) {
      return
    }

    const newLimit = currentItems.length + 10 // Charger 10 de plus
    const options = type === "artisan" 
      ? { artisanLimit: newLimit, interventionLimit: currentResults.interventions.items.length }
      : { artisanLimit: currentResults.artisans.items.length, interventionLimit: newLimit }
    
    setIsLoadingMore(true)
    
    try {
      const response = await universalSearch(query.trim(), options)
      resultsRef.current = response
      setResults(response)
    } catch (err) {
      console.error("[useUniversalSearch] loadMore error", err)
      setError(err instanceof Error ? err.message : "Erreur lors du chargement")
    } finally {
      setIsLoadingMore(false)
    }
  }, [query, isLoadingMore])

  return {
    query,
    setQuery: handleQueryChange,
    results,
    isSearching,
    error,
    clearSearch,
    loadMore,
    isLoadingMore,
  }
}
