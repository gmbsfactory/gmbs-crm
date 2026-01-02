"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import type { ReactElement } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/artisans/Avatar"
import { useArtisansQuery } from "@/hooks/useArtisansQuery"
import type { ArtisanGetAllParams } from "@/lib/react-query/queryKeys"
import { useReferenceData } from "@/hooks/useReferenceData"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useArtisanViews } from "@/hooks/useArtisanViews"
import { ArtisanViewTabs } from "@/components/artisans/ArtisanViewTabs"
import type { Artisan as ApiArtisan } from "@/lib/supabase-api-v2"
import { getArtisanTotalCount, getArtisanCountWithFilters } from "@/lib/supabase-api-v2"
import { convertArtisanFiltersToServerFilters } from "@/lib/filter-converter"
import { Search, Eye, Edit, Trash2, Mail, Phone, X, Filter, ChevronDown, FileText } from "lucide-react"
import { PageSearchBar } from "@/components/ui/page-search-bar"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ArtisanContextMenuContent } from "@/components/artisans/ArtisanContextMenu"
import { cn } from "@/lib/utils"
import Loader from "@/components/ui/Loader"
import { Pagination } from "@/components/ui/pagination"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { getHighlightSegments } from "@/components/search/highlight"
import { useQueryClient } from "@tanstack/react-query"
import { artisansApi } from "@/lib/api/v2"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"

// Helper pour convertir hex en rgba
function hexToRgba(hex: string, alpha: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Style pour les badges avec couleur personnalisée
function computeBadgeStyle(color?: string | null) {
  if (!color) {
    return {
      backgroundColor: "#f1f5f9",
      color: "#0f172a",
      borderColor: "#e2e8f0",
    }
  }
  return {
    backgroundColor: hexToRgba(color, 0.28) ?? "#f1f5f9",
    color,
    borderColor: color,
  }
}

type Contact = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  position: string
  status: "Disponible" | "En_intervention" | "Indisponible" | "En_congé" | "Inactif"
  avatar: string
  photoProfilUrl?: string | null
  photoProfilMetadata?: {
    hash: string | null
    sizes: Record<string, string>
    mime_preferred: string
    baseUrl: string | null
  } | null
  artisanInitials?: string
  lastContact: string
  createdAt: string
  notes: string
  siret?: string
  statutJuridique?: string
  statutArtisan?: string
  statutArtisanColor?: string | null
  zoneIntervention?: string | number
  adresse?: string
  adresseIntervention?: string
  metiers?: string[]
  statutDossier?: string
  statutInactif?: boolean
  attribueA?: string
  gestionnaireInitials?: string
  gestionnaireColor?: string | null
  gestionnaire_id?: string | null
  gestionnaireAvatarUrl?: string | null
  gestionnaireFirstname?: string | null
  gestionnaireLastname?: string | null
}

type ReferenceUser = {
  id: string
  firstname: string | null
  lastname: string | null
  code_gestionnaire: string | null
  color?: string | null
  avatar_url?: string | null
}

const statusConfig = {
  Disponible: {
    label: "Disponible",
    color: "bg-green-100 text-green-700 border-green-200",
    activeColor: "bg-green-500 text-white",
  },
  En_intervention: {
    label: "En intervention",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    activeColor: "bg-yellow-500 text-white",
  },
  Indisponible: {
    label: "Indisponible",
    color: "bg-red-100 text-red-700 border-red-200",
    activeColor: "bg-red-500 text-white",
  },
  En_congé: {
    label: "En congé",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    activeColor: "bg-blue-500 text-white",
  },
  Inactif: {
    label: "Inactif",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    activeColor: "bg-gray-500 text-white",
  },
} as const

const dossierStatusConfig = {
  Actif: {
    label: "Actif",
    color: "bg-green-100 text-green-800",
  },
  En_cours: {
    label: "En cours",
    color: "bg-yellow-100 text-yellow-800",
  },
  Archivé: {
    label: "Archivé",
    color: "bg-gray-100 text-gray-800",
  },
  Suspendu: {
    label: "Suspendu",
    color: "bg-red-100 text-red-800",
  },
} as const

