"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Bold, Check, Italic, Plus, GripVertical, X } from "lucide-react"
import type { DropResult } from "@hello-pangea/dnd"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModeIcons } from "@/components/ui/mode-selector"
import { cn } from "@/lib/utils"
import { INTERVENTION_PROPERTIES } from "@/types/property-schema"
import type {
  InterventionViewDefinition,
  TableLayoutOptions,
  TableColumnStyle,
  TableColumnAlignment,
  TableColumnAppearance,
  TableColumnTextSize,
} from "@/types/intervention-views"
import type { ModalDisplayMode } from "@/types/modal-display"
import {
  STYLE_ELIGIBLE_COLUMNS,
  TABLE_APPEARANCE_OPTIONS,
  TABLE_TEXT_SIZE_OPTIONS,
  normalizeColumnStyle,
} from "@/lib/interventions/column-style"
import { TABLE_ALIGNMENT_OPTIONS } from "./table/column-alignment-options"

type ColumnConfigurationProps = {
  view: InterventionViewDefinition
  mode: ModalDisplayMode
  onClose: () => void
  onCycleMode?: () => void
  onUpdateColumns: (visibleProperties: string[]) => void
  onUpdateColumnOrder: (visibleProperties: string[]) => void
  onUpdateLayoutOptions?: (patch: Partial<TableLayoutOptions>) => void
}

