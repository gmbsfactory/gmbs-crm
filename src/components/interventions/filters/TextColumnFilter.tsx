"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ColumnFilterProps } from "./types"
import { SortControls } from "./SortControls"
import type { ViewFilter } from "@/types/intervention-views"
import { formatFilterSummary } from "./filter-utils"

export function TextColumnFilter({
  property,
  schema,
  activeFilter,
  onFilterChange,
  sorts,
  onSortChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [debouncedValue, setDebouncedValue] = useState("")

  // Initialiser la valeur depuis le filtre actif
  useEffect(() => {
    if (activeFilter) {
      if (activeFilter.operator === "contains" || activeFilter.operator === "eq") {
        setSearchValue(String(activeFilter.value ?? ""))
        setDebouncedValue(String(activeFilter.value ?? ""))
      } else {
        setSearchValue("")
        setDebouncedValue("")
      }
    } else {
      setSearchValue("")
      setDebouncedValue("")
    }
  }, [activeFilter])

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(searchValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue])

  // Appliquer le filtre avec debounce
  useEffect(() => {
    if (!open) return

    const trimmedValue = debouncedValue.trim()

    if (trimmedValue === "") {
      // Si on efface le filtre, le supprimer
      if (activeFilter) {
        onFilterChange(property, null)
      }
      return
    }

    // Créer ou mettre à jour le filtre
    const newFilter: ViewFilter = {
      property,
      operator: "contains",
      value: trimmedValue,
    }

    // Ne mettre à jour que si le filtre a changé
    if (
      !activeFilter ||
      activeFilter.operator !== newFilter.operator ||
      activeFilter.value !== newFilter.value
    ) {
      onFilterChange(property, newFilter)
    }
  }, [debouncedValue, open, property, onFilterChange, activeFilter])

  const hasActiveFilter = Boolean(activeFilter && activeFilter.value)

  const handleClear = useCallback(() => {
    setSearchValue("")
    setDebouncedValue("")
    onFilterChange(property, null)
  }, [property, onFilterChange])

  const displayValue = useMemo(() => {
    if (activeFilter && (activeFilter.operator === "contains" || activeFilter.operator === "eq")) {
      return String(activeFilter.value ?? "")
    }
    return ""
  }, [activeFilter])

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
            </span>
          </button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-72">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">Filtrer par {schema.label}</div>
          <SortControls property={property} label={schema.label} sortable={schema.sortable} sorts={sorts} onSortChange={onSortChange} />
          <div className="space-y-2">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Rechercher..."
              className="w-full"
              autoFocus
            />
            {hasActiveFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex-1 justify-start">
                  {displayValue}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end">
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

