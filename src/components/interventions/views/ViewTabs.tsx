"use client"

import React, { type ComponentType, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  GanttChart,
  Hash,
  GripVertical,
  KanbanSquare,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Settings,
  SquareStack,
  Table,
  Trash2,
} from "lucide-react"
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeIcons } from "@/components/ui/mode-selector/ModeIcons"
import { MODE_OPTIONS } from "@/components/ui/mode-selector/ModeSelector"
import { useModalDisplay } from "@/contexts/ModalDisplayContext"
import { useGenieEffectContext } from "@/contexts/GenieEffectContext"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { InterventionViewDefinition, ViewLayout } from "@/types/intervention-views"

// Styles CSS pour l'animation de rebond de la pastille
const badgeBounceKeyframes = `
@keyframes badge-bounce-in {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(1.4);
  }
  40% {
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.2);
  }
  80% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes badge-glow-pulse {
  0% {
    box-shadow: 0 0 0 0 currentColor;
  }
  50% {
    box-shadow: 0 0 12px 4px currentColor;
  }
  100% {
    box-shadow: 0 0 0 0 currentColor;
  }
}
`

// Injecter les styles si ce n'est pas déjà fait
if (typeof document !== "undefined") {
  const styleId = "genie-badge-bounce-styles"
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style")
    style.id = styleId
    style.textContent = badgeBounceKeyframes
    document.head.appendChild(style)
  }
}

const LABELS: Record<ViewLayout, string> = {
  table: "Tableau",
  cards: "Cartes",
  gallery: "Galerie",
  kanban: "Kanban",
  calendar: "Calendrier",
  timeline: "Chronologie",
}

const VISIBLE_VIEW_LAYOUTS: ViewLayout[] = ["table", "cards", "calendar"]

const layoutIconMap: Record<ViewLayout, ComponentType<{ className?: string }>> = {
  table: Table,
  cards: SquareStack,
  gallery: LayoutGrid,
  kanban: KanbanSquare,
  calendar: CalendarRange,
  timeline: GanttChart,
}

type SortableTabProps = {
  view: InterventionViewDefinition
  isActive: boolean
  onSelect: (id: string) => void
  onRenameView?: (id: string) => void
  onDuplicateView?: (id: string) => void
  onDeleteView?: (id: string) => void
  onResetDefault?: (id: string) => void
  onConfigureColumns?: (viewId: string) => void
  onToggleBadge?: (id: string) => void
  isReorderMode?: boolean
  onEnterReorderMode?: () => void
  interventionCount?: number
  frozenCount?: number  // Compteur gelé pendant l'animation
  isBouncing?: boolean  // Animation de rebond active
  statusColor?: string | null  // Couleur du statut correspondant (dynamique depuis la DB)
  tabRef?: React.RefObject<HTMLButtonElement | null>
  tabIndex?: number
  onBadgeRef?: (element: HTMLElement | null) => void  // Callback pour enregistrer la ref de la pastille
}