const mapArtisanToContact = (artisan: ApiArtisan, users: ReferenceUser[], artisanStatuses: any[]): Contact => {
  const raw = artisan as any
  const user = users.find((u) => u.id === artisan.gestionnaire_id)
  // Trouver le statut en utilisant l'ID du statut de l'artisan
  const artisanStatus = artisanStatuses.find((s) => s.id === artisan.statut_id)

  // Debug: vérifier si le statut est trouvé
  if (!artisanStatus && artisan.statut_id) {
    console.warn(`[mapArtisanToContact] Statut non trouvé pour artisan ${artisan.id}:`, {
      artisanStatutId: artisan.statut_id,
      availableStatusIds: artisanStatuses.map(s => s.id),
      availableStatusCodes: artisanStatuses.map(s => s.code),
    })
  }

  const zone = Array.isArray(raw.zones) && raw.zones.length > 0 ? raw.zones[0] : raw.zoneIntervention

  // Calculer les initiales du gestionnaire
  const gestionnaireInitials = user
    ? ((user.firstname?.[0] || '') + (user.lastname?.[0] || '')).toUpperCase() || user.code_gestionnaire?.substring(0, 2).toUpperCase() || '??'
    : '—'

  // Récupérer les métadonnées de la photo_profil depuis l'artisan (déjà mappées par mapArtisanRecord)
  const photoProfilUrl = artisan.photoProfilBaseUrl || null
  const photoProfilMetadata = artisan.photoProfilMetadata || null

  // Calculer les initiales de l'artisan
  const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
  const artisanInitials = artisanName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??"

  return {
    id: artisan.id,
    name: artisanName,
    email: artisan.email || "",
    phone: artisan.telephone || "",
    company: artisan.raison_sociale || "",
    position: Array.isArray(raw.metiers) ? raw.metiers.join(", ") : raw.metiers || "",
    status: (raw.statut_artisan ?? raw.status ?? "Disponible") as Contact["status"],
    avatar: photoProfilUrl || "/placeholder.svg",
    photoProfilUrl: photoProfilUrl,
    photoProfilMetadata: photoProfilMetadata,
    artisanInitials: artisanInitials,
    lastContact: raw.date_ajout || artisan.updated_at || "",
    createdAt: artisan.created_at || raw.date_ajout || "",
    notes: raw.commentaire || "",
    siret: artisan.siret || "",
    statutJuridique: artisan.statut_juridique || "",
    statutArtisan: artisanStatus?.label || "",
    statutArtisanColor: artisanStatus?.color || null,
    zoneIntervention: zone ?? "",
    adresse: `${artisan.adresse_siege_social || ""}, ${artisan.code_postal_siege_social || ""} ${artisan.ville_siege_social || ""}`.trim(),
    adresseIntervention: `${artisan.adresse_intervention || ""}, ${artisan.code_postal_intervention || ""} ${artisan.ville_intervention || ""}`.trim(),
    metiers: Array.isArray(raw.metiers) ? raw.metiers : raw.metiers ? [raw.metiers] : [],
    statutDossier: artisan.statutDossier || "",
    statutInactif: Boolean(raw.statut_inactif),
    attribueA: user ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.code_gestionnaire || "Non assigné" : "Non assigné",
    gestionnaireInitials,
    gestionnaireColor: user?.color || null,
    gestionnaire_id: artisan.gestionnaire_id ?? null,
    gestionnaireAvatarUrl: user?.avatar_url || null,
    gestionnaireFirstname: user?.firstname || null,
    gestionnaireLastname: user?.lastname || null,
  }
}

