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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ColumnFilterProps } from "./types"
import type { ViewFilter } from "@/types/intervention-views"
import { formatFilterSummary } from "./filter-utils"

type NumberOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between"

const OPERATOR_LABELS: Record<NumberOperator, string> = {
  eq: "Est égal à",
  neq: "Différent de",
  gt: "Supérieur à",
  gte: "Supérieur ou égal à",
  lt: "Inférieur à",
  lte: "Inférieur ou égal à",
  between: "Entre",
}

export function NumberColumnFilter({
  property,
  schema,
  activeFilter,
  onFilterChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"simple" | "range">("simple")
  const [operator, setOperator] = useState<NumberOperator>("eq")
  const [simpleValue, setSimpleValue] = useState("")
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")

  // Initialiser depuis le filtre actif
  useEffect(() => {
    if (activeFilter) {
      if (activeFilter.operator === "between") {
        const filterValue = activeFilter.value
        if (filterValue && typeof filterValue === "object" && !Array.isArray(filterValue)) {
          const { from, to } = filterValue as { from?: number; to?: number }
          setRangeFrom(from?.toString() ?? "")
          setRangeTo(to?.toString() ?? "")
          setMode("range")
        } else if (Array.isArray(filterValue)) {
          setRangeFrom(filterValue[0]?.toString() ?? "")
          setRangeTo(filterValue[1]?.toString() ?? "")
          setMode("range")
        }
      } else {
        const op = activeFilter.operator as NumberOperator
        if (OPERATOR_LABELS[op]) {
          setOperator(op)
          setSimpleValue(String(activeFilter.value ?? ""))
          setMode("simple")
        }
      }
    } else {
      setSimpleValue("")
      setRangeFrom("")
      setRangeTo("")
      setMode("simple")
      setOperator("eq")
    }
  }, [activeFilter])

  const handleSimpleApply = useCallback(() => {
    const numValue = Number.parseFloat(simpleValue)
    if (Number.isNaN(numValue)) {
      return
    }

    const newFilter: ViewFilter = {
      property,
      operator,
      value: numValue,
    }
    onFilterChange(property, newFilter)
  }, [property, operator, simpleValue, onFilterChange])

  const handleRangeApply = useCallback(() => {
    const fromValue = rangeFrom.trim() ? Number.parseFloat(rangeFrom) : undefined
    const toValue = rangeTo.trim() ? Number.parseFloat(rangeTo) : undefined

    if (fromValue === undefined && toValue === undefined) {
      return
    }

    if (fromValue !== undefined && Number.isNaN(fromValue)) {
      return
    }

    if (toValue !== undefined && Number.isNaN(toValue)) {
      return
    }

    const newFilter: ViewFilter = {
      property,
      operator: "between",
      value: {
        from: fromValue,
        to: toValue,
      },
    }
    onFilterChange(property, newFilter)
  }, [property, rangeFrom, rangeTo, onFilterChange])

  const handleClear = useCallback(() => {
    setSimpleValue("")
    setRangeFrom("")
    setRangeTo("")
    onFilterChange(property, null)
  }, [property, onFilterChange])

  const hasActiveFilter = Boolean(activeFilter)

  const displayLabel = useMemo(() => {
    if (!hasActiveFilter) return ""
    if (activeFilter?.operator === "between") {
      const filterValue = activeFilter.value
      if (filterValue && typeof filterValue === "object" && !Array.isArray(filterValue)) {
        const { from, to } = filterValue as { from?: number; to?: number }
        if (from !== undefined && to !== undefined) {
          return `${from} – ${to}`
        }
        if (from !== undefined) {
          return `≥ ${from}`
        }
        if (to !== undefined) {
          return `≤ ${to}`
        }
      }
    } else {
      const op = activeFilter?.operator as NumberOperator
      const value = activeFilter?.value
      if (OPERATOR_LABELS[op] && value !== undefined) {
        return `${OPERATOR_LABELS[op]} ${value}`
      }
    }
    return ""
  }, [hasActiveFilter, activeFilter])

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
      <DropdownMenuContent side="bottom" align="start" className="w-72">
        <div className="space-y-3 p-4">
          <div className="text-sm font-semibold text-foreground">Filtrer par {schema.label}</div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "range")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple">Simple</TabsTrigger>
              <TabsTrigger value="range">Plage</TabsTrigger>
            </TabsList>
            <TabsContent value="simple" className="mt-3 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Opérateur
                </label>
                <Select value={operator} onValueChange={(v) => setOperator(v as NumberOperator)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                      <SelectItem key={op} value={op}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Valeur
                </label>
                <Input
                  type="number"
                  value={simpleValue}
                  onChange={(e) => setSimpleValue(e.target.value)}
                  placeholder="Ex. 100"
                  className="w-full"
                />
              </div>
              <Button size="sm" onClick={handleSimpleApply} className="w-full">
                Appliquer
              </Button>
            </TabsContent>
            <TabsContent value="range" className="mt-3 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Plage
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    placeholder="Min"
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <Input
                    type="number"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    placeholder="Max"
                    className="flex-1"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleRangeApply} className="w-full">
                Appliquer
              </Button>
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

