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
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ColumnFilterProps, FilterOption } from "./types"
import type { ViewFilter } from "@/types/intervention-views"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"

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

export function UserColumnFilter({
  property,
  schema,
  activeFilter,
  interventions,
  loadDistinctValues,
  onFilterChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [remoteOptions, setRemoteOptions] = useState<FilterOption[] | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [hasFetchedOptions, setHasFetchedOptions] = useState(false)

  // Récupérer les données de référence pour avoir accès aux utilisateurs avec leurs avatars
  const { data: referenceData } = useReferenceDataQuery()

  // Fonction pour formater le label d'un utilisateur à partir d'une valeur brute
  const formatUserLabel = useCallback((raw: unknown): string => {
    if (raw === null || raw === undefined) return "Non assigné"
    
    const rawString = String(raw)
    const user = referenceData?.users?.find(
      (u) => u.code_gestionnaire === rawString || u.username === rawString
    )
    
    if (user) {
      const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
      return user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName
    }
    
    // Si l'utilisateur n'est pas trouvé, retourner la valeur brute
    return rawString
  }, [referenceData?.users])

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
          const key = makeValueKey(raw)
          if (unique.has(key)) return
          unique.set(key, {
            key,
            value: raw,
            label: formatUserLabel(raw),
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
  }, [open, loadDistinctValues, property, hasFetchedOptions, formatUserLabel])

  // Construire les options à partir de referenceData.users (comme InterventionEditForm)
  const allOptions = useMemo(() => {
    const options: FilterOption[] = []

    // Toujours ajouter "Non assigné"
    options.push({
      key: makeValueKey(null),
      value: null,
      label: "Non assigné",
    })

    // Ajouter tous les utilisateurs de referenceData
    if (referenceData?.users) {
      referenceData.users.forEach((user) => {
        const userCode = user.code_gestionnaire || user.username
        const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
        options.push({
          key: makeValueKey(userCode),
          value: userCode,
          label: user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName,
        })
      })
    }

    return options.sort((a, b) => {
      if (a.value === null || a.value === undefined) return -1
      if (b.value === null || b.value === undefined) return 1
      return a.label.localeCompare(b.label, "fr", { sensitivity: "base" })
    })
  }, [referenceData?.users])

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
        .filter((v): v is string | number | boolean => v !== undefined && v !== null)

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
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un utilisateur..."
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
                  filteredOptions.map((option) => {
                    const isSelected = selectedKeys.has(option.key)

                    // Trouver l'utilisateur dans referenceData (comme InterventionEditForm)
                    const user = option.value === null || option.value === undefined
                      ? null
                      : referenceData?.users?.find(
                          u => u.code_gestionnaire === option.value || u.username === option.value
                        )

                    const firstname = user?.firstname || (option.value === null || option.value === undefined ? "?" : String(option.value))
                    const lastname = user?.lastname
                    const color = user?.color || (option.value === null || option.value === undefined ? "#9ca3af" : undefined)
                    const avatarUrl = user?.avatar_url

                    return (
                      <label
                        key={option.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/70"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleToggleKey(option.key, Boolean(checked))}
                        />
                        <GestionnaireBadge
                          firstname={firstname}
                          lastname={lastname}
                          color={color}
                          avatarUrl={avatarUrl}
                          size="sm"
                          showBorder={false}
                        />
                        <span className="truncate flex-1">{option.label}</span>
                      </label>
                    )
                  })
                )}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            {selectedOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                {selectedOptions.map((option) => {
                  // Trouver l'utilisateur dans referenceData (comme InterventionEditForm)
                  const user = option.value === null || option.value === undefined
                    ? null
                    : referenceData?.users?.find(
                        u => u.code_gestionnaire === option.value || u.username === option.value
                      )

                  const firstname = user?.firstname || (option.value === null || option.value === undefined ? "?" : String(option.value))
                  const lastname = user?.lastname
                  const color = user?.color || (option.value === null || option.value === undefined ? "#9ca3af" : undefined)
                  const avatarUrl = user?.avatar_url

                  return (
                    <Badge key={option.key} variant="secondary" className="flex items-center gap-1 pl-1 pr-1.5">
                      <GestionnaireBadge
                        firstname={firstname}
                        lastname={lastname}
                        color={color}
                        avatarUrl={avatarUrl}
                        size="xs"
                        showBorder={false}
                      />
                      <span className="truncate max-w-[120px] text-xs">{option.label}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                        onClick={() => handleToggleKey(option.key, false)}
                        aria-label={`Retirer ${option.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
                <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={handleClear}>
                  Tout effacer
                </Button>
              </div>
            )}
            {selectedOptions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedOptions.length} {selectedOptions.length === 1 ? "utilisateur sélectionné" : "utilisateurs sélectionnés"}
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

