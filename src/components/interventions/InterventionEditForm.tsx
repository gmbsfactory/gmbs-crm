"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload, X, Search, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { DocumentManager } from "@/components/documents/DocumentManager"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { useReferenceData } from "@/hooks/useReferenceData"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { interventionsApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import type { Intervention, UpdateInterventionData } from "@/lib/api/v2/common/types"
import type { InterventionWithStatus } from "@/types/intervention"
import { supabase } from "@/lib/supabase-client"
import { useInterventionsMutations } from "@/hooks/useInterventionsMutations"
import { getReasonTypeForTransition, type StatusReasonType } from "@/lib/comments/statusReason"
import { cn } from "@/lib/utils"
import { ArtisanSearchModal, type ArtisanSearchResult } from "@/components/artisans/ArtisanSearchModal"
import { Avatar } from "@/components/artisans/Avatar"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { toast } from "sonner"

const INTERVENTION_DOCUMENT_KINDS = [
  { kind: "devis", label: "Devis" },
  { kind: "facturesGMBS", label: "Facture GMBS" },
  { kind: "facturesMateriel", label: "Facture Matériel" },
  { kind: "photos", label: "Photos" },
  { kind: "facturesArtisans", label: "Facture Artisan" },
]

const MAX_RADIUS_KM = 10000

const AGENCIES_WITH_OPTIONAL_REFERENCE = new Set(["imodirect", "afedim", "oqoro"])
const STATUSES_REQUIRING_DATE_PREVUE = new Set(["VISITE_TECHNIQUE", "EN_COURS", "INTER_EN_COURS"])
const STATUSES_REQUIRING_DEFINITIVE_ID = new Set([
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "EN_COURS",
  "INTER_EN_COURS",
  "TERMINE",
  "INTER_TERMINEE",
  "STAND_BY",
])

const formatDistanceKm = (value: number) => {
  if (!Number.isFinite(value)) return "—"
  if (value < 1) return "< 1 km"
  if (value < 10) return `${value.toFixed(1)} km`
  return `${Math.round(value)} km`
}

