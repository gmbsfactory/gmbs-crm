"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export type ArtisanViewFilter = {
  property: string
  operator: "eq" | "ne" | "is_empty" | "is_not_empty"
  value?: string | null
}

export type ArtisanViewDefinition = {
  id: string
  title: string
  description: string
  filters: ArtisanViewFilter[]
  isDefault: boolean
}

const CURRENT_USER_PLACEHOLDER = "__CURRENT_USER__"

const DEFAULT_VIEW_PRESETS: Array<{
  id: string
  title: string
  description: string
  filters: ArtisanViewFilter[]
}> = [
    {
      id: "liste-generale",
      title: "Liste générale",
      description: "Liste complète de tous les artisans sans filtres",
      filters: [],
    },
    {
      id: "ma-liste-artisans",
      title: "Ma liste artisans",
      description: "Artisans assignés au gestionnaire connecté au CRM",
      filters: [
        { property: "gestionnaire_id", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
    },
    {
      id: "artisans-a-completer",
      title: "Liste Artisans à compléter",
      description: "Tous les artisans avec le statut Dossier à compléter",
      filters: [
        { property: "statut_dossier", operator: "eq", value: "À compléter" },
      ],
    },
    {
      id: "mes-artisans-a-completer",
      title: "Mes Artisans à compléter",
      description: "Artisans assignés au gestionnaire connecté avec le statut Dossier à compléter",
      filters: [
        { property: "gestionnaire_id", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
        { property: "statut_dossier", operator: "eq", value: "À compléter" },
      ],
    },
  ]

const DEFAULT_VIEWS: ArtisanViewDefinition[] = DEFAULT_VIEW_PRESETS.map((preset) => ({
  ...preset,
  isDefault: true,
}))

const STORAGE_KEY = "crm:artisans:views"

function applyUserScopedFilters(view: ArtisanViewDefinition, userId: string | null): ArtisanViewDefinition {
  if (!userId) return view

  return {
    ...view,
    filters: view.filters.map((filter) => {
      if (filter.value === CURRENT_USER_PLACEHOLDER) {
        return { ...filter, value: userId }
      }
      return filter
    }),
  }
}

export function useArtisanViews() {
  const [views, setViews] = useState<ArtisanViewDefinition[]>(DEFAULT_VIEWS)
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    const defaultView = DEFAULT_VIEWS.find((view) => view.id === "liste-generale") ?? DEFAULT_VIEWS[0]
    return defaultView.id
  })
  const [isReady, setIsReady] = useState(false)

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { views: ArtisanViewDefinition[]; activeViewId: string }
        if (parsed.views && Array.isArray(parsed.views)) {
          // Fusionner les vues sauvegardées avec les vues par défaut
          // S'assurer que toutes les vues par défaut sont présentes et à jour
          const mergedViews: ArtisanViewDefinition[] = []
          const seenIds = new Set<string>()

          // D'abord, ajouter toutes les vues par défaut (toujours prioritaires)
          DEFAULT_VIEWS.forEach((defaultView) => {
            mergedViews.push(defaultView)
            seenIds.add(defaultView.id)
          })

          // Ensuite, ajouter les vues personnalisées (non par défaut) depuis le localStorage
          // Ignorer les vues par défaut du localStorage car elles peuvent être obsolètes
          parsed.views.forEach((storedView) => {
            if (!storedView.isDefault && !seenIds.has(storedView.id)) {
              mergedViews.push(storedView)
              seenIds.add(storedView.id)
            }
          })

          setViews(mergedViews)
          if (parsed.activeViewId && mergedViews.some(v => v.id === parsed.activeViewId)) {
            setActiveViewId(parsed.activeViewId)
          }
        }
      }
    } catch (error) {
      console.error("Failed to load artisan views from storage", error)
    }

    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) return

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          views,
          activeViewId,
        }),
      )
    } catch (error) {
      console.error("Failed to save artisan views to storage", error)
    }
  }, [views, activeViewId, isReady])

  const activeView = useMemo(() => {
    const view = views.find((v) => v.id === activeViewId) ?? views[0]
    return applyUserScopedFilters(view, currentUserId)
  }, [views, activeViewId, currentUserId])

  const setActiveView = useCallback((id: string) => {
    setActiveViewId(id)
  }, [])

  return {
    views,
    activeView,
    activeViewId,
    setActiveView,
    isReady,
  }
}

