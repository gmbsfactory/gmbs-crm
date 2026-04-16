"use client"

import { QueryClient } from "@tanstack/react-query"
import { interventionKeys, artisanKeys, dashboardKeys, comptabiliteKeys, referenceKeys, type ArtisanGetAllParams, type ComptabiliteQueryParams } from "@/lib/react-query/queryKeys"
import { interventionsApi, artisansApi, type InterventionQueryParams } from "@/lib/api"
import { fetchComptabiliteData } from "@/hooks/useComptabiliteQuery"

// Alias pour compatibilité
type GetAllParams = InterventionQueryParams
import { referenceApi, type ReferenceData } from "@/lib/reference-api"
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
 * Utilise le cache TanStack Query pour éviter les requêtes dupliquées
 */
async function createMappers(queryClient: QueryClient) {
  // Utiliser fetchQuery avec la même clé que useReferenceDataQuery
  // pour bénéficier du cache partagé et de la déduplication
  const refData = await queryClient.fetchQuery({
    queryKey: referenceKeys.allData(),
    queryFn: () => referenceApi.getAll(),
    staleTime: 5 * 60 * 1000,
  }) as ReferenceData

  const statuses = refData.interventionStatuses
  const users = refData.users

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

  // Créer le mapper userCodeToId — uniquement les champs UNIQUE (code_gestionnaire, username)
  // Les champs non-uniques (firstname, lastname, fullName) sont exclus pour éviter les collisions
  const userMap: Record<string, string> = {}
  for (const user of users) {
    if (user.code_gestionnaire) userMap[user.code_gestionnaire.toLowerCase()] = user.id
    if (user.username) userMap[user.username.toLowerCase()] = user.id
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
    return
  }
  
  // Vérifier l'authentification avant de commencer
  const { data: auth } = await supabase.auth.getSession()
  if (!auth?.session?.user) {
    return
  }
  
  try {
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
    const mappersPromise = createMappers(queryClient)

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
        return await interventionsApi.getAllLight(generalListParams)
      },
      staleTime: 30 * 1000, // 30 secondes
    })

    // 5. Préchargement progressif des vues par défaut
    // Stratégie : Précharger la vue principale immédiatement, les autres en arrière-plan
    
    // Identifier la vue principale (liste-generale ou mes-demandes en priorité)
    const primaryViewId = currentUserId ? "mes-demandes" : "liste-generale"
    const primaryView = defaultViews.find((v) => v.id === primaryViewId) || defaultViews[0]
    const remainingViews = defaultViews.filter((v) => v.id !== primaryView?.id)

    // Précharger la vue principale immédiatement
    if (primaryView) {
      try {
        const { serverFilters } = convertViewFiltersToServerFilters(primaryView.filters, {
          statusCodeToId,
          userCodeToId,
          currentUserId,
        })

        const params: GetAllParams = {
          limit: 100,
          offset: 0,
          ...serverFilters,
        }

        const queryKey = interventionKeys.lightList(params)
        const fullQueryKey = primaryView.id ? [...queryKey, primaryView.id] : queryKey

        await queryClient.prefetchQuery({
          queryKey: fullQueryKey,
          queryFn: async () => {
            return await interventionsApi.getAllLight(params)
          },
          staleTime: 30 * 1000,
        })

      } catch (err) {
        console.warn(`[preloadCriticalData] ⚠️ Erreur lors du préchargement vue principale "${primaryView.title}":`, err)
      }
    }

    // Précharger les autres vues en arrière-plan après un délai
    // Utiliser requestIdleCallback si disponible, sinon setTimeout
    const scheduleBackgroundPreload = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(
          () => {
            preloadRemainingViews(remainingViews, queryClient, {
              statusCodeToId,
              userCodeToId,
              currentUserId,
            })
          },
          { timeout: 5000 } // Forcer l'exécution après 5s max
        )
      } else {
        // Fallback pour les navigateurs sans requestIdleCallback
        setTimeout(() => {
          preloadRemainingViews(remainingViews, queryClient, {
            statusCodeToId,
            userCodeToId,
            currentUserId,
          })
        }, 2000) // Démarrer après 2 secondes
      }
    }

    scheduleBackgroundPreload()

    // 6. Précharger les vues par défaut des artisans
    await preloadArtisanViews(queryClient, currentUserId)

    // 7. Précharger les données comptabilité (dernière période utilisée depuis localStorage)
    preloadComptabiliteData(queryClient)

    // 8. Précharger les statistiques du dashboard pour l'utilisateur courant et le mois en cours
    if (currentUserId) {
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

      } catch (err) {
        console.warn("[preloadCriticalData] ⚠️ Erreur lors du préchargement des stats dashboard:", err)
      }
    }

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
            return await artisansApi.getAll(params)
          },
          staleTime: 30 * 1000, // 30 secondes
        })

      } catch (err) {
        console.warn(`[preloadArtisanViews] ⚠️ Erreur lors du préchargement vue "${view.title}":`, err)
      }
    }
  } catch (error) {
    console.warn("[preloadArtisanViews] ⚠️ Erreur lors du préchargement des vues artisans:", error)
  }
}