function hexToRgba(hex: string, alpha: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface InterventionEditFormProps {
  intervention: Intervention & { tenants?: any; owner?: any; intervention_artisans?: any[]; intervention_costs?: any[]; intervention_payments?: any[] }
  onSuccess?: (data: any) => void
  onCancel?: () => void
  mode?: "halfpage" | "centerpage" | "fullpage"
  formRef?: React.RefObject<HTMLFormElement | null>
  onSubmittingChange?: (isSubmitting: boolean) => void
}

export function InterventionEditForm({
  intervention,
  onSuccess,
  onCancel,
  mode = "centerpage",
  formRef,
  onSubmittingChange
}: InterventionEditFormProps) {
  const { data: refData, loading: refDataLoading } = useReferenceData()
  const queryClient = useQueryClient()
  const { update: updateMutation } = useInterventionsMutations()
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{
    id: string
    displayName: string
    code: string | null
    color: string | null
    roles: string[]
  } | null>(null)
  const [pendingReasonType, setPendingReasonType] = useState<StatusReasonType | null>(null)

  // Extraire les coûts et paiements
  const costs = intervention.intervention_costs || []
  const payments = intervention.intervention_payments || []
  const sstCost = costs.find(c => c.cost_type === 'sst')
  const materielCost = costs.find(c => c.cost_type === 'materiel')
  const interventionCost = costs.find(c => c.cost_type === 'intervention')
  const sstPayment = payments.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = payments.find(p => p.payment_type === 'acompte_client')

  // Artisans liés
  const artisans = intervention.intervention_artisans || []
  const primaryArtisan = artisans.find(a => a.is_primary)?.artisans

  const [formData, setFormData] = useState({
    // Champs principaux
    statut_id: intervention.statut_id || "",
    id_inter: intervention.id_inter || "",
    agence_id: intervention.agence_id || "",
    reference_agence: intervention.reference_agence || "",
    assigned_user_id: intervention.assigned_user_id || "",
    metier_id: intervention.metier_id || "",
    contexte_intervention: intervention.contexte_intervention || "",
    consigne_intervention: intervention.consigne_intervention || "",

    // Adresse
    adresse: intervention.adresse || "",
    code_postal: intervention.code_postal || "",
    ville: intervention.ville || "",
    latitude: intervention.latitude || 48.8566,
    longitude: intervention.longitude || 2.3522,
    adresseComplete: [intervention.adresse, intervention.code_postal, intervention.ville]
      .filter(Boolean)
      .join(", ") || "Paris, France",

    // Dates
    date: intervention.date?.split('T')[0] || "",
    date_prevue: intervention.date_prevue?.split('T')[0] || "",

    // SST
    numero_sst: intervention.numero_sst || "",
    pourcentage_sst: intervention.pourcentage_sst?.toString() || "",

    // Commentaires
    consigne_second_artisan: intervention.consigne_second_artisan || "",
    commentaire_agent: intervention.commentaire_agent || "",

    // Propriétaire (owner)
    nomProprietaire: intervention.owner?.owner_lastname || "",
    prenomProprietaire: intervention.owner?.owner_firstname || "",
    telephoneProprietaire: intervention.owner?.telephone || "",
    emailProprietaire: intervention.owner?.email || "",

    // Client (tenant)
    nomClient: intervention.tenants?.lastname || "",
    prenomClient: intervention.tenants?.firstname || "",
    telephoneClient: intervention.tenants?.telephone || "",
    emailClient: intervention.tenants?.email || "",

    // Artisan
    artisan: primaryArtisan ? `${primaryArtisan.prenom || ''} ${primaryArtisan.nom || ''}`.trim() : "",
    artisanTelephone: primaryArtisan?.telephone || "",
    artisanEmail: primaryArtisan?.email || "",

    // Coûts
    coutSST: sstCost?.amount?.toString() || "",
    coutMateriel: materielCost?.amount?.toString() || "",
    coutIntervention: interventionCost?.amount?.toString() || "",

    // Acomptes
    accompteSST: sstPayment?.amount?.toString() || "",
    accompteSSTRecu: sstPayment?.is_received || false,
    dateAccompteSSTRecu: sstPayment?.payment_date?.split('T')[0] || "",
    accompteClient: clientPayment?.amount?.toString() || "",
    accompteClientRecu: clientPayment?.is_received || false,
    dateAccompteClientRecu: clientPayment?.payment_date?.split('T')[0] || "",
  })
  const isStatusReasonModalOpen = pendingReasonType !== null
  const [perimeterKmInput, setPerimeterKmInput] = useState("50")
  const perimeterKmValue = useMemo(() => {
    const parsed = Number.parseFloat(perimeterKmInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 50
    }
    return Math.min(parsed, MAX_RADIUS_KM)
  }, [perimeterKmInput])
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(primaryArtisan?.id ?? null)
  const primaryArtisanIdRef = useRef<string | null>(primaryArtisan?.id ?? null)

  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions: locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocode: geocodeQuery,
  } = useGeocodeSearch({ initialQuery: "" }) // Ne pas initialiser avec l'adresse
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProprietaireOpen, setIsProprietaireOpen] = useState(false)
  const [isAccompteOpen, setIsAccompteOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number } | null>(null)
  const { open: openArtisanModal } = useArtisanModal()
  const {
    artisans: nearbyArtisans,
    loading: isLoadingNearbyArtisans,
    error: nearbyArtisansError,
  } = useNearbyArtisans(formData.latitude, formData.longitude, {
    limit: 100,
    maxDistanceKm: perimeterKmValue,
    sampleSize: 400,
    metier_id: formData.metier_id || null,
  })
  const selectedArtisanData = useMemo(
    () => (selectedArtisanId ? nearbyArtisans.find((artisan) => artisan.id === selectedArtisanId) ?? null : null),
    [selectedArtisanId, nearbyArtisans],
  )

  // Trier les artisans : archivés en bas
  const sortedNearbyArtisans = useMemo(() => {
    if (!refData?.artisanStatuses) return nearbyArtisans

    // Trouver les IDs des statuts ARCHIVE et ARCHIVER
    const archiveStatuses = refData.artisanStatuses.filter(
      (s) => s.code === "ARCHIVE" || s.code === "ARCHIVER"
    )
    if (archiveStatuses.length === 0) return nearbyArtisans

    const archiveStatusIds = new Set(archiveStatuses.map((s) => s.id))

    // Séparer les artisans archivés et non archivés
    const nonArchived = nearbyArtisans.filter(
      (artisan) => !artisan.statut_id || !archiveStatusIds.has(artisan.statut_id)
    )
    const archived = nearbyArtisans.filter(
      (artisan) => artisan.statut_id && archiveStatusIds.has(artisan.statut_id)
    )

    // Retourner : non archivés d'abord (triés par distance), puis archivés (triés par distance)
    return [...nonArchived, ...archived]
  }, [nearbyArtisans, refData?.artisanStatuses])

  const mapMarkers = useMemo(() => {
    if (!refData?.artisanStatuses) {
      // Fallback si pas de refData
      return nearbyArtisans.map((artisan) => ({
        id: artisan.id,
        lat: artisan.lat,
        lng: artisan.lng,
        color: artisan.id === selectedArtisanData?.id ? "#f97316" : "#2563eb",
        title: artisan.displayName,
      }))
    }

    // Trouver les IDs des statuts ARCHIVE et ARCHIVER
    const archiveStatuses = refData.artisanStatuses.filter(
      (s) => s.code === "ARCHIVE" || s.code === "ARCHIVER"
    )
    const archiveStatusIds = new Set(archiveStatuses.map((s) => s.id))

    const markers = nearbyArtisans.map((artisan) => {
      // Si l'artisan est archivé (ARCHIVE ou ARCHIVER), utiliser la couleur grise
      const isArchived =
        artisan.statut_id && archiveStatusIds.has(artisan.statut_id)
      const baseColor = isArchived
        ? "#6B7280"
        : artisan.id === selectedArtisanData?.id
          ? "#f97316"
          : "#2563eb"

      return {
        id: artisan.id,
        lat: artisan.lat,
        lng: artisan.lng,
        color: baseColor,
        title: artisan.displayName,
      }
    })
    return markers
  }, [nearbyArtisans, selectedArtisanData, refData?.artisanStatuses])

  const mapSelectedConnection = useMemo(() => {
    if (!selectedArtisanData) return null
    return {
      lat: selectedArtisanData.lat,
      lng: selectedArtisanData.lng,
      distanceLabel: formatDistanceKm(selectedArtisanData.distanceKm),
    }
  }, [selectedArtisanData])

  useEffect(() => {
    primaryArtisanIdRef.current = primaryArtisan?.id ?? null
  }, [primaryArtisan?.id])

  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!response.ok) {
          throw new Error("Une erreur est survenue lors du chargement de l'utilisateur")
        }
        const payload = await response.json()
        if (!isMounted) return

        const user = payload?.user
        if (!user) return

        const first = user.firstname ?? user.prenom ?? ""
        const last = user.lastname ?? user.name ?? ""
        const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
        const displayName =
          displayNameCandidate || user.username || user.email || "Vous"

        setCurrentUser({
          id: user.id,
          displayName,
          code: user.code_gestionnaire ?? null,
          color: user.color ?? null,
          roles: Array.isArray(user.roles) ? user.roles : [],
        })
      } catch (error) {
        console.warn(
          "[InterventionEditForm] Impossible de charger l'utilisateur courant",
          error,
        )
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  const canEditContext = useMemo(() => {
    const roles = currentUser?.roles ?? []
    return roles.some((role) => typeof role === "string" && role.toLowerCase().includes("admin"))
  }, [currentUser])

  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) {
      return undefined
    }
    return refData.interventionStatuses.find((status) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const getInterventionStatusCode = useCallback(
    (statusId?: string | null) => {
      if (!statusId || !refData?.interventionStatuses) {
        return null
      }
      return refData.interventionStatuses.find((status) => status.id === statusId)?.code ?? null
    },
    [refData?.interventionStatuses],
  )

  const initialStatusCode = useMemo(
    () => getInterventionStatusCode(intervention.statut_id),
    [intervention.statut_id, getInterventionStatusCode],
  )

  const requiresDefinitiveId = useMemo(() => {
    if (!selectedStatus) {
      return false
    }
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DEFINITIVE_ID.has(code)) {
      return true
    }
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "devis envoyé" ||
      normalizedLabel === "visite technique" ||
      normalizedLabel === "accepté" ||
      normalizedLabel === "accepte" ||
      normalizedLabel === "en cours" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours" ||
      normalizedLabel === "terminé" ||
      normalizedLabel === "termine" ||
      normalizedLabel === "stand-by" ||
      normalizedLabel === "stand by"
    )
  }, [selectedStatus])

  const requiresDatePrevue = useMemo(() => {
    if (!selectedStatus) {
      return false
    }
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DATE_PREVUE.has(code)) {
      return true
    }
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "visite technique" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours"
    )
  }, [selectedStatus])

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setGeocodeError(null)
  }

  const applyArtisanSelection = useCallback((artisan: NearbyArtisan | null) => {
    setSelectedArtisanId(artisan?.id ?? null)
    setFormData((prev) => ({
      ...prev,
      artisan: artisan?.displayName ?? "",
      artisanTelephone: artisan?.telephone ?? "",
      artisanEmail: artisan?.email ?? "",
    }))
  }, [])

  const handleSelectNearbyArtisan = useCallback(
    (artisan: NearbyArtisan) => {
      if (selectedArtisanId === artisan.id) {
        applyArtisanSelection(null)
        return
      }
      applyArtisanSelection(artisan)
    },
    [applyArtisanSelection, selectedArtisanId],
  )

  const handleRemoveSelectedArtisan = useCallback(() => {
    applyArtisanSelection(null)
  }, [applyArtisanSelection])

  const handleArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = artisan.raison_sociale
      || artisan.plain_nom
      || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
      || "Artisan sans nom"

    setSelectedArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      artisan: displayName,
      artisanTelephone: artisan.telephone || "",
      artisanEmail: artisan.email || "",
    }))

    // Si l'artisan sélectionné via recherche n'est pas dans la liste de proximité,
    // on le convertit au format NearbyArtisan et on le stockera pour l'afficher
    const isInProximity = nearbyArtisans.some(a => a.id === artisan.id)
    if (!isInProximity && artisan.adresse_intervention && artisan.ville_intervention) {
      // On pourrait l'ajouter à une liste séparée, mais pour l'instant
      // la synchronisation visuelle via selectedArtisanId suffit
    }
  }, [nearbyArtisans])

  const handleOpenArtisanModal = useCallback((artisanId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    // Ouvrir le modal d'artisan avec le layoutId de l'intervention actuelle
    // pour pouvoir revenir à cette intervention à la fermeture
    openArtisanModal(artisanId, {
      layoutId: intervention.id,
      origin: `intervention:${intervention.id}`,
    })
  }, [intervention.id, openArtisanModal])

  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    // Annuler le timeout de blur si existant
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
      suggestionBlurTimeoutRef.current = null
    }

    // Parser l'adresse pour extraire code postal et ville
    const addressParts = parseAddress(suggestion.label)

    // Fermer immédiatement le dropdown
    clearSuggestions()
    setShowLocationSuggestions(false)

    // Mettre à jour tous les champs
    setFormData((prev) => ({
      ...prev,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
      adresseComplete: suggestion.label,
      adresse: addressParts.street || suggestion.label,
      code_postal: addressParts.postalCode || "",
      ville: addressParts.city || "",
    }))

    // Mettre à jour la query pour refléter la sélection
    setLocationQuery(suggestion.label)
    setGeocodeError(null)
  }, [clearSuggestions, setLocationQuery])

  // Fonction helper pour parser une adresse
  const parseAddress = (fullAddress: string): { street: string; postalCode: string; city: string } => {
    // Formats supportés :
    // OpenCage : "123 Rue de Rivoli, 75001 Paris, France"
    // Nominatim : "Rue de Rivoli, Paris, Île-de-France, 75001, France"

    const parts = fullAddress.split(',').map(p => p.trim())

    let street = ""
    let postalCode = ""
    let city = ""

    // Chercher le code postal dans toutes les parties (format 5 chiffres français)
    const postalCodeRegex = /\b(\d{5})\b/

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const match = part.match(postalCodeRegex)

      if (match) {
        postalCode = match[1]

        // Si le code postal est dans la même partie que la ville (format "75001 Paris")
        const cityInSamePart = part.replace(match[0], '').trim()
        if (cityInSamePart) {
          city = cityInSamePart
        }
        // Sinon, chercher la ville dans les parties précédentes
        else if (i > 0 && !city) {
          city = parts[i - 1]
        }
      }
    }

    // Si pas de ville trouvée, prendre la deuxième partie comme ville
    if (!city && parts.length >= 2) {
      city = parts[1].replace(postalCodeRegex, '').trim()
    }

    // La rue est toujours la première partie (avant la première virgule)
    street = parts[0] || fullAddress

    return { street, postalCode, city }
  }

  const handleGeocodeAddress = useCallback(async () => {
    const fullAddress = locationQuery.trim()
    if (!fullAddress) {
      setGeocodeError("Adresse manquante")
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)
    clearSuggestions() // Fermer le dropdown
    setShowLocationSuggestions(false)

    try {
      const result = await geocodeQuery(fullAddress)
      if (!result) {
        setGeocodeError("Adresse introuvable")
        return
      }

      // Parser l'adresse pour extraire code postal et ville
      const addressParts = parseAddress(result.label)

      setFormData((prev) => ({
        ...prev,
        latitude: result.lat,
        longitude: result.lng,
        adresseComplete: result.label,
        adresse: addressParts.street || result.label,
        code_postal: addressParts.postalCode || "",
        ville: addressParts.city || "",
      }))
      setLocationQuery(result.label)
    } catch (error) {
      console.error("[Geocode] Error:", error)
      setGeocodeError("Une erreur est survenue lors de la géolocalisation")
    } finally {
      setIsGeocoding(false)
    }
  }, [locationQuery, geocodeQuery, clearSuggestions, setLocationQuery])

  const executeSubmit = async (options?: { reason?: string; reasonType?: StatusReasonType }) => {
    setIsSubmitting(true)
    onSubmittingChange?.(true)

    try {
      const referenceAgenceValue = formData.reference_agence?.trim() ?? ""
      const idInterValue = formData.id_inter?.trim() ?? ""

      const updateData: UpdateInterventionData = {
        statut_id: formData.statut_id || undefined,
        agence_id: formData.agence_id || undefined,
        reference_agence: referenceAgenceValue.length > 0 ? referenceAgenceValue : null,
        assigned_user_id: formData.assigned_user_id || undefined,
        metier_id: formData.metier_id || undefined,
        date: formData.date || undefined,
        date_prevue: formData.date_prevue || undefined,
        contexte_intervention: formData.contexte_intervention || undefined,
        consigne_intervention: formData.consigne_intervention || undefined,
        consigne_second_artisan: formData.consigne_second_artisan || undefined,
        commentaire_agent: formData.commentaire_agent || undefined,
        adresse: formData.adresse || undefined,
        code_postal: formData.code_postal || undefined,
        ville: formData.ville || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        numero_sst: formData.numero_sst || undefined,
        pourcentage_sst: formData.pourcentage_sst ? parseFloat(formData.pourcentage_sst) : undefined,
        id_inter: idInterValue.length > 0 ? idInterValue : null,
      }

      if (!canEditContext) {
        delete updateData.contexte_intervention
      }

      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof UpdateInterventionData] === undefined) {
          delete updateData[key as keyof UpdateInterventionData]
        }
      })

      // Utiliser useInterventionsMutations pour enregistrer la modification locale
      console.log(`[InterventionEditForm] 📝 Mise à jour de l'intervention ${intervention.id} via useInterventionsMutations`)
      const updated = await updateMutation.mutateAsync({
        id: intervention.id,
        data: {
          agence_id: updateData.agence_id,
          assigned_user_id: updateData.assigned_user_id,
          statut_id: updateData.statut_id,
          metier_id: updateData.metier_id,
          date: updateData.date,
          date_prevue: updateData.date_prevue ?? undefined,
          contexte_intervention: updateData.contexte_intervention,
          consigne_intervention: updateData.consigne_intervention,
          consigne_second_artisan: updateData.consigne_second_artisan,
          commentaire_agent: updateData.commentaire_agent,
          adresse: updateData.adresse,
          code_postal: updateData.code_postal,
          ville: updateData.ville,
          latitude: updateData.latitude,
          longitude: updateData.longitude,
          numero_sst: updateData.numero_sst,
          pourcentage_sst: updateData.pourcentage_sst,
        },
      })

      // Mettre à jour les coûts
      const costsToUpdate: Array<{ cost_type: "sst" | "materiel" | "intervention"; amount: number }> = []

      const coutSSTValue = parseFloat(formData.coutSST) || 0
      const coutMaterielValue = parseFloat(formData.coutMateriel) || 0
      const coutInterventionValue = parseFloat(formData.coutIntervention) || 0

      if (coutSSTValue >= 0) {
        costsToUpdate.push({ cost_type: "sst", amount: coutSSTValue })
      }
      if (coutMaterielValue >= 0) {
        costsToUpdate.push({ cost_type: "materiel", amount: coutMaterielValue })
      }
      if (coutInterventionValue >= 0) {
        costsToUpdate.push({ cost_type: "intervention", amount: coutInterventionValue })
      }

      // Mettre à jour chaque coût
      for (const cost of costsToUpdate) {
        try {
          await interventionsApi.upsertCost(intervention.id, {
            cost_type: cost.cost_type,
            label: cost.cost_type === "sst" ? "Coût SST" : cost.cost_type === "materiel" ? "Coût Matériel" : "Coût Intervention",
            amount: cost.amount,
            currency: "EUR",
          })
        } catch (costError) {
          console.error(`[InterventionEditForm] Erreur lors de la mise à jour du coût ${cost.cost_type}:`, costError)
          // Ne pas bloquer la soumission si un coût échoue
        }
      }

      const currentPrimaryId = primaryArtisanIdRef.current
      const nextPrimaryId = selectedArtisanId ?? null

      let payload: InterventionWithStatus = updated as InterventionWithStatus

      if (currentPrimaryId !== nextPrimaryId) {
        await interventionsApi.setPrimaryArtisan(intervention.id, nextPrimaryId)
        primaryArtisanIdRef.current = nextPrimaryId
        payload = await interventionsApi.getById(intervention.id)
      } else {
        // Recharger les données pour avoir les coûts à jour
        payload = await interventionsApi.getById(intervention.id)
      }

      if (options?.reason && options.reasonType) {
        try {
          await commentsApi.create({
            entity_id: intervention.id,
            entity_type: "intervention",
            content: options.reason,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id ?? undefined,
            reason_type: options.reasonType,
          })
          await queryClient.invalidateQueries({ queryKey: ["comments", "intervention", intervention.id] })
        } catch (commentError) {
          console.error("[InterventionEditForm] Impossible d'ajouter le commentaire obligatoire", commentError)
          throw new Error("Le commentaire obligatoire n'a pas pu être enregistré. Merci de réessayer.")
        }
      }

      onSuccess?.(payload)
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
      const message = error instanceof Error ? error.message : "Erreur lors de la mise à jour de l'intervention"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const idInterValue = formData.id_inter?.trim() ?? ""
    if (requiresDefinitiveId && (idInterValue.length === 0 || idInterValue.toLowerCase().includes("auto"))) {
      form.reportValidity()
      return
    }

    const datePrevueValue = formData.date_prevue?.trim() ?? ""
    if (requiresDatePrevue && datePrevueValue.length === 0) {
      form.reportValidity()
      return
    }

    const nextStatusCode = getInterventionStatusCode(formData.statut_id)
    const reasonType = getReasonTypeForTransition(initialStatusCode, nextStatusCode)

    if (reasonType) {
      setPendingReasonType(reasonType)
      return
    }

    await executeSubmit()
  }

  const handleStatusReasonCancel = () => {
    setPendingReasonType(null)
  }

  const handleStatusReasonConfirm = async (reason: string) => {
    const reasonType = pendingReasonType
    if (!reasonType) {
      return
    }
    setPendingReasonType(null)
    await executeSubmit({ reason, reasonType })
  }

  const isFullPage = mode === "fullpage"
  const isCenterPage = mode === "centerpage"
  const useTwoColumns = isFullPage || isCenterPage

  const containerClass = useTwoColumns ? "space-y-4" : "space-y-4"
  const contentClass = useTwoColumns ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-4"

  const selectedAgencyId = formData.agence_id
  const selectedAgencyData = useMemo(() => {
    if (!selectedAgencyId || !refData?.agencies) {
      return undefined
    }
    return refData.agencies.find((agency) => agency.id === selectedAgencyId)
  }, [selectedAgencyId, refData])

  const showReferenceField = useMemo(() => {
    if (!selectedAgencyData) {
      return false
    }
    const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase()
    const normalizedLabel = normalize(selectedAgencyData.label)
    const normalizedCode = normalize(selectedAgencyData.code)
    return (
      AGENCIES_WITH_OPTIONAL_REFERENCE.has(normalizedLabel) ||
      AGENCIES_WITH_OPTIONAL_REFERENCE.has(normalizedCode)
    )
  }, [selectedAgencyData])

  const mainGridClassName = showReferenceField
    ? "grid legacy-form-main-grid legacy-form-main-grid--with-reference"
    : "grid legacy-form-main-grid"

  if (refDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Chargement des données...</div>
      </div>
    )
  }

  return (
    <form ref={formRef} className={containerClass} onSubmit={handleSubmit}>
      <Card className="legacy-form-card">
        <CardContent className="pt-4">
          <div className={mainGridClassName}>
            <div className="legacy-form-field">
              <Label htmlFor="statut" className="legacy-form-label">
                Statut *
              </Label>
              <Select value={formData.statut_id} onValueChange={(value) => handleInputChange("statut_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.interventionStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="idIntervention" className="legacy-form-label">
                ID Intervention {requiresDefinitiveId && "*"}
              </Label>
              <Input
                id="idIntervention"
                value={formData.id_inter}
                onChange={(event) => handleInputChange("id_inter", event.target.value)}
                placeholder="Auto-généré (provisoire)"
                className="legacy-form-input"
                required={requiresDefinitiveId}
                pattern={requiresDefinitiveId ? "^(?!.*(?:[Aa][Uu][Tt][Oo])).+$" : undefined}
                title={requiresDefinitiveId ? "ID intervention définitif requis (sans la chaîne \"AUTO\")" : undefined}
                autoComplete="off"
              />
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="agence" className="legacy-form-label">
                Agence
              </Label>
              <Select value={formData.agence_id} onValueChange={(value) => handleInputChange("agence_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showReferenceField && (
              <div className="legacy-form-field">
                <Label htmlFor="reference_agence" className="legacy-form-label">
                  Référence agence
                </Label>
                <Input
                  id="reference_agence"
                  name="reference_agence"
                  value={formData.reference_agence}
                  onChange={(event) => handleInputChange("reference_agence", event.target.value)}
                  placeholder="Ex: REF-12345"
                  className="legacy-form-input"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="legacy-form-field">
              <Label htmlFor="attribueA" className="legacy-form-label">
                Attribué à
              </Label>
              <Select value={formData.assigned_user_id} onValueChange={(value) => handleInputChange("assigned_user_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.users.map((user) => {
                    const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="typeMetier" className="legacy-form-label">
                Type (Métier)
              </Label>
              <Select value={formData.metier_id} onValueChange={(value) => handleInputChange("metier_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Métier" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.metiers.map((metier) => (
                    <SelectItem key={metier.id} value={metier.id}>
                      {metier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`legacy-form-content-grid ${contentClass}`}>
        {/* COLONNE GAUCHE */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Détails intervention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label htmlFor="contexteIntervention" className="text-xs">
                  Contexte d&apos;intervention *
                </Label>
                <Textarea
                  id="contexteIntervention"
                  value={formData.contexte_intervention}
                  onChange={
                    canEditContext
                      ? (event) => handleInputChange("contexte_intervention", event.target.value)
                      : undefined
                  }
                  placeholder="Décrivez le contexte de l&apos;intervention..."
                  rows={3}
                  className={cn(
                    "text-sm",
                    !canEditContext && "cursor-not-allowed bg-muted/50 text-muted-foreground",
                  )}
                  readOnly={!canEditContext}
                  aria-readonly={!canEditContext}
                  required
                />
                {!canEditContext && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Seuls les administrateurs peuvent modifier ce champ après création.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="consigneIntervention" className="text-xs">
                  Consigne d&apos;intervention
                </Label>
                <Textarea
                  id="consigneIntervention"
                  value={formData.consigne_intervention}
                  onChange={(event) => handleInputChange("consigne_intervention", event.target.value)}
                  placeholder="Consignes spécifiques pour l&apos;intervention..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="adresse" className="text-xs">
                  Adresse *
                </Label>
                <Textarea
                  id="adresse"
                  value={formData.adresse}
                  onChange={(event) => handleInputChange("adresse", event.target.value)}
                  placeholder="Adresse complète de l&apos;intervention"
                  rows={2}
                  className="text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="codePostal" className="text-xs">
                    Code postal
                  </Label>
                  <Input
                    id="codePostal"
                    value={formData.code_postal}
                    onChange={(event) => handleInputChange("code_postal", event.target.value)}
                    placeholder="75001"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="ville" className="text-xs">
                    Ville
                  </Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(event) => handleInputChange("ville", event.target.value)}
                    placeholder="Paris"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Localisation</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Input
                        value={locationQuery}
                        onChange={(event) => {
                          setLocationQuery(event.target.value)
                          setGeocodeError(null)
                        }}
                        onFocus={() => {
                          setShowLocationSuggestions(true)
                          if (suggestionBlurTimeoutRef.current) {
                            window.clearTimeout(suggestionBlurTimeoutRef.current)
                            suggestionBlurTimeoutRef.current = null
                          }
                        }}
                        onBlur={() => {
                          suggestionBlurTimeoutRef.current = window.setTimeout(() => {
                            clearSuggestions()
                            setShowLocationSuggestions(false)
                          }, 150)
                        }}
                        placeholder="Rechercher une adresse..."
                        className="h-8 text-sm"
                      />
                      {showLocationSuggestions && locationSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-muted bg-background shadow-lg">
                          <ul className="divide-y divide-border text-left text-sm">
                            {locationSuggestions.map((suggestion) => (
                              <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-muted/80 focus:bg-muted/80"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleSuggestionSelect(suggestion)}
                                >
                                  <span className="truncate font-medium">{suggestion.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {suggestion.lat.toFixed(4)} • {suggestion.lng.toFixed(4)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:w-auto">
                      <Input
                        id="perimeterKm"
                        type="number"
                        min={1}
                        max={MAX_RADIUS_KM}
                        value={perimeterKmInput}
                        onChange={(event) => setPerimeterKmInput(event.target.value)}
                        onBlur={(event) => {
                          const raw = Number.parseFloat(event.target.value)
                          if (!Number.isFinite(raw) || raw <= 0) {
                            setPerimeterKmInput("50")
                            return
                          }
                          const clamped = Math.min(raw, MAX_RADIUS_KM)
                          setPerimeterKmInput(String(clamped))
                        }}
                        placeholder="Rayon (km)"
                        className="h-8 w-full min-w-[90px] text-sm sm:w-28"
                      />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        km
                      </span>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleGeocodeAddress} disabled={isGeocoding}>
                      {isGeocoding ? "Recherche..." : "Localiser"}
                    </Button>
                  </div>
                  {isSuggesting && (
                    <div className="text-xs text-muted-foreground">Recherche d&apos;adresses...</div>
                  )}
                  {geocodeError && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {geocodeError}
                    </div>
                  )}
                  <div className="overflow-hidden rounded-lg border">
                    <MapLibreMap
                      lat={formData.latitude}
                      lng={formData.longitude}
                      height="200px"
                      onLocationChange={handleLocationChange}
                      markers={mapMarkers}
                      circleRadiusKm={perimeterKmValue}
                      selectedConnection={mapSelectedConnection ?? undefined}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Lat: {formData.latitude.toFixed(4)}</span>
                    <span>Lng: {formData.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="mb-3 block text-xs font-medium">Coûts</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="coutIntervention" className="text-xs">
                      Coût intervention
                    </Label>
                    <Input
                      id="coutIntervention"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.coutIntervention}
                      onChange={(event) => handleInputChange("coutIntervention", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coutSST" className="text-xs">
                      Coût SST
                    </Label>
                    <Input
                      id="coutSST"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.coutSST}
                      onChange={(event) => handleInputChange("coutSST", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coutMateriel" className="text-xs">
                      Coût matériel
                    </Label>
                    <Input
                      id="coutMateriel"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.coutMateriel}
                      onChange={(event) => handleInputChange("coutMateriel", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="datePrevue" className="text-xs">
                      Date prévue {requiresDatePrevue && "*"}
                    </Label>
                    <Input
                      id="datePrevue"
                      type="date"
                      value={formData.date_prevue}
                      onChange={(event) => handleInputChange("date_prevue", event.target.value)}
                      className="h-8 text-sm"
                      required={requiresDatePrevue}
                      title={requiresDatePrevue ? "Date prévue obligatoire pour ce statut" : undefined}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLONNE DROITE */}
        <div className="space-y-4">
          {/* Propriétaire et Client */}
          <Collapsible open={isProprietaireOpen} onOpenChange={setIsProprietaireOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Détails propriétaire et client
                    {isProprietaireOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <Label className="mb-2 block text-xs font-medium">Propriétaire</Label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor="nomProprietaire" className="text-xs">Nom</Label>
                        <Input
                          id="nomProprietaire"
                          value={formData.nomProprietaire}
                          onChange={(event) => handleInputChange("nomProprietaire", event.target.value)}
                          placeholder="Nom du propriétaire"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="prenomProprietaire" className="text-xs">Prénom</Label>
                        <Input
                          id="prenomProprietaire"
                          value={formData.prenomProprietaire}
                          onChange={(event) => handleInputChange("prenomProprietaire", event.target.value)}
                          placeholder="Prénom du propriétaire"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="telephoneProprietaire" className="text-xs">Téléphone</Label>
                        <Input
                          id="telephoneProprietaire"
                          value={formData.telephoneProprietaire}
                          onChange={(event) => handleInputChange("telephoneProprietaire", event.target.value)}
                          placeholder="06 12 34 56 78"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="emailProprietaire" className="text-xs">Email</Label>
                        <Input
                          id="emailProprietaire"
                          type="email"
                          value={formData.emailProprietaire}
                          onChange={(event) => handleInputChange("emailProprietaire", event.target.value)}
                          placeholder="proprietaire@example.com"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium">Client</Label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor="nomClient" className="text-xs">Nom</Label>
                        <Input
                          id="nomClient"
                          value={formData.nomClient}
                          onChange={(event) => handleInputChange("nomClient", event.target.value)}
                          placeholder="Nom du client"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="prenomClient" className="text-xs">Prénom</Label>
                        <Input
                          id="prenomClient"
                          value={formData.prenomClient}
                          onChange={(event) => handleInputChange("prenomClient", event.target.value)}
                          placeholder="Prénom du client"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="telephoneClient" className="text-xs">Téléphone</Label>
                        <Input
                          id="telephoneClient"
                          value={formData.telephoneClient}
                          onChange={(event) => handleInputChange("telephoneClient", event.target.value)}
                          placeholder="06 12 34 56 78"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="emailClient" className="text-xs">Email</Label>
                        <Input
                          id="emailClient"
                          type="email"
                          value={formData.emailClient}
                          onChange={(event) => handleInputChange("emailClient", event.target.value)}
                          placeholder="client@example.com"
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Artisans */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4" />
                Artisans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="artisan" className="text-xs">Artisan</Label>
                  <div className="flex gap-2">
                    <Input
                      id="artisan"
                      value={formData.artisan}
                      onChange={(event) => handleInputChange("artisan", event.target.value)}
                      placeholder="Nom de l'artisan"
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        setArtisanSearchPosition({ x: e.clientX, y: e.clientY })
                        setShowArtisanSearch(true)
                      }}
                      title="Rechercher un artisan"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="artisanTelephone" className="text-xs">Téléphone</Label>
                  <Input
                    id="artisanTelephone"
                    value={formData.artisanTelephone}
                    onChange={(event) => handleInputChange("artisanTelephone", event.target.value)}
                    placeholder="06 12 34 56 78"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="artisanEmail" className="text-xs">Email</Label>
                  <Input
                    id="artisanEmail"
                    type="email"
                    value={formData.artisanEmail}
                    onChange={(event) => handleInputChange("artisanEmail", event.target.value)}
                    placeholder="artisan@example.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Artisans à proximité
                  </span>
                  {isLoadingNearbyArtisans ? (
                    <span className="text-[11px] text-muted-foreground">Recherche…</span>
                  ) : null}
                </div>

                {nearbyArtisansError ? (
                  <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {nearbyArtisansError}
                  </div>
                ) : nearbyArtisans.length === 0 && !isLoadingNearbyArtisans ? (
                  <div className="rounded border border-border/50 bg-background px-3 py-3 text-xs text-muted-foreground">
                    Aucun artisan géolocalisé n’a été trouvé dans un rayon de {perimeterKmValue} km.
                  </div>
                ) : (
                  <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                    {sortedNearbyArtisans.map((artisan) => {
                      const isSelected = selectedArtisanId === artisan.id

                      // Calculer les initiales de l'artisan
                      const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                      const artisanInitials = artisanName
                        .split(" ")
                        .map((part) => part.charAt(0))
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "??"

                      // Trouver le statut de l'artisan
                      const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                      const statutArtisan = artisanStatus?.label || ""
                      const statutArtisanColor = artisanStatus?.color || null

                      return (
                        <div
                          key={artisan.id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "relative rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm transition-colors",
                            isSelected
                              ? "border-primary/70 ring-2 ring-primary/50"
                              : "hover:border-primary/40",
                          )}
                          onClick={() => handleSelectNearbyArtisan(artisan)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              handleSelectNearbyArtisan(artisan)
                            }
                          }}
                        >
                          {isSelected ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-6 w-6 rounded-full bg-background/80 text-foreground shadow-sm transition hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleRemoveSelectedArtisan()
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <div className="flex items-start gap-3">
                            <Avatar
                              photoProfilMetadata={artisan.photoProfilMetadata}
                              initials={artisanInitials}
                              name={artisan.displayName}
                              size={40}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground">
                                    {artisan.displayName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {statutArtisan && statutArtisanColor && (
                                    <Badge
                                      variant="outline"
                                      className="border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide flex-shrink-0"
                                      style={{
                                        backgroundColor: hexToRgba(statutArtisanColor, 0.15) || statutArtisanColor + '20',
                                        color: statutArtisanColor,
                                        borderColor: statutArtisanColor,
                                      }}
                                    >
                                      {statutArtisan}
                                    </Badge>
                                  )}
                                  {statutArtisan && !statutArtisanColor && (
                                    <Badge
                                      variant="outline"
                                      className="border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 border-gray-300 flex-shrink-0"
                                    >
                                      {statutArtisan}
                                    </Badge>
                                  )}
                                  <Badge variant={isSelected ? "default" : "secondary"} className="flex-shrink-0">
                                    {formatDistanceKm(artisan.distanceKm)}
                                  </Badge>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => handleOpenArtisanModal(artisan.id, e)}
                                    title="Voir les détails de l'artisan"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {artisan.adresse ? (
                                  <span>
                                    {artisan.adresse}
                                    {artisan.codePostal || artisan.ville ? (
                                      <>
                                        , {artisan.codePostal ?? ""}
                                        {artisan.codePostal && artisan.ville ? " " : ""}
                                        {artisan.ville ?? ""}
                                      </>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span>
                                    {artisan.codePostal ?? "—"}
                                    {artisan.codePostal && artisan.ville ? " " : ""}
                                    {artisan.ville ?? ""}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {artisan.telephone ? <span>📞 {artisan.telephone}</span> : null}
                                {artisan.email ? <span>✉️ {artisan.email}</span> : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Acomptes */}
          <Collapsible open={isAccompteOpen} onOpenChange={setIsAccompteOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Gestion des acomptes
                    {isAccompteOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="accompteSST" className="text-xs">Acompte SST</Label>
                      <Input
                        id="accompteSST"
                        value={formData.accompteSST}
                        placeholder="Montant"
                        className="h-8 text-sm"
                        disabled
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Acompte SST reçu</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.accompteSSTRecu}
                          disabled
                        />
                        <Input
                          type="date"
                          value={formData.dateAccompteSSTRecu}
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="accompteClient" className="text-xs">Acompte client</Label>
                      <Input
                        id="accompteClient"
                        value={formData.accompteClient}
                        placeholder="Montant"
                        className="h-8 text-sm"
                        disabled
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Acompte client reçu</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.accompteClientRecu}
                          disabled
                        />
                        <Input
                          type="date"
                          value={formData.dateAccompteClientRecu}
                          className="h-8 text-sm"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: La gestion des acomptes est en lecture seule. Utilisez l&apos;API dédiée pour modifier ces données.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Documents */}
          <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Upload className="h-4 w-4" />
                    Documents
                    {isDocumentsOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <DocumentManager
                    entityType="intervention"
                    entityId={intervention.id}
                    kinds={INTERVENTION_DOCUMENT_KINDS}
                    currentUser={currentUser ?? undefined}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Commentaires (Historique) */}
          <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    Commentaires
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        isCommentsOpen && "rotate-180",
                      )}
                    />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <CommentSection
                    entityType="intervention"
                    entityId={intervention.id}
                    currentUserId={currentUser?.id}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Commentaires */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Commentaires & Consignes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label htmlFor="commentaireAgent" className="text-xs">
                  Commentaire agent
                </Label>
                <Textarea
                  id="commentaireAgent"
                  value={formData.commentaire_agent}
                  onChange={(event) => handleInputChange("commentaire_agent", event.target.value)}
                  placeholder="Notes internes..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="consigneSecondArtisan" className="text-xs">
                  Consigne second artisan
                </Label>
                <Textarea
                  id="consigneSecondArtisan"
                  value={formData.consigne_second_artisan}
                  onChange={(event) => handleInputChange("consigne_second_artisan", event.target.value)}
                  placeholder="Consignes pour le second artisan..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de recherche d'artisan */}
      <ArtisanSearchModal
        open={showArtisanSearch}
        onClose={() => {
          setShowArtisanSearch(false)
          setArtisanSearchPosition(null)
        }}
        onSelect={handleArtisanSearchSelect}
        position={artisanSearchPosition}
      />
      <StatusReasonModal
        open={isStatusReasonModalOpen}
        type={pendingReasonType ?? "archive"}
        onCancel={handleStatusReasonCancel}
        onConfirm={(reason) => {
          void handleStatusReasonConfirm(reason)
        }}
        isSubmitting={isSubmitting}
      />
    </form>
  )
}
