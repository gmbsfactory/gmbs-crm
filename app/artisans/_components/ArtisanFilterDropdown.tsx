"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, X, Filter, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterItem {
  key: string
  label: string
}

interface ArtisanFilterDropdownProps {
  /** Display label on the trigger button */
  label: string
  /** Title inside the dropdown panel */
  title: string
  /** Whether the dropdown is open */
  open: boolean
  /** Toggle open state */
  onOpenChange: (open: boolean) => void
  /** Current search query inside the dropdown */
  searchQuery: string
  /** Update the search query */
  onSearchQueryChange: (query: string) => void
  /** Items to display (already filtered by searchQuery) */
  items: FilterItem[]
  /** Currently selected item keys */
  selectedKeys: string[]
  /** Active items (resolved from selectedKeys) for the pill area */
  activeItems: FilterItem[]
  /** Whether any filter is active */
  hasFilter: boolean
  /** Toggle an item on/off */
  onToggle: (key: string, checked: boolean) => void
  /** Clear all selections */
  onClear: () => void
  /** Select all visible items */
  onSelectAll?: () => void
  /** Get count for a specific item key */
  getCount: (key: string) => number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArtisanFilterDropdown({
  label,
  title,
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  items,
  selectedKeys,
  activeItems,
  hasFilter,
  onToggle,
  onClear,
  onSelectAll,
  getCount,
}: ArtisanFilterDropdownProps) {
  const allSelected = items.length > 0 && items.every((item) => selectedKeys.includes(item.key))
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            hasFilter ? "bg-primary/10 text-primary" : "hover:bg-muted/80",
          )}
        >
          <span className="truncate">{label}</span>
          <span className="ml-auto flex items-center gap-0.5 text-muted-foreground">
            {hasFilter ? <Filter className="h-3.5 w-3.5" /> : null}
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-72">
        <div className="space-y-3 p-2">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8"
              />
            </div>

            {/* Select all / clear row */}
            {onSelectAll && items.length > 0 && (
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-1 text-xs"
                  onClick={allSelected ? onClear : onSelectAll}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedKeys.length}/{items.length}
                </span>
              </div>
            )}

            {/* List */}
            <ScrollArea className="h-[400px] w-full rounded-md border">
              <div className="space-y-1 p-1">
                {items.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Aucun resultat</div>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedKeys.includes(item.key)
                    return (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/70"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => onToggle(item.key, Boolean(checked))}
                        />
                        <span className="truncate flex-1">{item.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({getCount(item.key)})
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>

            {/* Active pills */}
            {activeItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                {activeItems.map((item) => (
                  <Badge key={item.key} variant="secondary" className="flex items-center gap-1">
                    <span className="truncate max-w-[120px]">{item.label}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                      onClick={() => onToggle(item.key, false)}
                      aria-label={`Retirer ${item.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={onClear}>
                  Tout effacer
                </Button>
              </div>
            )}
            {activeItems.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {activeItems.length}{" "}
                {activeItems.length === 1 ? "element selectionne" : "elements selectionnes"}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
