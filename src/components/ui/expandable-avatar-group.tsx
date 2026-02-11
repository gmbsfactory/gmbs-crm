"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { GestionnaireBadge, type GestionnaireBadgeProps } from "@/components/ui/gestionnaire-badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpandableAvatarGroupItem {
  id: string
  firstname?: string | null
  lastname?: string | null
  prenom?: string | null
  name?: string | null
  color?: string | null
  avatarUrl?: string | null
  searchText?: string
}

export interface ExpandableAvatarGroupProps {
  items: ExpandableAvatarGroupItem[]
  maxVisible?: number
  avatarSize?: "xs" | "sm" | "md" | "lg"
  className?: string
  onAvatarClick?: (id: string) => void
  showSearch?: boolean
  searchThreshold?: number
}

// ---------------------------------------------------------------------------
// Size config for the "+N" badge
// ---------------------------------------------------------------------------

const overflowSizeClasses: Record<string, string> = {
  xs: "h-6 w-6 text-[0.65rem]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function badgePropsFromItem(item: ExpandableAvatarGroupItem): Omit<GestionnaireBadgeProps, "size" | "className" | "onClick"> {
  return {
    firstname: item.firstname,
    lastname: item.lastname,
    prenom: item.prenom,
    name: item.name,
    color: item.color,
    avatarUrl: item.avatarUrl,
  }
}

function getSearchableText(item: ExpandableAvatarGroupItem): string {
  if (item.searchText) return item.searchText.toLowerCase()
  return `${item.firstname ?? ""} ${item.lastname ?? ""} ${item.prenom ?? ""} ${item.name ?? ""}`.toLowerCase()
}

function getDisplayFirstName(item: ExpandableAvatarGroupItem): string {
  return item.firstname || item.prenom || item.name || "?"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpandableAvatarGroup({
  items,
  maxVisible = 4,
  avatarSize = "sm",
  className,
  onAvatarClick,
  showSearch = true,
  searchThreshold = 12,
}: ExpandableAvatarGroupProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectionHistory, setSelectionHistory] = React.useState<string[]>([])

  // Reorder items: most recently clicked appear first
  const orderedItems = React.useMemo(() => {
    if (selectionHistory.length === 0) return items

    const orderMap = new Map<string, number>()
    selectionHistory.forEach((id, index) => orderMap.set(id, index))

    return [...items].sort((a, b) => {
      const aOrder = orderMap.get(a.id)
      const bOrder = orderMap.get(b.id)
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
      if (aOrder !== undefined) return -1
      if (bOrder !== undefined) return 1
      return 0
    })
  }, [items, selectionHistory])

  const visibleItems = orderedItems.slice(0, maxVisible)
  const hiddenCount = Math.max(0, orderedItems.length - maxVisible)

  const handleAvatarClick = React.useCallback((id: string) => {
    setSelectionHistory(prev => [id, ...prev.filter(h => h !== id)])
    onAvatarClick?.(id)
  }, [onAvatarClick])

  // Filter for the popover search
  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return orderedItems
    return orderedItems.filter(item => getSearchableText(item).includes(query))
  }, [orderedItems, searchQuery])

  const shouldShowSearch = showSearch && orderedItems.length >= searchThreshold

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center -space-x-2">
        {/* Visible avatars */}
        {visibleItems.map((item, index) => (
          <div
            key={item.id}
            style={{ zIndex: visibleItems.length - index }}
            className="relative"
          >
            <GestionnaireBadge
              {...badgePropsFromItem(item)}
              size={avatarSize}
              className={cn(
                "ring-2 ring-background transition-transform hover:scale-110 hover:z-50",
                onAvatarClick && "cursor-pointer",
              )}
              onClick={() => handleAvatarClick(item.id)}
            />
          </div>
        ))}

        {/* "+N" overflow badge with popover */}
        {hiddenCount > 0 && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative flex items-center justify-center rounded-full",
                  "bg-muted/80 text-muted-foreground font-semibold",
                  "ring-2 ring-background hover:bg-muted transition-colors",
                  overflowSizeClasses[avatarSize],
                )}
                style={{ zIndex: 0 }}
              >
                +{hiddenCount}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0 overflow-hidden" align="start" sideOffset={8}>
              {/* Search */}
              {shouldShowSearch && (
                <div className="p-3 border-b bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm bg-background/50"
                    />
                  </div>
                </div>
              )}

              {/* Avatar grid */}
              <div className="p-4 max-h-[320px] overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Aucun résultat
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="flex flex-col items-center gap-2 group">
                        <GestionnaireBadge
                          {...badgePropsFromItem(item)}
                          size="md"
                          className={cn(
                            "transition-transform group-hover:scale-110 group-hover:ring-2 group-hover:ring-primary/50",
                            onAvatarClick && "cursor-pointer",
                          )}
                          onClick={() => {
                            handleAvatarClick(item.id)
                            setIsOpen(false)
                          }}
                        />
                        <div className="text-center">
                          <p className="text-xs font-medium truncate max-w-[60px]">
                            {getDisplayFirstName(item)}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                            {item.lastname ?? ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t bg-muted/20">
                <p className="text-xs text-center text-muted-foreground">
                  {filteredItems.length === orderedItems.length
                    ? `${orderedItems.length} gestionnaire${orderedItems.length > 1 ? "s" : ""}`
                    : `${filteredItems.length} sur ${orderedItems.length} résultat${orderedItems.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