/**
 * Précharge les données comptabilité pour la dernière période utilisée.
 * Lit les filtres depuis localStorage pour déterminer la date range,
 * et peuple le cache TanStack Query pour que l'affichage soit instantané.
 */
function preloadComptabiliteData(queryClient: QueryClient) {
  if (typeof window === "undefined") return

  try {
    const periodType = localStorage.getItem("comptabilite-period-type") || "month"
    const startYear = localStorage.getItem("comptabilite-start-year")
    const startMonth = localStorage.getItem("comptabilite-start-month")
    const endYear = localStorage.getItem("comptabilite-end-year")
    const endMonth = localStorage.getItem("comptabilite-end-month")

    // Si pas de filtres sauvegardés, précharger le mois courant
    let dateRange: { start: string; end: string }

    if (startYear && endYear) {
      if (periodType === "month" && startMonth && endMonth) {
        const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1)
        const endDate = new Date(parseInt(endYear), parseInt(endMonth), 0, 23, 59, 59, 999)
        dateRange = { start: startDate.toISOString(), end: endDate.toISOString() }
      } else {
        const startDate = new Date(parseInt(startYear), 0, 1)
        const endDate = new Date(parseInt(endYear), 11, 31, 23, 59, 59, 999)
        dateRange = { start: startDate.toISOString(), end: endDate.toISOString() }
      }
    } else {
      // Fallback : mois courant
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      dateRange = { start: startDate.toISOString(), end: endDate.toISOString() }
    }

    const queryParams: ComptabiliteQueryParams = {
      dateStart: dateRange.start,
      dateEnd: dateRange.end,
      page: 1,
      pageSize: 100,
    }

    queryClient.prefetchQuery({
      queryKey: comptabiliteKeys.list(queryParams),
      queryFn: () => fetchComptabiliteData(dateRange, 1, 100),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })

  } catch (err) {
    console.warn("[preloadComptabiliteData] ⚠️ Erreur lors du préchargement comptabilité:", err)
  }
}

/**
 * Précharge les vues restantes en arrière-plan avec limitation de concurrence
 * Cette fonction est appelée après le préchargement de la vue principale
 */
async function preloadRemainingViews(
  views: InterventionViewDefinition[],
  queryClient: QueryClient,
  helpers: {
    statusCodeToId: (code: string | string[]) => string | string[] | undefined
    userCodeToId: (code: string | string[]) => string | string[] | undefined
    currentUserId?: string
  }
) {
  if (views.length === 0) return

  const batchSize = 2 // Limiter à 2 requêtes parallèles
  const batchDelay = 300 // Délai entre les batches

  for (let i = 0; i < views.length; i += batchSize) {
    const batch = views.slice(i, i + batchSize)

    // Précharger le batch en parallèle
    await Promise.all(
      batch.map(async (view) => {
        try {
          const { serverFilters } = convertViewFiltersToServerFilters(view.filters, helpers)

          const params: GetAllParams = {
            limit: 100,
            offset: 0,
            ...serverFilters,
          }

          const queryKey = interventionKeys.lightList(params)
          const fullQueryKey = view.id ? [...queryKey, view.id] : queryKey

          await queryClient.prefetchQuery({
            queryKey: fullQueryKey,
            queryFn: async () => {
              return await interventionsApi.getAllLight(params)
            },
            staleTime: 30 * 1000,
          })

        } catch (err) {
          console.warn(`[preloadCriticalData] ⚠️ Erreur lors du préchargement vue "${view.title}":`, err)
        }
      })
    )

    // Attendre avant le prochain batch (sauf pour le dernier)
    if (i + batchSize < views.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay))
    }
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

