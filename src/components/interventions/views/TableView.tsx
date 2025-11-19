"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { ChangeEvent, ReactNode, CSSProperties } from "react"
import { AlignCenter, AlignLeft, AlignRight, Bell, Bold, ChevronDown, Eye, Filter, Italic, Send, X } from "lucide-react"
import Loader from "@/components/ui/Loader"

import { useColumnResize } from "@/hooks/useColumnResize"
import { useInterventionReminders } from "@/hooks/useInterventionReminders"
import { isCheckStatus } from "@/lib/interventions/checkStatus"
import { runQuery, getPropertyValue } from "@/lib/query-engine"
import { SCROLL_CONFIG } from "@/config/interventions"
import { toDate } from "@/lib/date-utils"
import { getPropertyLabel, getPropertySchema } from "@/types/property-schema"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type {
  InterventionViewByLayout,
  TableLayoutOptions,
  TableColumnAppearance,
  TableColumnStyle,
  TableColumnTextSize,
  TableColumnAlignment,
  TableStatusBorderSize,
  TableShadowIntensity,
  TableRowDisplayMode,
  TableRowDensity,
} from "@/types/intervention-views"
import { TABLE_STATUS_BORDER_WIDTHS, TABLE_SHADOW_INTENSITIES } from "@/types/intervention-views"
import type { ViewFilter } from "@/types/intervention-views"
import type { PropertySchema } from "@/types/property-schema"
import { ColumnFilter } from "@/components/interventions/filters/ColumnFilter"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { InterventionContextMenuContent } from "@/components/interventions/InterventionContextMenu"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { RemoteEditBadge } from "@/components/interventions/RemoteEditBadge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { ReminderMentionInput } from "@/components/interventions/ReminderMentionInput"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase-client"
import { CommentSection } from "@/components/shared/CommentSection"
import {
  STYLE_ELIGIBLE_COLUMNS,
  TABLE_APPEARANCE_OPTIONS,
  TABLE_TEXT_SIZE_OPTIONS,
  normalizeColumnStyle,
} from "@/lib/interventions/column-style"
import { TABLE_ALIGNMENT_OPTIONS } from "./column-alignment-options"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"
import { iconForStatus } from "@/lib/interventions/status-icons"
import { getStatusDisplay } from "@/lib/interventions/status-display"
import { Pagination } from "@/components/ui/pagination"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" })

type NoteDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

const NoteDialogContent = React.forwardRef<HTMLDivElement, NoteDialogContentProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogPrimitive.Overlay
        className="fixed inset-0 z-[55] bg-black/20"
        onClick={(e) => {
          // Empêcher la fermeture du modal si on clique sur l'overlay
          // Le modal ne se fermera que via les boutons ou Escape
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={className}
        {...props}
      />
    </AlertDialogPortal>
  ),
)

NoteDialogContent.displayName = "NoteDialogContent"

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
}


type CellRender = {
  content: ReactNode
  backgroundColor?: string
  defaultTextColor?: string
  cellClassName?: string
  statusGradient?: string  // 🆕 Pour remplacer le gradient général par la couleur du statut
}

