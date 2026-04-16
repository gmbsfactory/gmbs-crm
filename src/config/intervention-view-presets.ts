// ===== CONFIGURATION DES VUES D'INTERVENTIONS =====
// Presets, templates et helpers purs — aucune dépendance React

import type {
  InterventionViewDefinition,
  LayoutOptions,
  ViewFilters,
  ViewFilter,
  ViewLayout,
  TableLayoutOptions,
  TableColumnStyle,
  TableColumnAlignment,
} from "@/types/intervention-views"
import { normalizeColumnStyle } from "@/lib/interventions/column-style"

// ---- Constants ----

export const CURRENT_USER_PLACEHOLDER = "__CURRENT_USER_USERNAME__"
export const NO_USER_PLACEHOLDER = "__NO_USER_USERNAME__"
export const USER_SCOPED_VIEW_IDS = new Set([
  "mes-demandes",
  "ma-liste-en-cours",
  "mes-visites-technique",
  "ma-liste-accepte",
  "ma-liste-att-acompte",
  "mes-interventions-a-check",
])

export const VISIBLE_VIEW_LAYOUTS: ViewLayout[] = ["table", "cards", "calendar"]

export const VIEWS_STORAGE_KEY = "crm:interventions:view-configs"
export const ACTIVE_VIEW_STORAGE_KEY = "crm:interventions:active-view"

// ---- Clone helper ----

export const cloneViewDefinition = (view: InterventionViewDefinition): InterventionViewDefinition => {
  if (typeof structuredClone === "function") {
    return structuredClone(view)
  }
  return JSON.parse(JSON.stringify(view)) as InterventionViewDefinition
}

// ---- Sanitizers ----

export const sanitizeColumnStyles = (styles?: Record<string, TableColumnStyle | null> | null): Record<string, TableColumnStyle> | undefined => {
  if (!styles) return undefined
  const result: Record<string, TableColumnStyle> = {}
  Object.entries(styles).forEach(([key, value]) => {
    if (!value) return
    const normalized = normalizeColumnStyle(key, value)
    if (normalized) result[key] = normalized
  })
  return Object.keys(result).length ? result : undefined
}

export const sanitizeColumnAlignment = (alignment?: Record<string, TableColumnAlignment>): Record<string, TableColumnAlignment> | undefined => {
  if (!alignment) return undefined
  const allowed: TableColumnAlignment[] = ["left", "center", "right"]
  const result: Record<string, TableColumnAlignment> = {}
  Object.entries(alignment).forEach(([key, value]) => {
    if (allowed.includes(value) && value !== "center") result[key] = value
  })
  return Object.keys(result).length ? result : undefined
}

// ---- Layout merging ----

export const mergeTableLayoutOptions = (
  base: TableLayoutOptions,
  patch?: Partial<TableLayoutOptions>,
): TableLayoutOptions => {
  const mergedColumnWidths = { ...base.columnWidths, ...(patch?.columnWidths ?? {}) }
  const mergedHidden = patch?.hiddenColumns ?? base.hiddenColumns
  const baseDensity = base.rowDensity ?? (base.dense ? "dense" : undefined)
  const patchDensityCandidate =
    patch?.rowDensity ?? (patch?.dense !== undefined ? (patch.dense ? "dense" : "default") : undefined)
  const resolvedDensity = patchDensityCandidate ?? baseDensity
  const normalizedDensity = resolvedDensity === "default" ? undefined : resolvedDensity
  const mergedDense =
    patch?.dense !== undefined
      ? patch.dense
      : normalizedDensity
        ? normalizedDensity === "dense" || normalizedDensity === "ultra-dense"
        : base.dense
  const mergedStyles = sanitizeColumnStyles({ ...(base.columnStyles ?? {}), ...(patch?.columnStyles ?? {}) })
  const mergedAlignment = sanitizeColumnAlignment({ ...(base.columnAlignment ?? {}), ...(patch?.columnAlignment ?? {}) })

  return {
    ...base,
    ...patch,
    layout: "table",
    columnWidths: mergedColumnWidths,
    hiddenColumns: mergedHidden,
    dense: mergedDense,
    rowDensity: normalizedDensity,
    columnStyles: mergedStyles,
    columnAlignment: mergedAlignment,
  }
}

export const ensureLayoutOptions = (layout: ViewLayout, base: LayoutOptions, patch?: Partial<LayoutOptions>): LayoutOptions => {
  if (layout === "table") {
    return mergeTableLayoutOptions(base as TableLayoutOptions, patch as Partial<TableLayoutOptions> | undefined)
  }
  if (!patch) return base
  const { layout: _, ...rest } = patch as Partial<Record<string, unknown>>
  return { ...base, ...rest, layout } as LayoutOptions
}

