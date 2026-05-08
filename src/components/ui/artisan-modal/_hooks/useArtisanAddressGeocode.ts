import { useCallback, useEffect, useRef, useState } from "react"
import type { UseFormSetValue } from "react-hook-form"
import { useGeocodeSearch, type GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import type { ArtisanFormValues } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

const SUGGESTION_BLUR_DELAY_MS = 150

export function useArtisanAddressGeocode(setValue: UseFormSetValue<ArtisanFormValues>) {
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isSuggesting,
    clearSuggestions,
  } = useGeocodeSearch({ minQueryLength: 3, debounceMs: 300 })

  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionBlurTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  const handleSuggestionSelect = useCallback(
    (suggestion: GeocodeSuggestion) => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }

      const parts = suggestion.label.split(",").map((p) => p.trim())
      const postalMatch = suggestion.label.match(/\b(\d{5})\b/)

      const street = parts[0] || suggestion.label
      const postalCode = postalMatch?.[1] || ""
      let city = ""

      for (const part of parts) {
        if (postalMatch && part.includes(postalMatch[1])) {
          const cityMatch = part.replace(postalMatch[1], "").trim()
          if (cityMatch) city = cityMatch
        } else if (
          !part.toLowerCase().includes("france") &&
          !postalMatch?.[1]?.includes(part) &&
          part !== street &&
          part.length > 1
        ) {
          if (!city) city = part
        }
      }

      setValue("adresse_siege_social", street)
      setValue("code_postal_siege_social", postalCode)
      setValue("ville_siege_social", city)
      setValue("intervention_latitude", suggestion.lat)
      setValue("intervention_longitude", suggestion.lng)

      setAddressQuery(suggestion.label)
      clearSuggestions()
      setShowSuggestions(false)
    },
    [setValue, clearSuggestions, setAddressQuery],
  )

  const handleAddressChange = useCallback(
    (value: string) => {
      setAddressQuery(value)
      setValue("adresse_siege_social", value)
      setValue("intervention_latitude", null)
      setValue("intervention_longitude", null)
      setShowSuggestions(true)
    },
    [setAddressQuery, setValue],
  )

  const handleAddressFocus = useCallback(() => {
    setShowSuggestions(true)
  }, [])

  const handleAddressBlur = useCallback(() => {
    suggestionBlurTimeoutRef.current = window.setTimeout(() => {
      setShowSuggestions(false)
    }, SUGGESTION_BLUR_DELAY_MS)
  }, [])

  return {
    addressQuery,
    setAddressQuery,
    addressSuggestions,
    isSuggesting,
    showSuggestions,
    handleSuggestionSelect,
    handleAddressChange,
    handleAddressFocus,
    handleAddressBlur,
  }
}