const resolveThemeMode = (): "dark" | "light" => {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

const toSoftColor = (hex: string | undefined, mode: "light" | "dark", fallback = "#cbd5f5") => {
  if (!hex) return fallback
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return fallback
  const numeric = Number.parseInt(sanitized, 16)
  const r = (numeric >> 16) & 255
  const g = (numeric >> 8) & 255
  const b = numeric & 255
  const mixTarget = mode === "dark" ? 0 : 255
  const factor = mode === "dark" ? 0.45 : 0.7
  const mixChannel = (channel: number) => Math.round(channel + (mixTarget - channel) * factor)
  const color = `rgb(${mixChannel(r)}, ${mixChannel(g)}, ${mixChannel(b)})`
  return color
}

const getReadableTextColor = (hex: string | undefined, fallback = "#ffffff") => {
  if (!hex) return fallback
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return fallback
  const r = Number.parseInt(sanitized.slice(0, 2), 16)
  const g = Number.parseInt(sanitized.slice(2, 4), 16)
  const b = Number.parseInt(sanitized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#111827" : "#FFFFFF"
}

const getRowHeight = (density: TableRowDensity): number => {
  switch (density) {
    case "ultra-dense":
      return 28
    case "dense":
      return 36
    case "default":
      return 44
    default:
      return 36
  }
}

const renderCell = (
  intervention: InterventionEntity,
  property: string,
  style: TableColumnStyle | undefined,
  themeMode: "light" | "dark",
): CellRender => {
  const schema = getPropertySchema(property)
  const value = getPropertyValue(intervention, property)

  if (!schema) {
    return { content: value == null || value === "" ? "—" : String(value) }
  }

  if (property === "statusValue") {
    if (!value) return { content: "—" }
    const statusInfo = (intervention as any).status as { code?: string; color?: string; label?: string } | undefined
    const statusCode = (statusInfo?.code ?? value ?? "") as string

    // Utiliser getStatusDisplay pour obtenir label, color et icon de manière centralisée
    const statusDisplay = getStatusDisplay(statusCode, {
      statusFromDb: statusInfo ? {
        code: statusInfo.code ?? statusCode,
        label: statusInfo.label ?? String(value),
        color: statusInfo.color ?? null,
      } : undefined,
    })

    // DAT-001 : Vérifier si l'intervention doit afficher le statut "Check"
    const datePrevue = (intervention as any).date_prevue ?? (intervention as any).datePrevue ?? null
    const isCheck = isCheckStatus(statusCode, datePrevue)

    // Si Check, remplacer complètement le label par "CHECK"
    const displayLabel = isCheck ? "CHECK" : statusDisplay.label
    const displayColor = isCheck ? "#EF4444" : statusDisplay.color // Rouge pour Check

    const appearance: TableColumnAppearance = style?.appearance ?? "solid"
    const statusIcon = !isCheck ? statusDisplay.icon : null

    if (appearance === "none") {
      return {
        content: isCheck ? (
          <span className="check-status-badge inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold text-white bg-red-500">
            CHECK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {statusIcon}
            {displayLabel}
          </span>
        )
      }
    }
    if (appearance === "badge") {
      const textColor = style?.textColor ?? getReadableTextColor(displayColor)
      return {
        content: (
          <span
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-0.5 leading-tight",
              isCheck && "check-status-badge"
            )}
            style={{ backgroundColor: displayColor, color: textColor }}
          >
            {statusIcon}
            {displayLabel}
          </span>
        ),
        cellClassName: "font-medium",
      }
    }
    const pastel = toSoftColor(displayColor, themeMode)
    return {
      content: isCheck ? (
        <span className="check-status-badge inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold text-white bg-red-500">
          CHECK
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {statusIcon}
          {displayLabel}
        </span>
      ),
      backgroundColor: isCheck ? "#FEE2E2" : pastel, // Fond rouge clair si Check
      defaultTextColor: themeMode === "dark" ? "#F3F4F6" : "#111827",
      cellClassName: "font-medium",
      // 🆕 En mode gradient, utiliser la couleur du statut (rouge si Check)
      statusGradient: isCheck
        ? `linear-gradient(
          to bottom,
          color-mix(in oklab, #EF4444, white 20%) 0%,
          #EF4444 50%,
          color-mix(in oklab, #EF4444, black 20%) 100%
        )`
        : `linear-gradient(
        to bottom,
        color-mix(in oklab, ${statusDisplay.color}, white 20%) 0%,
        ${statusDisplay.color} 50%,
        color-mix(in oklab, ${statusDisplay.color}, black 20%) 100%
      )`,
    }
  }

  if (property === "attribueA") {
    const assignedCode =
      (intervention as any).assignedUserCode ??
      (typeof value === "string" ? value : value == null ? "" : String(value))
    if (!assignedCode) return { content: "—" }
    const color = (intervention as any).assignedUserColor as string | undefined
    const assignedUserName = (intervention as any).assignedUserName as string | undefined

    // Calculer les initiales à partir du nom complet ou du code
    const getInitials = (): string => {
      if (assignedUserName) {
        const parts = assignedUserName.trim().split(/\s+/)
        if (parts.length >= 2) {
          return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || 'U'
        }
        if (parts.length === 1 && parts[0]) {
          return parts[0].substring(0, 2).toUpperCase() || 'U'
        }
      }
      // Fallback sur le code gestionnaire (première lettre)
      return assignedCode.substring(0, 2).toUpperCase() || 'U'
    }

    const initials = getInitials()
    const appearance: TableColumnAppearance = style?.appearance ?? "solid"

    if (!color || appearance === "none") {
      // Même sans couleur, afficher le badge circulaire
      return {
        content: (
          <div
            className="relative inline-flex h-8 w-8 select-none items-center justify-center rounded-full border-2 text-xs font-semibold uppercase"
            style={{
              borderColor: color || '#e5e7eb',
              background: color || undefined,
              color: color ? '#ffffff' : '#1f2937',
            }}
            title={assignedUserName || assignedCode}
          >
            {initials}
          </div>
        ),
      }
    }

    if (appearance === "badge") {
      // Mode badge : afficher le badge circulaire
      return {
        content: (
          <div
            className="relative inline-flex h-8 w-8 select-none items-center justify-center rounded-full border-2 text-xs font-semibold uppercase"
            style={{
              borderColor: color,
              background: color,
              color: '#ffffff',
            }}
            title={assignedUserName || assignedCode}
          >
            {initials}
          </div>
        ),
        cellClassName: "font-medium",
      }
    }

    // Mode solid : afficher le badge circulaire avec fond pastel
    const pastel = toSoftColor(color, themeMode, themeMode === "dark" ? "#1f2937" : "#e2e8f0")
    return {
      content: (
        <div
          className="relative inline-flex h-8 w-8 select-none items-center justify-center rounded-full border-2 text-xs font-semibold uppercase"
          style={{
            borderColor: color,
            background: color,
            color: '#ffffff',
          }}
          title={assignedUserName || assignedCode}
        >
          {initials}
        </div>
      ),
      backgroundColor: pastel,
      defaultTextColor: themeMode === "dark" ? "#E5E7EB" : "#111827",
      cellClassName: "font-medium",
      // 🆕 En mode gradient, utiliser la couleur de l'utilisateur
      statusGradient: `linear-gradient(
        to bottom,
        color-mix(in oklab, ${color}, white 20%) 0%,
        ${color} 50%,
        color-mix(in oklab, ${color}, black 20%) 100%
      )`,
    }
  }

  switch (schema.type) {
    case "date": {
      if (!value) return { content: "—" }
      const date = new Date(String(value))
      return { content: Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date) }
    }
    case "number": {
      if (typeof value !== "number") return { content: value == null ? "—" : String(value) }
      return { content: numberFormatter.format(value) }
    }
    case "select":
    case "multi_select": {
      if (!value) return { content: "—" }
      if (schema.type === "multi_select" && Array.isArray(value)) {
        return {
          content: value
            .map((item) => schema.options?.find((option) => option.value === item)?.label ?? String(item))
            .join(", "),
        }
      }
      const option = schema.options?.find((option) => option.value === value)
      return { content: option?.label ?? String(value) }
    }
    case "checkbox":
      return { content: value ? "Oui" : "Non" }
    default:
      return { content: value == null || value === "" ? "—" : String(value) }
  }
}

