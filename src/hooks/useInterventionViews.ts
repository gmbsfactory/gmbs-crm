"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  InterventionViewDefinition,
  LayoutOptions,
  ViewFilters,
  ViewFilter,
  ViewFilterOperator,
  ViewLayout,
  ViewSort,
  TableLayoutOptions,
  TableColumnStyle,
  TableColumnAlignment,
  TableColumnAppearance,
} from "@/types/intervention-views"
import { STYLE_ELIGIBLE_COLUMNS, normalizeColumnStyle } from "@/lib/interventions/column-style"
import { supabase } from "@/lib/supabase-client"

const CURRENT_USER_PLACEHOLDER = "__CURRENT_USER_USERNAME__"
const NO_USER_PLACEHOLDER = "__NO_USER_USERNAME__"
const USER_SCOPED_VIEW_IDS = new Set([
  "mes-demandes",
  "ma-liste-en-cours",
  "mes-visites-technique",
  "ma-liste-accepte",
])

const VISIBLE_VIEW_LAYOUTS: ViewLayout[] = ["table", "cards", "calendar"]

const VIEWS_STORAGE_KEY = "crm:interventions:view-configs"
const ACTIVE_VIEW_STORAGE_KEY = "crm:interventions:active-view"

const cloneViewDefinition = (view: InterventionViewDefinition): InterventionViewDefinition => {
  if (typeof structuredClone === "function") {
    return structuredClone(view)
  }
  return JSON.parse(JSON.stringify(view)) as InterventionViewDefinition
}

