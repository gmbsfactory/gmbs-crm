"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Filter, X, Search, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getPropertyValue } from "@/lib/query-engine"
import type { ColumnFilterProps, FilterOption } from "./types"
import { SortControls } from "./SortControls"
import type { ViewFilter } from "@/types/intervention-views"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import { formatFilterSummary } from "./filter-utils"
import { useFilterCounts } from "@/hooks/useFilterCounts"
import { agenciesApi } from "@/lib/api/v2/agenciesApi"
import { metiersApi } from "@/lib/api/v2/metiersApi"
import { interventionsApi } from "@/lib/api/v2/interventionsApi"

const makeValueKey = (value: unknown): string => {
  if (value === null || value === undefined) return "null"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${typeof value}:${String(value)}`
  }
  if (Array.isArray(value)) {
    return `array:${value.map((v) => String(v)).join(",")}`
  }
  if (typeof value === "object") {
    try {
      return `object:${JSON.stringify(value)}`
    } catch {
      return `object:${String(value)}`
    }
  }
  return `${typeof value}:${String(value)}`
}

const formatFilterLabel = (value: unknown, schema: ColumnFilterProps["schema"]): string => {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  if (schema.type === "select" || schema.type === "multi_select") {
    const option = schema.options?.find((opt) => opt.value === value)
    return option?.label ?? String(value)
  }

  return String(value)
}

const buildFilterOptions = (
  items: InterventionEntity[],
  property: string,
  schema: ColumnFilterProps["schema"],
  activeFilter?: ViewFilter,
): FilterOption[] => {
  const seen = new Map<string, FilterOption>()

  const addCandidate = (raw: unknown) => {
    const key = makeValueKey(raw)
    if (seen.has(key)) return
    seen.set(key, {
      key,
      value: raw,
      label: formatFilterLabel(raw, schema),
    })
  }

  // Ajouter les options du schema si disponibles
  if (schema.type === "select" || schema.type === "multi_select") {
    schema.options?.forEach((option) => addCandidate(option.value))
  }

  // Ajouter les valeurs des interventions
  items.forEach((item) => {
    const value = getPropertyValue(item, property)
    if (Array.isArray(value)) {
      value.forEach(addCandidate)
      return
    }
    if (value !== null && value !== undefined && value !== "") {
      addCandidate(value)
    }
  })

  // Ajouter les valeurs du filtre actif si elles ne sont pas déjà présentes
  if (activeFilter) {
    if (activeFilter.operator === "eq" && activeFilter.value !== undefined) {
      addCandidate(activeFilter.value)
    }
    if (activeFilter.operator === "in" && Array.isArray(activeFilter.value)) {
      activeFilter.value.forEach(addCandidate)
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
  )
}

const deriveSelectedKeys = (filter?: ViewFilter): Set<string> => {
  if (!filter) return new Set()
  if (filter.operator === "eq" && filter.value !== undefined) {
    return new Set([makeValueKey(filter.value)])
  }
  if (filter.operator === "in" && Array.isArray(filter.value)) {
    return new Set(filter.value.map((value) => makeValueKey(value)))
  }
  return new Set()
}

/**
 * Détermine le type de propriété pour le comptage API
 */
const getFilterPropertyType = (property: string): 'metier' | 'agence' | 'statut' | 'user' | null => {
  // Mapping des propriétés de la vue vers les types API
  const propertyMap: Record<string, 'metier' | 'agence' | 'statut' | 'user'> = {
    'metier': 'metier',
    'metier_id': 'metier',
    'metierLabel': 'metier',
    'agence': 'agence',
    'agence_id': 'agence',
    'agenceLabel': 'agence',
    'statusValue': 'statut',
    'statut': 'statut',
    'statut_id': 'statut',
    'attribueA': 'user',
    'assignedUserCode': 'user',
    'assigned_user_id': 'user',
  }

  return propertyMap[property] || null
}

export function SelectColumnFilter({
  property,
  schema,
  activeFilter,
  interventions,
  loadDistinctValues,
  onFilterChange,
  baseFilters,
  sorts,
  onSortChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [remoteOptions, setRemoteOptions] = useState<FilterOption[] | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [hasFetchedOptions, setHasFetchedOptions] = useState(false)
  const [allAgencies, setAllAgencies] = useState<Array<{ id: string; label: string; code?: string }>>([])
  const [allMetiers, setAllMetiers] = useState<Array<{ id: string; label: string; code?: string }>>([])
  const [allStatuts, setAllStatuts] = useState<Array<{ id: string; label: string; code?: string }>>([])

  // Déterminer le type de propriété pour le comptage API
  const filterPropertyType = useMemo(() => {
    const type = getFilterPropertyType(property)
    return type
  }, [property])

  // Charger toutes les agences depuis l'API si nécessaire
  useEffect(() => {
    if (filterPropertyType === 'agence' && allAgencies.length === 0) {
      agenciesApi.getAll().then(agencies => {
        setAllAgencies(agencies.map(a => ({ id: a.id, label: a.label })))
      }).catch(err => {
        console.error('[SelectColumnFilter] Erreur chargement agences:', err)
      })
    }
  }, [filterPropertyType, allAgencies.length])

  // Charger tous les métiers depuis l'API si nécessaire
  useEffect(() => {
    if (filterPropertyType === 'metier' && allMetiers.length === 0) {
      metiersApi.getAll().then(metiers => {
        const mappedMetiers = metiers.map(m => ({
          id: m.id,
          label: m.label || m.code || m.id,
          code: m.code // Garder le code pour le mapping
        }))
        setAllMetiers(mappedMetiers)
      }).catch(err => {
        console.error('[SelectColumnFilter] Erreur chargement métiers:', err)
      })
    }
  }, [filterPropertyType, allMetiers.length])

  // Charger tous les statuts depuis l'API si nécessaire
  useEffect(() => {
    if (filterPropertyType === 'statut' && allStatuts.length === 0) {
      interventionsApi.getAllStatuses().then(statuses => {
        const mappedStatuses = statuses.map(s => ({
          id: s.id,
          label: s.label || s.code || s.id,
          code: s.code // Garder le code pour le mapping
        }))
        setAllStatuts(mappedStatuses)
      }).catch(err => {
        console.error('[SelectColumnFilter] Erreur chargement statuts:', err)
      })
    }
  }, [filterPropertyType, allStatuts.length])

  // Récupérer les valeurs possibles pour le comptage API
  const possibleValues = useMemo(() => {
    if (!filterPropertyType) return []

    // Pour les agences, métiers et statuts : utiliser la liste complète depuis l'API
    if (filterPropertyType === 'agence') {
      return allAgencies
    }

    if (filterPropertyType === 'metier') {
      return allMetiers
    }

    if (filterPropertyType === 'statut') {
      return allStatuts
    }

    // Pour les autres types (user), extraire depuis les interventions chargées
    const uniqueValues = new Map<string, { id: string; label: string }>()

    interventions.forEach((intervention) => {
      let id: string | null = null
      let label: string | null = null

      switch (filterPropertyType) {
        case 'user':
          id = (intervention as any).assigned_user_id || 'null'
          label = (intervention as any).assignedUserName || (intervention as any).attribueA || 'Non assigné'
          break
      }

      if (id && label && !uniqueValues.has(id)) {
        uniqueValues.set(id, { id, label })
      }
    })

    return Array.from(uniqueValues.values())
  }, [filterPropertyType, interventions, allAgencies, allMetiers, allStatuts])

  // Hook pour charger les compteurs depuis l'API
  // Charger les compteurs dès que possibleValues est disponible (pas besoin d'attendre que le menu soit ouvert)
  const { counts: apiCounts, isLoading: isLoadingCounts } = useFilterCounts(
    filterPropertyType!,
    possibleValues,
    baseFilters,
    !!filterPropertyType && possibleValues.length > 0
  )

  // Charger les valeurs distinctes depuis l'API si disponible
  useEffect(() => {
    if (!open || !loadDistinctValues || hasFetchedOptions) return
    let cancelled = false
    setIsLoadingOptions(true)
    loadDistinctValues(property)
      .then((values) => {
        if (cancelled || !Array.isArray(values)) return
        const unique = new Map<string, FilterOption>()
        values.forEach((raw) => {
          if (raw == null || raw === "") return
          const key = makeValueKey(raw)
          if (unique.has(key)) return
          unique.set(key, {
            key,
            value: raw,
            label: formatFilterLabel(raw, schema),
          })
        })
        setRemoteOptions(Array.from(unique.values()))
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteOptions(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOptions(false)
          setHasFetchedOptions(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, loadDistinctValues, property, schema, hasFetchedOptions])

  // Construire les options locales
  const baseOptions = useMemo(
    () => buildFilterOptions(interventions, property, schema, activeFilter),
    [interventions, property, schema, activeFilter],
  )

  // Combiner les options locales et distantes
  const allOptions = useMemo(() => {
    let options: FilterOption[]
    if (!remoteOptions) {
      options = baseOptions
    } else {
      const unique = new Map<string, FilterOption>()
      remoteOptions.forEach((option) => unique.set(option.key, option))
      baseOptions.forEach((option) => {
        if (!unique.has(option.key)) {
          unique.set(option.key, option)
        }
      })
      options = Array.from(unique.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
      )
    }

    // Ajouter les counts depuis l'API si disponibles
    // Pour les agences, métiers et statuts, on mappe les labels/codes vers les IDs
    if (filterPropertyType && apiCounts && Object.keys(apiCounts).length > 0) {
      options.forEach((option) => {
        let itemId: string | null = null
        const optionValue = String(option.value)
        const optionValueLower = optionValue.toLowerCase()

        if (filterPropertyType === 'agence') {
          // Chercher l'ID de l'agence par ID, label ou code (insensible à la casse)
          const agence = allAgencies.find(a =>
            a.id === optionValue ||
            a.label === optionValue ||
            a.label.toLowerCase() === optionValueLower ||
            a.id.toLowerCase() === optionValueLower ||
            a.code === optionValue ||
            a.code?.toLowerCase() === optionValueLower
          )
          itemId = agence?.id || null
        } else if (filterPropertyType === 'metier') {
          // Chercher l'ID du métier par ID, label ou code (insensible à la casse)
          // Les options peuvent contenir des codes en majuscules (ex: "BRICOLAGE")
          // alors que les métiers ont des labels en casse normale (ex: "Bricolage")
          const metier = allMetiers.find(m =>
            m.id === optionValue ||
            m.label === optionValue ||
            m.label.toLowerCase() === optionValueLower ||
            m.id.toLowerCase() === optionValueLower ||
            m.code === optionValue ||
            m.code?.toLowerCase() === optionValueLower
          )
          itemId = metier?.id || null
        } else if (filterPropertyType === 'statut') {
          // Chercher l'ID du statut par ID, label ou code (insensible à la casse)
          const statut = allStatuts.find(s =>
            s.id === optionValue ||
            s.label === optionValue ||
            s.label.toLowerCase() === optionValueLower ||
            s.id.toLowerCase() === optionValueLower ||
            s.code === optionValue ||
            s.code?.toLowerCase() === optionValueLower
          )
          itemId = statut?.id || null
        } else {
          // Pour les autres types (user), utiliser directement la valeur de l'option
          itemId = optionValue
        }

        if (itemId && apiCounts[itemId] !== undefined) {
          option.count = apiCounts[itemId]
        }
      })
    }

    return options
  }, [baseOptions, remoteOptions, filterPropertyType, apiCounts, allAgencies, allMetiers, allStatuts])

  // Filtrer les options selon la recherche
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return allOptions
    const query = searchQuery.toLowerCase()
    return allOptions.filter((option) => option.label.toLowerCase().includes(query))
  }, [allOptions, searchQuery])

  const selectedKeys = useMemo(() => deriveSelectedKeys(activeFilter), [activeFilter])
  const hasActiveFilter = Boolean(activeFilter)

  const selectedOptions = useMemo(
    () => allOptions.filter((option) => selectedKeys.has(option.key)),
    [allOptions, selectedKeys],
  )

  const handleToggleKey = useCallback(
    (key: string, checked: boolean) => {
      const nextKeys = new Set(selectedKeys)
      if (checked) {
        nextKeys.add(key)
      } else {
        nextKeys.delete(key)
      }

      const option = allOptions.find((opt) => opt.key === key)
      if (!option) return

      const values = Array.from(nextKeys)
        .map((k) => {
          const opt = allOptions.find((o) => o.key === k)
          return opt?.value
        })
        .filter((v): v is string | number | boolean => v !== undefined)

      if (values.length === 0) {
        onFilterChange(property, null)
        return
      }

      if (values.length === 1) {
        onFilterChange(property, { property, operator: "eq", value: values[0] })
        return
      }

      onFilterChange(property, { property, operator: "in", value: values })
    },
    [selectedKeys, allOptions, onFilterChange, property],
  )

  const handleClear = useCallback(() => {
    onFilterChange(property, null)
  }, [property, onFilterChange])

  const selectionSummary = useMemo(() => {
    if (isLoadingOptions && allOptions.length === 0) {
      return "Chargement…"
    }
    if (selectedOptions.length === 0) {
      return "Choisir…"
    }
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((option) => option.label).join(", ")
    }
    const [first, second] = selectedOptions
    return `${first.label}, ${second.label} (+${selectedOptions.length - 2})`
  }, [isLoadingOptions, allOptions.length, selectedOptions])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="flex w-full items-center justify-center gap-1.5">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded px-1 py-0.5 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hasActiveFilter ? "bg-white/20" : "hover:bg-white/10",
            )}
          >
            <span className="truncate">{schema.label}</span>
            <span className="flex items-center gap-0.5 opacity-70">
              {hasActiveFilter ? <Filter className="h-3.5 w-3.5" /> : null}
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-72">
        <div className="space-y-3 p-2">
          <div className="text-sm font-semibold text-foreground">Filtrer par {schema.label}</div>
          <SortControls property={property} label={schema.label} sortable={schema.sortable} sorts={sorts} onSortChange={onSortChange} />
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-64 rounded-md border">
              <div className="space-y-1 p-1">
                {isLoadingOptions && allOptions.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Chargement…</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Aucun résultat</div>
                ) : (
                  filteredOptions.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/70"
                    >
                      <Checkbox
                        checked={selectedKeys.has(option.key)}
                        onCheckedChange={(checked) => handleToggleKey(option.key, Boolean(checked))}
                      />
                      <span className="truncate flex-1">{option.label}</span>
                      {option.count !== undefined && !isLoadingCounts && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          ({option.count})
                        </span>
                      )}
                      {isLoadingCounts && filterPropertyType && (
                        <span className="text-xs text-muted-foreground ml-auto animate-pulse">
                          ...
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            {selectedOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                {selectedOptions.map((option) => (
                  <Badge key={option.key} variant="secondary" className="flex items-center gap-1">
                    <span className="truncate max-w-[120px]">{option.label}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                      onClick={() => handleToggleKey(option.key, false)}
                      aria-label={`Retirer ${option.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={handleClear}>
                  Tout effacer
                </Button>
              </div>
            )}
            {selectedOptions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedOptions.length} {selectedOptions.length === 1 ? "élément sélectionné" : "éléments sélectionnés"}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