const sizeClassMap: Record<TableColumnTextSize, string> = {
  xl: "text-xl",
  lg: "text-lg",
  md: "text-sm",
  sm: "text-xs",
  xs: "text-[0.65rem]",
}

const buildTypographyClasses = (style: TableColumnStyle | undefined) => {
  const classes = [sizeClassMap[style?.textSize ?? "md"]]
  if (style?.bold) {
    classes.push("font-semibold")
  }
  if (style?.italic) {
    classes.push("italic")
  }
  return classes.join(" ")
}

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
}: TableViewProps) {
  // Log pour debug pagination
  useEffect(() => {
    console.log(`[TableView] Props pagination - currentPage: ${currentPage}, totalPages: ${totalPages}, totalCount: ${totalCount}, onPageChange: ${typeof onPageChange}`)
  }, [currentPage, totalPages, totalCount, onPageChange])

  const dataset = useMemo(() => {
    // ⚠️ NE PAS réappliquer les filtres/sorts de la vue !
    // Ils sont déjà appliqués côté serveur + residualFilters dans page.tsx
    // Si on les réapplique ici, on filtre 2 fois les mêmes données !
    const firstId = interventions[0]?.id ?? 'none'
    const lastId = interventions[interventions.length - 1]?.id ?? 'none'
    console.log(`[TableView] dataset recalculé - length: ${interventions.length}, firstId: ${firstId}, lastId: ${lastId}, currentPage: ${currentPage}`)
    return interventions;
  }, [interventions, currentPage])
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
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(true)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteDialogInterventionId, setNoteDialogInterventionId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [noteDialogCoords, setNoteDialogCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const noteDialogContentRef = useRef<HTMLDivElement | null>(null)
  const isReminderSaveDisabled = noteValue.trim().length === 0 && !dueDateValue
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const uuidPattern = useMemo(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, [])

  const columnWidths = view.layoutOptions.columnWidths ?? {}
  const tableLayoutOptions = view.layoutOptions as TableLayoutOptions
  const columnStyles = useMemo(() => tableLayoutOptions.columnStyles ?? {}, [tableLayoutOptions.columnStyles])
  const columnAlignment = useMemo(() => tableLayoutOptions.columnAlignment ?? {}, [tableLayoutOptions.columnAlignment])
  const statusBorderSize = (tableLayoutOptions.statusBorderSize ?? "m") as TableStatusBorderSize
  const statusBorderWidth = TABLE_STATUS_BORDER_WIDTHS[statusBorderSize] ?? TABLE_STATUS_BORDER_WIDTHS.m
  const statusBorderWidthPx = `${statusBorderWidth}px`
  const statusBorderEnabled = tableLayoutOptions.showStatusBorder ?? false
  const coloredShadow = tableLayoutOptions.coloredShadow ?? false
  const shadowIntensity = (tableLayoutOptions.shadowIntensity ?? "normal") as TableShadowIntensity
  const shadowValues = TABLE_SHADOW_INTENSITIES[shadowIntensity]
  const rowDisplayMode = (tableLayoutOptions.rowDisplayMode ?? "stripes") as TableRowDisplayMode
  const useAccentColor = tableLayoutOptions.useAccentColor ?? false
  const rowDensity = (tableLayoutOptions.rowDensity ??
    (tableLayoutOptions.dense ? "dense" : "default")) as TableRowDensity
  const { open: openInterventionModal } = useInterventionModal()
  const isMarketView = view.id === "market"
  const viewType: "default" | "market" = isMarketView ? "market" : "default"

  const densityTableClass =
    rowDensity === "ultra-dense" ? "text-xs" : rowDensity === "dense" ? "text-sm" : undefined
  const densityHeaderClass =
    rowDensity === "ultra-dense"
      ? "!h-8 !py-1.5 !pl-2.5 !pr-2.5"
      : rowDensity === "dense"
        ? "!h-10 !py-2 !pl-3 !pr-3"
        : undefined
  const densityCellClass =
    rowDensity === "ultra-dense"
      ? "!py-1.5 !pl-2.5 !pr-2.5"
      : rowDensity === "dense"
        ? "!py-2 !pl-3 !pr-3"
        : "py-3"
  const rowHeight = getRowHeight(rowDensity)
  const isBrowser = typeof window !== "undefined"
  const isFirefox = isBrowser && typeof navigator !== "undefined" ? /firefox/i.test(navigator.userAgent) : false

  // Créer une signature stable du dataset pour détecter les changements réels
  const datasetSignature = useMemo(() => {
    if (dataset.length === 0) return `empty-${currentPage}`
    const firstId = dataset[0]?.id ?? 'none'
    const lastId = dataset[dataset.length - 1]?.id ?? 'none'
    return `${currentPage}-${dataset.length}-${firstId}-${lastId}`
  }, [dataset, currentPage])

  const rowVirtualizer = useVirtualizer({
    count: dataset.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: SCROLL_CONFIG.OVERSCAN,
    measureElement: isBrowser && !isFirefox ? (element) => element.getBoundingClientRect().height : undefined,
    scrollMargin: tableContainerRef.current?.offsetTop ?? 0,
    getItemKey: (index) => {
      const item = dataset[index]
      // Utiliser une clé unique qui inclut l'ID et l'index pour éviter les collisions entre pages
      return item?.id ? `${item.id}-${index}` : `index-${index}`
    },
  })

  // Réinitialiser le scroll en haut quand on change de page OU quand les données changent significativement
  useEffect(() => {
    if (tableContainerRef.current && dataset.length > 0) {
      console.log(`[TableView] Réinitialisation du scroll pour la page ${currentPage}, dataset.length: ${dataset.length}, signature: ${datasetSignature}`)
      tableContainerRef.current.scrollTop = 0
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        if (tableContainerRef.current) {
          rowVirtualizer.scrollToIndex(0, { align: 'start' })
        }
      })
    }
  }, [currentPage, dataset.length, datasetSignature, rowVirtualizer])

  // Forcer la mise à jour du virtualizer quand les données changent
  useEffect(() => {
    if (dataset.length > 0) {
      console.log(`[TableView] Forcer la mise à jour du virtualizer - dataset.length: ${dataset.length}, signature: ${datasetSignature}`)
      // Mesurer à nouveau les éléments pour s'assurer que le virtualizer est à jour
      rowVirtualizer.measure()
    }
  }, [dataset.length, datasetSignature, rowVirtualizer])
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalHeight = rowVirtualizer.getTotalSize()

  const scroller = tableContainerRef.current
  const viewportTop = scroller?.scrollTop ?? 0
  const viewportHeight = scroller?.clientHeight ?? 0
  const viewportBottom = viewportTop + viewportHeight

  const visibleItems = virtualItems.filter((item) => {
    const itemTop = item.start
    const itemBottom = item.start + item.size
    return itemBottom > viewportTop && itemTop < viewportBottom
  })

  const firstVisible =
    visibleItems[0]?.index ??
    virtualItems[0]?.index ??
    0
  const lastVisible =
    visibleItems[visibleItems.length - 1]?.index ??
    virtualItems[virtualItems.length - 1]?.index ??
    0
  const totalRows = totalCount ?? dataset.length

  const tableInlineStyle: CSSProperties & Record<string, any> = {
    ...(statusBorderEnabled ? { "--table-status-border-width": statusBorderWidthPx } : {}),
    ...(coloredShadow
      ? {
        "--shadow-intensity-strong": `${shadowValues.strong}%`,
        "--shadow-intensity-soft": `${shadowValues.soft}%`,
      }
      : {}),
    ...(rowDisplayMode === "gradient" ? { "--use-gradient-mode": "1" } : {}),
    ...(useAccentColor ? { "--use-accent-color": "1" } : {}),
  }
  const [styleMenu, setStyleMenu] = useState<{ property: string; x: number; y: number } | null>(null)
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light")
  const styleMenuRef = useRef<HTMLDivElement | null>(null)
  const { activeColumn, handlePointerDown } = useColumnResize(columnWidths, (widths) => {
    onLayoutOptionsChange?.({ columnWidths: widths })
  })

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!response.ok) {
          throw new Error("Unable to load current user")
        }
        const payload = await response.json()
        if (!isMounted) return
        setCurrentUserId(payload?.user?.id ?? null)
      } catch (loadError) {
        console.warn("[TableView] Impossible de charger l'utilisateur courant", loadError)
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])
  const handleScrollWithFades = useCallback(() => {
    const scroller = tableContainerRef.current
    if (!scroller) return

    const { scrollTop, scrollHeight, clientHeight } = scroller
    const scrollBottom = scrollHeight - scrollTop - clientHeight

    setShowTopFade(scrollTop > rowHeight * 0.5)
    setShowBottomFade(scrollBottom > rowHeight * 0.5)
  }, [rowHeight])

  useEffect(() => {
    handleScrollWithFades()
  }, [handleScrollWithFades, dataset.length, expandedRowId])

  // Plus besoin de gérer le resize, on utilise flex-1

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

  useEffect(() => {
    if (!styleMenu) return

    const handleDismiss = (event: MouseEvent | PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (styleMenuRef.current?.contains(target)) {
        return
      }
      const path = typeof event.composedPath === "function" ? event.composedPath() : []
      const isInsidePortal = path.some(
        (node) => node instanceof HTMLElement && node.hasAttribute("data-quick-style-panel"),
      )
      if (isInsidePortal) {
        return
      }
      setStyleMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStyleMenu(null)
      }
    }

    window.addEventListener("pointerdown", handleDismiss)
    window.addEventListener("click", handleDismiss)
    window.addEventListener("contextmenu", handleDismiss)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("pointerdown", handleDismiss)
      window.removeEventListener("click", handleDismiss)
      window.removeEventListener("contextmenu", handleDismiss)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [styleMenu])

  useEffect(() => {
    setStyleMenu(null)
  }, [view.id])

  const handleHeaderContextMenu = useCallback(
    (event: React.MouseEvent, property: string) => {
      if (!onLayoutOptionsChange) return
      event.preventDefault()
      event.stopPropagation()
      if (typeof window === "undefined") {
        setStyleMenu({ property, x: event.clientX, y: event.clientY })
        return
      }
      const padding = 12
      const panelWidth = 420
      const panelHeight = 120
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const x = Math.max(padding, Math.min(event.clientX, viewportWidth - panelWidth - padding))
      const y = Math.max(padding, Math.min(event.clientY, viewportHeight - panelHeight - padding))
      setStyleMenu({ property, x, y })
    },
    [onLayoutOptionsChange],
  )

  const applyColumnStyle = useCallback(
    (property: string, updater: (prev: TableColumnStyle) => TableColumnStyle) => {
      if (!onLayoutOptionsChange) return
      const current = columnStyles[property] ?? {}
      const nextRaw = updater({ ...current })
      const normalized = normalizeColumnStyle(property, nextRaw)
      const nextStyles = { ...columnStyles }
      if (normalized) {
        nextStyles[property] = normalized
      } else {
        delete nextStyles[property]
      }
      onLayoutOptionsChange({
        columnStyles: nextStyles,
      })
    },
    [columnStyles, onLayoutOptionsChange],
  )

  const applyColumnAlignment = useCallback(
    (property: string, nextAlignment: TableColumnAlignment) => {
      if (!onLayoutOptionsChange) return
      const nextAlignments = { ...columnAlignment }
      const currentExplicitAlignment = columnAlignment[property]
      const currentAlignment = (currentExplicitAlignment ?? "center") as TableColumnAlignment

      // Si on clique sur "center"
      if (nextAlignment === "center") {
        // Si "center" est déjà défini explicitement, on le supprime (retour à "center" par défaut)
        if (currentExplicitAlignment === "center") {
          delete nextAlignments[property]
          onLayoutOptionsChange({ columnAlignment: nextAlignments })
          return
        }
        // Sinon, on définit explicitement "center"
        nextAlignments[property] = "center"
        onLayoutOptionsChange({ columnAlignment: nextAlignments })
        return
      }
      // Si on clique sur le même alignement que celui actuel, ne rien faire
      if (currentAlignment === nextAlignment) return
      // Sinon, définir le nouvel alignement
      nextAlignments[property] = nextAlignment
      onLayoutOptionsChange({ columnAlignment: nextAlignments })
    },
    [columnAlignment, onLayoutOptionsChange],
  )

  const handleReminderContextMenu = useCallback(
    (event: React.MouseEvent, interventionId: string) => {
      event.preventDefault()
      event.stopPropagation()
      const existingNote = getReminderNote(interventionId) ?? ""
      const existingDueDate = getReminderDueDate(interventionId)
      const existingMentions = getReminderMentions(interventionId)
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const DIALOG_WIDTH = 448
      const DIALOG_HEIGHT = 360
      const GAP = 8

      let left = rect.left - DIALOG_WIDTH - GAP
      if (left < 16) {
        left = rect.right + GAP
      }
      left = Math.max(16, Math.min(left, window.innerWidth - DIALOG_WIDTH - 16))

      let top = rect.top
      if (top + DIALOG_HEIGHT > window.innerHeight - 16) {
        top = window.innerHeight - DIALOG_HEIGHT - 16
      }
      top = Math.max(16, top)

      setNoteDialogCoords({ top, left })
      setNoteDialogInterventionId(interventionId)
      setNoteValue(existingNote)
      setDueDateValue(existingDueDate ? new Date(existingDueDate) : null)
      const validMentionIds = existingMentions.filter((mention) => uuidPattern.test(mention))
      setMentionIds(validMentionIds)
      setShowNoteDialog(true)
    },
    [getReminderDueDate, getReminderMentions, getReminderNote, uuidPattern],
  )

  const handleNoteSave = useCallback(async () => {
    if (!noteDialogInterventionId) return
    const cleaned = noteValue.trim()
    const dueDateIso = dueDateValue ? dueDateValue.toISOString() : null
    const hasContent = cleaned.length > 0 || dueDateIso

    if (hasContent) {
      await saveReminder({
        interventionId: noteDialogInterventionId,
        idInter: (dataset.find(i => i.id === noteDialogInterventionId) as any)?.id_inter || undefined,
        note: cleaned.length > 0 ? cleaned : null,
        dueDate: dueDateIso,
        mentionedUserIds: mentionIds,
      })
    } else {
      await removeReminder(noteDialogInterventionId)
    }

    setShowNoteDialog(false)
    setNoteDialogInterventionId(null)
    setNoteValue("")
    setDueDateValue(null)
    setMentionIds([])
  }, [dueDateValue, mentionIds, noteDialogInterventionId, noteValue, removeReminder, saveReminder])

  const handleNoteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Fermer le modal immédiatement
      setShowNoteDialog(false)
      setNoteDialogInterventionId(null)
      setNoteValue("")
      setDueDateValue(null)
      setMentionIds([])
    } else {
      setShowNoteDialog(true)
    }
  }, [])

  let quickStylePanel: ReactNode = null
  if (styleMenu) {
    const propertyKey = styleMenu.property
    const propertyLabel = getPropertyLabel(propertyKey)
    const styleEntry = columnStyles[propertyKey] ?? {}
    const sizeValue = styleEntry.textSize ?? "md"
    const isBold = Boolean(styleEntry.bold)
    const isItalic = Boolean(styleEntry.italic)
    const colorValue = styleEntry.textColor ?? "#111827"
    const isAppearanceEditable = STYLE_ELIGIBLE_COLUMNS.has(propertyKey)
    const appearanceValue: TableColumnAppearance = isAppearanceEditable
      ? styleEntry.appearance ?? "solid"
      : "none"
    const alignmentValue = (columnAlignment[propertyKey] ?? "center") as TableColumnAlignment

    quickStylePanel = (
      <div
        ref={styleMenuRef}
        data-quick-style-panel="true"
        className="fixed z-[95] min-w-[340px] max-w-[420px] rounded-lg border border-border bg-popover p-3 shadow-xl"
        style={{ top: styleMenu.y, left: styleMenu.x }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">{propertyLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setStyleMenu(null)}
            aria-label="Fermer le style rapide"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.7rem]">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Taille</span>
            <Select
              value={sizeValue}
              onValueChange={(value) =>
                applyColumnStyle(propertyKey, (prev) => ({
                  ...prev,
                  textSize: value as TableColumnTextSize,
                }))
              }
            >
              <SelectTrigger data-quick-style-panel="true" className="h-7 w-[78px] text-[0.7rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-quick-style-panel="true" className="z-[110]">
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
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-7 w-7 text-muted-foreground",
                  isBold && "border border-primary/60 bg-primary/10 text-primary",
                )}
                onClick={() =>
                  applyColumnStyle(propertyKey, (prev) => ({
                    ...prev,
                    bold: !isBold,
                  }))
                }
                aria-label={`Basculer en gras (${propertyLabel})`}
              >
                <Bold className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-7 w-7 text-muted-foreground",
                  isItalic && "border border-primary/60 bg-primary/10 text-primary",
                )}
                onClick={() =>
                  applyColumnStyle(propertyKey, (prev) => ({
                    ...prev,
                    italic: !isItalic,
                  }))
                }
                aria-label={`Basculer en italique (${propertyLabel})`}
              >
                <Italic className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Couleur</span>
            <div className="flex items-center gap-1">
              <input
                data-quick-style-panel="true"
                type="color"
                value={colorValue}
                onChange={(event) => {
                  const nextColor = event.target.value
                  applyColumnStyle(propertyKey, (prev) => ({
                    ...prev,
                    textColor: nextColor,
                  }))
                }}
                className="h-7 w-7 cursor-pointer rounded border border-border"
                aria-label={`Couleur du texte (${propertyLabel})`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() =>
                  applyColumnStyle(propertyKey, (prev) => ({
                    ...prev,
                    textColor: undefined,
                  }))
                }
                aria-label={`Réinitialiser la couleur (${propertyLabel})`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

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
                    alignmentValue === value && "border border-primary/60 bg-primary/10 text-primary",
                  )}
                  onClick={() => applyColumnAlignment(propertyKey, value)}
                  aria-label={`${label} (${propertyLabel})`}
                >
                  <Icon className="h-3 w-3" />
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
                applyColumnStyle(propertyKey, (prev) => ({
                  ...prev,
                  appearance: value as TableColumnAppearance,
                }))
              }}
            >
              <SelectTrigger
                data-quick-style-panel="true"
                className={cn(
                  "h-7 w-[140px] text-[0.7rem]",
                  !isAppearanceEditable && "cursor-not-allowed opacity-60",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-quick-style-panel="true" className="z-[110]">
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
  }

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
      <div className="flex flex-col flex-1 min-h-0">
        <Card className="border-2 shadow-sm flex flex-col flex-1 min-h-0">
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
                    "data-table shadcn-table border-separate border-spacing-0 caption-bottom text-sm",
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
                    <tr className="border-b border-border/60 bg-muted/30">
                      {view.visibleProperties.map((property) => {
                        const width = columnWidths[property] ?? 150 // Largeur par défaut si non définie
                        const schema = getPropertySchema(property)
                        const activeFilter = view.filters.find((filter) => filter.property === property)
                        const headerStyle: CSSProperties = {
                          width,
                          minWidth: width,
                          maxWidth: width,
                        }
                        return (
                          <th
                            key={property}
                            style={headerStyle}
                            className={cn(
                              "z-20 border-b border-border bg-muted/95 px-4 py-4 text-left text-sm font-semibold text-foreground",
                              "whitespace-nowrap backdrop-blur-sm align-middle relative select-none",
                              densityHeaderClass,
                            )}
                            onContextMenu={(event) => handleHeaderContextMenu(event, property)}
                          >
                            <div className="relative flex items-center gap-2">
                              {schema?.filterable && onPropertyFilterChange ? (
                                <ColumnFilter
                                  property={property}
                                  schema={schema}
                                  activeFilter={activeFilter}
                                  interventions={allInterventions ?? interventions}
                                  loadDistinctValues={loadDistinctValues}
                                  onFilterChange={onPropertyFilterChange}
                                />
                              ) : (
                                <span>{getPropertyLabel(property)}</span>
                              )}
                              <div
                                className={cn(
                                  "absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors duration-150",
                                  activeColumn === property
                                    ? "bg-primary"
                                    : "opacity-0 hover:opacity-100 hover:bg-primary/70",
                                )}
                                onPointerDown={(event) => handlePointerDown(event, property)}
                              />
                            </div>
                          </th>
                        )
                      })}
                      <th
                        style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                        className={cn(
                          "z-20 border-b border-border bg-muted/95 px-4 py-4 text-left text-sm font-semibold text-foreground",
                          "whitespace-nowrap backdrop-blur-sm align-middle relative select-none",
                          densityHeaderClass,
                        )}
                      >
                        Actions
                      </th>
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
                      "data-table shadcn-table border-separate border-spacing-0 caption-bottom text-sm",
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
                              ((intervention as any).status?.color as string | undefined) ??
                              (intervention as any).statusColor ??
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
                              <React.Fragment key={intervention.id}>
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      data-intervention-id={intervention.id}
                                      className={cn(
                                        "group relative cursor-pointer border-b border-border/30 transition-colors duration-150 hover:bg-accent/10 data-[state=selected]:hover:bg-muted",
                                        statusBorderEnabled && "table-row-status-border",
                                        isExpanded && "bg-muted/30",
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
                                        const { content, backgroundColor, defaultTextColor, cellClassName, statusGradient } =
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
                                              "px-4 py-4 text-sm align-middle transition-colors duration-150",
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
                                            <TruncatedCell content={content} />
                                          </td>
                                        )
                                      })}
                                      <td
                                        className={cn(
                                          "px-4 py-4 text-sm align-middle text-center transition-colors duration-150",
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
                                              void toggleReminder(intervention.id, (intervention as any).id_inter || undefined)
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
                                    <td colSpan={view.visibleProperties.length + 1} className="p-0 align-top">
                                      <ExpandedRowContent
                                        intervention={intervention}
                                        statusColor={statusColor}
                                        showStatusBorder={statusBorderEnabled}
                                        statusBorderWidth={statusBorderWidthPx}
                                        currentUserId={currentUserId}
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
          <style jsx>{`
          .table-scroll-wrapper::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .table-scroll-wrapper::-webkit-scrollbar-track {
            background: ${themeMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"};
          }
          .table-scroll-wrapper::-webkit-scrollbar-thumb {
            background: ${themeMode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"};
            border-radius: 4px;
          }
          .table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
            background: ${themeMode === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"};
          }
        `}</style>
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

      <AlertDialog open={showNoteDialog} onOpenChange={handleNoteDialogOpenChange}>
        <NoteDialogContent
          ref={noteDialogContentRef}
          className={cn(
            "note-reminder-dialog fixed z-[60] w-[min(448px,calc(100vw-32px))] max-w-md rounded-lg border border-border bg-popover p-6 shadow-xl focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
          style={{
            top: noteDialogCoords.top,
            left: noteDialogCoords.left,
          }}
          onEscapeKeyDown={() => handleNoteDialogOpenChange(false)}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>
              {noteDialogInterventionId && reminders.has(noteDialogInterventionId)
                ? "Modifier le rappel"
                : "Créer un rappel"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ajoutez une note et/ou définissez une date d&apos;échéance. Utilisez @ pour notifier un gestionnaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Note (optionnel)</span>
              <ReminderMentionInput
                value={noteValue}
                onChange={(value, mentions) => {
                  setNoteValue(value)
                  setMentionIds(mentions)
                }}
                placeholder="Exemple: @prenom.nom relancer le client..."
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Date d&apos;échéance (optionnel)</span>
              <DatePicker
                date={dueDateValue}
                onDateChange={setDueDateValue}
                placeholder="Sélectionner une date..."
                popoverContainer={noteDialogContentRef.current}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                handleNoteDialogOpenChange(false)
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleNoteSave()
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isReminderSaveDisabled}
            >
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </NoteDialogContent>
      </AlertDialog>
    </>
  )
}

export default TableView

function TruncatedCell({ content, className }: { content: ReactNode; className?: string }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const cellRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = cellRef.current
    if (!element) return

    // Vérifier si le contenu déborde
    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth)
    }

    // Vérifier immédiatement après le rendu
    checkOverflow()

    // Le ResizeObserver détectera les changements de taille ultérieurs
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  })

  const contentStr = typeof content === "string" ? content :
    typeof content === "number" ? String(content) : ""

  useEffect(() => {
    if (typeof document === "undefined") return
    setPortalElement(document.body)
  }, [])

  const updateTooltipPosition = (event: React.MouseEvent) => {
    const offset = 12
    const margin = 16
    const x = Math.min(window.innerWidth - margin, event.clientX + offset)
    const y = Math.min(window.innerHeight - margin, event.clientY + offset)

    setTooltipPos({
      x: Math.max(margin, x),
      y: Math.max(margin, y),
    })
  }

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (!isOverflowing) return
    updateTooltipPosition(event)
  }

  const handleMouseLeave = () => {
    setTooltipPos(null)
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={(event) => {
          if (!isOverflowing || !tooltipPos) return
          updateTooltipPosition(event)
        }}
      >
        <div
          ref={cellRef}
          className={cn(
            "truncate relative",
            className
          )}
        >
          {content}
        </div>
      </div>
      {portalElement && tooltipPos && contentStr
        ? createPortal(
          <div
            className="fixed z-[1000] max-w-sm break-words rounded-lg border-2 border-border bg-card p-3 text-sm font-normal text-card-foreground shadow-2xl whitespace-normal pointer-events-none"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
          >
            {contentStr}
          </div>,
          portalElement,
        )
        : null}
    </>
  )
}