const VIEW_TEMPLATES: Record<ViewLayout, InterventionViewDefinition> = {
  table: {
    id: "table",
    title: "Tableau",
    layout: "table",
    visibleProperties: [
      "dateIntervention",
      "agence",
      "attribueA",
      "id_inter",
      "metier",
      "codePostal",
      "ville",
      "artisan",
      "coutIntervention",
      "datePrevue",
      "statusValue",
    ],
    filters: [],
    sorts: [{ property: "dateIntervention", direction: "desc" }],
    layoutOptions: {
      layout: "table",
      columnWidths: {
        attribueA: 50,
      },
      hiddenColumns: [],
      rowDensity: "dense",
      rowDisplayMode: "stripes",
      useAccentColor: true,
      showStatusBorder: false,
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
    description: "Vue en tableau avec colonnes configurables et tri multi-colonnes",
    isDefault: true,
  },
  cards: {
    id: "cards",
    title: "Cartes",
    layout: "cards",
    visibleProperties: ["contexteIntervention", "nomClient", "prenomClient", "dateIntervention", "attribueA"],
    filters: [],
    sorts: [{ property: "date", direction: "desc" }],
    layoutOptions: {
      layout: "cards",
      coverProperty: null,
      previewProperties: ["contexteIntervention", "nomClient"],
      showStatus: true,
    },
    description: "Vue cartes compacte avec focus sur le contexte et le client",
    isDefault: true,
  },
  gallery: {
    id: "gallery",
    title: "Galerie",
    layout: "gallery",
    visibleProperties: ["nomClient", "contexteIntervention", "attribueA"],
    filters: [],
    sorts: [{ property: "dateIntervention", direction: "desc" }],
    layoutOptions: {
      layout: "gallery",
      coverProperty: null,
      previewProperty: "contexteIntervention",
      size: "medium",
      highlightedProperties: ["nomClient", "attribueA"],
    },
    description: "Galerie visuelle des interventions avec carte responsive",
    isDefault: false,
  },
  kanban: {
    id: "kanban",
    title: "Kanban",
    layout: "kanban",
    visibleProperties: ["contexteIntervention", "nomClient", "attribueA", "dateIntervention"],
    filters: [],
    sorts: [{ property: "statusValue", direction: "asc" }],
    layoutOptions: {
      layout: "kanban",
      groupProperty: "statusValue",
      columnOrder: [],
      collapsedColumns: [],
    },
    description: "Pipeline par statut avec drag & drop",
    isDefault: false,
  },
  calendar: {
    id: "calendar",
    title: "Calendrier",
    layout: "calendar",
    visibleProperties: ["nomClient", "contexteIntervention", "attribueA"],
    filters: [],
    sorts: [{ property: "dateIntervention", direction: "asc" }],
    layoutOptions: {
      layout: "calendar",
      dateProperty: "dateIntervention",
      endDateProperty: "dateIntervention",
      viewMode: "month",
    },
    description: "Vue calendrier (mois/semaine/jour) basée sur la date d'intervention",
    isDefault: false,
  },
  timeline: {
    id: "timeline",
    title: "Chronologie",
    layout: "timeline",
    visibleProperties: ["nomClient", "attribueA", "statusValue"],
    filters: [],
    sorts: [{ property: "date", direction: "asc" }],
    layoutOptions: {
      layout: "timeline",
      startDateProperty: "date",
      endDateProperty: "dateIntervention",
      groupBy: "artisan",
      zoom: "month",
    },
    description: "Chronologie type Gantt avec regroupement personnalisable",
    isDefault: true,
  },
}

// ============================================
// HELPER FUNCTIONS - Doivent être avant DEFAULT_VIEWS
// ============================================

const sanitizeColumnStyles = (styles?: Record<string, TableColumnStyle | null> | null): Record<string, TableColumnStyle> | undefined => {
  if (!styles) return undefined
  const result: Record<string, TableColumnStyle> = {}
  Object.entries(styles).forEach(([key, value]) => {
    if (!value) return
    const normalized = normalizeColumnStyle(key, value)
    if (normalized) {
      result[key] = normalized
    }
  })
  return Object.keys(result).length ? result : undefined
}

const sanitizeColumnAlignment = (alignment?: Record<string, TableColumnAlignment>): Record<string, TableColumnAlignment> | undefined => {
  if (!alignment) return undefined
  const allowed: TableColumnAlignment[] = ["left", "center", "right"]
  const result: Record<string, TableColumnAlignment> = {}
  Object.entries(alignment).forEach(([key, value]) => {
    if (allowed.includes(value) && value !== "center") {
      result[key] = value
    }
  })
  return Object.keys(result).length ? result : undefined
}

const mergeTableLayoutOptions = (
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
  const mergedStyles = sanitizeColumnStyles({
    ...(base.columnStyles ?? {}),
    ...(patch?.columnStyles ?? {}),
  })

  const mergedAlignment = sanitizeColumnAlignment({
    ...(base.columnAlignment ?? {}),
    ...(patch?.columnAlignment ?? {}),
  })

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

const ensureLayoutOptions = (layout: ViewLayout, base: LayoutOptions, patch?: Partial<LayoutOptions>): LayoutOptions => {
  if (layout === "table") {
    return mergeTableLayoutOptions(base as TableLayoutOptions, patch as Partial<TableLayoutOptions> | undefined)
  }
  if (!patch) return base
  const { layout: _, ...rest } = patch as Partial<Record<string, unknown>>
  return { ...base, ...rest, layout } as LayoutOptions
}

// ============================================
// DEFAULT VIEW PRESETS
// ============================================

type DefaultViewPreset = {
  id: string
  title: string
  description: string
  filters: ViewFilters
  visibleProperties?: string[]
  layoutOptions?: Partial<TableLayoutOptions>
  showBadge?: boolean
}

const DEFAULT_VIEW_PRESETS: DefaultViewPreset[] = [
  {
    id: "liste-generale",
    title: "Liste générale",
    description: "Liste complète de toutes les interventions sans filtres",
    filters: [],
    showBadge: true,
    layoutOptions: {
      showStatusBorder: true,
      statusBorderSize: "m",
      showStatusFilter: false,
      columnWidths: {
        attribueA: 50,
      },
      rowDisplayMode: "gradient",
      useAccentColor: false,
      columnStyles: {
        statusValue: { appearance: "badge" },
        attribueA: { appearance: "none" },
      },
    },
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
    visibleProperties: [
      "dateIntervention",
      "agence",
      "metier",
      "adresse",
      "ville",
      "codePostal",
      "datePrevue",
    ],
    layoutOptions: {
      columnWidths: {
        attribueA: 50,
      },
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
  },
  {
    id: "mes-demandes",
    title: "Mes demandes",
    description: "Demandes assignées à l'utilisateur connecté",
    filters: [
      { property: "statusValue", operator: "eq", value: "DEMANDE" },
      { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
    ],
    showBadge: true,
    layoutOptions: {
      columnWidths: {
        attribueA: 50,
      },
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
  },
  {
    id: "ma-liste-en-cours",
    title: "Ma liste en cours",
    description: "Interventions en cours assignées à l'utilisateur connecté",
    filters: [
      { property: "statusValue", operator: "eq", value: "INTER_EN_COURS" },
      { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
    ],
    showBadge: true,
    layoutOptions: {
      columnWidths: {
        attribueA: 50,
      },
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
  },
  {
    id: "mes-visites-technique",
    title: "Mes visites technique",
    description: "Visites techniques assignées à l'utilisateur connecté",
    filters: [
      { property: "statusValue", operator: "eq", value: "VISITE_TECHNIQUE" },
      { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
    ],
    showBadge: true,
    layoutOptions: {
      columnWidths: {
        attribueA: 50,
      },
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
  },
  {
    id: "ma-liste-accepte",
    title: "Ma liste accepté",
    description: "Interventions acceptées assignées à l'utilisateur connecté",
    filters: [
      { property: "statusValue", operator: "eq", value: "ACCEPTE" },
      { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
    ],
    showBadge: true,
    layoutOptions: {
      columnWidths: {
        attribueA: 50,
      },
      columnStyles: {
        attribueA: { appearance: "none" },
      },
    },
  },
  // Vue calendar retirée des vues par défaut
  // {
  //   id: "calendar",
  //   title: "Calendrier",
  //   description: "Vue calendrier des interventions",
  //   filters: [],
  //   layoutOptions: {
  //     layout: "calendar",
  //     dateProperty: "dateIntervention",
  //     endDateProperty: "dateIntervention",
  //     viewMode: "month",
  //   } as any,
  // },
]

const DEFAULT_VIEWS: InterventionViewDefinition[] = DEFAULT_VIEW_PRESETS.map((preset) => {
  // Détecter le layout depuis layoutOptions ou utiliser "table" par défaut
  const layout = (preset.layoutOptions?.layout as ViewLayout) ?? "table"
  const base = cloneViewDefinition(VIEW_TEMPLATES[layout] ?? VIEW_TEMPLATES.table)
  
  // Si c'est une vue table, utiliser mergeTableLayoutOptions
  if (layout === "table") {
    const baseTableOptions = base.layoutOptions as TableLayoutOptions
    const mergedLayoutOptions = preset.layoutOptions
      ? mergeTableLayoutOptions(baseTableOptions, preset.layoutOptions)
      : baseTableOptions
    const view: InterventionViewDefinition = {
      ...base,
      id: preset.id,
      title: preset.title,
      description: preset.description,
      filters: preset.filters,
      visibleProperties: preset.visibleProperties ?? base.visibleProperties,
      layoutOptions: mergedLayoutOptions,
      showBadge: preset.showBadge ?? false,
      isDefault: true,
    }
    return USER_SCOPED_VIEW_IDS.has(view.id) ? applyUserScopedFilters(view, null) : view
  }
  
  // Pour les autres layouts (calendar, etc.)
  const view: InterventionViewDefinition = {
    ...base,
    id: preset.id,
    title: preset.title,
    description: preset.description,
    filters: preset.filters,
    visibleProperties: preset.visibleProperties ?? base.visibleProperties,
    layoutOptions: preset.layoutOptions ? { ...base.layoutOptions, ...preset.layoutOptions } : base.layoutOptions,
    showBadge: preset.showBadge ?? false,
    isDefault: true,
  }
  return USER_SCOPED_VIEW_IDS.has(view.id) ? applyUserScopedFilters(view, null) : view
})

const DEFAULT_VIEW_IDS = new Set(DEFAULT_VIEWS.map((view) => view.id))
const DEFAULT_VIEW_MAP = new Map(DEFAULT_VIEWS.map((view) => [view.id, cloneViewDefinition(view)]))
const LEGACY_DEFAULT_VIEW_IDS = new Set(["table", "cards", "timeline", "ma-liste-accepte"])

const layoutTemplatesByLayout: Record<ViewLayout, InterventionViewDefinition> = VIEW_TEMPLATES

function applyUserScopedFilters(view: InterventionViewDefinition, username: string | null): InterventionViewDefinition {
  if (!USER_SCOPED_VIEW_IDS.has(view.id)) {
    return view
  }

  // Ne pas appliquer le filtre si le username n'est pas connu
  // Cela évite d'injecter __NO_USER_USERNAME__ qui ne peut pas être converti en ID utilisateur
  if (username === null) {
    return view
  }

  const targetValue = username
  let changed = false
  let hasAssignmentFilter = false

  const nextFilters = view.filters.map((filter) => {
    if (filter.property !== "attribueA") {
      return filter
    }
    hasAssignmentFilter = true
    const needsUpdate =
      filter.operator !== "eq" ||
      filter.value === CURRENT_USER_PLACEHOLDER ||
      filter.value !== targetValue
    if (!needsUpdate) {
      return filter
    }
    changed = true
    return {
      property: filter.property,
      operator: "eq",
      value: targetValue,
    } as ViewFilter
  })

  if (!hasAssignmentFilter) {
    changed = true
    nextFilters.push({
      property: "attribueA",
      operator: "eq",
      value: targetValue,
    } as ViewFilter)
  }

  if (!changed) {
    return view
  }

  return {
    ...view,
    filters: nextFilters as ViewFilters,
  }
}

const prepareViewsForPersistence = (views: InterventionViewDefinition[]): InterventionViewDefinition[] => {
  return views.map((view) => {
    if (!DEFAULT_VIEW_IDS.has(view.id)) {
      return view
    }
    const template = DEFAULT_VIEW_MAP.get(view.id)
    if (!template) return view
    if (view.filters === template.filters) return view
    const resetFilters = cloneViewDefinition(template).filters
    if (JSON.stringify(view.filters) === JSON.stringify(resetFilters)) {
      return view
    }
    return {
      ...view,
      filters: resetFilters,
    }
  })
}

const safeJSONParse = (value: string | null): InterventionViewDefinition[] | null => {
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

const mergeViewWithDefaults = (
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
    layoutOptions: {
      ...snapshot.layoutOptions,
      ...(overrides.layoutOptions as Partial<LayoutOptions> | undefined),
    } as LayoutOptions,
    isDefault: snapshot.isDefault,
  }

  if (merged.layout === "table") {
    const tableOptions = merged.layoutOptions as TableLayoutOptions
    tableOptions.columnStyles = sanitizeColumnStyles(tableOptions.columnStyles)
    tableOptions.columnAlignment = sanitizeColumnAlignment(tableOptions.columnAlignment)
  }

  if (overrides.isCustom) {
    merged.isCustom = overrides.isCustom
  }

  return merged
}

const mergeStoredViews = (stored: InterventionViewDefinition[] | null): InterventionViewDefinition[] => {
  const result: InterventionViewDefinition[] = []
  const seen = new Set<string>()

  stored?.forEach((view) => {
    if (LEGACY_DEFAULT_VIEW_IDS.has(view.id) && !DEFAULT_VIEW_IDS.has(view.id)) {
      return
    }
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

type CreateViewPayload = {
  title: string
  layout: ViewLayout
  sourceViewId?: string
  visibleProperties?: string[]
  filters?: ViewFilters
  sorts?: ViewSort[]
  layoutOptions?: Partial<LayoutOptions>
}

type UpdateViewPatch = {
  title?: string
  visibleProperties?: string[]
  filters?: ViewFilters
  sorts?: ViewSort[]
  layoutOptions?: Partial<LayoutOptions>
  description?: string | null
  showBadge?: boolean
}

type UseInterventionViewsResult = {
  views: InterventionViewDefinition[]
  activeViewId: string
  activeView: InterventionViewDefinition
  isReady: boolean
  setActiveView: (id: string) => void
  createView: (payload: CreateViewPayload) => InterventionViewDefinition | null
  duplicateView: (id: string, titleOverride?: string) => InterventionViewDefinition | null
  updateView: (id: string, patch: UpdateViewPatch) => void
  updateLayoutOptions: (id: string, patch: Partial<LayoutOptions>) => void
  updateVisibleProperties: (id: string, properties: string[]) => void
  updateFilters: (id: string, filters: ViewFilters) => void
  updateSorts: (id: string, sorts: ViewSort[]) => void
  reorderViews: (ids: string[]) => void
  removeView: (id: string) => void
  resetViewToDefault: (id: string) => void
  resetAllViews: () => void
  registerExternalView: (view: InterventionViewDefinition, activate?: boolean) => void
}

const generateRandomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `view-${Math.random().toString(36).slice(2, 10)}`
}

const slugify = (input: string) =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")

export function useInterventionViews(): UseInterventionViewsResult {
  const [views, setViews] = useState<InterventionViewDefinition[]>(DEFAULT_VIEWS)
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    const defaultView = DEFAULT_VIEWS.find((view) => view.isDefault) ?? DEFAULT_VIEWS[0]
    return defaultView.id
  })
  const [isReady, setIsReady] = useState(false)
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const resolveUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (!token) {
          if (!cancelled) {
            setCurrentUsername(null)
          }
          return
        }

        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error("Unable to fetch current user")
        }
        const payload = await response.json()
        const user = payload?.user ?? null
        const identifier: string | null =
          user?.code_gestionnaire ?? user?.username ?? user?.surnom ?? null
        if (!cancelled) {
          setCurrentUsername(identifier)
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentUsername(null)
        }
      }
    }

    resolveUser()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      resolveUser()
    })

    return () => {
      cancelled = true
      authListener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedViews = safeJSONParse(localStorage.getItem(VIEWS_STORAGE_KEY))
    const mergedViews = mergeStoredViews(storedViews)
    setViews(mergedViews)

    const storedActive = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)
    if (storedActive && mergedViews.some((view) => view.id === storedActive)) {
      setActiveViewId(storedActive)
    } else {
      const defaultView = mergedViews.find((view) => view.isDefault) ?? mergedViews[0]
      setActiveViewId(defaultView.id)
    }

    setIsReady(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isReady) return
    try {
      const persistable = prepareViewsForPersistence(views)
      localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(persistable))
    } catch (error) {
      console.warn("useInterventionViews: unable to persist views", error)
    }
  }, [views, isReady])

  useEffect(() => {
    if (typeof window === "undefined" || !isReady) return
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeViewId)
    } catch (error) {
      console.warn("useInterventionViews: unable to persist active view", error)
    }
  }, [activeViewId, isReady])

  useEffect(() => {
    if (!views.length) return
    if (views.some((view) => view.id === activeViewId)) return
    const fallback = views.find((view) => view.isDefault) ?? views[0]
    setActiveViewId(fallback.id)
  }, [views, activeViewId])

  useEffect(() => {
    setViews((prev) => {
      let changed = false
      const next = prev.map((view) => {
        const updated = applyUserScopedFilters(view, currentUsername)
        if (updated !== view) {
          changed = true
          return updated
        }
        return view
      })
      return changed ? next : prev
    })
  }, [currentUsername])

  useEffect(() => {
    if (!views.length) return
    const active = views.find((view) => view.id === activeViewId)
    if (active && VISIBLE_VIEW_LAYOUTS.includes(active.layout)) return
    const fallback = views.find((view) => VISIBLE_VIEW_LAYOUTS.includes(view.layout))
    if (!fallback) return
    setActiveViewId(fallback.id)
  }, [views, activeViewId])

  const existingIds = useMemo(() => new Set(views.map((view) => view.id)), [views])

  const buildViewFromTemplate = useCallback(
    (layout: ViewLayout, overrides: Partial<InterventionViewDefinition> = {}): InterventionViewDefinition => {
      const template = layoutTemplatesByLayout[layout] ?? DEFAULT_VIEWS[0]
      const base = cloneViewDefinition(template)
      const composed: InterventionViewDefinition = {
        ...base,
        id: overrides.id ?? base.id,
        title: overrides.title ?? base.title,
        layout,
        visibleProperties: overrides.visibleProperties ?? base.visibleProperties,
        filters: overrides.filters ?? base.filters,
        sorts: overrides.sorts ?? base.sorts,
        layoutOptions: ensureLayoutOptions(layout, base.layoutOptions, overrides.layoutOptions),
        isDefault: overrides.isDefault ?? false,
        isCustom: overrides.isCustom ?? overrides.id !== base.id,
        description: overrides.description ?? base.description,
      }
      return composed
    },
    [],
  )

  const setActiveView = useCallback((id: string) => {
    setActiveViewId((prev) => (prev === id ? prev : id))
  }, [])

  const createView = useCallback(
    (payload: CreateViewPayload): InterventionViewDefinition | null => {
      const baseTitle = payload.title.trim()
      if (!baseTitle) return null

      const baseId = slugify(baseTitle) || generateRandomId()
      let candidateId = baseId
      let index = 2
      while (existingIds.has(candidateId)) {
        candidateId = `${baseId}-${index}`
        index += 1
      }

      const templateSource = payload.sourceViewId
        ? views.find((view) => view.id === payload.sourceViewId)
        : layoutTemplatesByLayout[payload.layout]

      const template = templateSource
        ? cloneViewDefinition(templateSource)
        : cloneViewDefinition(layoutTemplatesByLayout[payload.layout] ?? DEFAULT_VIEWS[0])

      const newView: InterventionViewDefinition = {
        ...template,
        id: candidateId,
        title: baseTitle,
        layout: payload.layout,
        visibleProperties: payload.visibleProperties ?? template.visibleProperties,
        filters: payload.filters ?? template.filters,
        sorts: payload.sorts ?? template.sorts,
        layoutOptions: ensureLayoutOptions(payload.layout, template.layoutOptions, payload.layoutOptions),
        isDefault: false,
        isCustom: true,
        description: template.description,
      }

      setViews((prev) => [...prev, newView])
      setActiveViewId(newView.id)
      return newView
    },
    [existingIds, views],
  )

  const duplicateView = useCallback(
    (id: string, titleOverride?: string) => {
      const baseView = views.find((view) => view.id === id)
      if (!baseView) return null
      const newTitle = titleOverride?.trim() || `${baseView.title} (copie)`
      return createView({
        title: newTitle,
        layout: baseView.layout,
        sourceViewId: id,
        visibleProperties: baseView.visibleProperties,
        filters: baseView.filters,
        sorts: baseView.sorts,
        layoutOptions: baseView.layoutOptions,
      })
    },
    [views, createView],
  )

  const updateView = useCallback(
    (id: string, patch: UpdateViewPatch) => {
      setViews((prev) =>
        prev.map((view) => {
          if (view.id !== id) return view
          const layoutOptions = patch.layoutOptions
            ? ensureLayoutOptions(view.layout, view.layoutOptions, patch.layoutOptions)
            : view.layoutOptions

          return {
            ...view,
            title: patch.title ? patch.title.trim() || view.title : view.title,
            visibleProperties: patch.visibleProperties ?? view.visibleProperties,
            filters: patch.filters ?? view.filters,
            sorts: patch.sorts ?? view.sorts,
            layoutOptions,
            description: patch.description === null ? undefined : patch.description ?? view.description,
            showBadge: patch.showBadge !== undefined ? patch.showBadge : view.showBadge,
          }
        }),
      )
    },
    [],
  )

  const updateLayoutOptions = useCallback(
    (id: string, patch: Partial<LayoutOptions>) => {
      updateView(id, { layoutOptions: patch })
    },
    [updateView],
  )

  const updateVisibleProperties = useCallback(
    (id: string, properties: string[]) => {
      updateView(id, { visibleProperties: properties })
    },
    [updateView],
  )

  const updateFilters = useCallback(
    (id: string, filters: ViewFilters) => {
      updateView(id, { filters })
    },
    [updateView],
  )

  const updateSorts = useCallback(
    (id: string, sorts: ViewSort[]) => {
      updateView(id, { sorts })
    },
    [updateView],
  )

  const reorderViews = useCallback((ids: string[]) => {
    setViews((prev) => {
      if (!ids.length) return prev
      const byId = new Map(prev.map((view) => [view.id, view]))
      if (ids.some((id) => !byId.has(id))) {
        return prev
      }
      const ordered = ids.map((id) => byId.get(id) as InterventionViewDefinition)
      prev.forEach((view) => {
        if (!ids.includes(view.id)) {
          ordered.push(view)
        }
      })
      return ordered
    })
  }, [])

  const removeView = useCallback((id: string) => {
    if (DEFAULT_VIEW_IDS.has(id)) return
    setViews((prev) => prev.filter((view) => view.id !== id))
  }, [])

  const resetViewToDefault = useCallback((id: string) => {
    const defaultView = DEFAULT_VIEWS.find((view) => view.id === id)
    if (!defaultView) return
    setViews((prev) => prev.map((view) => (view.id === id ? cloneViewDefinition(defaultView) : view)))
  }, [])

  const resetAllViews = useCallback(() => {
    // Supprimer les données du localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(VIEWS_STORAGE_KEY)
      localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY)
    }
    
    // Réinitialiser avec les vues par défaut
    const refreshedDefaults = DEFAULT_VIEWS.map((view) => {
      if (USER_SCOPED_VIEW_IDS.has(view.id)) {
        return applyUserScopedFilters(cloneViewDefinition(view), currentUsername)
      }
      return cloneViewDefinition(view)
    })
    
    setViews(refreshedDefaults)
    
    // Réinitialiser la vue active à la première vue par défaut
    const defaultView = DEFAULT_VIEWS.find((view) => view.isDefault) ?? DEFAULT_VIEWS[0]
    setActiveViewId(defaultView.id)
  }, [currentUsername])

  const registerExternalView = useCallback(
    (incoming: InterventionViewDefinition, activate = false) => {
      setViews((prev) => {
        const enriched: InterventionViewDefinition = {
          ...incoming,
          isCustom: true,
        }
        const exists = prev.some((view) => view.id === enriched.id)
        if (exists) {
          return prev.map((view) => (view.id === enriched.id ? enriched : view))
        }
        return [...prev, enriched]
      })
      if (activate) {
        setActiveView(incoming.id)
      }
    },
    [setActiveView],
  )

  const activeView = useMemo(() => {
    return views.find((view) => view.id === activeViewId) ?? views[0]
  }, [views, activeViewId])

  return {
    views,
    activeViewId,
    activeView,
    isReady,
    setActiveView,
    createView,
    duplicateView,
    updateView,
    updateLayoutOptions,
    updateVisibleProperties,
    updateFilters,
    updateSorts,
    reorderViews,
    removeView,
    resetViewToDefault,
    resetAllViews,
    registerExternalView,
  }
}
