"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useArtisansQuery } from "@/hooks/useArtisansQuery"
import type { ArtisanGetAllParams } from "@/lib/react-query/queryKeys"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useArtisanViews } from "@/hooks/useArtisanViews"
import { artisansApi } from "@/lib/api/v2"
import { convertArtisanFiltersToServerFilters } from "@/lib/filter-converter"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { useQueryClient } from "@tanstack/react-query"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { toast } from "sonner"
import type {
  Contact,
  ReferenceUser,
  ArtisanStatus,
  MetierRef,
} from "@/types/artisan-page"
import {
  mapArtisanToContact,
  VIRTUAL_STATUS_DOSSIER_A_COMPLETER,
} from "@/types/artisan-page"
import { useArtisanFilterCounts } from "./useArtisanFilterCounts"

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtisanPageState() {
  const { can, isLoading: permissionsLoading } = usePermissions()
  const artisanModal = useArtisanModal()
  const { views, activeView, activeViewId, setActiveView, isReady } = useArtisanViews()
  const queryClient = useQueryClient()

  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? undefined

  const canWriteArtisans = can("write_artisans")
  const canDeleteArtisans = can("delete_artisans")
  const canReadArtisans = can("read_artisans")

  // -----------------------------------------------------------------------
  // Core state
  // -----------------------------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [artisanStatuses, setArtisanStatuses] = useState<ArtisanStatus[]>([])
  const [selectedMetiers, setSelectedMetiers] = useState<string[]>([])
  const [metiers, setMetiers] = useState<MetierRef[]>([])

  // -----------------------------------------------------------------------
  // Reference data
  // -----------------------------------------------------------------------
  const {
    data: referenceData,
    loading: referenceLoading,
    error: referenceError,
  } = useReferenceDataQuery()

  // -----------------------------------------------------------------------
  // Server / client filters
  // -----------------------------------------------------------------------
  const { serverFilters, clientFilters } = useMemo(() => {
    const baseFilters =
      activeView && activeView.filters.length > 0
        ? convertArtisanFiltersToServerFilters(activeView.filters, {
            currentUserId,
          })
        : { serverFilters: {}, clientFilters: [] }

    const combinedServerFilters: Partial<ArtisanGetAllParams> = {
      ...(baseFilters.serverFilters ?? {}),
    }

    const normalizedSearch = searchTerm.trim()
    if (normalizedSearch) {
      combinedServerFilters.search = normalizedSearch
    }

    const realStatuses = selectedStatuses.filter(
      (label) => label !== VIRTUAL_STATUS_DOSSIER_A_COMPLETER,
    )
    const hasDossierFilter = selectedStatuses.includes(VIRTUAL_STATUS_DOSSIER_A_COMPLETER)

    if (realStatuses.length > 0) {
      const statusIds = artisanStatuses
        .filter((status) => realStatuses.includes(status.label))
        .map((status) => status.id)
        .filter((statusId): statusId is string => Boolean(statusId))

      if (statusIds.length > 0) {
        combinedServerFilters.statuts = statusIds
      }
    }

    if (hasDossierFilter) {
      combinedServerFilters.statut_dossier = "À compléter"
    }

    if (selectedMetiers.length > 0 && metiers.length > 0) {
      const metierIds = metiers
        .filter((metier) => metier.label && selectedMetiers.includes(metier.label))
        .map((metier) => metier.id)
        .filter((metierId): metierId is string => Boolean(metierId))

      if (metierIds.length > 0) {
        combinedServerFilters.metiers = metierIds
      } else {
        console.warn("[ArtisansPage] Aucun ID trouve pour les metiers selectionnes:", {
          selectedMetiers,
          availableMetiers: metiers.map((m) => ({ id: m.id, label: m.label })),
        })
      }
    }

    const hasServerFilters = Object.keys(combinedServerFilters).length > 0

    return {
      serverFilters: hasServerFilters ? combinedServerFilters : undefined,
      clientFilters: baseFilters.clientFilters,
    }
  }, [activeView, currentUserId, searchTerm, selectedStatuses, selectedMetiers, artisanStatuses, metiers])

  // -----------------------------------------------------------------------
  // Reset page on view / filter change
  // -----------------------------------------------------------------------
  useEffect(() => {
    setCurrentPage(1)
  }, [activeViewId])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatuses, selectedMetiers])

  // -----------------------------------------------------------------------
  // Artisans query
  // -----------------------------------------------------------------------
  const {
    artisans,
    loading: artisansLoading,
    error: artisansError,
    totalCount,
    totalPages,
    refresh,
  } = useArtisansQuery({
    limit: 100,
    autoLoad: true,
    serverFilters,
    page: currentPage,
    viewId: activeViewId,
  })

  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(validPage)
    },
    [totalPages],
  )

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const previousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }, [])

  const loading = artisansLoading || referenceLoading
  const error = artisansError || referenceError

  // -----------------------------------------------------------------------
  // Apply pending filter from sessionStorage (dashboard links)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isReady || artisanStatuses.length === 0) return

    const pendingFilterStr = sessionStorage.getItem("pending-artisan-filter")
    if (pendingFilterStr) {
      try {
        const pendingFilter = JSON.parse(pendingFilterStr)

        if (pendingFilter.viewId && views.some((v) => v.id === pendingFilter.viewId)) {
          setActiveView(pendingFilter.viewId)
        }

        if (pendingFilter.statusFilter) {
          const statusLabel = pendingFilter.statusFilter
          const statusExists =
            artisanStatuses.some((s) => s.label === statusLabel) ||
            statusLabel === VIRTUAL_STATUS_DOSSIER_A_COMPLETER
          if (statusExists) {
            setSelectedStatuses([statusLabel])
          }
        }

        sessionStorage.removeItem("pending-artisan-filter")
      } catch (err) {
        console.error("Erreur lors de l'application du filtre depuis sessionStorage:", err)
        sessionStorage.removeItem("pending-artisan-filter")
      }
    }
  }, [isReady, views, setActiveView, artisanStatuses])

  // -----------------------------------------------------------------------
  // Map artisans to contacts
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!referenceData) return
    const statuses = (referenceData.artisanStatuses || []) as ArtisanStatus[]
    setArtisanStatuses(statuses)
    const metiersData = (referenceData.metiers || []) as MetierRef[]
    setMetiers(metiersData)

    const activeArtisans = artisans.filter((artisan) => artisan.is_active !== false)

    const mapped = activeArtisans.map((artisan) =>
      mapArtisanToContact(artisan, referenceData.users as ReferenceUser[], statuses),
    )
    setContacts(mapped)
  }, [artisans, referenceData])

  // -----------------------------------------------------------------------
  // View-filtered contacts (client-side filters only)
  // -----------------------------------------------------------------------
  const viewFilteredContacts = useMemo(() => {
    if (!isReady || !activeView) return contacts

    if (clientFilters.length === 0) return contacts

    return contacts.filter((contact) => {
      return clientFilters.every((filter) => {
        if (filter.property === "gestionnaire_id") {
          if (filter.operator === "eq") {
            return contact.gestionnaire_id === filter.value
          }
        }
        return true
      })
    })
  }, [contacts, activeView, isReady, clientFilters])

  // -----------------------------------------------------------------------
  // Filter counts (delegated to separate hook)
  // -----------------------------------------------------------------------
  const {
    viewCounts,
    getContactCountByStatus,
    getContactCountByMetier,
  } = useArtisanFilterCounts({
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
  })

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const handleViewDetails = useCallback(
    (contact: Contact) => {
      artisanModal.open(contact.id)
    },
    [artisanModal],
  )

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)

  const handleDeleteContact = useCallback((contact: Contact) => {
    setContactToDelete(contact)
    setShowDeleteDialog(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!contactToDelete) return

    try {
      await artisansApi.delete(contactToDelete.id)
      queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: artisanKeys.detail(contactToDelete.id) })
      setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id))
      toast.success("Artisan supprime avec succes")
      setShowDeleteDialog(false)
      setContactToDelete(null)
    } catch (err) {
      console.error("Erreur lors de la suppression de l'artisan:", err)
      toast.error("Erreur lors de la suppression", {
        description: err instanceof Error ? err.message : "Une erreur est survenue",
      })
    }
  }, [contactToDelete, queryClient])

  const handleCancelDelete = useCallback(() => {
    setShowDeleteDialog(false)
    setContactToDelete(null)
  }, [])

  // -----------------------------------------------------------------------
  // Derived data for UI
  // -----------------------------------------------------------------------
  const allMetiers = metiers.map((m) => m.label)

  const metierColorMap = useMemo(() => {
    const map: Record<string, { color: string | null; label: string }> = {}
    metiers.forEach((m) => {
      if (m.code) {
        map[m.code] = { color: m.color, label: m.label }
      }
      map[m.label] = { color: m.color, label: m.label }
    })
    return map
  }, [metiers])

  const extendedStatuses = useMemo(() => {
    const virtualStatus: ArtisanStatus = {
      id: "__DOSSIER_A_COMPLETER__",
      code: "DOSSIER_A_COMPLETER",
      label: VIRTUAL_STATUS_DOSSIER_A_COMPLETER,
      color: "#F59E0B",
      is_active: true,
      is_virtual: true,
    }
    return [...artisanStatuses, virtualStatus]
  }, [artisanStatuses])

  // -----------------------------------------------------------------------
  // Filter UI state
  // -----------------------------------------------------------------------
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const [statusSearchQuery, setStatusSearchQuery] = useState("")
  const [metierFilterOpen, setMetierFilterOpen] = useState(false)
  const [metierSearchQuery, setMetierSearchQuery] = useState("")

  const hasStatusFilter = selectedStatuses.length > 0
  const activeStatuses = useMemo(
    () => extendedStatuses.filter((s) => selectedStatuses.includes(s.label)),
    [extendedStatuses, selectedStatuses],
  )

  const filteredStatuses = useMemo(() => {
    if (!statusSearchQuery.trim()) return extendedStatuses.filter((s) => s.is_active !== false)
    const query = statusSearchQuery.toLowerCase()
    return extendedStatuses.filter(
      (s) => s.is_active !== false && s.label.toLowerCase().includes(query),
    )
  }, [statusSearchQuery, extendedStatuses])

  const filteredMetiers = useMemo(() => {
    if (!metierSearchQuery.trim()) return allMetiers
    const query = metierSearchQuery.toLowerCase()
    return allMetiers.filter((m) => m.toLowerCase().includes(query))
  }, [metierSearchQuery, allMetiers])

  const hasMetierFilter = selectedMetiers.length > 0
  const activeMetiers = useMemo(
    () => allMetiers.filter((m) => selectedMetiers.includes(m)),
    [allMetiers, selectedMetiers],
  )

  const handleToggleStatus = useCallback((statusLabel: string, checked: boolean) => {
    setSelectedStatuses((prev) => {
      if (checked) return [...prev, statusLabel]
      return prev.filter((s) => s !== statusLabel)
    })
  }, [])

  const handleClearStatus = useCallback(() => {
    setSelectedStatuses([])
  }, [])

  const handleToggleMetier = useCallback((metier: string, checked: boolean) => {
    setSelectedMetiers((prev) => {
      if (checked) return [...prev, metier]
      return prev.filter((m) => m !== metier)
    })
  }, [])

  const handleClearMetier = useCallback(() => {
    setSelectedMetiers([])
  }, [])

  // -----------------------------------------------------------------------
  // Return value
  // -----------------------------------------------------------------------
  return {
    // permissions
    permissionsLoading,
    canReadArtisans,
    canWriteArtisans,
    canDeleteArtisans,

    // views
    views,
    activeViewId,
    setActiveView,
    isReady,
    viewCounts,

    // data
    viewFilteredContacts,
    loading,
    error,
    totalCount,
    totalPages,
    currentPage,
    searchTerm,
    setSearchTerm,

    // pagination
    goToPage,
    nextPage,
    previousPage,

    // actions
    handleViewDetails,
    handleDeleteContact,
    handleConfirmDelete,
    handleCancelDelete,
    showDeleteDialog,
    setShowDeleteDialog,
    contactToDelete,

    // metier color map
    metierColorMap,

    // filter dropdowns: status
    statusFilterOpen,
    setStatusFilterOpen,
    statusSearchQuery,
    setStatusSearchQuery,
    hasStatusFilter,
    activeStatuses,
    filteredStatuses,
    selectedStatuses,
    handleToggleStatus,
    handleClearStatus,
    getContactCountByStatus,

    // filter dropdowns: metier
    metierFilterOpen,
    setMetierFilterOpen,
    metierSearchQuery,
    setMetierSearchQuery,
    hasMetierFilter,
    activeMetiers,
    filteredMetiers,
    selectedMetiers,
    handleToggleMetier,
    handleClearMetier,
    getContactCountByMetier,
  }
}

export type ArtisanPageState = ReturnType<typeof useArtisanPageState>
