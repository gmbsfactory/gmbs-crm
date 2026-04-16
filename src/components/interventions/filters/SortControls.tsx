"use client"

import { ArrowDown, ArrowUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ViewSort } from "@/types/intervention-views"

interface SortControlsProps {
  property: string
  label: string
  sortable?: boolean
  sorts?: ViewSort[]
  onSortChange?: (sorts: ViewSort[]) => void
}

export function SortControls({ property, label, sortable, sorts, onSortChange }: SortControlsProps) {
  if (!sortable || !onSortChange) return null

  const activeSort = sorts?.find((s) => s.property === property)
  const currentDir = activeSort?.direction ?? null

  return (
    <div className="flex items-center justify-between pb-2 border-b">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tri</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 text-muted-foreground",
            currentDir === "asc" && "border border-primary/60 bg-primary/10 text-primary",
          )}
          onClick={() => {
            onSortChange(currentDir === "asc" ? [] : [{ property, direction: "asc" }])
          }}
          aria-label={`Tri croissant (${label})`}
          title="Croissant"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 text-muted-foreground",
            currentDir === "desc" && "border border-primary/60 bg-primary/10 text-primary",
          )}
          onClick={() => {
            onSortChange(currentDir === "desc" ? [] : [{ property, direction: "desc" }])
          }}
          aria-label={`Tri décroissant (${label})`}
          title="Décroissant"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        {currentDir && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onSortChange([])}
            aria-label={`Supprimer le tri (${label})`}
            title="Supprimer le tri"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
