"use client"

import { QueryClient } from "@tanstack/react-query"
import { interventionKeys, artisanKeys, dashboardKeys, type ArtisanGetAllParams } from "@/lib/react-query/queryKeys"
import { interventionsApiV2, artisansApiV2 } from "@/lib/supabase-api-v2"
import { interventionsApi } from "@/lib/api/v2"
import type { GetAllParams } from "@/lib/supabase-api-v2"
import { referenceApi } from "@/lib/reference-api"
import { convertViewFiltersToServerFilters, convertArtisanFiltersToServerFilters } from "@/lib/filter-converter"
import type { InterventionViewDefinition } from "@/types/intervention-views"
import type { ArtisanViewDefinition } from "@/hooks/useArtisanViews"
import { getHasPreloaded, setHasPreloaded } from "@/lib/preload-flag"
import { supabase } from "@/lib/supabase-client"

const CURRENT_USER_PLACEHOLDER = "__CURRENT_USER_USERNAME__"

/**
 * Obtient les vues par défaut à précharger (excluant calendar)
 * Cette fonction réplique la logique de usePreloadDefaultViews mais sans hooks React
 */
async function getDefaultViewsToPreload(currentUserId?: string): Promise<InterventionViewDefinition[]> {
  // Pour l'instant, on utilise les vues par défaut de base
  // Dans une version future, on pourrait charger depuis localStorage si nécessaire
  const defaultViewIds = [
    "liste-generale",
    "market",
    "mes-demandes",
    "ma-liste-en-cours",
    "mes-visites-technique",
    "ma-liste-accepte",
    "ma-liste-att-acompte",
  ]

  // Créer des vues simplifiées pour le préchargement
  // Ces vues correspondent aux DEFAULT_VIEW_PRESETS dans useInterventionViews.ts
  const views: InterventionViewDefinition[] = [
    {
      id: "liste-generale",
      title: "Liste générale",
      layout: "table",
      visibleProperties: [],
      filters: [],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "market",
      title: "Market",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "DEMANDE" },
        { property: "attribueA", operator: "is_empty", value: null },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "mes-demandes",
      title: "Mes demandes",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "DEMANDE" },
        { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "ma-liste-en-cours",
      title: "Ma liste en cours",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "INTER_EN_COURS" },
        { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "mes-visites-technique",
      title: "Mes visites technique",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "VISITE_TECHNIQUE" },
        { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "ma-liste-accepte",
      title: "Ma liste accepté",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "ACCEPTE" },
        { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
    {
      id: "ma-liste-att-acompte",
      title: "En attente d'acompte",
      layout: "table",
      visibleProperties: [],
      filters: [
        { property: "statusValue", operator: "eq", value: "ATT_ACOMPTE" },
        { property: "attribueA", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      sorts: [{ property: "dateIntervention", direction: "desc" }],
      layoutOptions: { layout: "table" },
      isDefault: true,
    },
  ]

  // Remplacer CURRENT_USER_PLACEHOLDER par le vrai userId dans les filtres
  return views.map((view) => {
    if (!currentUserId) return view
    const updatedFilters = view.filters.map((filter) => {
      if (
        filter.property === "attribueA" &&
        filter.operator === "eq" &&
        filter.value === CURRENT_USER_PLACEHOLDER
      ) {
        return { ...filter, value: currentUserId }
      }
      return filter
    })
    return { ...view, filters: updatedFilters }
  })
}

/**
 * Crée les mappers nécessaires pour convertir les filtres
 */
async function createMappers() {
  // Vérifier l'authentification avant de faire les requêtes
  const { data: auth } = await supabase.auth.getSession()
  if (!auth?.session?.user) {
    throw new Error("Not authenticated")
  }

  const [statuses, users] = await Promise.all([
    referenceApi.getInterventionStatuses(),
    referenceApi.getUsers(),
  ])

  // Créer le mapper statusCodeToId
  const statusMap: Record<string, string> = {}
  const addStatusMapping = (key: string | null | undefined, id: string) => {
    if (!key) return
    const upper = key.toUpperCase()
    const normalized = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toUpperCase()
    statusMap[key] = id
    statusMap[upper] = id
    statusMap[normalized] = id
  }

  for (const status of statuses) {
    addStatusMapping(status.code, status.id)
    addStatusMapping(status.label, status.id)
  }

  // Alias legacy
  const interEnCoursId = statusMap["INTER_EN_COURS"]
  const interTermineeId = statusMap["INTER_TERMINEE"]
  // Les codes BDD sont INTER_EN_COURS et INTER_TERMINEE
  // Pas besoin d'alias legacy car le frontend utilise maintenant les codes réels

  const statusCodeToId = (code: string | string[] | undefined): string | string[] | undefined => {
    if (!code) return undefined
    if (Array.isArray(code)) {
      return code.map((c) => statusMap[c]).filter(Boolean)
    }
    return statusMap[code]
  }

  // Créer le mapper userCodeToId
  const userMap: Record<string, string> = {}
  for (const user of users) {
    if (user.username) userMap[user.username.toLowerCase()] = user.id
    if (user.firstname) userMap[user.firstname.toLowerCase()] = user.id
    if (user.lastname) userMap[user.lastname.toLowerCase()] = user.id
    if (user.code_gestionnaire) userMap[user.code_gestionnaire.toLowerCase()] = user.id
    const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim().toLowerCase()
    if (fullName) userMap[fullName] = user.id
  }

  const userCodeToId = (name: string | string[] | undefined): string | string[] | undefined => {
    if (!name) return undefined
    if (Array.isArray(name)) {
      return name.map((n) => userMap[n.toLowerCase()]).filter(Boolean)
    }
    return userMap[name.toLowerCase()]
  }

  return { statusCodeToId, userCodeToId }
}

/**
 * Précharge les données critiques après la connexion pour une réactivité optimale
 * Cette fonction peut être appelée juste après une connexion réussie pour
 * précharger les données les plus utilisées avant même que l'utilisateur navigue
 */
export async function preloadCriticalData(queryClient: QueryClient) {
  // Vérifier si le préchargement a déjà été fait
  if (getHasPreloaded()) {
    console.log("[preloadCriticalData] ⏭️ Préchargement déjà effectué, skip")
    return
  }
  
  // Vérifier l'authentification avant de commencer
  const { data: auth } = await supabase.auth.getSession()
  if (!auth?.session?.user) {
    console.log("[preloadCriticalData] ⏭️ Utilisateur non authentifié, skip")
    return
  }
  
  try {
    console.log("[preloadCriticalData] 🚀 Démarrage du préchargement des données critiques")
    setHasPreloaded(true)

    // 1. Précharger currentUser (déjà invalidé, mais on peut le précharger explicitement)
    // Note: La query currentUser sera automatiquement déclenchée par useCurrentUser,
    // mais on peut la précharger ici pour garantir qu'elle est chaude
    const currentUserData = await queryClient.fetchQuery({
      queryKey: ["currentUser"],
      queryFn: async () => {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        })
        if (!response.ok) {
          if (response.status === 401) return null
          throw new Error("Impossible de récupérer l'utilisateur")
        }
        const payload = await response.json()
        return payload?.user ?? null
      },
      staleTime: 5 * 60 * 1000,
    })

    const currentUserId = (currentUserData as { id: string } | null)?.id

    // 2. Créer les mappers en parallèle avec le chargement de currentUser
    const mappersPromise = createMappers()

    // 3. Obtenir les vues par défaut à précharger
    const defaultViewsPromise = getDefaultViewsToPreload(currentUserId)

    // Attendre que tout soit prêt
    const [{ statusCodeToId, userCodeToId }, defaultViews] = await Promise.all([
      mappersPromise,
      defaultViewsPromise,
    ])

    // 4. Précharger la liste générale d'interventions (version légère)
    // C'est la vue la plus courante, donc on la précharge en priorité
    const generalListParams: GetAllParams = {
      limit: 100,
      offset: 0,
    }

    queryClient.prefetchQuery({
      queryKey: interventionKeys.lightList(generalListParams),
      queryFn: async () => {
        return await interventionsApiV2.getAllLight(generalListParams)
      },
      staleTime: 30 * 1000, // 30 secondes
    })

    // 5. Précharger toutes les vues par défaut (excluant calendar) avec limitation de concurrence
    console.log(`[preloadCriticalData] 📋 Préchargement de ${defaultViews.length} vues par défaut`)
    
    const batchSize = 2 // Limiter à 2 requêtes parallèles
    const batchDelay = 300 // Délai entre les batches
    
    for (let i = 0; i < defaultViews.length; i += batchSize) {
      const batch = defaultViews.slice(i, i + batchSize)
      
      // Précharger le batch en parallèle
      await Promise.all(
        batch.map(async (view) => {
      try {
        // Convertir les filtres de la vue en filtres serveur
        const { serverFilters } = convertViewFiltersToServerFilters(view.filters, {
          statusCodeToId,
          userCodeToId,
          currentUserId,
        })

        // Créer les paramètres de requête
        const params: GetAllParams = {
          limit: 100,
          offset: 0,
          ...serverFilters,
        }

        // Précharger avec TanStack Query (utilise le dedup automatique)
        const queryKey = interventionKeys.lightList(params)
        const fullQueryKey = view.id ? [...queryKey, view.id] : queryKey

            await queryClient.prefetchQuery({
          queryKey: fullQueryKey,
          queryFn: async () => {
            return await interventionsApiV2.getAllLight(params)
          },
          staleTime: 30 * 1000, // 30 secondes
        })

        console.log(`[preloadCriticalData] ✅ Vue "${view.title}" préchargée`)
      } catch (err) {
        console.warn(`[preloadCriticalData] ⚠️ Erreur lors du préchargement vue "${view.title}":`, err)
          }
        })
      )
      
      // Attendre avant le prochain batch (sauf pour le dernier)
      if (i + batchSize < defaultViews.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay))
      }
    }

    // 6. Précharger les vues par défaut des artisans
    console.log("[preloadCriticalData] 🎨 Préchargement des vues artisans")
    await preloadArtisanViews(queryClient, currentUserId)

    // 7. Précharger les statistiques du dashboard pour l'utilisateur courant et le mois en cours
    if (currentUserId) {
      console.log("[preloadCriticalData] 📊 Préchargement des statistiques du dashboard")
      try {
        // Calculer la période par défaut (mois en cours)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        
        const dashboardPeriod = {
          startDate: startOfMonth.toISOString(),
          endDate: endOfMonth.toISOString(),
        }

        // Précharger les stats d'interventions
        queryClient.prefetchQuery({
          queryKey: dashboardKeys.statsByUser({
            userId: currentUserId,
            startDate: dashboardPeriod.startDate,
            endDate: dashboardPeriod.endDate,
          }),
          queryFn: async () => {
            return await interventionsApi.getStatsByUser(
              currentUserId,
              dashboardPeriod.startDate,
              dashboardPeriod.endDate
            )
          },
          staleTime: 30 * 1000, // 30 secondes
        })

        // Précharger les stats de marge
        queryClient.prefetchQuery({
          queryKey: dashboardKeys.marginByUser({
            userId: currentUserId,
            startDate: dashboardPeriod.startDate,
            endDate: dashboardPeriod.endDate,
          }),
          queryFn: async () => {
            return await interventionsApi.getMarginStatsByUser(
              currentUserId,
              dashboardPeriod.startDate,
              dashboardPeriod.endDate
            )
          },
          staleTime: 30 * 1000, // 30 secondes
        })

        // Précharger les stats par période (semaine courante)
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(now.getFullYear(), now.getMonth(), diff)
        weekStart.setHours(0, 0, 0, 0)

        queryClient.prefetchQuery({
          queryKey: dashboardKeys.periodStatsByUser({
            userId: currentUserId,
            period: "week",
            startDate: weekStart.toISOString().split('T')[0],
          }),
          queryFn: async () => {
            return await interventionsApi.getPeriodStatsByUser(
              currentUserId,
              "week",
              weekStart.toISOString().split('T')[0]
            )
          },
          staleTime: 30 * 1000, // 30 secondes
        })

        console.log("[preloadCriticalData] ✅ Statistiques du dashboard préchargées")
      } catch (err) {
        console.warn("[preloadCriticalData] ⚠️ Erreur lors du préchargement des stats dashboard:", err)
      }
    }

    console.log("[preloadCriticalData] ✅ Données critiques préchargées")
  } catch (error) {
    // En cas d'erreur, réinitialiser le flag pour permettre un nouveau préchargement
    setHasPreloaded(false)
    // Ne pas bloquer la navigation en cas d'erreur de préchargement
    console.warn("[preloadCriticalData] ⚠️ Erreur lors du préchargement:", error)
  }
}

