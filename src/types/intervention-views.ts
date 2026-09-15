import type { ColumnWidths } from "@/hooks/useColumnResize"

export type ViewLayout = "table" | "cards" | "gallery" | "kanban" | "calendar" | "timeline"

export type ViewSortDirection = "asc" | "desc"

export interface ViewSort {
  property: string
  direction: ViewSortDirection
  priority?: number
}

export type ViewFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "between"

export type ViewFilterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | (string | number | boolean | null)[]
  | { from?: string | number; to?: string | number }

export interface ViewFilter {
  property: string
  operator: ViewFilterOperator
  value?: ViewFilterValue
}

export type ViewFilters = ViewFilter[]

export interface BaseLayoutOptions {
  layout: ViewLayout
}

export type TableStatusBorderSize = "s" | "m" | "l"

export const TABLE_STATUS_BORDER_WIDTHS: Record<TableStatusBorderSize, number> = {
  s: 4,
  m: 8,
  l: 12,
}

export type TableShadowIntensity = "subtle" | "normal" | "strong"

export type TableRowDisplayMode = "stripes" | "gradient"

export type TableRowDensity = "default" | "dense" | "ultra-dense"

export const TABLE_SHADOW_INTENSITIES: Record<TableShadowIntensity, { strong: number; soft: number }> = {
  subtle: { strong: 30, soft: 15 },
  normal: { strong: 60, soft: 28 },
  strong: { strong: 85, soft: 45 },
}

export interface TableLayoutOptions extends BaseLayoutOptions {
  layout: "table"
  columnWidths?: ColumnWidths
  hiddenColumns?: string[]
  dense?: boolean
  columnStyles?: Record<string, TableColumnStyle>
  columnAlignment?: Record<string, TableColumnAlignment>
  showStatusBorder?: boolean
  statusBorderSize?: TableStatusBorderSize
  rowDensity?: TableRowDensity
  coloredShadow?: boolean
  shadowIntensity?: TableShadowIntensity
  rowDisplayMode?: TableRowDisplayMode
  useAccentColor?: boolean
  showStatusFilter?: boolean
}

export type TableColumnAppearance = "solid" | "none" | "badge"

export type TableColumnTextSize = "xs" | "sm" | "md" | "lg" | "xl"

export type TableStatusDisplayMode = "text" | "icon"

export type TableColumnStyle = {
  appearance?: TableColumnAppearance
  textSize?: TableColumnTextSize
  bold?: boolean
  italic?: boolean
  textColor?: string | null
  statusDisplayMode?: TableStatusDisplayMode
}

export type TableColumnAlignment = "left" | "center" | "right"

export interface CardsLayoutOptions extends BaseLayoutOptions {
  layout: "cards"
  coverProperty?: string | null
  previewProperties?: string[]
  showStatus?: boolean
}

export interface GalleryLayoutOptions extends BaseLayoutOptions {
  layout: "gallery"
  coverProperty?: string | null
  previewProperty?: string | null
  size: "small" | "medium" | "large"
  highlightedProperties?: string[]
}

export interface KanbanLayoutOptions extends BaseLayoutOptions {
  layout: "kanban"
  groupProperty: string
  columnOrder?: string[]
  collapsedColumns?: string[]
}

export interface CalendarLayoutOptions extends BaseLayoutOptions {
  layout: "calendar"
  dateProperty: string
  endDateProperty?: string
  viewMode: "month" | "week" | "day"
}

export interface TimelineLayoutOptions extends BaseLayoutOptions {
  layout: "timeline"
  startDateProperty: string
  endDateProperty: string
  groupBy?: string
  zoom?: "week" | "month" | "quarter"
}

export type LayoutOptions =
  | TableLayoutOptions
  | CardsLayoutOptions
  | GalleryLayoutOptions
  | KanbanLayoutOptions
  | CalendarLayoutOptions
  | TimelineLayoutOptions

export type LayoutOptionFor<L extends ViewLayout> = Extract<LayoutOptions, { layout: L }>

export interface InterventionViewDefinition {
  id: string
  title: string
  layout: ViewLayout
  visibleProperties: string[]
  filters: ViewFilters
  sorts: ViewSort[]
  layoutOptions: LayoutOptions
  isDefault?: boolean
  isCustom?: boolean
  description?: string
  showBadge?: boolean
}

export type InterventionViewByLayout<L extends ViewLayout> = InterventionViewDefinition & {
  layout: L
  layoutOptions: LayoutOptionFor<L>
}
