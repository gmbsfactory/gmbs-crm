"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns"
import { fr } from "date-fns/locale"
import { Filter, X, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ColumnFilterProps } from "./types"
import type { ViewFilter } from "@/types/intervention-views"
import { formatFilterSummary } from "./filter-utils"

type DatePreset = {
  label: string
  getValue: () => { from: Date; to: Date }
}

const DATE_PRESETS: DatePreset[] = [
  {
    label: "Aujourd'hui",
    getValue: () => {
      const today = new Date()
      return { from: startOfDay(today), to: endOfDay(today) }
    },
  },
  {
    label: "Cette semaine",
    getValue: () => {
      const now = new Date()
      return { from: startOfWeek(now, { locale: fr }), to: endOfWeek(now, { locale: fr }) }
    },
  },
  {
    label: "Ce mois",
    getValue: () => {
      const now = new Date()
      return { from: startOfMonth(now), to: endOfMonth(now) }
    },
  },
  {
    label: "Ce trimestre",
    getValue: () => {
      const now = new Date()
      return { from: startOfQuarter(now), to: endOfQuarter(now) }
    },
  },
  {
    label: "Cette année",
    getValue: () => {
      const now = new Date()
      return { from: startOfYear(now), to: endOfYear(now) }
    },
  },
]

export function DateColumnFilter({
  property,
  schema,
  activeFilter,
  onFilterChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"preset" | "range">("preset")
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })

  // Initialiser depuis le filtre actif
  useEffect(() => {
    if (activeFilter && activeFilter.operator === "between") {
      const filterValue = activeFilter.value
      if (filterValue && typeof filterValue === "object" && !Array.isArray(filterValue)) {
        const { from, to } = filterValue as { from?: string; to?: string }
        setRange({
          from: from ? new Date(from) : null,
          to: to ? new Date(to) : null,
        })
        setMode("range")
      } else if (Array.isArray(filterValue)) {
        setRange({
          from: filterValue[0] ? new Date(filterValue[0] as string) : null,
          to: filterValue[1] ? new Date(filterValue[1] as string) : null,
        })
        setMode("range")
      }
    } else {
      setRange({ from: null, to: null })
      setMode("preset")
    }
  }, [activeFilter])

  const handlePresetSelect = useCallback(
    (preset: DatePreset) => {
      const { from, to } = preset.getValue()
      const newFilter: ViewFilter = {
        property,
        operator: "between",
        value: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      }
      onFilterChange(property, newFilter)
      setRange({ from, to })
    },
    [property, onFilterChange],
  )

  const handleRangeSelect = useCallback(
    (selectedRange: { from: Date | null; to: Date | null }) => {
      setRange(selectedRange)
      if (selectedRange.from && selectedRange.to) {
        const newFilter: ViewFilter = {
          property,
          operator: "between",
          value: {
            from: selectedRange.from.toISOString(),
            to: selectedRange.to.toISOString(),
          },
        }
        onFilterChange(property, newFilter)
      }
    },
    [property, onFilterChange],
  )

  const handleClear = useCallback(() => {
    setRange({ from: null, to: null })
    onFilterChange(property, null)
  }, [property, onFilterChange])

  const hasActiveFilter = Boolean(activeFilter && activeFilter.operator === "between")

  const displayLabel = useMemo(() => {
    if (!hasActiveFilter || !range.from || !range.to) return ""
    return `${format(range.from, "dd/MM/yyyy", { locale: fr })} – ${format(range.to, "dd/MM/yyyy", { locale: fr })}`
  }, [hasActiveFilter, range])

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
          {hasActiveFilter && activeFilter && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {formatFilterSummary(activeFilter, schema)}
            </Badge>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-auto p-0">
        <div className="space-y-3 p-4">
          <div className="text-sm font-semibold text-foreground">Filtrer par {schema.label}</div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "preset" | "range")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preset">Presets</TabsTrigger>
              <TabsTrigger value="range">Plage</TabsTrigger>
            </TabsList>
            <TabsContent value="preset" className="mt-3 space-y-2">
              <div className="grid grid-cols-1 gap-1">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="range" className="mt-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !range.from && !range.to && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range.from && range.to
                      ? `${format(range.from, "dd/MM/yyyy", { locale: fr })} – ${format(range.to, "dd/MM/yyyy", { locale: fr })}`
                      : "Sélectionner une plage"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-4" 
                  align="start"
                  data-range-complete={range.from !== null && range.to !== null}
                >
                  <Calendar
                    mode="range"
                    selected={{ from: range.from ?? undefined, to: range.to ?? undefined }}
                    onSelect={(selectedRange) =>
                      handleRangeSelect({
                        from: selectedRange?.from ?? null,
                        to: selectedRange?.to ?? null,
                      })
                    }
                    numberOfMonths={2}
                    locale={fr}
                    classNames={{
                      // Style shadcn/ui amélioré pour les plages de dates
                      range_start: "bg-primary text-primary-foreground rounded-l-md font-bold shadow-md",
                      range_middle: "bg-primary/35 text-primary-foreground rounded-none",
                      range_end: "bg-primary text-primary-foreground rounded-r-md font-bold shadow-md",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold shadow-lg",
                      day_today: "bg-accent text-accent-foreground font-semibold",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </TabsContent>
          </Tabs>
          {hasActiveFilter && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Badge variant="secondary" className="flex-1 justify-start">
                {displayLabel}
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

