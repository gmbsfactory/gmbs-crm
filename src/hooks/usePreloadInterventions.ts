"use client"

import { useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { interventionsApiV2, type GetAllParams } from "@/lib/supabase-api-v2"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import type { InterventionViewDefinition } from "@/types/intervention-views"
import { convertViewFiltersToServerFilters } from "@/lib/filter-converter"
import { getPreloadConfig, runInIdle } from "@/lib/device-capabilities"

interface PreloadOptions {
  /**
   * Utiliser l'endpoint léger pour le préchargement (données minimales)
   * Par défaut: true pour réduire le volume de données
   */
  useLight?: boolean
}

/**
 * Précharge une vue spécifique avec TanStack Query
 * Utilise requestIdleCallback pour ne pas bloquer le thread principal
 */
export function usePreloadView(
  view: InterventionViewDefinition,
  options: PreloadOptions & {
    statusCodeToId: (code: string | string[]) => string | string[] | undefined
    userCodeToId: (code: string | string[]) => string | string[] | undefined
    currentUserId?: string
  }
) {
  const queryClient = useQueryClient()
  const { useLight = true, statusCodeToId, userCodeToId, currentUserId } = options
  
  // Configuration adaptative - extraire les valeurs primitives pour dépendances stables
  const preloadConfig = useMemo(() => getPreloadConfig(), [])
  const staleTime = preloadConfig.staleTime

  // Mémoriser les options de conversion pour dépendances stables
  const stableConvertOptions = useMemo(() => ({
    statusCodeToId,
    userCodeToId,
    currentUserId,
  }), [statusCodeToId, userCodeToId, currentUserId])

  // Mémoriser l'ID et le titre de la vue pour dépendances stables
  const viewId = view?.id
  const viewTitle = view?.title
  
  // Créer une clé stable pour les filtres (évite re-run si l'objet est recréé avec même contenu)
  const filtersKey = useMemo(() => {
    if (!view?.filters) return ''
    try {
      return JSON.stringify(view.filters)
    } catch {
      return view.id ?? ''
    }
  }, [view?.filters, view?.id])

  // Stocker les filtres dans une ref pour éviter les stale closures
  const filtersRef = useRef(view?.filters)
  filtersRef.current = view?.filters

  useEffect(() => {
    if (!viewId || !filtersKey) return

    // Utiliser idle callback pour précharger quand le navigateur est inactif
    const cleanup = runInIdle(() => {
      try {
        // Convertir les filtres de la vue en filtres serveur
        // Utiliser filtersRef.current pour avoir la valeur à jour sans l'ajouter aux deps
        const { serverFilters } = convertViewFiltersToServerFilters(filtersRef.current, stableConvertOptions)

        // Créer les paramètres de requête
        const params: GetAllParams = {
          limit: 100,
          offset: 0,
          ...serverFilters,
        }

        // Précharger avec TanStack Query (utilise le dedup automatique)
        const queryKey = useLight
          ? interventionKeys.lightList(params)
          : interventionKeys.list(params)

        // Ajouter viewId à la clé pour permettre l'invalidation ciblée
        const fullQueryKey = [...queryKey, viewId]

        queryClient.prefetchQuery({
          queryKey: fullQueryKey,
          queryFn: async () => {
            if (useLight) {
              return await interventionsApiV2.getAllLight(params)
            }
            return await interventionsApiV2.getAll(params)
          },
          staleTime,
        })

        console.log(`[usePreloadView] ✅ Vue "${viewTitle}" préchargée (idle)`)
      } catch (err) {
        console.warn(`[usePreloadView] ⚠️ Erreur lors du préchargement vue "${viewTitle}":`, err)
      }
    }, { timeout: 3000 })

    return cleanup
    // filtersKey est une clé stable dérivée de view.filters - pas besoin d'ajouter view.filters
  }, [viewId, viewTitle, filtersKey, queryClient, useLight, stableConvertOptions, staleTime])
}

/**
 * Précharge la liste générale (sans filtres) avec TanStack Query
 * Utilise requestIdleCallback pour ne pas bloquer le thread principal
 */
export function usePreloadGeneralList(options: PreloadOptions = {}) {
  const queryClient = useQueryClient()
  const { useLight = true } = options
  
  // Extraire les valeurs primitives pour dépendances stables
  const preloadConfig = useMemo(() => getPreloadConfig(), [])
  const staleTime = preloadConfig.staleTime

  useEffect(() => {
    // Utiliser idle callback pour précharger quand le navigateur est inactif
    const cleanup = runInIdle(() => {
      const params: GetAllParams = {
        limit: 100,
        offset: 0,
        // Pas de filtres = liste générale
      }

      const queryKey = useLight
        ? interventionKeys.lightList(params)
        : interventionKeys.list(params)

      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          if (useLight) {
            return await interventionsApiV2.getAllLight(params)
          }
          return await interventionsApiV2.getAll(params)
        },
        staleTime,
      })

      console.log(`[usePreloadGeneralList] ✅ Liste générale préchargée (idle)`)
    }, { timeout: 2000 })

    return cleanup
  }, [queryClient, useLight, staleTime])
}

