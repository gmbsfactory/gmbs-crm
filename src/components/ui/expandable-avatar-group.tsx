"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GestionnaireBadge, type GestionnaireBadgeProps } from "@/components/ui/gestionnaire-badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export interface ExpandableAvatarGroupItem extends Omit<GestionnaireBadgeProps, 'size'> {
  id: string
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
  // Track selection history for queue ordering (most recent deselection first)
  const [selectionHistory, setSelectionHistory] = React.useState<string[]>([])

  // Reorder items based on selection history
  // Most recently deselected items appear first in the queue
  const orderedItems = React.useMemo(() => {
    if (selectionHistory.length === 0) return items
    
    // Create a map of item order based on history (most recent = lowest index)
    const orderMap = new Map<string, number>()
    selectionHistory.forEach((id, index) => {
      orderMap.set(id, index)
    })
    
    // Sort items: items in history come first (sorted by recency), then the rest
    return [...items].sort((a, b) => {
      const aOrder = orderMap.get(a.id)
      const bOrder = orderMap.get(b.id)
      
      // Both in history: sort by recency (lower index = more recent)
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder
      }
      
      // Only 'a' in history: it comes first
      if (aOrder !== undefined) return -1
      
      // Only 'b' in history: it comes first
      if (bOrder !== undefined) return 1
      
      // Neither in history: maintain original order
      return 0
    })
  }, [items, selectionHistory])

  const visibleItems = orderedItems.slice(0, maxVisible)
  const hiddenCount = Math.max(0, orderedItems.length - maxVisible)
  const hasMore = hiddenCount > 0

  // Handle avatar click with queue logic
  const handleAvatarClick = React.useCallback((id: string) => {
    // Update selection history: add this ID to the front
    setSelectionHistory(prev => {
      // Remove if already exists to avoid duplicates
      const filtered = prev.filter(historyId => historyId !== id)
      // Add to front (most recent)
      return [id, ...filtered]
    })
    
    // Call parent handler
    onAvatarClick?.(id)
  }, [onAvatarClick])

  // Filter items for popover (use ordered items)
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return orderedItems
    
    const query = searchQuery.toLowerCase()
    return orderedItems.filter(item => {
      const searchableText = item.searchText || 
        `${item.firstname || ''} ${item.lastname || ''} ${item.prenom || ''} ${item.name || ''}`.toLowerCase()
      return searchableText.includes(query)
    })
  }, [orderedItems, searchQuery])

  const shouldShowSearch = showSearch && orderedItems.length >= searchThreshold

  return (
    <div className={cn("flex items-center", className)}>
      {/* Visible avatars */}
      <div className="flex items-center -space-x-2">
        <AnimatePresence mode="popLayout">
          {visibleItems.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                delay: index * 0.02,
              }}
              style={{ zIndex: visibleItems.length - index }}
              className="relative"
            >
              <GestionnaireBadge
                {...item}
                size={avatarSize}
                className={cn(
                  "ring-2 ring-background transition-all hover:scale-110 hover:z-50",
                  onAvatarClick && "cursor-pointer"
                )}
                onClick={() => handleAvatarClick(item.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* +N Badge with Popover */}
        {hasMore && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <motion.button
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className={cn(
                  "relative flex items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground font-semibold ring-2 ring-background hover:bg-muted transition-colors",
                  avatarSize === "xs" && "h-6 w-6 text-[0.65rem]",
                  avatarSize === "sm" && "h-8 w-8 text-xs",
                  avatarSize === "md" && "h-9 w-9 text-sm",
                  avatarSize === "lg" && "h-12 w-12 text-base"
                )}
                style={{ zIndex: 0 }}
              >
                +{hiddenCount}
              </motion.button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 overflow-hidden"
              align="start"
              sideOffset={8}
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
                className="backdrop-blur-xl bg-background/95"
              >
                {/* Search bar (optional) */}
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
                      <AnimatePresence mode="popLayout">
                        {filteredItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                              delay: index * 0.02,
                            }}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <GestionnaireBadge
                              {...item}
                              size="md"
                              className={cn(
                                "transition-all group-hover:scale-110 group-hover:ring-2 group-hover:ring-primary/50",
                                onAvatarClick && "cursor-pointer"
                              )}
                              onClick={() => {
                                handleAvatarClick(item.id)
                                setIsOpen(false)
                              }}
                            />
                            <div className="text-center">
                              <p className="text-xs font-medium truncate max-w-[60px]">
                                {item.firstname || item.prenom || item.name || '?'}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                                {item.lastname || ''}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Footer with count */}
                <div className="px-4 py-2 border-t bg-muted/20">
                  <p className="text-xs text-center text-muted-foreground">
                    {filteredItems.length === orderedItems.length
                      ? `${orderedItems.length} gestionnaire${orderedItems.length > 1 ? 's' : ''}`
                      : `${filteredItems.length} sur ${orderedItems.length} résultat${orderedItems.length > 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </motion.div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
