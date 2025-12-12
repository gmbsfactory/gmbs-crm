"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase-client"

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
    id: "mes-artisans-a-completer",
    title: "Mes Artisans à compléter",
    description: "Artisans assignés au gestionnaire connecté avec le statut Dossier à compléter",
    filters: [
      { property: "gestionnaire_id", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      { property: "statut_dossier", operator: "eq", value: "À compléter" },
    ],
  },
  {
    id: "artisans-a-completer",
    title: "Artisans à compléter",
    description: "Tous les artisans avec le statut Dossier à compléter",
    filters: [
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const resolveUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (!token) {
          if (!cancelled) {
            setCurrentUserId(null)
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
        // Pour les artisans, gestionnaire_id est un UUID qui référence users.id
        const userId: string | null = user?.id ?? null
        if (!cancelled) {
          setCurrentUserId(userId)
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentUserId(null)
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

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { views: ArtisanViewDefinition[]; activeViewId: string }
        if (parsed.views && Array.isArray(parsed.views)) {
          setViews(parsed.views)
          if (parsed.activeViewId) {
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