function SortableTab({
  view,
  isActive,
  onSelect,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onResetDefault,
  onConfigureColumns,
  onToggleBadge,
  isReorderMode = false,
  onEnterReorderMode,
  interventionCount = 0,
  frozenCount,
  isBouncing = false,
  statusColor,
  tabRef,
  tabIndex,
  onBadgeRef,
}: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
    disabled: !isReorderMode,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  
  // Référence pour la pastille
  const badgeRef = useRef<HTMLSpanElement>(null)
  
  // Enregistrer la référence de la pastille auprès du contexte parent
  useEffect(() => {
    if (onBadgeRef && badgeRef.current) {
      onBadgeRef(badgeRef.current)
    }
    return () => {
      if (onBadgeRef) {
        onBadgeRef(null)
      }
    }
  }, [onBadgeRef])
  
  // Utiliser le compteur gelé si disponible, sinon le compteur normal
  const displayCount = frozenCount !== undefined ? frozenCount : interventionCount

  const Icon = layoutIconMap[view.layout]
  const router = useRouter()
  const { preferredMode, setPreferredMode } = useModalDisplay()
  const currentMode = MODE_OPTIONS.find((option) => option.mode === preferredMode) ?? MODE_OPTIONS[0]
  const CurrentModeIcon = ModeIcons[currentMode.mode]
  const canConfigureColumns = view.layout === "table" && Boolean(onConfigureColumns)
  const showRename = Boolean(onRenameView)
  const showDuplicate = Boolean(onDuplicateView)
  const showReorder = Boolean(onEnterReorderMode) && !isReorderMode
  const showConfig = canConfigureColumns
  const hasPreModeSection = showRename || showDuplicate || showReorder || showConfig

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group flex items-center gap-1", isDragging && "opacity-60")}
    >
      {/* DESIGN v1.4 - Poignée visible uniquement en mode réorganisation */}
      {isReorderMode && (
        <button
          type="button"
          aria-label={`Réordonner la vue ${view.title}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {(() => {
            const hasStatusColor = Boolean(statusColor)
            
            // Styles inline pour les couleurs dynamiques
            const getButtonStyle = (): React.CSSProperties | undefined => {
              if (isActive) {
                // INTERCALAIRE ACTIF : couleur pleine, fusionné avec la table
                if (hasStatusColor && statusColor) {
                  return {
                    backgroundColor: statusColor,
                    borderColor: statusColor,
                    color: "#FFFFFF",
                  }
                }
                // Sans couleur de statut : utiliser les classes CSS (primary)
                return undefined
              }
              
              // PILULE INACTIVE
              if (hasStatusColor && statusColor) {
                return {
                  borderColor: `${statusColor}40`,
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                }
              }
              return undefined
            }
            
            return (
              <button
                ref={tabRef}
                type="button"
                tabIndex={tabIndex}
                onClick={() => onSelect(view.id)}
                className={cn(
                  "relative flex items-center gap-2 border px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  // PILULE INACTIVE : rounded-full, flotte au-dessus
                  !isActive && "rounded-full",
                  !isActive && !hasStatusColor && "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
                  !isActive && hasStatusColor && "hover:opacity-80",
                  // INTERCALAIRE ACTIF : coins supérieurs arrondis, inférieurs carrés, fusionne avec table
                  isActive && "rounded-t-lg rounded-b-none border-b-0 relative z-20 -mb-[4px]",
                  isActive && !hasStatusColor && "border-primary bg-primary text-primary-foreground",
                )}
                style={getButtonStyle()}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{view.title}</span>
                {view.showBadge && displayCount > 0 && (
                  <span 
                    ref={badgeRef}
                    className={cn(
                      "absolute -top-2.5 -right-2.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-md border-2",
                      // Vue ACTIVE : pastille style PASTEL avec fond visible
                      isActive && !hasStatusColor && "border-primary/60 bg-background text-primary",
                      // Vue INACTIVE : pastille style PLEIN
                      !isActive && !hasStatusColor && "bg-primary text-primary-foreground border-primary"
                    )}
                    style={{
                      ...(hasStatusColor && statusColor ? (
                        isActive 
                          ? {
                              // Vue active : style pastel avec fond blanc pour contraste
                              borderColor: statusColor,
                              backgroundColor: "hsl(var(--background))",
                              color: statusColor,
                            }
                          : {
                              // Vue inactive : style plein
                              backgroundColor: statusColor,
                              color: "#FFFFFF",
                              borderColor: statusColor,
                            }
                      ) : {}),
                      // Animation de rebond
                      ...(isBouncing ? {
                        animation: "badge-bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), badge-glow-pulse 0.5s ease-out",
                      } : {}),
                    }}
                  >
                    {displayCount}
                  </span>
                )}
              </button>
            )
          })()}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {showRename && (
            <ContextMenuItem onSelect={() => onRenameView?.(view.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Renommer…
            </ContextMenuItem>
          )}
          {showDuplicate && (
            <ContextMenuItem onSelect={() => onDuplicateView?.(view.id)}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer…
            </ContextMenuItem>
          )}
          {showReorder && (
            <>
              {(showRename || showDuplicate) && <ContextMenuSeparator />}
              <ContextMenuItem onSelect={onEnterReorderMode}>
                <GripVertical className="mr-2 h-4 w-4" />
                Réorganiser les vues
              </ContextMenuItem>
            </>
          )}
          {showConfig && (
            <>
              {(showRename || showDuplicate || showReorder) && <ContextMenuSeparator />}
              <ContextMenuItem onSelect={() => onConfigureColumns?.(view.id)}>
                <Settings className="mr-2 h-4 w-4" />
                Configurer les colonnes…
              </ContextMenuItem>
            </>
          )}
          {hasPreModeSection && <ContextMenuSeparator />}
          {onToggleBadge && (
            <ContextMenuItem onSelect={() => onToggleBadge(view.id)}>
              <Hash className="mr-2 h-4 w-4" />
              {view.showBadge ? "Masquer la pastille" : "Afficher la pastille"}
            </ContextMenuItem>
          )}
          {onToggleBadge && <ContextMenuSeparator />}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <CurrentModeIcon className="mr-2 h-4 w-4" />
              Mode d&apos;affichage
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-64">
              {MODE_OPTIONS.map((option) => {
                const OptionIcon = ModeIcons[option.mode]
                const isModeActive = preferredMode === option.mode
                return (
                  <ContextMenuItem
                    key={option.mode}
                    onSelect={() => setPreferredMode(option.mode)}
                    className={isModeActive ? "bg-muted" : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <OptionIcon />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium leading-none">{option.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </ContextMenuItem>
                )
              })}
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => router.push("/settings/interface")}>
                <Settings className="mr-2 h-4 w-4" />
                Modifier la vue par défaut
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {!view.isDefault && onDeleteView && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => onDeleteView?.(view.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer la vue
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {/* DESIGN v1.4 - Menu masqué, remplacé par clic droit */}
      {false && (onRenameView || onDuplicateView || onDeleteView || onResetDefault || onConfigureColumns) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onSelect(view.id)}>Activer</DropdownMenuItem>
            {onRenameView && <DropdownMenuItem onSelect={() => onRenameView?.(view.id)}>Renommer…</DropdownMenuItem>}
            {onDuplicateView && <DropdownMenuItem onSelect={() => onDuplicateView?.(view.id)}>Dupliquer…</DropdownMenuItem>}
            {view.layout === "table" && onConfigureColumns && (
              <DropdownMenuItem onSelect={() => onConfigureColumns?.(view.id)}>
                <Settings className="mr-2 h-4 w-4" />
                Configurer les colonnes…
              </DropdownMenuItem>
            )}
            {view.isDefault && onResetDefault && (
              <DropdownMenuItem onSelect={() => onResetDefault?.(view.id)}>Réinitialiser la vue</DropdownMenuItem>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="flex items-center gap-2">
                  <CurrentModeIcon />
                  <span>Mode d&apos;affichage</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                {MODE_OPTIONS.map((option) => {
                  const OptionIcon = ModeIcons[option.mode]
                  const isModeActive = preferredMode === option.mode
                  return (
                    <DropdownMenuItem
                      key={option.mode}
                      onSelect={() => setPreferredMode(option.mode)}
                      className={isModeActive ? "bg-muted" : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <OptionIcon />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium leading-none">{option.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/settings/interface")}>
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Modifier la vue par défaut</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {!view.isDefault && onDeleteView && (
              <DropdownMenuItem className="text-destructive" onSelect={() => onDeleteView?.(view.id)}>
                Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

type ViewTabsProps = {
  views: InterventionViewDefinition[]
  activeViewId: string
  onSelect: (id: string) => void
  onReorder: (ids: string[]) => void
  onRenameView?: (id: string) => void
  onDuplicateView?: (id: string) => void
  onDeleteView?: (id: string) => void
  onResetDefault?: (id: string) => void
  onConfigureColumns?: (viewId: string) => void
  onToggleBadge?: (id: string) => void
  isReorderMode?: boolean
  onEnterReorderMode?: () => void
  interventionCounts?: Record<string, number>
  /** Couleurs des vues basées sur les statuts (passées depuis le parent) */
  viewStatusColors?: Record<string, string | null>
}

export function ViewTabs({
  views,
  activeViewId,
  onSelect,
  onReorder,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onResetDefault,
  onConfigureColumns,
  onToggleBadge,
  isReorderMode = false,
  onEnterReorderMode,
  interventionCounts = {},
  viewStatusColors = {},
}: ViewTabsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  
  // Contexte pour l'animation Genie Effect
  const { registerBadgeRef, bouncingViewId, frozenCountViewIds } = useGenieEffectContext()
  
  // État local pour les compteurs gelés (snapshot au moment où l'animation démarre)
  const [frozenCounts, setFrozenCounts] = useState<Record<string, number>>({})
  
  // Mettre à jour les compteurs gelés quand frozenCountViewIds change
  useEffect(() => {
    if (frozenCountViewIds.size > 0) {
      // Prendre un snapshot des compteurs actuels pour les vues gelées
      const newFrozenCounts: Record<string, number> = {}
      frozenCountViewIds.forEach((viewId) => {
        newFrozenCounts[viewId] = interventionCounts[viewId] ?? 0
      })
      setFrozenCounts(newFrozenCounts)
    } else {
      // Réinitialiser les compteurs gelés
      setFrozenCounts({})
    }
  }, [frozenCountViewIds, interventionCounts])
  
  const visibleViews = useMemo(
    () => views.filter((view) => VISIBLE_VIEW_LAYOUTS.includes(view.layout)),
    [views]
  )
  const viewIds = useMemo(() => visibleViews.map((view) => view.id), [visibleViews])
  const visibleViewCount = useMemo(() => visibleViews.length, [visibleViews])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  
  // Refs pour les boutons de vues pour la navigation Tab
  const tabRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({})
  
  // Initialiser les refs pour chaque vue
  useEffect(() => {
    visibleViews.forEach((view) => {
      if (!tabRefs.current[view.id]) {
        tabRefs.current[view.id] = { current: null }
      }
    })
  }, [visibleViews])

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
  }, [visibleViewCount, updateScrollState])

  // Navigation Tab entre les vues pastillées
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne gérer que Tab (sans Shift) et Shift+Tab
      if (e.key !== "Tab") return
      
      // Ignorer si on est dans un champ éditable, un modal, ou un AlertDialog
      const target = e.target as HTMLElement
      const isEditable = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
      if (isEditable) return
      
      // Vérifier si on est dans un modal ou un AlertDialog
      const isInModal = target.closest('[role="dialog"]') !== null
      const isInAlertDialog = target.closest('[role="alertdialog"]') !== null
      if (isInModal || isInAlertDialog) return
      
      // Vérifier si le focus est actuellement sur un des boutons de vue
      const currentFocusedButton = Object.values(tabRefs.current).find(
        (ref) => ref.current === document.activeElement
      )
      
      if (!currentFocusedButton) {
        // Si aucun bouton n'a le focus, ne rien faire (laisser le comportement par défaut)
        return
      }
      
      // Trouver l'index du bouton actuellement focusé
      const currentIndex = visibleViews.findIndex(
        (view) => tabRefs.current[view.id]?.current === document.activeElement
      )
      
      if (currentIndex === -1) return
      
      // Calculer le prochain index
      let nextIndex: number
      if (e.shiftKey) {
        // Shift+Tab : navigation inverse
        nextIndex = currentIndex === 0 ? visibleViews.length - 1 : currentIndex - 1
      } else {
        // Tab : navigation normale
        nextIndex = (currentIndex + 1) % visibleViews.length
      }
      
      // Empêcher le comportement par défaut et focuser le prochain bouton
      e.preventDefault()
      const nextButton = tabRefs.current[visibleViews[nextIndex].id]?.current
      if (nextButton) {
        nextButton.focus()
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visibleViews])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = viewIds.indexOf(String(active.id))
    const overIndex = viewIds.indexOf(String(over.id))
    if (activeIndex === -1 || overIndex === -1) return

    const reordered = arrayMove(viewIds, activeIndex, overIndex)
    onReorder(reordered)
    requestAnimationFrame(updateScrollState)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="relative overflow-visible">
        <SortableContext items={viewIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollContainerRef}
            className="flex items-end gap-4 overflow-x-auto overflow-y-visible scrollbar-hide pt-3 pb-1"
          >
            {visibleViews.map((view, index) => {
              // Créer une ref pour chaque bouton si elle n'existe pas
              if (!tabRefs.current[view.id]) {
                tabRefs.current[view.id] = React.createRef<HTMLButtonElement>()
              }
              
              // Vérifier si cette vue est en cours de rebond
              const isViewBouncing = bouncingViewId === view.id
              
              // Utiliser le compteur gelé si la vue est dans frozenCountViewIds
              const isFrozen = frozenCountViewIds.has(view.id)
              const frozenCount = isFrozen ? frozenCounts[view.id] : undefined
              
              return (
                <SortableTab
                  key={view.id}
                  view={view}
                  isActive={view.id === activeViewId}
                  onSelect={onSelect}
                  onRenameView={onRenameView}
                  onDuplicateView={onDuplicateView}
                  onDeleteView={onDeleteView}
                  onResetDefault={onResetDefault}
                  onConfigureColumns={onConfigureColumns}
                  onToggleBadge={onToggleBadge}
                  isReorderMode={isReorderMode}
                  onEnterReorderMode={onEnterReorderMode}
                  interventionCount={interventionCounts[view.id] || 0}
                  frozenCount={frozenCount}
                  isBouncing={isViewBouncing}
                  statusColor={viewStatusColors[view.id]}
                  tabRef={tabRefs.current[view.id]}
                  tabIndex={0}
                  onBadgeRef={(element) => registerBadgeRef(view.id, element)}
                />
              )
            })}
          </div>
        </SortableContext>
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
    </DndContext>
  )
}

export default ViewTabs