// ---- Shared column layout preset ----

const SHARED_TABLE_COLUMN_WIDTHS = {
  dateIntervention: 85,
  agence: 85,
  attribueA: 50,
  id_inter: 85,
  metier: 85,
  codePostal: 70,
  adresse: 100,
  artisan: 110,
  coutIntervention: 80,
  datePrevue: 85,
  statusValue: 100,
  understatement: 50,
}

const SHARED_TABLE_COLUMN_STYLES: Record<string, TableColumnStyle> = {
  attribueA: { appearance: "none" },
  agence: { appearance: "badge", bold: true },
  metier: { appearance: "badge" },
  statusValue: { appearance: "badge" },
  understatement: { appearance: "badge" },
}

const SHARED_TABLE_COLUMN_ALIGNMENT: Record<string, TableColumnAlignment> = {
  statusValue: "right",
  understatement: "left",
}

const SHARED_TABLE_LAYOUT: Partial<TableLayoutOptions> = {
  columnWidths: SHARED_TABLE_COLUMN_WIDTHS,
  rowDensity: "ultra-dense",
  rowDisplayMode: "stripes",
  useAccentColor: true,
  columnStyles: SHARED_TABLE_COLUMN_STYLES,
  columnAlignment: SHARED_TABLE_COLUMN_ALIGNMENT,
}

// ---- View templates ----

export const VIEW_TEMPLATES: Record<ViewLayout, InterventionViewDefinition> = {
  table: {
    id: "table",
    title: "Tableau",
    layout: "table",
    visibleProperties: [
      "dateIntervention", "agence", "attribueA", "id_inter", "metier",
      "codePostal", "adresse", "artisan", "coutIntervention", "datePrevue",
      "statusValue", "understatement",
    ],
    filters: [],
    sorts: [{ property: "dateIntervention", direction: "desc" }],
    layoutOptions: {
      layout: "table",
      ...SHARED_TABLE_LAYOUT,
      hiddenColumns: [],
      showStatusBorder: false,
    },
    description: "Vue en tableau avec colonnes configurables et tri multi-colonnes",
    isDefault: true,
  },
  cards: {
    id: "cards", title: "Cartes", layout: "cards",
    visibleProperties: ["contexteIntervention", "nomClient", "prenomClient", "dateIntervention", "attribueA"],
    filters: [], sorts: [{ property: "date", direction: "desc" }],
    layoutOptions: { layout: "cards", coverProperty: null, previewProperties: ["contexteIntervention", "nomClient"], showStatus: true },
    description: "Vue cartes compacte avec focus sur le contexte et le client", isDefault: true,
  },
  gallery: {
    id: "gallery", title: "Galerie", layout: "gallery",
    visibleProperties: ["nomClient", "contexteIntervention", "attribueA"],
    filters: [], sorts: [{ property: "dateIntervention", direction: "desc" }],
    layoutOptions: { layout: "gallery", coverProperty: null, previewProperty: "contexteIntervention", size: "medium", highlightedProperties: ["nomClient", "attribueA"] },
    description: "Galerie visuelle des interventions avec carte responsive", isDefault: false,
  },
  kanban: {
    id: "kanban", title: "Kanban", layout: "kanban",
    visibleProperties: ["contexteIntervention", "nomClient", "attribueA", "dateIntervention"],
    filters: [], sorts: [{ property: "statusValue", direction: "asc" }],
    layoutOptions: { layout: "kanban", groupProperty: "statusValue", columnOrder: [], collapsedColumns: [] },
    description: "Pipeline par statut avec drag & drop", isDefault: false,
  },
  calendar: {
    id: "calendar", title: "Calendrier", layout: "calendar",
    visibleProperties: ["nomClient", "contexteIntervention", "attribueA"],
    filters: [], sorts: [{ property: "dateIntervention", direction: "asc" }],
    layoutOptions: { layout: "calendar", dateProperty: "dateIntervention", endDateProperty: "dateIntervention", viewMode: "month" },
    description: "Vue calendrier (mois/semaine/jour) basée sur la date d'intervention", isDefault: false,
  },
  timeline: {
    id: "timeline", title: "Chronologie", layout: "timeline",
    visibleProperties: ["nomClient", "attribueA", "statusValue"],
    filters: [], sorts: [{ property: "date", direction: "asc" }],
    layoutOptions: { layout: "timeline", startDateProperty: "date", endDateProperty: "dateIntervention", groupBy: "artisan", zoom: "month" },
    description: "Chronologie type Gantt avec regroupement personnalisable", isDefault: true,
  },
}

