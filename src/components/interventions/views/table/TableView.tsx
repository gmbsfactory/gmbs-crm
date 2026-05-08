"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode, CSSProperties } from "react"
import { Bell, Eye } from "lucide-react"
import Loader from "@/components/ui/Loader"

import { useColumnResize } from "@/hooks/useColumnResize"
import { useInterventionReminders } from "@/hooks/useInterventionReminders"
import { getPropertyLabel, getPropertySchema } from "@/types/property-schema"
import { resolveThemeMode } from "./lib/table-theme"
import { buildTypographyClasses } from "./lib/table-style"
import { useTableAppearance } from "./hooks/useTableAppearance"
import { useReminderDialog } from "./hooks/useReminderDialog"
import { useScrollFades } from "./hooks/useScrollFades"
import { useTableVirtualization } from "./hooks/useTableVirtualization"
import { useStyleMenu } from "./hooks/useStyleMenu"
import { useColumnStyleEditor } from "./hooks/useColumnStyleEditor"
import { TruncatedCell } from "./parts/TruncatedCell"
import { ReminderNoteDialog } from "./parts/ReminderNoteDialog"
import { QuickStylePanel } from "./parts/QuickStylePanel"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type {
  InterventionViewByLayout,
  TableLayoutOptions,
  TableColumnAlignment,
} from "@/types/intervention-views"
import type { ViewFilter, ViewSort } from "@/types/intervention-views"
import { ColumnFilter } from "@/components/interventions/filters/ColumnFilter"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { InterventionContextMenuContent } from "@/components/interventions/InterventionContextMenu"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useTableKeyboardNavigation } from "@/hooks/useTableKeyboardNavigation"
import { RemoteEditBadge } from "@/components/interventions/RemoteEditBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { ExpandedRowContent } from "@/components/interventions/views/ExpandedRowContent"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"
import { Pagination } from "@/components/ui/pagination"
import { GestionnaireSelector } from "@/components/interventions/GestionnaireSelector"
import { getReadableTextColor } from "@/utils/color"
import { useInterventionStatusMap } from "@/hooks/useInterventionStatusMap"
import { useUserMap } from "@/hooks/useUserMap"
import { convertViewFiltersToServerFilters } from "@/lib/filter-converter"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { InterventionPresenceIndicator } from "@/components/ui/InterventionPresenceIndicator"

type TableViewProps = {
  view: InterventionViewByLayout<"table">
  interventions: InterventionEntity[]
  loading: boolean
  error: string | null
  onInterventionClick?: (id: string, options?: InterventionModalOpenOptions) => void
  onLayoutOptionsChange?: (patch: Partial<TableLayoutOptions>) => void
  onPropertyFilterChange?: (property: string, filter: ViewFilter | null) => void
  allInterventions?: InterventionEntity[]
  loadDistinctValues?: (property: string) => Promise<string[]>
  totalCount?: number
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onNextPage?: () => void
  onPreviousPage?: () => void
  /** Terme de recherche actif pour surligner les correspondances dans les cellules */
  searchQuery?: string
  /** Couleur du header (provenant de l'onglet de vue actif) */
  headerColor?: string | null
  /** Callback pour changer le tri (colonnes triables) */
  onSortChange?: (sorts: ViewSort[]) => void
}

import { type CellRender, renderCell } from "./cells"

