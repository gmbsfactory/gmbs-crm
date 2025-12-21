"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Table } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ArtisanViewDefinition } from "@/hooks/useArtisanViews"

type ArtisanViewTabsProps = {
  views: ArtisanViewDefinition[]
  activeViewId: string
  onSelect: (id: string) => void
  artisanCounts?: Record<string, number>
}

export function ArtisanViewTabs({
  views,
  activeViewId,
  onSelect,
  artisanCounts = {},
}: ArtisanViewTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  
  // Refs pour les boutons de vues pour la navigation Tab
  const tabRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({})
  
  // Initialiser les refs pour chaque vue
  useEffect(() => {
    views.forEach((view) => {
      if (!tabRefs.current[view.id]) {
        tabRefs.current[view.id] = React.createRef<HTMLButtonElement>()
      }
    })
  }, [views])

  const updateScrollState = useCallback(() => {
    const node = scrollContainerRef.current
    if (!node) return
    const { scrollLeft, scrollWidth, clientWidth } = node
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    const node = scrollContainerRef.current
    if (!node) return

    updateScrollState()

    const handleScroll = () => updateScrollState()
    node.addEventListener("scroll", handleScroll)
    window.addEventListener("resize", updateScrollState)

    return () => {
      node.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [updateScrollState])

  const scrollToEnd = useCallback((direction: 'left' | 'right') => {
    const node = scrollContainerRef.current
    if (!node) return
    
    if (direction === 'left') {
      node.scrollTo({ left: 0, behavior: "smooth" })
    } else {
      node.scrollTo({ left: node.scrollWidth - node.clientWidth, behavior: "smooth" })
    }
    
    requestAnimationFrame(updateScrollState)
  }, [updateScrollState])

  useLayoutEffect(() => {
    updateScrollState()
  }, [views.length, updateScrollState])

  return (
    <div className="relative overflow-visible">
      <div
        ref={scrollContainerRef}
        className="flex items-end gap-4 overflow-x-auto overflow-y-visible scrollbar-hide pt-3 pb-1"
      >
        {views.map((view) => {
          const isActive = view.id === activeViewId
          const count = artisanCounts[view.id] || 0
          
          // Créer une ref pour chaque bouton si elle n'existe pas
          if (!tabRefs.current[view.id]) {
            tabRefs.current[view.id] = React.createRef<HTMLButtonElement>()
          }
          
          return (
            <button
              key={view.id}
              ref={tabRefs.current[view.id]}
              type="button"
              tabIndex={0}
              onClick={() => onSelect(view.id)}
              className={cn(
                "relative flex items-center gap-2 border px-3 py-1.5 text-sm font-medium transition-all duration-200",
                // PILULE INACTIVE : rounded-full, flotte au-dessus
                !isActive && "rounded-full",
                !isActive && "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
                // INTERCALAIRE ACTIF : coins supérieurs arrondis, inférieurs carrés, fusionne avec table
                isActive && "rounded-t-lg rounded-b-none border-b-0 relative z-20 -mb-[4px]",
                isActive && "border-primary bg-primary text-primary-foreground",
              )}
            >
              <Table className="h-4 w-4" />
              <span className="whitespace-nowrap">{view.title}</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 flex h-11 items-center bg-gradient-to-r from-background via-background/80 to-transparent pl-2 pr-4">
          <button
            type="button"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur-sm shadow-sm transition hover:bg-background"
            onClick={() => scrollToEnd('left')}
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 flex h-11 items-center bg-gradient-to-l from-background via-background/80 to-transparent pr-4 pl-4">
          <button
            type="button"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur-sm shadow-sm transition hover:bg-background"
            onClick={() => scrollToEnd('right')}
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