const getStatusColor = (status: Contact["status"]) => {
  const colors: Record<string, string> = {
    Disponible: "bg-green-100 text-green-800",
    En_intervention: "bg-yellow-100 text-yellow-800",
    Indisponible: "bg-red-100 text-red-800",
    En_congé: "bg-blue-100 text-blue-800",
    Inactif: "bg-gray-100 text-gray-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

const getDossierStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    Actif: "bg-green-100 text-green-800",
    En_cours: "bg-yellow-100 text-yellow-800",
    Archivé: "bg-gray-100 text-gray-800",
    Suspendu: "bg-red-100 text-red-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

// Constante pour le statut virtuel "Dossier à compléter"
const VIRTUAL_STATUS_DOSSIER_A_COMPLETER = "Dossier à compléter"

/** Helper pour rendre du texte avec surlignage des termes de recherche */
function HighlightedText({ text, searchQuery }: { text: string; searchQuery: string }) {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return <>{text}</>
  }
  const segments = getHighlightSegments(text, searchQuery)
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={segment.isMatch ? "search-highlight" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}

export default function ArtisansPage(): ReactElement {
  const { can, isLoading } = usePermissions()
  const artisanModal = useArtisanModal()
  const { views, activeView, activeViewId, setActiveView, isReady } = useArtisanViews()
  const queryClient = useQueryClient()

  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? undefined

  const canWriteArtisans = can("write_artisans")
  const canDeleteArtisans = can("delete_artisans")

  // État pour stocker les counts réels de chaque vue
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [viewCountsLoading, setViewCountsLoading] = useState(false)

  // État pour la pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [artisanStatuses, setArtisanStatuses] = useState<any[]>([])
  const [selectedMetiers, setSelectedMetiers] = useState<string[]>([])
  const [metiers, setMetiers] = useState<Array<{ id: string; code: string; label: string; color: string | null }>>([])

  // Convertir les filtres de la vue active en filtres serveur et y ajouter recherche + filtres UI
  const { serverFilters, clientFilters } = useMemo(() => {
    const baseFilters = activeView && activeView.filters.length > 0
      ? convertArtisanFiltersToServerFilters(activeView.filters, {
        currentUserId: currentUserId,
      })
      : { serverFilters: {}, clientFilters: [] }

    const combinedServerFilters: Partial<ArtisanGetAllParams> = {
      ...(baseFilters.serverFilters ?? {}),
    }

    const normalizedSearch = searchTerm.trim()
    if (normalizedSearch) {
      combinedServerFilters.search = normalizedSearch
    }

    // Séparer les statuts réels du statut virtuel
    const realStatuses = selectedStatuses.filter(
      label => label !== VIRTUAL_STATUS_DOSSIER_A_COMPLETER
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

    // Si "Dossier à compléter" est sélectionné, ajouter le filtre statut_dossier
    if (hasDossierFilter) {
      combinedServerFilters.statut_dossier = "À compléter"
    }

    if (selectedMetiers.length > 0 && metiers.length > 0) {
      // Convertir les labels de métiers en IDs
      const metierIds = metiers
        .filter((metier) => metier.label && selectedMetiers.includes(metier.label))
        .map((metier) => metier.id)
        .filter((metierId): metierId is string => Boolean(metierId))

      if (metierIds.length > 0) {
        combinedServerFilters.metiers = metierIds
      } else {
        // Debug: vérifier pourquoi la conversion échoue
        console.warn("[ArtisansPage] Aucun ID trouvé pour les métiers sélectionnés:", {
          selectedMetiers,
          availableMetiers: metiers.map(m => ({ id: m.id, label: m.label })),
        })
      }
    }

    const hasServerFilters = Object.keys(combinedServerFilters).length > 0

    return {
      serverFilters: hasServerFilters ? combinedServerFilters : undefined,
      clientFilters: baseFilters.clientFilters,
    }
  }, [activeView, currentUserId, searchTerm, selectedStatuses, selectedMetiers, artisanStatuses, metiers])

  // Réinitialiser à la page 1 quand la vue active change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeViewId])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatuses, selectedMetiers])

  // Fonction pour convertir ArtisanViewFilter en paramètres API pour le comptage
  const convertFiltersToApiParams = useCallback(
    (filters: Array<{ property: string; operator: string; value?: string | null }>): {
      gestionnaire?: string
      statut?: string
      statuts?: string[]
      statut_dossier?: string
    } => {
      const params: {
        gestionnaire?: string
        statut?: string
        statuts?: string[]
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
            // Pour l'opérateur "in", la valeur pourrait être un tableau sérialisé
            try {
              const parsed = JSON.parse(filter.value)
              if (Array.isArray(parsed)) {
                params.statuts = parsed
              }
            } catch {
              // Si ce n'est pas du JSON valide, ignorer
            }
          }
        }
      }

      return params
    },
    [currentUserId]
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

  // Charger les counts réels pour toutes les vues
  useEffect(() => {
    if (!isReady || views.length === 0) return
    if (requiresCurrentUserForCounts && !currentUserId) {
      return
    }

    let cancelled = false
    setViewCountsLoading(true)

    const loadCounts = async () => {
      const counts: Record<string, number> = {}

      // Charger les counts en parallèle pour toutes les vues
      const countPromises = views.map(async (view) => {
        try {
          // Convertir les filtres de la vue en paramètres API
          const apiParams = convertFiltersToApiParams(view.filters)

          // Utiliser getArtisanCountWithFilters qui supporte tous les filtres (gestionnaire, statut_dossier, etc.)
          const count = await getArtisanCountWithFilters(apiParams)

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

  const {
    artisans,
    loading: artisansLoading,
    error: artisansError,
    totalCount,
    totalPages,
    refresh,
  } = useArtisansQuery({
    limit: 100, // ✅ Limite fixe de 100
    autoLoad: true,
    serverFilters, // ✅ Passer les filtres serveur ici
    page: currentPage,
    viewId: activeViewId,
  })

  // Gestion de la pagination
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }, [totalPages])

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const previousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }, [])

  const {
    data: referenceData,
    loading: referenceLoading,
    error: referenceError,
  } = useReferenceData()

  const loading = artisansLoading || referenceLoading
  const error = artisansError || referenceError

  // Appliquer les filtres depuis sessionStorage (pour les liens du dashboard)
  useEffect(() => {
    if (!isReady || artisanStatuses.length === 0) return

    const pendingFilterStr = sessionStorage.getItem('pending-artisan-filter')
    if (pendingFilterStr) {
      try {
        const pendingFilter = JSON.parse(pendingFilterStr)

        // Activer la vue spécifiée (ex: "ma-liste-artisans")
        if (pendingFilter.viewId && views.some(v => v.id === pendingFilter.viewId)) {
          setActiveView(pendingFilter.viewId)
        }

        // Activer le filtre de statut spécifié (ex: "Potentiel")
        if (pendingFilter.statusFilter) {
          // Trouver le statut correspondant dans la liste des statuts d'artisans
          const statusLabel = pendingFilter.statusFilter
          // Vérifier si le statut existe dans la liste des statuts disponibles (réels ou virtuels)
          const statusExists = artisanStatuses.some(s => s.label === statusLabel) ||
            statusLabel === VIRTUAL_STATUS_DOSSIER_A_COMPLETER
          if (statusExists) {
            setSelectedStatuses([statusLabel])
          }
        }

        // Nettoyer sessionStorage après avoir appliqué les filtres
        sessionStorage.removeItem('pending-artisan-filter')
      } catch (error) {
        console.error("Erreur lors de l'application du filtre depuis sessionStorage:", error)
        sessionStorage.removeItem('pending-artisan-filter')
      }
    }
  }, [isReady, views, setActiveView, artisanStatuses])

  useEffect(() => {
    if (!referenceData) return
    const statuses = referenceData.artisanStatuses || []
    setArtisanStatuses(statuses)
    const metiersData = referenceData.metiers || []
    setMetiers(metiersData)

    // Filtrer uniquement les artisans actifs (is_active === true)
    const activeArtisans = artisans.filter((artisan) => artisan.is_active !== false)

    // Les artisans sont déjà triés par created_at DESC côté serveur (dans artisansApi.getAll)
    // On n'a pas besoin de re-trier ici, on garde l'ordre du serveur
    const mapped = activeArtisans.map((artisan) =>
      mapArtisanToContact(
        artisan,
        referenceData.users as ReferenceUser[],
        statuses
      )
    )
    setContacts(mapped)
  }, [artisans, referenceData])

  // Note: Les mises à jour d'artisans sont maintenant gérées automatiquement par TanStack Query
  // via les mutations qui invalident les queries appropriées
  // Le cache React Query sera automatiquement mis à jour lors des modifications

  // Appliquer les filtres de la vue active (uniquement les filtres client)
  const viewFilteredContacts = useMemo(() => {
    if (!isReady || !activeView) return contacts

    // Si pas de filtres client, retourner directement
    if (clientFilters.length === 0) {
      return contacts
    }

    // Appliquer uniquement les filtres client
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

  // Utiliser viewCounts (counts réels depuis BDD) au lieu de calculer localement

  const handleEditContact = useCallback((contact: Contact) => {
    artisanModal.openEdit(contact.id)
  }, [artisanModal])

  const handleViewDetails = useCallback((contact: Contact) => {
    artisanModal.open(contact.id)
  }, [artisanModal])

  // État pour le dialogue de confirmation de suppression
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)

  const handleDeleteContact = useCallback((contact: Contact) => {
    // Ouvrir le dialogue au lieu d'utiliser window.confirm
    setContactToDelete(contact)
    setShowDeleteDialog(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!contactToDelete) return

    try {
      // Appel API pour supprimer l'artisan (soft delete)
      await artisansApi.delete(contactToDelete.id)

      // Invalider le cache pour forcer le rechargement des données
      queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: artisanKeys.detail(contactToDelete.id) })

      // Mise à jour optimiste de l'état local
      setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id))

      toast.success("Artisan supprimé avec succès")

      // Fermer le dialogue
      setShowDeleteDialog(false)
      setContactToDelete(null)
    } catch (error) {
      console.error("Erreur lors de la suppression de l'artisan:", error)
      toast.error("Erreur lors de la suppression", {
        description: error instanceof Error ? error.message : "Une erreur est survenue"
      })
    }
  }, [contactToDelete, queryClient])

  const handleCancelDelete = useCallback(() => {
    setShowDeleteDialog(false)
    setContactToDelete(null)
  }, [])

  const handleSendEmail = useCallback((contact: Contact) => {
    console.log("Send email to:", contact.email)
  }, [])

  const handleCall = useCallback((contact: Contact) => {
    console.log("Call:", contact.phone)
  }, [])

  // Compteurs avec filtres serveur appliqués
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [metierCounts, setMetierCounts] = useState<Record<string, number>>({})
  const [filterCountsLoading, setFilterCountsLoading] = useState(false)

  // Charger les compteurs pour chaque statut avec les filtres appliqués
  useEffect(() => {
    if (!isReady || !referenceData || artisanStatuses.length === 0) return

    let cancelled = false
    setFilterCountsLoading(true)

    const loadCounts = async () => {
      try {
        // Base filters (vue active)
        const baseFilters = activeView && activeView.filters.length > 0
          ? convertArtisanFiltersToServerFilters(activeView.filters, {
            currentUserId: currentUserId,
          })
          : { serverFilters: {}, clientFilters: [] }

        const baseServerFilters = baseFilters.serverFilters ?? {}
        const searchFilter = searchTerm.trim() ? { search: searchTerm.trim() } : {}

        // Inclure les filtres de métier sélectionnés dans les compteurs de statut
        const metierFilter = selectedMetiers.length > 0
          ? {
            metiers: metiers
              .filter((metier) => selectedMetiers.includes(metier.label))
              .map((metier) => metier.id)
              .filter((metierId): metierId is string => Boolean(metierId)),
          }
          : {}

        // Compter pour chaque statut
        const statusCountPromises = artisanStatuses
          .filter((s) => s.is_active !== false)
          .map(async (status) => {
            const countParams = {
              ...baseServerFilters,
              ...searchFilter,
              ...metierFilter,
              statuts: [status.id],
            }
            const count = await getArtisanCountWithFilters(countParams)
            return { statusLabel: status.label, count }
          })

        const statusCountResults = await Promise.all(statusCountPromises)
        const statusCountsMap: Record<string, number> = {}
        statusCountResults.forEach(({ statusLabel, count }) => {
          statusCountsMap[statusLabel] = count
        })

        // Compter pour le statut virtuel "Dossier à compléter"
        const dossierCountParams = {
          ...baseServerFilters,
          ...searchFilter,
          ...metierFilter,
          statut_dossier: "À compléter",
        }
        const dossierCount = await getArtisanCountWithFilters(dossierCountParams)
        statusCountsMap[VIRTUAL_STATUS_DOSSIER_A_COMPLETER] = dossierCount

        if (!cancelled) {
          setStatusCounts(statusCountsMap)
        }

        // Inclure les filtres de statut sélectionnés dans les compteurs de métier
        const statusFilter = selectedStatuses.length > 0
          ? {
            statuts: artisanStatuses
              .filter((status) => selectedStatuses.includes(status.label))
              .map((status) => status.id)
              .filter((statusId): statusId is string => Boolean(statusId)),
          }
          : {}

        // Compter pour chaque métier
        const metierCountPromises = metiers.map(async (metier) => {
          const countParams = {
            ...baseServerFilters,
            ...searchFilter,
            ...statusFilter,
            metiers: [metier.id],
          }
          const count = await getArtisanCountWithFilters(countParams)
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
      } catch (error) {
        console.error("Erreur lors du chargement des compteurs:", error)
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
    (status: string) => {
      return statusCounts[status] ?? 0
    },
    [statusCounts],
  )

  const getContactCountByMetier = useCallback(
    (metier: string) => {
      return metierCounts[metier] ?? 0
    },
    [metierCounts],
  )

  // Utiliser les métiers de referenceData au lieu de ceux des contacts
  const allMetiers = metiers.map((m) => m.label)

  // Map (code ou label) → { color, label } pour les métiers (pour afficher les badges colorés)
  // Les métiers dans contact.metiers peuvent être des codes OU des labels
  const metierColorMap = useMemo(() => {
    const map: Record<string, { color: string | null; label: string }> = {}
    metiers.forEach((m) => {
      // Mapper par code ET par label pour couvrir les deux cas
      if (m.code) {
        map[m.code] = { color: m.color, label: m.label }
      }
      map[m.label] = { color: m.color, label: m.label }
    })
    return map
  }, [metiers])

  // Liste des statuts avec le statut virtuel "Dossier à compléter"
  const extendedStatuses = useMemo(() => {
    const virtualStatus = {
      id: '__DOSSIER_A_COMPLETER__',
      code: 'DOSSIER_A_COMPLETER',
      label: VIRTUAL_STATUS_DOSSIER_A_COMPLETER,
      color: '#F59E0B', // Couleur ambre/orange
      is_active: true,
      is_virtual: true, // Marqueur pour identifier les statuts virtuels
    }
    return [...artisanStatuses, virtualStatus]
  }, [artisanStatuses])

  // États pour les filtres
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const [statusSearchQuery, setStatusSearchQuery] = useState("")
  const [metierFilterOpen, setMetierFilterOpen] = useState(false)
  const [metierSearchQuery, setMetierSearchQuery] = useState("")

  // Filtres calculés
  const hasStatusFilter = selectedStatuses.length > 0
  const activeStatuses = useMemo(() =>
    extendedStatuses.filter(s => selectedStatuses.includes(s.label)),
    [extendedStatuses, selectedStatuses]
  )

  const filteredStatuses = useMemo(() => {
    if (!statusSearchQuery.trim()) return extendedStatuses.filter(s => s.is_active !== false)
    const query = statusSearchQuery.toLowerCase()
    return extendedStatuses.filter(s =>
      s.is_active !== false && s.label.toLowerCase().includes(query)
    )
  }, [statusSearchQuery, extendedStatuses])

  const filteredMetiers = useMemo(() => {
    if (!metierSearchQuery.trim()) return allMetiers
    const query = metierSearchQuery.toLowerCase()
    return allMetiers.filter((m) => m.toLowerCase().includes(query))
  }, [metierSearchQuery, allMetiers])

  const hasMetierFilter = selectedMetiers.length > 0
  const activeMetiers = useMemo(() =>
    allMetiers.filter((m) => selectedMetiers.includes(m)),
    [allMetiers, selectedMetiers]
  )

  const statusSelectionSummary = useMemo(() => {
    if (activeStatuses.length === 0) return "Choisir…"
    if (activeStatuses.length <= 2) {
      return activeStatuses.map((s) => s.label).join(", ")
    }
    const [first, second] = activeStatuses
    return `${first.label}, ${second.label} (+${activeStatuses.length - 2})`
  }, [activeStatuses])

  const metierSelectionSummary = useMemo(() => {
    if (activeMetiers.length === 0) return "Choisir…"
    if (activeMetiers.length <= 2) {
      return activeMetiers.join(", ")
    }
    const [first, second] = activeMetiers
    return `${first}, ${second} (+${activeMetiers.length - 2})`
  }, [activeMetiers])

  const handleToggleStatus = useCallback((statusLabel: string, checked: boolean) => {
    setSelectedStatuses((prev) => {
      if (checked) {
        return [...prev, statusLabel]
      } else {
        return prev.filter((s) => s !== statusLabel)
      }
    })
  }, [])

  const handleClearStatus = useCallback(() => {
    setSelectedStatuses([])
  }, [])

  const handleToggleMetier = useCallback((metier: string, checked: boolean) => {
    setSelectedMetiers((prev) => {
      if (checked) {
        return [...prev, metier]
      } else {
        return prev.filter((m) => m !== metier)
      }
    })
  }, [])

  const handleClearMetier = useCallback(() => {
    setSelectedMetiers([])
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    )
  }

  if (!can("read_artisans")) {
    return <AccessDenied permission="read_artisans" />
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-6">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold text-red-600">Erreur de chargement</h2>
            <p className="mb-4 text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div style={{ transform: 'scale(1.25)' }}>
          <Loader />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 space-y-0 px-6 pt-4 pb-2 overflow-hidden flex flex-col min-h-0">
        {/* Sélection des vues et filtres sur la même ligne */}
        {isReady && (
          <div className="flex items-center justify-between gap-4 flex-shrink-0">
            <ArtisanViewTabs
              views={views}
              activeViewId={activeViewId}
              onSelect={setActiveView}
              artisanCounts={{
                ...viewCounts,
                // Mettre à jour le count de la vue active avec le totalCount filtré
                ...(activeViewId && totalCount !== undefined ? { [activeViewId]: totalCount } : {}),
              }}
            />

            {/* Barre de recherche et filtres */}
            <div className="flex items-center gap-3">
              {/* Filtre Statut */}
              <DropdownMenu open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      hasStatusFilter ? "bg-primary/10 text-primary" : "hover:bg-muted/80",
                    )}
                  >
                    <span className="truncate">Statut</span>
                    <span className="ml-auto flex items-center gap-0.5 text-muted-foreground">
                      {hasStatusFilter ? <Filter className="h-3.5 w-3.5" /> : null}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-72">
                  <div className="space-y-3 p-2">
                    <div className="text-sm font-semibold text-foreground">Filtrer par statut</div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={statusSearchQuery}
                          onChange={(e) => setStatusSearchQuery(e.target.value)}
                          placeholder="Rechercher..."
                          className="pl-8"
                        />
                      </div>
                      <ScrollArea className="h-[400px] w-full rounded-md border">
                        <div className="space-y-1 p-1">
                          {filteredStatuses.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-muted-foreground">Aucun résultat</div>
                          ) : (
                            filteredStatuses.map((status) => {
                              const isSelected = selectedStatuses.includes(status.label)
                              return (
                                <label
                                  key={status.id}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/70"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleToggleStatus(status.label, Boolean(checked))}
                                  />
                                  <span className="truncate flex-1">
                                    {status.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({getContactCountByStatus(status.label)})
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>
                      {activeStatuses.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                          {activeStatuses.map((status) => (
                            <Badge key={status.id} variant="secondary" className="flex items-center gap-1">
                              <span className="truncate max-w-[120px]">{status.label}</span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                                onClick={() => handleToggleStatus(status.label, false)}
                                aria-label={`Retirer ${status.label}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={handleClearStatus}>
                            Tout effacer
                          </Button>
                        </div>
                      )}
                      {activeStatuses.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {activeStatuses.length} {activeStatuses.length === 1 ? "élément sélectionné" : "éléments sélectionnés"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusFilterOpen(false)}
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtre Métier */}
              <DropdownMenu open={metierFilterOpen} onOpenChange={setMetierFilterOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      hasMetierFilter ? "bg-primary/10 text-primary" : "hover:bg-muted/80",
                    )}
                  >
                    <span className="truncate">Métier</span>
                    <span className="ml-auto flex items-center gap-0.5 text-muted-foreground">
                      {hasMetierFilter ? <Filter className="h-3.5 w-3.5" /> : null}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-72">
                  <div className="space-y-3 p-2">
                    <div className="text-sm font-semibold text-foreground">Filtrer par métier</div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={metierSearchQuery}
                          onChange={(e) => setMetierSearchQuery(e.target.value)}
                          placeholder="Rechercher..."
                          className="pl-8"
                        />
                      </div>
                      <ScrollArea className="h-[400px] w-full rounded-md border">
                        <div className="space-y-1 p-1">
                          {filteredMetiers.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-muted-foreground">Aucun résultat</div>
                          ) : (
                            filteredMetiers.map((metier) => {
                              const isSelected = selectedMetiers.includes(metier)
                              return (
                                <label
                                  key={metier}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/70"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleToggleMetier(metier, Boolean(checked))}
                                  />
                                  <span className="truncate flex-1">{metier}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({getContactCountByMetier(metier)})
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>
                      {activeMetiers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                          {activeMetiers.map((metier) => (
                            <Badge key={metier} variant="secondary" className="flex items-center gap-1">
                              <span className="truncate max-w-[120px]">{metier}</span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                                onClick={() => handleToggleMetier(metier, false)}
                                aria-label={`Retirer ${metier}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={handleClearMetier}>
                            Tout effacer
                          </Button>
                        </div>
                      )}
                      {activeMetiers.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {activeMetiers.length} {activeMetiers.length === 1 ? "élément sélectionné" : "éléments sélectionnés"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMetierFilterOpen(false)}
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Barre de recherche style topbar avec raccourci Cmd+F */}
              <PageSearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Rechercher artisans..."
                enableShortcut
                shortcutId="artisans"
              />
            </div>
          </div>
        )}

        {/* Zone de contenu avec scroll */}
        <div className="flex flex-col flex-1 min-h-0">
          <Card className="border-2 shadow-sm flex flex-col flex-1 min-h-0 rounded-tl-none border-t-primary/40">
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              <div className="overflow-auto flex-1 min-h-0">
                <table className="min-w-full divide-y-2 divide-border text-xs">
                  <thead className="sticky top-0 z-10 bg-primary/15 border-b-2 border-primary/40">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary w-[140px]">Artisan</th>
                      <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">Entreprise</th>
                      <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">Métier</th>
                      <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">Contact</th>
                      <th className="px-2.5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-primary">Gest.</th>
                      <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">Adresse siège</th>
                      <th className="px-2.5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-primary w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {viewFilteredContacts.map((contact, index) => (
                      <ContextMenu key={contact.id}>
                        <ContextMenuTrigger asChild>
                          <tr className={`hover:bg-slate-100/60 dark:hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50 dark:bg-muted/10'}`}>
                            <td className="px-2.5 py-1.5">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  photoProfilMetadata={contact.photoProfilMetadata}
                                  initials={contact.artisanInitials || "??"}
                                  name={contact.name}
                                  size={40}
                                  priority={index < 3}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-medium truncate" title={contact.name}><HighlightedText text={contact.name} searchQuery={searchTerm} /></span>
                                      <span className="text-[10px] text-muted-foreground">Zone {contact.zoneIntervention ?? "—"}</span>
                                    </div>
                                    <div className="flex items-center flex-shrink-0">
                                      {(contact.statutDossier === "À compléter" || contact.statutDossier === "à compléter" || contact.statutDossier === "A compléter" || contact.statutDossier === "a compléter") ? (
                                        <Badge
                                          variant="outline"
                                          className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                                          style={{
                                            backgroundColor: hexToRgba('#EF4444', 0.15) || '#EF444420',
                                            color: '#EF4444',
                                            borderColor: '#EF4444',
                                          }}
                                        >
                                          Dossier Incomplet
                                        </Badge>
                                      ) : (
                                        <>
                                          {contact.statutArtisan && contact.statutArtisanColor && (
                                            <Badge
                                              variant="outline"
                                              className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                                              style={{
                                                backgroundColor: hexToRgba(contact.statutArtisanColor, 0.15) || contact.statutArtisanColor + '20',
                                                color: contact.statutArtisanColor,
                                                borderColor: contact.statutArtisanColor,
                                              }}
                                            >
                                              {contact.statutArtisan}
                                            </Badge>
                                          )}
                                          {contact.statutArtisan && !contact.statutArtisanColor && (
                                            <Badge
                                              variant="outline"
                                              className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 border-gray-300"
                                            >
                                              {contact.statutArtisan}
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 max-w-[180px]">
                              <div className="space-y-0.5">
                                <div className="font-medium truncate" title={`${contact.company || "—"}${contact.statutJuridique ? ` / ${contact.statutJuridique}` : ""}`}>
                                  <HighlightedText text={contact.company || "—"} searchQuery={searchTerm} />
                                  {contact.statutJuridique && (
                                    <span className="text-muted-foreground"> / {contact.statutJuridique}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 max-w-[160px]">
                              <div className="flex flex-wrap gap-1">
                                {contact.metiers && contact.metiers.length > 0 ? (
                                  contact.metiers.slice(0, 2).map((metierKey, idx) => {
                                    const metierInfo = metierColorMap[metierKey]
                                    const color = metierInfo?.color
                                    const displayLabel = metierInfo?.label || metierKey
                                    return (
                                      <Badge
                                        key={idx}
                                        variant="outline"
                                        className="px-1.5 py-0 text-[9px] font-medium border whitespace-nowrap"
                                        style={color ? {
                                          backgroundColor: hexToRgba(color, 0.15) || `${color}20`,
                                          color: color,
                                          borderColor: color,
                                        } : undefined}
                                        title={displayLabel}
                                      >
                                        {displayLabel}
                                      </Badge>
                                    )
                                  })
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                                {contact.metiers && contact.metiers.length > 2 && (
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0 text-[9px] font-medium border"
                                    title={contact.metiers.slice(2).map(k => metierColorMap[k]?.label || k).join(", ")}
                                  >
                                    +{contact.metiers.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 max-w-[140px]">
                              <div className="space-y-0.5 text-muted-foreground">
                                <div className="flex items-center gap-1.5 truncate" title={contact.email || "—"}>
                                  <Mail className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate"><HighlightedText text={contact.email || "—"} searchQuery={searchTerm} /></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span><HighlightedText text={contact.phone || "—"} searchQuery={searchTerm} /></span>
                                </div>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5">
                              <div className="flex items-center justify-center">
                                <GestionnaireBadge
                                  firstname={contact.gestionnaireFirstname}
                                  lastname={contact.gestionnaireLastname}
                                  color={contact.gestionnaireColor}
                                  avatarUrl={contact.gestionnaireAvatarUrl}
                                  size="sm"
                                />
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-muted-foreground max-w-[200px]">
                              <span className="line-clamp-2" title={contact.adresse || "—"}>
                                <HighlightedText text={contact.adresse || "—"} searchQuery={searchTerm} />
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5">
                              <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(contact)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {canWriteArtisans && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditContact(contact)}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canDeleteArtisans && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDeleteContact(contact)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ArtisanContextMenuContent
                          artisanId={contact.id}
                          isArchived={contact.statutInactif || contact.statutDossier === "Archivé"}
                        />
                      </ContextMenu>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalCount && totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={100}
              onPageChange={goToPage}
              onNext={nextPage}
              onPrevious={previousPage}
              canGoNext={currentPage < totalPages}
              canGoPrevious={currentPage > 1}
              className="border-t bg-background mt-2"
            />
          )}
        </div>
      </div>

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onEscapeKeyDown={handleCancelDelete}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est destructive. Êtes-vous sûr de vouloir supprimer l&apos;artisan &quot;{contactToDelete?.name}&quot; ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">
          Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <p className="text-xs text-muted-foreground">Permission requise : {permission}</p>
      </div>
    </div>
  )
}
