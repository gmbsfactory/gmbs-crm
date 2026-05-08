import React, { type RefObject } from "react"
import { ArrowDown, ArrowUp, Bold, Italic, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getPropertyLabel, getPropertySchema } from "@/types/property-schema"
import {
  STYLE_ELIGIBLE_COLUMNS,
  TABLE_APPEARANCE_OPTIONS,
  TABLE_TEXT_SIZE_OPTIONS,
} from "@/lib/interventions/column-style"
import type {
  TableColumnAlignment,
  TableColumnAppearance,
  TableColumnStyle,
  TableColumnTextSize,
  ViewSort,
} from "@/types/intervention-views"
import { TABLE_ALIGNMENT_OPTIONS } from "@/components/interventions/views/table/column-alignment-options"

const PORTAL_MARKER = { "data-quick-style-panel": "true" } as const
const TOGGLE_ACTIVE_CLASSES = "border border-primary/60 bg-primary/10 text-primary"

export type QuickStylePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  position: { x: number; y: number }
  property: string
  styleEntry: TableColumnStyle
  alignment: TableColumnAlignment
  sorts: ViewSort[] | undefined
  onClose: () => void
  onApplyStyle: (property: string, updater: (prev: TableColumnStyle) => TableColumnStyle) => void
  onApplyAlignment: (property: string, alignment: TableColumnAlignment) => void
  onSortChange?: (sorts: ViewSort[]) => void
}

export function QuickStylePanel({
  panelRef,
  position,
  property,
  styleEntry,
  alignment,
  sorts,
  onClose,
  onApplyStyle,
  onApplyAlignment,
  onSortChange,
}: QuickStylePanelProps) {
  const propertyLabel = getPropertyLabel(property)
  const sizeValue = styleEntry.textSize ?? "md"
  const isBold = Boolean(styleEntry.bold)
  const isItalic = Boolean(styleEntry.italic)
  const colorValue = styleEntry.textColor ?? "#111827"
  const isAppearanceEditable = STYLE_ELIGIBLE_COLUMNS.has(property)
  const appearanceValue: TableColumnAppearance = isAppearanceEditable
    ? styleEntry.appearance ?? "solid"
    : "none"
  const isSortable = Boolean(getPropertySchema(property)?.sortable && onSortChange)
  const currentSortDirection = sorts?.find((s) => s.property === property)?.direction ?? null

  const stopAll = (event: React.SyntheticEvent) => event.stopPropagation()
  const stopAndPrevent = (event: React.SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      ref={panelRef}
      {...PORTAL_MARKER}
      className="fixed z-[95] min-w-[340px] max-w-[420px] rounded-lg border border-border bg-popover p-3 shadow-xl"
      style={{ top: position.y, left: position.x }}
      onClick={stopAll}
      onPointerDown={stopAll}
      onContextMenu={stopAndPrevent}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
          {propertyLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Fermer le style rapide"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[0.7rem]">
        {/* Text size */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Taille</span>
          <Select
            value={sizeValue}
            onValueChange={(value) =>
              onApplyStyle(property, (prev) => ({ ...prev, textSize: value as TableColumnTextSize }))
            }
          >
            <SelectTrigger {...PORTAL_MARKER} className="h-7 w-[78px] text-[0.7rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...PORTAL_MARKER} className="z-[110]">
              {TABLE_TEXT_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bold / Italic */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Style</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn("h-7 w-7 text-muted-foreground", isBold && TOGGLE_ACTIVE_CLASSES)}
              onClick={() => onApplyStyle(property, (prev) => ({ ...prev, bold: !isBold }))}
              aria-label={`Basculer en gras (${propertyLabel})`}
            >
              <Bold className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn("h-7 w-7 text-muted-foreground", isItalic && TOGGLE_ACTIVE_CLASSES)}
              onClick={() => onApplyStyle(property, (prev) => ({ ...prev, italic: !isItalic }))}
              aria-label={`Basculer en italique (${propertyLabel})`}
            >
              <Italic className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Text color */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Couleur</span>
          <div className="flex items-center gap-1">
            <input
              {...PORTAL_MARKER}
              type="color"
              value={colorValue}
              onChange={(event) => {
                const nextColor = event.target.value
                onApplyStyle(property, (prev) => ({ ...prev, textColor: nextColor }))
              }}
              className="h-7 w-7 cursor-pointer rounded border border-border"
              aria-label={`Couleur du texte (${propertyLabel})`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onApplyStyle(property, (prev) => ({ ...prev, textColor: undefined }))}
              aria-label={`Réinitialiser la couleur (${propertyLabel})`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Alignement</span>
          <div className="flex items-center gap-1">
            {TABLE_ALIGNMENT_OPTIONS.map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-7 w-7 text-muted-foreground",
                  alignment === value && TOGGLE_ACTIVE_CLASSES,
                )}
                onClick={() => onApplyAlignment(property, value)}
                aria-label={`${label} (${propertyLabel})`}
              >
                <Icon className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </div>

        {/* Appearance + sort */}
        <div className={cn("flex items-center gap-1", !isAppearanceEditable && "opacity-60")}>
          <span className="text-muted-foreground">Affichage</span>
          <Select
            value={appearanceValue}
            disabled={!isAppearanceEditable}
            onValueChange={(value) => {
              if (!isAppearanceEditable) return
              onApplyStyle(property, (prev) => ({
                ...prev,
                appearance: value as TableColumnAppearance,
              }))
            }}
          >
            <SelectTrigger
              {...PORTAL_MARKER}
              className={cn(
                "h-7 w-[140px] text-[0.7rem]",
                !isAppearanceEditable && "cursor-not-allowed opacity-60",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...PORTAL_MARKER} className="z-[110]">
              {TABLE_APPEARANCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSortable && onSortChange && (
            <SortControls
              property={property}
              propertyLabel={propertyLabel}
              direction={currentSortDirection}
              onSortChange={onSortChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}

type SortControlsProps = {
  property: string
  propertyLabel: string
  direction: "asc" | "desc" | null
  onSortChange: (sorts: ViewSort[]) => void
}

function SortControls({ property, propertyLabel, direction, onSortChange }: SortControlsProps) {
  const setOrToggle = (next: "asc" | "desc") => {
    if (direction === next) {
      onSortChange([])
    } else {
      onSortChange([{ property, direction: next }])
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">Tri</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 text-muted-foreground",
            direction === "asc" && TOGGLE_ACTIVE_CLASSES,
          )}
          onClick={() => setOrToggle("asc")}
          aria-label={`Tri croissant (${propertyLabel})`}
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
            direction === "desc" && TOGGLE_ACTIVE_CLASSES,
          )}
          onClick={() => setOrToggle("desc")}
          aria-label={`Tri décroissant (${propertyLabel})`}
          title="Décroissant"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        {direction && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onSortChange([])}
            aria-label={`Supprimer le tri (${propertyLabel})`}
            title="Supprimer le tri"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