export function TableView({
  view,
  interventions,
  loading,
  error,
  onInterventionClick,
  onLayoutOptionsChange,
  onPropertyFilterChange,
  allInterventions,
  loadDistinctValues,
  totalCount = 0,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onNextPage,
  onPreviousPage,
  searchQuery = "",
  headerColor,
  onSortChange,
}: TableViewProps) {
  // Page presence — qui consulte quoi sur cette page ?
  const pagePresenceCtx = usePagePresenceContext()
  const pageViewers = pagePresenceCtx?.viewers ?? []

  // Récupérer les fonctions de mapping depuis le Context
  const { codeToId: statusCodeToId } = useInterventionStatusMap()
  const { nameToId: userCodeToId } = useUserMap()
  const { data: filterUserData } = useCurrentUser()
  const currentUserId = filterUserData?.id

  // Convertir les filtres de la vue en baseFilters pour les compteurs
  // Utilise la fonction centralisée pour garantir la cohérence avec le reste de l'application
  const baseFilters = useMemo(() => {
    if (!view.filters || view.filters.length === 0) return {}

    const { serverFilters } = convertViewFiltersToServerFilters(view.filters, {
      statusCodeToId,
      userCodeToId,
      currentUserId,
    })

    return serverFilters
  }, [view.filters, statusCodeToId, userCodeToId, currentUserId])

  // ⚠️ NE PAS réappliquer les filtres/sorts de la vue : déjà appliqués côté serveur + residualFilters dans page.tsx
  const dataset = useMemo(() => interventions, [interventions])
  const orderedIds = useMemo(() => dataset.map((item) => item.id), [dataset])
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const {
    reminders,
    saveReminder,
    toggleReminder,
    getReminderNote,
    getReminderDueDate,
    getReminderMentions,
    removeReminder,
  } = useInterventionReminders()
  const {
    showNoteDialog,
    noteDialogInterventionId,
    noteValue,
    setNoteValue,
    dueDateValue,
    setDueDateValue,
    mentionIds,
    setMentionIds,
    noteDialogCoords,
    noteDialogContentRef,
    isReminderSaveDisabled,
    handleReminderContextMenu,
    handleNoteSave,
    handleNoteDialogOpenChange,
  } = useReminderDialog({
    saveReminder,
    removeReminder,
    getReminderNote,
    getReminderDueDate,
    getReminderMentions,
    lookupIdInter: useCallback(
      (id: string) => dataset.find((i) => i.id === id)?.id_inter || undefined,
      [dataset],
    ),
  })

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
  const localCurrentUserId = currentUserData?.id ?? null

  const tableLayoutOptions = view.layoutOptions as TableLayoutOptions
  const {
    columnWidths,
    columnStyles,
    columnAlignment,
    statusBorderWidthPx,
    statusBorderEnabled,
    coloredShadow,
    shadowValues,
    rowDisplayMode,
    useAccentColor,
    rowDensity,
    densityTableClass,
    densityHeaderClass,
    densityCellClass,
    rowHeight,
    tableInlineStyle,
  } = useTableAppearance(tableLayoutOptions)
  const { open: openInterventionModal } = useInterventionModal()
  const isMarketView = view.id === "market"
  const viewType: "default" | "market" = isMarketView ? "market" : "default"

  const {
    rowVirtualizer,
    virtualItems,
    totalHeight,
    firstVisible,
    lastVisible,
  } = useTableVirtualization({
    scrollerRef: tableContainerRef,
    dataset,
    rowHeight,
    currentPage,
  })

  const { highlightedIndex } = useTableKeyboardNavigation({
    dataset,
    rowVirtualizer,
    expandedRowId,
    setExpandedRowId,
    onInterventionClick,
    orderedIds,
    enabled: true,
    onNextPage,
    onPreviousPage,
  })

  const totalRows = totalCount ?? dataset.length

  const [themeMode, setThemeMode] = useState<"light" | "dark">("light")
  const { activeColumn, handlePointerDown } = useColumnResize(columnWidths, (widths) => {
    onLayoutOptionsChange?.({ columnWidths: widths })
  })

  const { styleMenu, styleMenuRef, openStyleMenu, closeStyleMenu } = useStyleMenu(
    view.id,
    Boolean(onLayoutOptionsChange),
  )
  const { applyColumnStyle, applyColumnAlignment } = useColumnStyleEditor({
    columnStyles,
    columnAlignment,
    onLayoutOptionsChange,
  })

  const { showTopFade, showBottomFade, handleScrollWithFades } = useScrollFades({
    scrollerRef: tableContainerRef,
    rowHeight,
    recomputeDeps: [dataset.length, expandedRowId],
  })

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return

    const updateTheme = () => setThemeMode(resolveThemeMode())
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", updateTheme)

    return () => {
      observer.disconnect()
      media.removeEventListener("change", updateTheme)
    }
  }, [])

  const quickStylePanel: ReactNode = styleMenu ? (
    <QuickStylePanel
      panelRef={styleMenuRef}
      position={{ x: styleMenu.x, y: styleMenu.y }}
      property={styleMenu.property}
      styleEntry={columnStyles[styleMenu.property] ?? {}}
      alignment={(columnAlignment[styleMenu.property] ?? "center") as TableColumnAlignment}
      sorts={view.sorts}
      onClose={closeStyleMenu}
      onApplyStyle={applyColumnStyle}
      onApplyAlignment={applyColumnAlignment}
      onSortChange={onSortChange}
    />
  ) : null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <>
      {/* data-view-type="table" permet de désactiver les animations skeleton/glass-float en CSS */}
      <div className="flex flex-col flex-1 min-h-0" data-view-type="table">
        <Card
          className={cn(
            "border-2 shadow-sm flex flex-col flex-1 min-h-0 rounded-tl-none",
            !headerColor && "border-t-primary/40"
          )}
          style={headerColor ? {
            borderTopColor: `${headerColor}40`,
          } : undefined}
        >
          <div
            className={cn(
              "table-horizontal-wrapper overflow-x-auto flex-1 min-h-0",
              densityTableClass,
              statusBorderEnabled && "table-has-status-border",
            )}
          >
            <div className="min-w-fit h-full flex flex-col" style={tableInlineStyle}>
              {/* En-tête fixe */}
              <div className="flex-shrink-0">
                <table
                  className={cn(
                    "data-table shadcn-table border-separate border-spacing-0 caption-bottom",
                    densityTableClass,
                    statusBorderEnabled && "table-has-status-border",
                  )}
                  style={{
                    ...tableInlineStyle,
                    tableLayout: "fixed",
                    width: "max-content",
                    minWidth: "100%",
                  }}
                >
                  <thead className="z-20">
                    <tr className="border-b border-border/60">
                      {(() => {
                        // Calculer la couleur du texte en fonction de la luminosité du header
                        const headerTextColor = headerColor ? getReadableTextColor(headerColor) : undefined

                        return (
                          <>
                            {view.visibleProperties.map((property) => {
                              const width = columnWidths[property] ?? 150 // Largeur par défaut si non définie
                              const schema = getPropertySchema(property)
                              const activeFilter = view.filters.find((filter) => filter.property === property)
                              const headerCellStyle: CSSProperties = {
                                width,
                                minWidth: width,
                                maxWidth: width,
                                ...(headerColor ? {
                                  backgroundColor: `${headerColor}25`, // Version pastel (15% opacité)
                                  borderColor: `${headerColor}40`,
                                  color: headerColor, // Texte dans la couleur du statut
                                } : {}),
                              }
                              return (
                                <th
                                  key={property}
                                  style={headerCellStyle}
                                  className={cn(
                                    "z-20 border-b px-4 py-4 text-center text-sm font-semibold",
                                    "whitespace-nowrap backdrop-blur-sm align-middle relative select-none",
                                    // Sans couleur spécifique → couleur d'accentuation (primary) en version pastel
                                    !headerColor && "border-primary/40 bg-primary/15 text-primary",
                                    densityHeaderClass,
                                  )}
                                  onContextMenu={(event) => openStyleMenu(event, property)}
                                >
                                  <div className="relative flex items-center justify-center gap-2">
                                    {schema?.filterable && onPropertyFilterChange ? (
                                      <ColumnFilter
                                        property={property}
                                        schema={schema}
                                        activeFilter={activeFilter}
                                        interventions={allInterventions ?? interventions}
                                        loadDistinctValues={loadDistinctValues}
                                        onFilterChange={onPropertyFilterChange}
                                        baseFilters={baseFilters}
                                        sorts={view.sorts}
                                        onSortChange={onSortChange}
                                      />
                                    ) : (
                                      <span>{getPropertyLabel(property)}</span>
                                    )}
                                    <div
                                      className={cn(
                                        "absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors duration-150",
                                        activeColumn === property
                                          ? "bg-white/50"
                                          : "opacity-0 hover:opacity-100 hover:bg-white/30",
                                      )}
                                      onPointerDown={(event) => handlePointerDown(event, property)}
                                    />
                                  </div>
                                </th>
                              )
                            })}
                            <th
                              style={{
                                width: 100,
                                minWidth: 100,
                                maxWidth: 100,
                                ...(headerColor ? {
                                  backgroundColor: `${headerColor}25`, // Version pastel (15% opacité)
                                  borderColor: `${headerColor}40`,
                                  color: headerColor, // Texte dans la couleur du statut
                                } : {}),
                              }}
                              className={cn(
                                "z-20 border-b px-4 py-4 text-center text-sm font-semibold",
                                "whitespace-nowrap backdrop-blur-sm align-middle relative select-none",
                                // Sans couleur spécifique → couleur d'accentuation (primary)
                                !headerColor && "border-primary/40 bg-primary/15 text-primary",
                                densityHeaderClass,
                              )}
                            >
                              <div className="flex items-center justify-center">
                                Actions
                              </div>
                            </th>
                          </>
                        )
                      })()}
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Zone de scroll pour le corps */}
              <div className="relative flex-1 min-h-0">
                <div
                  ref={tableContainerRef}
                  className="table-scroll-wrapper relative h-full overflow-y-auto overflow-x-hidden"
                  onScroll={handleScrollWithFades}
                  style={{
                    height: "100%",
                    scrollbarWidth: "thin",
                    scrollbarColor:
                      themeMode === "dark"
                        ? "rgba(255,255,255,0.2) rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.2) rgba(0,0,0,0.05)",
                  }}
                >
                  <table
                    className={cn(
                      "data-table shadcn-table border-separate border-spacing-0 caption-bottom",
                      densityTableClass,
                      statusBorderEnabled && "table-has-status-border",
                    )}
                    style={{
                      ...tableInlineStyle,
                      tableLayout: "fixed",
                      width: "max-content",
                      minWidth: "100%",
                    }}
                  >
                    <tbody>
                      {dataset.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(view.visibleProperties.length + 1, 1)}
                            className="px-4 py-12 text-center text-sm text-muted-foreground"
                          >
                            Aucune intervention ne correspond à ces filtres. Ajustez votre sélection pour reprendre l&apos;affichage.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {virtualItems.length > 0 && (
                            <tr style={{ height: `${Math.max(virtualItems[0].start, 0)}px` }} />
                          )}

                          {virtualItems.map((virtualRow) => {
                            const intervention = dataset[virtualRow.index]
                            const rowIndex = virtualRow.index
                            const statusColor =
                              intervention.status?.color ??
                              intervention.statusColor ??
                              "#3B82F6"
                            const isExpanded = expandedRowId === intervention.id

                            const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                              if (isExpanded) {
                                setExpandedRowId(null)
                              } else {
                                setExpandedRowId(intervention.id)
                              }
                            }

                            return (
                              <React.Fragment key={virtualRow.key}>
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      ref={rowVirtualizer.measureElement}
                                      data-index={virtualRow.index}
                                      data-intervention-id={intervention.id}
                                      data-row-index={rowIndex}
                                      aria-selected={highlightedIndex === rowIndex}
                                      data-kb-highlighted={highlightedIndex === rowIndex ? "" : undefined}
                                      className={cn(
                                        "group relative cursor-pointer border-b border-border/30 transition-colors duration-150 hover:bg-accent/10 data-[state=selected]:hover:bg-muted",
                                        statusBorderEnabled && "table-row-status-border",
                                        isExpanded && "bg-muted/30",
                                        // Classes pour les stripes colorées basées sur l'index réel (pas la position DOM)
                                        rowIndex % 2 === 0 ? "table-row-even" : "table-row-odd",
                                      )}
                                      style={
                                        {
                                          ...(coloredShadow ? { "--row-shadow-base": statusColor } : {}),
                                          ...(statusBorderEnabled
                                            ? {
                                              "--status-border-color": statusColor,
                                              "--table-status-border-width": statusBorderWidthPx,
                                            }
                                            : {}),
                                        } as CSSProperties
                                      }
                                      onClick={handleRowClick}
                                    >
                                      {view.visibleProperties.map((property, propertyIndex) => {
                                        const styleEntry = columnStyles[property]
                                        const { content, tooltipText, backgroundColor, defaultTextColor, cellClassName, statusGradient } =
                                          renderCell(intervention, property, styleEntry, themeMode)
                                        const alignment = (columnAlignment[property] ?? "center") as TableColumnAlignment
                                        const alignmentClass =
                                          alignment === "center"
                                            ? "text-center"
                                            : alignment === "right"
                                              ? "text-right"
                                              : "text-left"
                                        const typographyClasses = buildTypographyClasses(styleEntry)
                                        const textColor = styleEntry?.textColor ?? defaultTextColor
                                        const width = columnWidths[property] ?? 150 // Largeur par défaut si non définie
                                        const inlineStyle: CSSProperties & Record<string, any> = {
                                          width,
                                          minWidth: width,
                                          maxWidth: width,
                                        }
                                        if (backgroundColor) inlineStyle.backgroundColor = backgroundColor
                                        if (textColor) inlineStyle.color = textColor

                                        if (rowDisplayMode === "gradient" && statusGradient) {
                                          inlineStyle["--cell-background-layer"] = statusGradient
                                        }

                                        return (
                                          <td
                                            key={`${intervention.id}-${property}`}
                                            className={cn(
                                              "px-4 align-middle transition-colors duration-150",
                                              densityCellClass,
                                              alignmentClass,
                                              typographyClasses,
                                              cellClassName,
                                              "max-w-[200px]",
                                              isExpanded && "!py-[px]",
                                              // Ajouter relative seulement pour la première cellule pour positionner le badge
                                              propertyIndex === 0 && "relative",
                                            )}
                                            style={inlineStyle}
                                          >
                                            {/* Badge de modification distante - seulement dans la première cellule */}
                                            {propertyIndex === 0 && (
                                              <RemoteEditBadge
                                                interventionId={intervention.id}
                                                className="top-1 left-1"
                                              />
                                            )}
                                            {/* Afficher directement les badges visuels sans TruncatedCell */}
                                            {property === "attribueA" ? (
                                              <div
                                                className="flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {(() => {
                                                  const assignedUserId = intervention.assignedUserId ?? null
                                                  const assignedUserName = intervention.assignedUserName
                                                  const assignedUserColor = intervention.assignedUserColor ?? undefined
                                                  const assignedUserAvatarUrl = intervention.assignedUserAvatarUrl ?? undefined
                                                  const assignedUserCode = intervention.assignedUserCode ?? undefined

                                                  const interventionDate = intervention.dateIntervention ?? intervention.date ?? null

                                                  if (!assignedUserId && !assignedUserCode) {
                                                    // Pas d'utilisateur assigné, utiliser le sélecteur avec "?"
                                                    return (
                                                      <GestionnaireSelector
                                                        interventionId={intervention.id}
                                                        currentUserId={null}
                                                        currentUserFirstname="?"
                                                        currentUserLastname=""
                                                        currentUserColor="#9ca3af"
                                                        currentUserAvatarUrl={undefined}
                                                        dateIntervention={interventionDate}
                                                      />
                                                    )
                                                  }

                                                  // Extraire prénom et nom pour GestionnaireBadge
                                                  const nameParts = assignedUserName?.trim().split(/\s+/) ?? []
                                                  const firstname = nameParts[0] ?? assignedUserCode ?? "?"
                                                  const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined

                                                  return (
                                                    <GestionnaireSelector
                                                      interventionId={intervention.id}
                                                      currentUserId={assignedUserId}
                                                      currentUserFirstname={firstname}
                                                      currentUserLastname={lastname}
                                                      currentUserColor={assignedUserColor}
                                                      currentUserAvatarUrl={assignedUserAvatarUrl}
                                                      dateIntervention={interventionDate}
                                                    />
                                                  )
                                                })()}
                                              </div>
                                            ) : property === "statusValue" ? (
                                              <div className="flex items-center justify-center">
                                                {content}
                                              </div>
                                            ) : (
                                              <TruncatedCell content={content} searchQuery={searchQuery} tooltipText={tooltipText} alwaysShowTooltip={property === "artisan"} />
                                            )}
                                          </td>
                                        )
                                      })}
                                      <td
                                        className={cn(
                                          "px-4 align-middle text-center transition-colors duration-150",
                                          densityCellClass,
                                          isExpanded && "!py-[7px]",
                                        )}
                                        style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center justify-center gap-0">
                                          {/* Cloche - Visible si reminder actif OU hover sur la ligne */}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                              "h-8 w-8 transition-opacity duration-150",
                                              reminders.has(intervention.id)
                                                ? "text-red-500 hover:text-red-600 opacity-100"
                                                : "opacity-0 group-hover:opacity-100",
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              void toggleReminder(intervention.id, intervention.id_inter || undefined)
                                            }}
                                            onContextMenu={(e) => {
                                              e.preventDefault()
                                              handleReminderContextMenu(e, intervention.id)
                                            }}
                                            title={reminders.has(intervention.id) ? "Retirer le rappel" : "Ajouter un rappel"}
                                          >
                                            <Bell className={cn("h-4 w-4", reminders.has(intervention.id) && "fill-current")} />
                                          </Button>
                                          {/* Œil - Toujours visible */}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onInterventionClick?.(intervention.id, {
                                                layoutId: `table-row-${intervention.id}`,
                                                orderedIds,
                                                index: rowIndex,
                                              })
                                            }}
                                            title="Voir les détails"
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          {/* Présence — qui consulte cette intervention ? */}
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <InterventionPresenceIndicator
                                              interventionId={intervention.id}
                                              viewers={pageViewers}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <InterventionContextMenuContent
                                    intervention={intervention}
                                    viewType={viewType}
                                    onOpen={() => openInterventionModal(intervention.id)}
                                    onOpenInNewTab={() => {
                                      const newWindow = window.open(`/interventions?i=${intervention.id}`, '_blank')
                                      // Remettre le focus sur la fenêtre actuelle après un court délai
                                      if (newWindow) {
                                        setTimeout(() => {
                                          window.focus()
                                        }, 100)
                                      }
                                    }}
                                  />
                                </ContextMenu>
                                {isExpanded && (
                                  <tr className="border-b-0 hover:bg-transparent">
                                    <td colSpan={view.visibleProperties.length + 1} className="expanded-row-cell p-0 align-top">
                                      <ExpandedRowContent
                                        intervention={intervention}
                                        statusColor={statusColor}
                                        showStatusBorder={statusBorderEnabled}
                                        statusBorderWidth={statusBorderWidthPx}
                                        currentUserId={localCurrentUserId}
                                        searchQuery={searchQuery}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}

                          {virtualItems.length > 0 && (
                            <tr
                              style={{
                                height: `${Math.max(totalHeight - virtualItems[virtualItems.length - 1].end, 0)}px`,
                              }}
                            />
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <div
                  className={cn(
                    "pointer-events-none absolute top-0 left-0 right-0 h-20 z-10",
                    "transition-opacity duration-1300",
                    showTopFade
                      ? (themeMode === "dark" ? "opacity-100" : "opacity-25")
                      : "opacity-0",
                  )}
                  style={{
                    background:
                      themeMode === "dark"
                        ? "linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 100%)"
                        : "linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 100%)",
                  }}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-10",
                    "transition-opacity duration-300",
                    showBottomFade
                      ? (themeMode === "dark" ? "opacity-100" : "opacity-25")
                      : "opacity-0",
                  )}
                  style={{
                    background:
                      themeMode === "dark"
                        ? "linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)"
                        : "linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)",
                  }}
                />
              </div>
            </div>
          </div>
          {/* Styles scrollbar via CSS global - évite les conflits styled-jsx avec React */}
        </Card>

        {/* Pagination en bas */}
        {totalCount > 0 && onPageChange ? (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={100}
            onPageChange={onPageChange}
            onNext={onNextPage}
            onPrevious={onPreviousPage}
            canGoNext={currentPage < totalPages}
            canGoPrevious={currentPage > 1}
            className="border-t bg-background mt-2"
          />
        ) : null}
      </div>

      {quickStylePanel}

      <ReminderNoteDialog
        open={showNoteDialog}
        onOpenChange={handleNoteDialogOpenChange}
        contentRef={noteDialogContentRef}
        coords={noteDialogCoords}
        isExistingReminder={Boolean(
          noteDialogInterventionId && reminders.has(noteDialogInterventionId),
        )}
        noteValue={noteValue}
        onNoteValueChange={(value, mentions) => {
          setNoteValue(value)
          setMentionIds(mentions)
        }}
        dueDateValue={dueDateValue}
        onDueDateChange={setDueDateValue}
        isSaveDisabled={isReminderSaveDisabled}
        onSave={() => void handleNoteSave()}
      />
    </>
  )
}

export default TableView