// ---- Default view presets ----

type DefaultViewPreset = {
  id: string
  title: string
  description: string
  filters: ViewFilters
  visibleProperties?: string[]
  layoutOptions?: Partial<TableLayoutOptions>
  showBadge?: boolean
}

/** Helper to create a user-scoped table preset with shared layout */
const userScopedPreset = (
  id: string,
  title: string,
  description: string,
  statusFilter: ViewFilter,
): DefaultViewPreset => ({
  id,
  title,
  description,
  filters: [statusFilter, { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER }],
  showBadge: true,
  layoutOptions: SHARED_TABLE_LAYOUT,
})

const DEFAULT_VIEW_PRESETS: DefaultViewPreset[] = [
  {
    id: "liste-generale",
    title: "Liste générale",
    description: "Liste complète de toutes les interventions sans filtres",
    filters: [],
    showBadge: true,
    layoutOptions: { ...SHARED_TABLE_LAYOUT, showStatusBorder: true, statusBorderSize: "m", showStatusFilter: false },
  },
  {
    id: "market",
    title: "Market",
    description: "Interventions en demande qui n'ont pas encore d'assignation",
    filters: [
      { property: "statusValue", operator: "eq", value: "DEMANDE" },
      { property: "attribueA", operator: "is_empty" },
    ],
    showBadge: true,
    visibleProperties: ["dateIntervention", "agence", "metier", "adresse", "ville", "codePostal", "datePrevue"],
    layoutOptions: {
      ...SHARED_TABLE_LAYOUT,
      columnWidths: { ...SHARED_TABLE_COLUMN_WIDTHS, adresse: 150, ville: 100 },
    },
  },
  userScopedPreset("mes-demandes", "Mes demandes", "Demandes assignées à l'utilisateur connecté",
    { property: "statusValue", operator: "eq", value: "DEMANDE" }),
  userScopedPreset("ma-liste-en-cours", "Ma liste en cours", "Interventions en cours assignées à l'utilisateur connecté",
    { property: "statusValue", operator: "eq", value: "INTER_EN_COURS" }),
  userScopedPreset("mes-visites-technique", "Mes visites technique", "Visites techniques assignées à l'utilisateur connecté",
    { property: "statusValue", operator: "eq", value: "VISITE_TECHNIQUE" }),
  userScopedPreset("ma-liste-accepte", "Ma liste accepté", "Interventions acceptées assignées à l'utilisateur connecté",
    { property: "statusValue", operator: "eq", value: "ACCEPTE" }),
  userScopedPreset("ma-liste-att-acompte", "En attente d'acompte", "Interventions en attente d'acompte assignées à l'utilisateur connecté",
    { property: "statusValue", operator: "eq", value: "ATT_ACOMPTE" }),
  {
    id: "mes-interventions-a-check",
    title: "Mes Interventions à check",
    description: "Interventions assignées à l'utilisateur connecté avec date d'échéance dépassée",
    filters: [
      { property: "isCheck", operator: "eq", value: true },
      { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
    ],
    showBadge: true,
    layoutOptions: SHARED_TABLE_LAYOUT,
  },
]

// ---- User-scoped filter application ----

export function applyUserScopedFilters(view: InterventionViewDefinition, userId: string | null): InterventionViewDefinition {
  if (!USER_SCOPED_VIEW_IDS.has(view.id)) return view
  if (userId === null) return view

  let changed = false
  let hasAssignmentFilter = false

  const nextFilters = view.filters.map((filter) => {
    if (filter.property !== "attribueA") return filter
    hasAssignmentFilter = true
    if (filter.operator === "eq" && filter.value === userId) return filter
    changed = true
    return { property: filter.property, operator: "eq", value: userId } as ViewFilter
  })

  if (!hasAssignmentFilter) {
    changed = true
    nextFilters.push({ property: "attribueA", operator: "eq", value: userId } as ViewFilter)
  }

  return changed ? { ...view, filters: nextFilters as ViewFilters } : view
}

// ---- Build DEFAULT_VIEWS from presets ----

export const DEFAULT_VIEWS: InterventionViewDefinition[] = DEFAULT_VIEW_PRESETS.map((preset) => {
  const layout = (preset.layoutOptions?.layout as ViewLayout) ?? "table"
  const base = cloneViewDefinition(VIEW_TEMPLATES[layout] ?? VIEW_TEMPLATES.table)

  const layoutOptions = layout === "table" && preset.layoutOptions
    ? mergeTableLayoutOptions(base.layoutOptions as TableLayoutOptions, preset.layoutOptions)
    : preset.layoutOptions ? { ...base.layoutOptions, ...preset.layoutOptions } : base.layoutOptions

  const view: InterventionViewDefinition = {
    ...base,
    id: preset.id,
    title: preset.title,
    description: preset.description,
    filters: preset.filters,
    visibleProperties: preset.visibleProperties ?? base.visibleProperties,
    layoutOptions,
    showBadge: preset.showBadge ?? false,
    isDefault: true,
  }
  return USER_SCOPED_VIEW_IDS.has(view.id) ? applyUserScopedFilters(view, null) : view
})

export const DEFAULT_VIEW_IDS = new Set(DEFAULT_VIEWS.map((v) => v.id))
export const DEFAULT_VIEW_MAP = new Map(DEFAULT_VIEWS.map((v) => [v.id, cloneViewDefinition(v)]))
export const LEGACY_DEFAULT_VIEW_IDS = new Set(["table", "cards", "timeline", "ma-liste-accepte"])
export const layoutTemplatesByLayout = VIEW_TEMPLATES

// ---- Persistence helpers ----

export const prepareViewsForPersistence = (views: InterventionViewDefinition[]): InterventionViewDefinition[] => {
  return views.map((view) => {
    if (!DEFAULT_VIEW_IDS.has(view.id)) return view
    const template = DEFAULT_VIEW_MAP.get(view.id)
    if (!template) return view
    if (view.filters === template.filters) return view
    const resetFilters = cloneViewDefinition(template).filters
    if (JSON.stringify(view.filters) === JSON.stringify(resetFilters)) return view
    return { ...view, filters: resetFilters }
  })
}

export const safeJSONParse = (value: string | null): InterventionViewDefinition[] | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((view): view is InterventionViewDefinition =>
      Boolean(view && typeof view.id === "string" && typeof view.layout === "string" && Array.isArray(view.visibleProperties)),
    )
  } catch (error) {
    console.warn("useInterventionViews: parsing failed", error)
    return null
  }
}

