"use client"

import { useRef, useState } from "react"
import type { UseFormRegister, UseFormSetValue } from "react-hook-form"
import { CheckCircle2, Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGeocodeSearch, type GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { cn } from "@/lib/utils"

const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
const labelClass = "text-xs font-medium text-foreground/80"

type Props = {
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  latitude: number | null
  longitude: number | null
  initialAddress?: string
  showRequiredIndicator?: boolean
}

export function AddressField({
  register,
  setValue,
  latitude,
  longitude,
  initialAddress = "",
  showRequiredIndicator = false,
}: Props) {
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isSuggesting,
    clearSuggestions,
  } = useGeocodeSearch({ minQueryLength: 3, debounceMs: 300, initialQuery: initialAddress })

  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimeoutRef = useRef<number | null>(null)

  const handleSuggestionSelect = (suggestion: GeocodeSuggestion) => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current)
    }

    const parts = suggestion.label.split(',').map(p => p.trim())
    const postalMatch = suggestion.label.match(/\b(\d{5})\b/)

    let street = parts[0] || suggestion.label
    let postalCode = postalMatch?.[1] || ""
    let city = ""

    for (const part of parts) {
      if (postalMatch && part.includes(postalMatch[1])) {
        const cityMatch = part.replace(postalMatch[1], '').trim()
        if (cityMatch) city = cityMatch
      } else if (!part.toLowerCase().includes("france") && !postalMatch?.[1]?.includes(part) && part !== street && part.length > 1) {
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
  }

  const isEmpty = showRequiredIndicator && !addressQuery?.trim()

  return (
    <div className="space-y-1">
      <Label className={labelClass}>Adresse du siège social *</Label>
      <div className="relative">
        <div className="relative">
          <Input
            placeholder="Rechercher une adresse..."
            value={addressQuery}
            className={cn(inputClass, isEmpty && "border-orange-400 focus-visible:ring-orange-400")}
            onChange={(e) => {
              setAddressQuery(e.target.value)
              setValue("adresse_siege_social", e.target.value)
              setValue("intervention_latitude", null)
              setValue("intervention_longitude", null)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => {
                setShowSuggestions(false)
              }, 150)
            }}
          />
          {isEmpty && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
          )}
        </div>
        {isSuggesting && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {showSuggestions && addressSuggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-popover shadow-xl">
            <ul className="divide-y divide-border/50 text-xs">
              {addressSuggestions.map((suggestion) => (
                <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors text-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{suggestion.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <Input
          id="code_postal_siege_social"
          placeholder="Code postal"
          className={inputClass}
          {...register("code_postal_siege_social")}
        />
        <Input
          id="ville_siege_social"
          placeholder="Ville"
          className={inputClass}
          {...register("ville_siege_social")}
        />
      </div>
      {latitude && longitude && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 mt-1.5">
          <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-300 font-medium">GPS:</span>
          <span className="text-xs text-green-600 dark:text-green-400 font-mono">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  )
}