export function ColumnConfiguration({
  view,
  mode,
  onClose,
  onCycleMode,
  onUpdateColumns,
  onUpdateColumnOrder,
  onUpdateLayoutOptions,
}: ColumnConfigurationProps) {
  const isTableLayout = view.layout === "table"
  const tableLayout = useMemo(() => (view.layoutOptions as TableLayoutOptions) ?? { layout: "table" }, [view.layoutOptions])

  const [visibleProperties, setVisibleProperties] = useState<string[]>(view.visibleProperties)
  const [columnStyles, setColumnStyles] = useState<Record<string, TableColumnStyle>>({ ...(tableLayout.columnStyles ?? {}) })
  const [columnAlignment, setColumnAlignment] = useState<Record<string, TableColumnAlignment>>({
    ...(tableLayout.columnAlignment ?? {}),
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null)

  useEffect(() => {
    setVisibleProperties(view.visibleProperties)
    setColumnStyles({ ...(tableLayout.columnStyles ?? {}) })
    setColumnAlignment({ ...(tableLayout.columnAlignment ?? {}) })
    setHasChanges(false)
    setSelectedAvailable(null)
  }, [view.id, view.visibleProperties, tableLayout.columnStyles, tableLayout.columnAlignment])

  const availableProperties = useMemo(
    () => INTERVENTION_PROPERTIES.filter((property) => !visibleProperties.includes(property.key)),
    [visibleProperties],
  )

  const visiblePropertiesWithInfo = useMemo(
    () =>
      visibleProperties
        .map((key) => INTERVENTION_PROPERTIES.find((property) => property.key === key))
        .filter(Boolean),
    [visibleProperties],
  )

  const updateColumnStyle = useCallback((propertyKey: string, updater: (prev: TableColumnStyle) => TableColumnStyle) => {
    setColumnStyles((prev) => {
      const current = prev[propertyKey] ?? {}
      const nextRaw = updater({ ...current })
      const normalized = normalizeColumnStyle(propertyKey, nextRaw)
      if (!normalized) {
        if (!prev[propertyKey]) return prev
        const { [propertyKey]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [propertyKey]: normalized }
    })
    setHasChanges(true)
  }, [])

  const handlePropertyToggle = useCallback(
    (propertyKey: string, checked: boolean) => {
      setVisibleProperties((prev) => {
        if (checked) {
          if (prev.includes(propertyKey)) return prev
          setHasChanges(true)
          return [...prev, propertyKey]
        }
        const next = prev.filter((prop) => prop !== propertyKey)
        if (columnStyles[propertyKey]) {
          setColumnStyles((styles) => {
            const { [propertyKey]: _removed, ...rest } = styles
            return rest
          })
        }
        if (columnAlignment[propertyKey]) {
          setColumnAlignment((alignment) => {
            const { [propertyKey]: _removed, ...rest } = alignment
            return rest
          })
        }
        setHasChanges(true)
        return next
      })
    },
    [columnAlignment, columnStyles],
  )

  const handleDragEnd = useCallback((result: DropResult) => {
    const destination = result.destination
    if (!destination) return
    const sourceIndex = result.source.index
    const destinationIndex = destination.index
    if (sourceIndex === destinationIndex) return
    setVisibleProperties((prev) => {
      const next = [...prev]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(destinationIndex, 0, moved)
      setHasChanges(true)
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    onUpdateColumns(visibleProperties)
    onUpdateColumnOrder(visibleProperties)
    if (isTableLayout && onUpdateLayoutOptions) {
      onUpdateLayoutOptions({
        columnStyles,
        columnAlignment,
      })
    }
    setHasChanges(false)
    onClose()
  }, [columnAlignment, columnStyles, isTableLayout, onClose, onUpdateColumnOrder, onUpdateColumns, onUpdateLayoutOptions, visibleProperties])

  const handleCancel = useCallback(() => {
    setVisibleProperties(view.visibleProperties)
    setColumnStyles({ ...(tableLayout.columnStyles ?? {}) })
    setColumnAlignment({ ...(tableLayout.columnAlignment ?? {}) })
    setHasChanges(false)
    onClose()
  }, [onClose, tableLayout.columnAlignment, tableLayout.columnStyles, view.visibleProperties])

  const ModeIcon = ModeIcons[mode]
  const bodyPadding = mode === "fullpage" ? "px-8 py-6 md:px-12" : "px-5 py-4 md:px-8"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const showAvailablePanel = mode === "fullpage"
  const gridColumnsClass = showAvailablePanel ? "grid-cols-1 lg:grid-cols-[0.7fr_0.3fr]" : "grid-cols-1"
  const renderAddColumnSelect = (triggerClassName?: string) => (
    <Select
      value={selectedAvailable ?? undefined}
      onValueChange={(value) => {
        handlePropertyToggle(value, true)
        setSelectedAvailable(null)
      }}
    >
      <SelectTrigger
        className={cn("modal-config-columns-select", triggerClassName ?? "w-[220px] text-xs")}
        disabled={availableProperties.length === 0}
      >
        <SelectValue
          placeholder={
            availableProperties.length === 0 ? "Toutes les colonnes affichées" : "Ajouter une colonne..."
          }
        />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {availableProperties.map((property) => (
          <SelectItem key={property.key} value={property.key}>
            {property.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <TooltipProvider>
      <div className={cn("modal-config-surface", surfaceVariantClass, surfaceModeClass)}>
        <header className="modal-config-columns-header">
          <div className="flex items-center gap-3">
            {onCycleMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button"
                    onClick={onCycleMode}
                    aria-label="Changer le mode d'affichage"
                  >
                    <ModeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Ajuster l&apos;affichage ({mode})
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="modal-config-columns-icon-placeholder" />
            )}
          </div>
          <div className="modal-config-columns-title">Configuration des colonnes</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="modal-config-columns-icon-button"
                onClick={handleCancel}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
          </Tooltip>
        </header>
        <div className={cn("modal-config-columns-body", bodyPadding)}>
          <div className={cn("modal-config-columns-grid", gridColumnsClass)}>
            <section className="modal-config-columns-panel">
              <div className="modal-config-columns-panel-header">
                <div className="space-y-0.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                    Colonnes visibles
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Glisser pour réordonner</span>
                </div>
                {!showAvailablePanel ? renderAddColumnSelect("w-[180px] sm:w-[210px] text-xs") : null}
              </div>
              <ScrollArea className="modal-config-columns-scroll">
                <div className="modal-config-columns-scroll-inner">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="visible-columns">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2.5">
                        {visiblePropertiesWithInfo.map((property, index) => {
                          const propertyInfo = property!
                          const propertyKey = propertyInfo.key
                          const styleEntry = columnStyles[propertyKey] ?? {}
                          const isAppearanceEditable = STYLE_ELIGIBLE_COLUMNS.has(propertyKey)
                          const appearanceValue: TableColumnAppearance = isAppearanceEditable
                            ? styleEntry.appearance ?? "solid"
                            : "none"
                          const sizeValue = styleEntry.textSize ?? "md"
                          const isBold = Boolean(styleEntry.bold)
                          const isItalic = Boolean(styleEntry.italic)
                          const colorValue = styleEntry.textColor ?? "#111827"
                          const alignmentValue = columnAlignment[propertyKey] ?? "center"

                          return (
                            <Draggable key={propertyKey} draggableId={propertyKey} index={index}>
                              {(draggableProvided, snapshot) => {
                                const item = (
                                  <div
                                    ref={draggableProvided.innerRef}
                                    {...draggableProvided.draggableProps}
                                    className={cn(
                                      "modal-config-columns-item space-y-2.5",
                                      snapshot.isDragging && "modal-config-columns-item--dragging",
                                    )}
                                  >
                                  <div className="flex items-start gap-3">
                                    <button
                                      type="button"
                                      {...draggableProvided.dragHandleProps}
                                      className="modal-config-columns-drag-handle"
                                      aria-label={`Déplacer ${propertyInfo.label}`}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="truncate text-sm font-medium">{propertyInfo.label}</div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {propertyInfo.type} • {propertyInfo.sortable ? "Triable" : "Non triable"} • {propertyInfo.filterable ? "Filtrable" : "Non filtrable"}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="modal-config-columns-icon-button modal-config-columns-icon-button--danger"
                                      onClick={() => handlePropertyToggle(propertyKey, false)}
                                      aria-label={`Retirer ${propertyInfo.label}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className={cn(
                                    "grid text-[11px] lg:items-center",
                                    mode === "fullpage" 
                                      ? "gap-1.5 sm:grid-cols-2 lg:grid-cols-[110px_120px_minmax(0,1fr)_minmax(0,1fr)_140px] xl:grid-cols-[110px_140px_minmax(0,1fr)_minmax(0,1fr)_150px]"
                                      : "gap-1 sm:grid-cols-2 lg:grid-cols-[95px_105px_minmax(0,1fr)_minmax(0,1fr)_125px]"
                                  )}>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Taille</span>
                                      <Select
                                        value={sizeValue}
                                        onValueChange={(value) =>
                                          updateColumnStyle(propertyKey, (prev) => ({
                                            ...prev,
                                            textSize: value as TableColumnTextSize,
                                          }))
                                        }
                                      >
                                        <SelectTrigger className={cn(
                                          "modal-config-columns-select", 
                                          mode === "fullpage" ? "w-[110px]" : "w-[95px]",
                                          "text-xs"
                                        )}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TABLE_TEXT_SIZE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Style</span>
                                      <div className={cn("flex items-center", mode === "fullpage" ? "gap-1" : "gap-0.5")}>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className={cn(
                                            "modal-config-columns-toggle",
                                            isBold && "modal-config-columns-toggle--active",
                                          )}
                                          onClick={() =>
                                            updateColumnStyle(propertyKey, (prev) => ({
                                              ...prev,
                                              bold: !isBold,
                                            }))
                                          }
                                          aria-label={`Gras (${propertyInfo.label})`}
                                        >
                                          <Bold className={cn(mode === "fullpage" ? "h-4 w-4" : "h-3.5 w-3.5")} />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className={cn(
                                            "modal-config-columns-toggle",
                                            isItalic && "modal-config-columns-toggle--active",
                                          )}
                                          onClick={() =>
                                            updateColumnStyle(propertyKey, (prev) => ({
                                              ...prev,
                                              italic: !isItalic,
                                            }))
                                          }
                                          aria-label={`Italique (${propertyInfo.label})`}
                                        >
                                          <Italic className={cn(mode === "fullpage" ? "h-4 w-4" : "h-3.5 w-3.5")} />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Couleur</span>
                                      <div className={cn("flex items-center", mode === "fullpage" ? "gap-1" : "gap-0.5")}>
                                        <input
                                          type="color"
                                          value={colorValue}
                                          onChange={(event) => {
                                            const nextColor = event.target.value
                                            updateColumnStyle(propertyKey, (prev) => ({
                                              ...prev,
                                              textColor: nextColor,
                                            }))
                                          }}
                                          className="modal-config-columns-color-picker"
                                          aria-label={`Couleur du texte (${propertyInfo.label})`}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="modal-config-columns-icon-button"
                                          onClick={() =>
                                            updateColumnStyle(propertyKey, (prev) => ({
                                              ...prev,
                                              textColor: undefined,
                                            }))
                                          }
                                          aria-label={`Réinitialiser la couleur (${propertyInfo.label})`}
                                        >
                                          <X className={cn(mode === "fullpage" ? "h-4 w-4" : "h-3.5 w-3.5")} />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Alignement</span>
                                      <div className={cn("flex items-center", mode === "fullpage" ? "gap-1" : "gap-0.5")}>
                                        {TABLE_ALIGNMENT_OPTIONS.map(({ value, icon: Icon, label }) => (
                                          <Button
                                            key={value}
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className={cn(
                                              "modal-config-columns-toggle",
                                              alignmentValue === value && "modal-config-columns-toggle--active",
                                            )}
                                            onClick={() => {
                                              setColumnAlignment((prev) => {
                                                if (value === "center") {
                                                  if (!prev[propertyKey]) return prev
                                                  const { [propertyKey]: _removed, ...rest } = prev
                                                  return rest
                                                }
                                                return { ...prev, [propertyKey]: value }
                                              })
                                              setHasChanges(true)
                                            }}
                                            aria-label={`${label} (${propertyInfo.label})`}
                                          >
                                            <Icon className={cn(mode === "fullpage" ? "h-4 w-4" : "h-3.5 w-3.5")} />
                                          </Button>
                                        ))}
                                      </div>
                                    </div>

                                    <div
                                      className={cn(
                                        "flex items-center gap-1",
                                        !isAppearanceEditable && "opacity-60",
                                      )}
                                    >
                                      <span className="text-muted-foreground">Affichage</span>
                                      <Select
                                        value={appearanceValue}
                                        disabled={!isAppearanceEditable}
                                        onValueChange={(value) => {
                                          if (!isAppearanceEditable) return
                                          updateColumnStyle(propertyKey, (prev) => ({
                                            ...prev,
                                            appearance: value as TableColumnAppearance,
                                          }))
                                        }}
                                      >
                                        <SelectTrigger
                                          className={cn(
                                            "modal-config-columns-select",
                                            mode === "fullpage" ? "w-[150px]" : "w-[125px]",
                                            "text-xs",
                                            !isAppearanceEditable && "cursor-not-allowed opacity-60",
                                          )}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TABLE_APPEARANCE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                                )

                                // Utiliser un portail uniquement en centerpage/halfpage pour éviter les problèmes de transform CSS
                                // En fullpage, pas besoin de portail car il n'y a pas de transform sur le modal
                                if (snapshot.isDragging && mode !== 'fullpage' && typeof window !== 'undefined') {
                                  return createPortal(item, document.body)
                                }

                                return item
                              }}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                        {visiblePropertiesWithInfo.length === 0 ? (
                          <p className="modal-config-columns-empty">
                            Aucune colonne sélectionnée pour le moment.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </ScrollArea>
            </section>

            {showAvailablePanel ? (
              <section className="modal-config-columns-panel">
                <div className="modal-config-columns-panel-header">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                    Colonnes disponibles
                  </Label>
                  {renderAddColumnSelect("w-[220px] text-xs")}
                </div>
                <ScrollArea className="modal-config-columns-scroll">
                  <div className="modal-config-columns-scroll-inner space-y-3">
                    {availableProperties.length === 0 ? (
                      <p className="modal-config-columns-empty">
                        Toutes les colonnes sont affichées.
                      </p>
                    ) : (
                      availableProperties.map((property) => (
                        <div
                          key={property.key}
                          className="modal-config-columns-available-item"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{property.label}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {property.type} • {property.sortable ? "Triable" : "Non triable"} • {property.filterable ? "Filtrable" : "Non filtrable"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="modal-config-columns-icon-button"
                            onClick={() => handlePropertyToggle(property.key, true)}
                            aria-label={`Ajouter ${property.label}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </section>
            ) : null}
          </div>
        </div>
        <footer className="modal-config-columns-footer">
          <div className="text-xs text-muted-foreground">Les modifications sont propres à cette vue uniquement.</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Check className="mr-2 h-4 w-4" />
              Appliquer
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}

export default ColumnConfiguration