/**
 * Obtient les vues par défaut d'artisans à précharger
 */
async function getDefaultArtisanViewsToPreload(currentUserId?: string): Promise<ArtisanViewDefinition[]> {
  const CURRENT_USER_PLACEHOLDER = "__CURRENT_USER__"
  
  const defaultViewIds = [
    "liste-generale",
    "ma-liste-artisans",
  ]

  const views: ArtisanViewDefinition[] = [
    {
      id: "liste-generale",
      title: "Liste générale",
      description: "Liste complète de tous les artisans sans filtres",
      filters: [],
      isDefault: true,
    },
    {
      id: "ma-liste-artisans",
      title: "Ma liste artisans",
      description: "Artisans assignés au gestionnaire connecté au CRM",
      filters: [
        { property: "gestionnaire_id", operator: "eq", value: CURRENT_USER_PLACEHOLDER },
      ],
      isDefault: true,
    },
  ]

  // Remplacer CURRENT_USER_PLACEHOLDER par le vrai userId dans les filtres
  return views.map((view) => {
    if (!currentUserId) return view
    const updatedFilters = view.filters.map((filter) => {
      if (
        filter.property === "gestionnaire_id" &&
        filter.operator === "eq" &&
        (filter.value === CURRENT_USER_PLACEHOLDER || filter.value === "__CURRENT_USER__")
      ) {
        return { ...filter, value: currentUserId }
      }
      return filter
    })
    return { ...view, filters: updatedFilters }
  })
}