function ExpandedRowContent({
  intervention,
  statusColor,
  showStatusBorder,
  statusBorderWidth,
  currentUserId,
}: {
  intervention: InterventionEntity
  statusColor: string
  showStatusBorder: boolean
  statusBorderWidth: string
  currentUserId?: string | null
}) {

  // Récupération des données de l'intervention avec useMemo pour réactivité
  const interventionData = useMemo(() => {
    const intervAny = intervention as any
    return {
      contexte: intervAny.contexteIntervention || "—",
      consigne: intervAny.consigneIntervention || "—",
      coutSST: intervAny.coutSST,
      adresse: intervAny.adresse || "—",
      ville: intervAny.ville || "",
      codePostal: intervAny.codePostal || "",
      prenomClient: intervAny.prenomClient || "",
      nomClient: intervAny.nomClient || "",
      telephoneClient: intervAny.telephoneClient || "—",
      telephone2Client: intervAny.telephone2Client || "",
      agenceName: intervAny.agenceLabel || intervAny.agence || intervAny.agency || "",
      referenceAgence: intervAny.referenceAgence || intervAny.reference_agence || "",
    }
  }, [intervention])

  const agencesRequiringRef = useMemo(() => ["ImoDirect", "AFEDIM", "Oqoro"], [])
  const showReferenceAgence = useMemo(
    () => agencesRequiringRef.includes(interventionData.agenceName),
    [interventionData.agenceName, agencesRequiringRef]
  )

  return (
    <div
      className={cn(
        "w-[100%] bg-accent/10 dark:bg-accent/15 p-2",
        showStatusBorder && "border-l"
      )}
      style={{
        ...(showStatusBorder ? {
          borderLeftColor: statusColor,
          borderLeftWidth: statusBorderWidth,
        } : {}),
        transform: "translate(-26px, -14px) scale(1.022)",
        transformOrigin: "top left",
        paddingTop: "20px",
        paddingBottom: "-10px",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Colonne 1 - Informations Générales */}
        <div className="space-y-1">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Contexte</p>
            <p className="text-sm">{interventionData.contexte}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Consigne</p>
            <p className="text-sm">{interventionData.consigne}</p>
          </div>
          {interventionData.coutSST != null && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Coût Artisan</p>
              <p className="text-sm font-medium">{numberFormatter.format(interventionData.coutSST)} €</p>
            </div>
          )}
        </div>

        {/* Colonne 2 - Informations Client */}
        <div className="space-y-3">
          {showReferenceAgence && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Référence agence</p>
              <p className="text-sm">{interventionData.referenceAgence || "—"}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Adresse</p>
            <p className="text-sm">
              {interventionData.adresse}
              {(interventionData.ville || interventionData.codePostal) && (
                <>
                  <br />
                  {interventionData.codePostal} {interventionData.ville}
                </>
              )}
            </p>
          </div>
          {(interventionData.prenomClient || interventionData.nomClient) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Client</p>
              <p className="text-sm">
                {interventionData.prenomClient} {interventionData.nomClient}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Téléphone</p>
            <p className="text-sm">
              {interventionData.telephoneClient}
              {interventionData.telephone2Client && (
                <>
                  {" | "}
                  {interventionData.telephone2Client}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Colonne 3 - Commentaires */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Commentaires</p>
          <CommentSection
            entityType="intervention"
            entityId={intervention.id}
            currentUserId={currentUserId}
            disableScrollFades
          />
        </div>
      </div>
    </div>
  )
}