/**
 * Précharge plusieurs vues en cascade avec TanStack Query
 * Utilise une configuration adaptative selon les capacités de l'appareil
 * et requestIdleCallback pour ne pas bloquer le thread principal
 */
export function usePreloadViews(
  views: InterventionViewDefinition[],
  options: PreloadOptions & {
    statusCodeToId: (code: string | string[]) => string | string[] | undefined
    userCodeToId: (code: string | string[]) => string | string[] | undefined
    currentUserId?: string
  }
) {
  const queryClient = useQueryClient()
  const { useLight = true, statusCodeToId, userCodeToId, currentUserId } = options

  // Configuration adaptative - extraire les valeurs primitives pour dépendances stables
  const preloadConfig = useMemo(() => getPreloadConfig(), [])
  const { maxViews, batchSize, batchDelay, staleTime } = preloadConfig

  // Mémoriser les dépendances réelles pour éviter les re-renders inutiles
  const stableOptions = useMemo(() => ({
    statusCodeToId,
    userCodeToId,
    currentUserId,
  }), [statusCodeToId, userCodeToId, currentUserId])

  // Créer une clé stable basée sur les IDs des vues (triés pour être insensible à l'ordre)
  // Note: le tri évite les re-runs si le parent réordonne les vues sans changer leur contenu
  const viewIds = useMemo(() => 
    views.map(v => v.id).sort().join(','), 
    [views]
  )
  
  // Stocker les vues dans une ref pour éviter les stale closures
  const viewsRef = useRef(views)
  viewsRef.current = views

  useEffect(() => {
    // Utiliser viewsRef.current pour avoir les vues à jour sans les ajouter aux deps
    const currentViews = viewsRef.current
    if (!currentViews || currentViews.length === 0) return

    // Limiter le nombre de vues à précharger selon les capacités
    const viewsToPreload = currentViews.slice(0, maxViews)
    
    console.log(`[usePreloadViews] 🚀 Préchargement de ${viewsToPreload.length}/${currentViews.length} vues (adaptatif: ${batchSize} batch, ${batchDelay}ms délai)`)

    let cancelled = false
    const cleanups: (() => void)[] = []

    const preloadSingleView = async (view: InterventionViewDefinition) => {
      if (cancelled) return

      try {
        // Convertir les filtres de la vue en filtres serveur
        const { serverFilters } = convertViewFiltersToServerFilters(view.filters, stableOptions)

        // Créer les paramètres de requête
        const params: GetAllParams = {
          limit: 100,
          offset: 0,
          ...serverFilters,
        }

        // Précharger avec TanStack Query
        const queryKey = useLight
          ? interventionKeys.lightList(params)
          : interventionKeys.list(params)

        // Ajouter viewId à la clé
        const fullQueryKey = view.id ? [...queryKey, view.id] : queryKey

        await queryClient.prefetchQuery({
          queryKey: fullQueryKey,
          queryFn: async () => {
            if (useLight) {
              return await interventionsApiV2.getAllLight(params)
            }
            return await interventionsApiV2.getAll(params)
          },
          staleTime,
        })

        console.log(`[usePreloadViews] ✅ Vue "${view.title}" préchargée`)
      } catch (err) {
        console.warn(`[usePreloadViews] ⚠️ Erreur préchargement "${view.title}":`, err)
      }
    }

    const preloadBatch = async (batch: InterventionViewDefinition[]) => {
      if (cancelled) return
      await Promise.all(batch.map(preloadSingleView))
    }

    // Fonction pour traiter tous les batches
    const processBatches = async () => {
      for (let i = 0; i < viewsToPreload.length; i += batchSize) {
        if (cancelled) break
        
        const batch = viewsToPreload.slice(i, i + batchSize)
        
        // Utiliser idle callback si supporté, sinon timeout classique
        await new Promise<void>((resolve) => {
          const cleanup = runInIdle(() => {
            preloadBatch(batch).then(resolve)
          }, { timeout: 5000, fallbackDelay: batchDelay })
          cleanups.push(cleanup)
        })
        
        // Attendre avant le prochain batch (sauf pour le dernier)
        if (i + batchSize < viewsToPreload.length && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay))
        }
      }
    }

    // Démarrer le préchargement après un court délai pour laisser le rendu initial
    const startTimeout = setTimeout(() => {
      if (!cancelled) {
        processBatches()
      }
    }, 1000) // Attendre 1 seconde après le montage

    return () => {
      cancelled = true
      clearTimeout(startTimeout)
      cleanups.forEach(cleanup => cleanup())
    }
    // viewIds est la clé stable dérivée de views - viewsRef.current donne accès aux vues actuelles
  }, [viewIds, queryClient, useLight, stableOptions, maxViews, batchSize, batchDelay, staleTime])
}