/**
 * Précharge les vues par défaut des artisans
 */
async function preloadArtisanViews(queryClient: QueryClient, currentUserId?: string) {
  try {
    const defaultViews = await getDefaultArtisanViewsToPreload(currentUserId)
    
    console.log(`[preloadArtisanViews] 📋 Préchargement de ${defaultViews.length} vues par défaut`)
    
    for (const view of defaultViews) {
      try {
        // Convertir les filtres de la vue en filtres serveur
        const { serverFilters } = convertArtisanFiltersToServerFilters(view.filters, {
          currentUserId,
        })

        // Créer les paramètres de requête
        const params: ArtisanGetAllParams = {
          limit: 100,
          offset: 0,
          ...serverFilters,
        }

        // Précharger avec TanStack Query (utilise le dedup automatique)
        const queryKey = artisanKeys.list(params)
        const fullQueryKey = view.id ? [...queryKey, view.id] : queryKey

        queryClient.prefetchQuery({
          queryKey: fullQueryKey,
          queryFn: async () => {
            return await artisansApiV2.getAll(params)
          },
          staleTime: 30 * 1000, // 30 secondes
        })

        console.log(`[preloadArtisanViews] ✅ Vue "${view.title}" préchargée`)
      } catch (err) {
        console.warn(`[preloadArtisanViews] ⚠️ Erreur lors du préchargement vue "${view.title}":`, err)
      }
    }
  } catch (error) {
    console.warn("[preloadArtisanViews] ⚠️ Erreur lors du préchargement des vues artisans:", error)
  }
}

/**
 * Précharge les données critiques de manière non-bloquante
 * Utilise requestIdleCallback si disponible, sinon setTimeout
 */
export function preloadCriticalDataAsync(queryClient: QueryClient) {
  if (typeof window === "undefined") return

  // Utiliser requestIdleCallback pour ne pas bloquer le rendu initial
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        preloadCriticalData(queryClient)
      },
      { timeout: 2000 } // Forcer l'exécution après 2s max
    )
  } else {
    // Fallback pour les navigateurs sans requestIdleCallback
    setTimeout(() => {
      preloadCriticalData(queryClient)
    }, 100)
  }
}

