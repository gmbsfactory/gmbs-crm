"use client"

import { useCallback, useMemo, useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ColumnFilterProps } from "./types"
import type { ViewFilter } from "@/types/intervention-views"
import { formatFilterSummary } from "./filter-utils"

type CheckboxFilterValue = "all" | true | false

export function CheckboxColumnFilter({
  property,
  schema,
  activeFilter,
  onFilterChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)

  const currentValue = useMemo<CheckboxFilterValue>(() => {
    if (!activeFilter) return "all"
    if (activeFilter.operator === "eq") {
      if (activeFilter.value === true) return true
      if (activeFilter.value === false) return false
    }
    return "all"
  }, [activeFilter])

  const handleValueChange = useCallback(
    (value: CheckboxFilterValue) => {
      if (value === "all") {
        onFilterChange(property, null)
      } else {
        const newFilter: ViewFilter = {
          property,
          operator: "eq",
          value,
        }
        onFilterChange(property, newFilter)
      }
    },
    [property, onFilterChange],
  )

  const hasActiveFilter = currentValue !== "all"

  const displayLabel = useMemo(() => {
    if (currentValue === true) return "Oui"
    if (currentValue === false) return "Non"
    return "Tous"
  }, [currentValue])

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
      <DropdownMenuContent side="bottom" align="start" className="w-64">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">Filtrer par {schema.label}</div>
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <Button
                variant={currentValue === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleValueChange("all")}
                className="w-full justify-start"
              >
                Tous
              </Button>
              <Button
                variant={currentValue === true ? "default" : "ghost"}
                size="sm"
                onClick={() => handleValueChange(true)}
                className="w-full justify-start"
              >
                Oui
              </Button>
              <Button
                variant={currentValue === false ? "default" : "ghost"}
                size="sm"
                onClick={() => handleValueChange(false)}
                className="w-full justify-start"
              >
                Non
              </Button>
            </div>
            {hasActiveFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{displayLabel}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleValueChange("all")}
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