export const mergeViewWithDefaults = (
  base: InterventionViewDefinition,
  overrides: Partial<InterventionViewDefinition> | null,
): InterventionViewDefinition => {
  if (!overrides) return cloneViewDefinition(base)
  const snapshot = cloneViewDefinition(base)
  const merged: InterventionViewDefinition = {
    ...snapshot,
    ...overrides,
    layout: overrides.layout ?? snapshot.layout,
    visibleProperties: overrides.visibleProperties ?? snapshot.visibleProperties,
    filters: overrides.filters ?? snapshot.filters,
    sorts: overrides.sorts ?? snapshot.sorts,
    layoutOptions: { ...snapshot.layoutOptions, ...(overrides.layoutOptions as Partial<LayoutOptions> | undefined) } as LayoutOptions,
    isDefault: snapshot.isDefault,
  }
  if (merged.layout === "table") {
    const tableOptions = merged.layoutOptions as TableLayoutOptions
    tableOptions.columnStyles = sanitizeColumnStyles(tableOptions.columnStyles)
    tableOptions.columnAlignment = sanitizeColumnAlignment(tableOptions.columnAlignment)
  }
  if (overrides.isCustom) merged.isCustom = overrides.isCustom
  return merged
}

export const mergeStoredViews = (stored: InterventionViewDefinition[] | null): InterventionViewDefinition[] => {
  const result: InterventionViewDefinition[] = []
  const seen = new Set<string>()

  stored?.forEach((view) => {
    if (LEGACY_DEFAULT_VIEW_IDS.has(view.id) && !DEFAULT_VIEW_IDS.has(view.id)) return
    const template = layoutTemplatesByLayout[view.layout]
    const merged = template ? mergeViewWithDefaults(template, view) : { ...view, isCustom: true }
    result.push(merged)
    seen.add(merged.id)
  })

  DEFAULT_VIEWS.forEach((defaultView) => {
    if (seen.has(defaultView.id)) return
    result.push(cloneViewDefinition(defaultView))
    seen.add(defaultView.id)
  })

  return result
}

// ---- ID generation ----

export const generateRandomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `view-${Math.random().toString(36).slice(2, 10)}`
}

export const slugify = (input: string) =>
  input.toLowerCase().normalize("NFD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")
