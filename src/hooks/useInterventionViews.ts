"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  InterventionViewDefinition,
  LayoutOptions,
  ViewFilters,
  ViewLayout,
  ViewSort,
} from "@/types/intervention-views"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import {
  DEFAULT_VIEWS,
  DEFAULT_VIEW_IDS,
  LEGACY_DEFAULT_VIEW_IDS,
  VISIBLE_VIEW_LAYOUTS,
  VIEWS_STORAGE_KEY,
  ACTIVE_VIEW_STORAGE_KEY,
  USER_SCOPED_VIEW_IDS,
  VIEW_TEMPLATES,
  layoutTemplatesByLayout,
  cloneViewDefinition,
  ensureLayoutOptions,
  applyUserScopedFilters,
  prepareViewsForPersistence,
  safeJSONParse,
  mergeStoredViews,
  generateRandomId,
  slugify,
} from "@/config/intervention-view-presets"

// ---- Types ----

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

// ---- Hook ----

export function useInterventionViews(): UseInterventionViewsResult {
  const [views, setViews] = useState<InterventionViewDefinition[]>(DEFAULT_VIEWS)
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    const defaultView = DEFAULT_VIEWS.find((view) => view.isDefault) ?? DEFAULT_VIEWS[0]
    return defaultView.id
  })
  const [isReady, setIsReady] = useState(false)

  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // Load from localStorage on mount
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

  // Persist views to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !isReady) return
    try {
      localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(prepareViewsForPersistence(views)))
    } catch (error) {
      console.warn("useInterventionViews: unable to persist views", error)
    }
  }, [views, isReady])

  // Persist active view
  useEffect(() => {
    if (typeof window === "undefined" || !isReady) return
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeViewId)
    } catch (error) {
      console.warn("useInterventionViews: unable to persist active view", error)
    }
  }, [activeViewId, isReady])

  // Fallback if active view no longer exists
  useEffect(() => {
    if (!views.length || views.some((v) => v.id === activeViewId)) return
    const fallback = views.find((v) => v.isDefault) ?? views[0]
    setActiveViewId(fallback.id)
  }, [views, activeViewId])

  // Apply user-scoped filters when user changes
  useEffect(() => {
    setViews((prev) => {
      let changed = false
      const next = prev.map((view) => {
        const updated = applyUserScopedFilters(view, currentUserId)
        if (updated !== view) changed = true
        return updated !== view ? updated : view
      })
      return changed ? next : prev
    })
  }, [currentUserId])

  // Ensure active view uses a visible layout
  useEffect(() => {
    if (!views.length) return
    const active = views.find((v) => v.id === activeViewId)
    if (active && VISIBLE_VIEW_LAYOUTS.includes(active.layout)) return
    const fallback = views.find((v) => VISIBLE_VIEW_LAYOUTS.includes(v.layout))
    if (fallback) setActiveViewId(fallback.id)
  }, [views, activeViewId])

  const existingIds = useMemo(() => new Set(views.map((v) => v.id)), [views])

  const buildViewFromTemplate = useCallback(
    (layout: ViewLayout, overrides: Partial<InterventionViewDefinition> = {}): InterventionViewDefinition => {
      const template = layoutTemplatesByLayout[layout] ?? DEFAULT_VIEWS[0]
      const base = cloneViewDefinition(template)
      return {
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
        ? views.find((v) => v.id === payload.sourceViewId)
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
      const baseView = views.find((v) => v.id === id)
      if (!baseView) return null
      return createView({
        title: titleOverride?.trim() || `${baseView.title} (copie)`,
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

  const updateView = useCallback((id: string, patch: UpdateViewPatch) => {
    setViews((prev) =>
      prev.map((view) => {
        if (view.id !== id) return view
        return {
          ...view,
          title: patch.title ? patch.title.trim() || view.title : view.title,
          visibleProperties: patch.visibleProperties ?? view.visibleProperties,
          filters: patch.filters ?? view.filters,
          sorts: patch.sorts ?? view.sorts,
          layoutOptions: patch.layoutOptions
            ? ensureLayoutOptions(view.layout, view.layoutOptions, patch.layoutOptions)
            : view.layoutOptions,
          description: patch.description === null ? undefined : patch.description ?? view.description,
          showBadge: patch.showBadge !== undefined ? patch.showBadge : view.showBadge,
        }
      }),
    )
  }, [])

  const updateLayoutOptions = useCallback((id: string, patch: Partial<LayoutOptions>) => {
    updateView(id, { layoutOptions: patch })
  }, [updateView])

  const updateVisibleProperties = useCallback((id: string, properties: string[]) => {
    updateView(id, { visibleProperties: properties })
  }, [updateView])

  const updateFilters = useCallback((id: string, filters: ViewFilters) => {
    updateView(id, { filters })
  }, [updateView])

  const updateSorts = useCallback((id: string, sorts: ViewSort[]) => {
    updateView(id, { sorts })
  }, [updateView])

  const reorderViews = useCallback((ids: string[]) => {
    setViews((prev) => {
      if (!ids.length) return prev
      const byId = new Map(prev.map((v) => [v.id, v]))
      if (ids.some((id) => !byId.has(id))) return prev
      const ordered = ids.map((id) => byId.get(id) as InterventionViewDefinition)
      prev.forEach((v) => { if (!ids.includes(v.id)) ordered.push(v) })
      return ordered
    })
  }, [])

  const removeView = useCallback((id: string) => {
    if (DEFAULT_VIEW_IDS.has(id)) return
    setViews((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const resetViewToDefault = useCallback((id: string) => {
    const defaultView = DEFAULT_VIEWS.find((v) => v.id === id)
    if (!defaultView) return
    setViews((prev) => prev.map((v) => (v.id === id ? cloneViewDefinition(defaultView) : v)))
  }, [])

  const resetAllViews = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(VIEWS_STORAGE_KEY)
      localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY)
    }
    const refreshedDefaults = DEFAULT_VIEWS.map((view) => {
      if (USER_SCOPED_VIEW_IDS.has(view.id)) {
        return applyUserScopedFilters(cloneViewDefinition(view), currentUserId)
      }
      return cloneViewDefinition(view)
    })
    setViews(refreshedDefaults)
    setActiveViewId((DEFAULT_VIEWS.find((v) => v.isDefault) ?? DEFAULT_VIEWS[0]).id)
  }, [currentUserId])

  const registerExternalView = useCallback(
    (incoming: InterventionViewDefinition, activate = false) => {
      setViews((prev) => {
        const enriched = { ...incoming, isCustom: true }
        const exists = prev.some((v) => v.id === enriched.id)
        return exists ? prev.map((v) => (v.id === enriched.id ? enriched : v)) : [...prev, enriched]
      })
      if (activate) setActiveView(incoming.id)
    },
    [setActiveView],
  )

  const activeView = useMemo(() => {
    return views.find((v) => v.id === activeViewId) ?? views[0]
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
