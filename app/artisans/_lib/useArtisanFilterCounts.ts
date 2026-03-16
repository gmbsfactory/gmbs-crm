"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { artisansApi } from "@/lib/api/v2"
import { convertArtisanFiltersToServerFilters } from "@/lib/filter-converter"
import type { ArtisanViewFilter } from "@/hooks/useArtisanViews"
import { ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS } from "@/config/artisans"
import type { ArtisanStatus, MetierRef } from "@/types/artisan-page"
import { VIRTUAL_STATUS_DOSSIER_A_COMPLETER } from "@/types/artisan-page"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArtisanView {
  id: string
  filters: ArtisanViewFilter[]
}

interface UseArtisanFilterCountsParams {
  isReady: boolean
  views: ArtisanView[]
  activeView: ArtisanView | null | undefined
  currentUserId: string | undefined
  referenceData: { artisanStatuses?: unknown[]; metiers?: unknown[] } | null
  artisanStatuses: ArtisanStatus[]
  metiers: MetierRef[]
  searchTerm: string
  selectedStatuses: string[]
  selectedMetiers: string[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtisanFilterCounts({
  isReady,
  views,
  activeView,
  currentUserId,
  referenceData,
  artisanStatuses,
  metiers,
  searchTerm,
  selectedStatuses,
  selectedMetiers,
}: UseArtisanFilterCountsParams) {
  // -----------------------------------------------------------------------
  // View counts
  // -----------------------------------------------------------------------
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [viewCountsLoading, setViewCountsLoading] = useState(false)

  const convertFiltersToApiParams = useCallback(
    (
      filters: Array<{ property: string; operator: string; value?: string | null }>,
    ): {
      gestionnaire?: string
      statut?: string
      statuts?: string[]
      exclude_statuts?: string[]
      statut_dossier?: string
    } => {
      const params: {
        gestionnaire?: string
        statut?: string
        statuts?: string[]
        exclude_statuts?: string[]
        statut_dossier?: string
      } = {}

      for (const filter of filters) {
        if (filter.property === "gestionnaire_id" && filter.operator === "eq") {
          if (
            filter.value === "CURRENT_USER" ||
            filter.value === "__CURRENT_USER__" ||
            filter.value === currentUserId
          ) {
            if (currentUserId) {
              params.gestionnaire = currentUserId
            }
          } else if (typeof filter.value === "string") {
            params.gestionnaire = filter.value
          }
        } else if (filter.property === "statut_dossier" && filter.operator === "eq") {
          if (typeof filter.value === "string") {
            params.statut_dossier = filter.value
          }
        } else if (filter.property === "statut_id") {
          if (filter.operator === "eq" && typeof filter.value === "string") {
            params.statut = filter.value
          } else if (filter.operator === "in" && typeof filter.value === "string") {
            try {
              const parsed = JSON.parse(filter.value)
              if (Array.isArray(parsed)) {
                params.statuts = parsed
              }
            } catch {
              // ignore invalid JSON
            }
          }
        }
      }

      // Exclure certains statuts des vues "Dossier à compléter"
      if (params.statut_dossier) {
        const excludedIds = artisanStatuses
          .filter((s) => ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS.includes(s.code as typeof ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS[number]))
          .map((s) => s.id)
          .filter((id): id is string => Boolean(id))
        if (excludedIds.length > 0) {
          params.exclude_statuts = excludedIds
        }
      }

      return params
    },
    [currentUserId, artisanStatuses],
  )

  const viewsSignature = useMemo(() => {
    return views.map((view) => ({
      id: view.id,
      filters: JSON.stringify(view.filters ?? []),
    }))
  }, [views])

  const requiresCurrentUserForCounts = useMemo(() => {
    return views.some((view) =>
      view.filters?.some(
        (filter) =>
          filter.property === "gestionnaire_id" &&
          (filter.value === "CURRENT_USER" || filter.value === "__CURRENT_USER__"),
      ),
    )
  }, [views])

  // Load view counts
  useEffect(() => {
    if (!isReady || views.length === 0) return
    if (requiresCurrentUserForCounts && !currentUserId) return

    let cancelled = false
    setViewCountsLoading(true)

    const loadCounts = async () => {
      const counts: Record<string, number> = {}

      const countPromises = views.map(async (view) => {
        try {
          const apiParams = convertFiltersToApiParams(view.filters)
          const count = await artisansApi.getCountWithFilters(apiParams)
          if (!cancelled) {
            counts[view.id] = count
          }
        } catch (error) {
          console.error(`Erreur lors du comptage pour la vue ${view.id}:`, error)
          if (!cancelled) {
            counts[view.id] = 0
          }
        }
      })

      await Promise.all(countPromises)

      if (!cancelled) {
        setViewCounts(counts)
        setViewCountsLoading(false)
      }
    }

    loadCounts()
    return () => {
      cancelled = true
    }
  }, [views, viewsSignature, isReady, convertFiltersToApiParams, requiresCurrentUserForCounts, currentUserId])

  // -----------------------------------------------------------------------
  // Filter counts (status / metier)
  // -----------------------------------------------------------------------
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [metierCounts, setMetierCounts] = useState<Record<string, number>>({})
  const [filterCountsLoading, setFilterCountsLoading] = useState(false)

  useEffect(() => {
    if (!isReady || !referenceData || artisanStatuses.length === 0) return

    let cancelled = false
    setFilterCountsLoading(true)

    const loadCounts = async () => {
      try {
        const baseFilters =
          activeView && activeView.filters.length > 0
            ? convertArtisanFiltersToServerFilters(activeView.filters, {
                currentUserId,
              })
            : { serverFilters: {}, clientFilters: [] }

        const baseServerFilters = baseFilters.serverFilters ?? {}
        const searchFilter = searchTerm.trim() ? { search: searchTerm.trim() } : {}

        const metierFilter =
          selectedMetiers.length > 0
            ? {
                metiers: metiers
                  .filter((metier) => selectedMetiers.includes(metier.label))
                  .map((metier) => metier.id)
                  .filter((metierId): metierId is string => Boolean(metierId)),
              }
            : {}

        // Count per status
        const statusCountPromises = artisanStatuses
          .filter((s) => s.is_active !== false)
          .map(async (status) => {
            const countParams = {
              ...baseServerFilters,
              ...searchFilter,
              ...metierFilter,
              statuts: [status.id],
            }
            const count = await artisansApi.getCountWithFilters(countParams)
            return { statusLabel: status.label, count }
          })

        const statusCountResults = await Promise.all(statusCountPromises)
        const statusCountsMap: Record<string, number> = {}
        statusCountResults.forEach(({ statusLabel, count }) => {
          statusCountsMap[statusLabel] = count
        })

        // Virtual status "Dossier a completer"
        const dossierCountParams = {
          ...baseServerFilters,
          ...searchFilter,
          ...metierFilter,
          statut_dossier: "À compléter",
        }
        const dossierCount = await artisansApi.getCountWithFilters(dossierCountParams)
        statusCountsMap[VIRTUAL_STATUS_DOSSIER_A_COMPLETER] = dossierCount

        if (!cancelled) {
          setStatusCounts(statusCountsMap)
        }

        // Count per metier
        const statusFilter =
          selectedStatuses.length > 0
            ? {
                statuts: artisanStatuses
                  .filter((status) => selectedStatuses.includes(status.label))
                  .map((status) => status.id)
                  .filter((statusId): statusId is string => Boolean(statusId)),
              }
            : {}

        const metierCountPromises = metiers.map(async (metier) => {
          const countParams = {
            ...baseServerFilters,
            ...searchFilter,
            ...statusFilter,
            metiers: [metier.id],
          }
          const count = await artisansApi.getCountWithFilters(countParams)
          return { metierLabel: metier.label, count }
        })

        const metierCountResults = await Promise.all(metierCountPromises)
        const metierCountsMap: Record<string, number> = {}
        metierCountResults.forEach(({ metierLabel, count }) => {
          metierCountsMap[metierLabel] = count
        })

        if (!cancelled) {
          setMetierCounts(metierCountsMap)
          setFilterCountsLoading(false)
        }
      } catch (err) {
        console.error("Erreur lors du chargement des compteurs:", err)
        if (!cancelled) {
          setFilterCountsLoading(false)
        }
      }
    }

    loadCounts()
    return () => {
      cancelled = true
    }
  }, [isReady, referenceData, artisanStatuses, metiers, activeView, currentUserId, searchTerm, selectedMetiers, selectedStatuses])

  const getContactCountByStatus = useCallback(
    (status: string) => statusCounts[status] ?? 0,
    [statusCounts],
  )

  const getContactCountByMetier = useCallback(
    (metier: string) => metierCounts[metier] ?? 0,
    [metierCounts],
  )

  return {
    viewCounts,
    viewCountsLoading,
    statusCounts,
    metierCounts,
    filterCountsLoading,
    getContactCountByStatus,
    getContactCountByMetier,
  }
}
