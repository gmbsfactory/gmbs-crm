"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type GeocodeSuggestion = {
  label: string
  lat: number
  lng: number
  precision?: string
  /** Code postal structuré renvoyé par le provider (BAN) — à préférer au parsing du label */
  postcode?: string
  /** Ville structurée renvoyée par le provider (BAN) — à préférer au parsing du label */
  city?: string
}

type UseGeocodeSearchOptions = {
  minQueryLength?: number
  debounceMs?: number
  initialQuery?: string
}

export function useGeocodeSearch(options: UseGeocodeSearchOptions = {}) {
  const { minQueryLength = 3, debounceMs = 300, initialQuery = "" } = options

  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (!query || query.trim().length < minQueryLength) {
      setSuggestions([])
      abortRef.current?.abort()
      return
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsSuggesting(true)

      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query.trim())}&suggest=1&limit=5`,
          { signal: controller.signal, cache: "no-store" },
        )

        if (!response.ok) {
          if (response.status === 404) {
            setSuggestions([])
            return
          }

          throw new Error(`Suggestion request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as GeocodeSuggestion[]
        if (mountedRef.current) {
          setSuggestions(payload)
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError" && mountedRef.current) {
          console.warn("[useGeocodeSearch] Suggestion fetch failed", error)
          setSuggestions([])
        }
      } finally {
        if (mountedRef.current) {
          setIsSuggesting(false)
        }
      }
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [query, minQueryLength, debounceMs])

  const clearSuggestions = useCallback(() => {
    abortRef.current?.abort()
    setSuggestions([])
  }, [])

  const geocode = useCallback(
    async (value?: string) => {
      const target = (value ?? query).trim()
      if (!target) {
        return null
      }

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(target)}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          if (response.status === 404) {
            return null
          }

          throw new Error(`Geocode request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as {
          lat: number
          lng: number
          precision?: string
          postcode?: string
          city?: string
        }
        return {
          label: target,
          lat: payload.lat,
          lng: payload.lng,
          precision: payload.precision,
          postcode: payload.postcode,
          city: payload.city,
        } satisfies GeocodeSuggestion
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          return null
        }
        throw error
      }
    },
    [query],
  )

  return {
    query,
    setQuery,
    suggestions,
    isSuggesting,
    clearSuggestions,
    geocode,
  }
}
