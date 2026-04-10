// ===== HOOK PARTAGÉ POUR L'ÉTAT DES FORMULAIRES D'INTERVENTION =====
// Encapsule toute la logique commune entre NewInterventionForm et InterventionEditForm

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useInterventionDraftStore, NEW_INTERVENTION_DRAFT_KEY } from "@/stores/interventionDraft"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { useFormDataChanges } from "@/hooks/useFormDataChanges"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import type { ArtisanSearchResult } from "@/lib/artisans/types"
import type { EmailTemplateData } from "@/lib/email-templates/intervention-emails"
import { supabase } from "@/lib/supabase-client"
import { calculatePrimaryArtisanMargin } from "@/lib/utils/margin-calculator"
import { toast } from "sonner"

import {
  MAX_RADIUS_KM,
  STATUSES_REQUIRING_DATE_PREVUE,
  STATUSES_REQUIRING_DEFINITIVE_ID,
  STATUSES_REQUIRING_NOM_FACTURATION,
  STATUSES_REQUIRING_ASSIGNED_USER,
  STATUSES_REQUIRING_COUTS,
  STATUSES_REQUIRING_CONSIGNE_ARTISAN,
  STATUSES_REQUIRING_CLIENT_INFO,
  STATUSES_REQUIRING_AGENCE,
  STATUSES_REQUIRING_METIER,
  STATUSES_REQUIRING_DEVIS,
  ARTISAN_REQUIRED_STATUS_CODES,
} from "@/lib/interventions/form-constants"
import { formatDistanceKm, parseAddress, getArtisanDisplayName, artisanSearchResultToNearbyArtisan } from "@/lib/interventions/form-utils"
import type { InterventionFormData, CollapsibleSectionsState } from "@/lib/interventions/form-types"
import { getDefaultCollapsibleState } from "@/lib/interventions/form-types"

// ---- Types ----

export interface UseInterventionFormStateOptions {
  mode: "create" | "edit"
  initialFormData: InterventionFormData
  initialLocationQuery?: string
  initialSelectedArtisanId?: string | null
  initialSelectedSecondArtisanId?: string | null
  /** Données artisan assigné depuis la DB (edit mode) — fallback d'affichage quand pas dans nearby */
  initialPrimaryArtisanData?: NearbyArtisan | null
  initialSecondaryArtisanData?: NearbyArtisan | null
  /** ID de l'intervention (edit mode) — active la persistance du draft */
  interventionId?: string
  /** Activer la restauration du draft de création (mode create uniquement — désactiver si defaultValues fournis) */
  restoreNewDraft?: boolean

  // Callbacks de notification vers le parent
  onClientNameChange?: (name: string) => void
  onAgencyNameChange?: (name: string) => void
  onClientPhoneChange?: (phone: string) => void
  onHasUnsavedChanges?: (hasChanges: boolean) => void
  onSubmittingChange?: (isSubmitting: boolean) => void
}

// ---- Hook ----

export function useInterventionFormState(options: UseInterventionFormStateOptions) {
  const {
    mode,
    initialFormData,
    initialLocationQuery = "",
    initialSelectedArtisanId = null,
    initialSelectedSecondArtisanId = null,
    initialPrimaryArtisanData = null,
    initialSecondaryArtisanData = null,
    interventionId,
    restoreNewDraft = false,
    onClientNameChange,
    onAgencyNameChange,
    onClientPhoneChange,
    onHasUnsavedChanges,
    onSubmittingChange,
  } = options

  // ---- Draft store ----
  const { getDraft, saveDraft, clearDraft: clearDraftStore } = useInterventionDraftStore()
  const existingDraft = mode === "edit" && interventionId
    ? getDraft(interventionId)
    : mode === "create" && restoreNewDraft
      ? getDraft(NEW_INTERVENTION_DRAFT_KEY)
      : null

  // ---- Données de référence ----
  const { data: refData, loading: refDataLoading } = useReferenceDataQuery()
  const { data: currentUserData } = useCurrentUser()
  const { open: openArtisanModal } = useArtisanModal()

  const currentUser = useMemo(() => {
    if (!currentUserData) return null
    const first = currentUserData.firstname ?? currentUserData.prenom ?? ""
    const last = currentUserData.lastname ?? currentUserData.nom ?? ""
    const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
    const displayName = displayNameCandidate || currentUserData.username || currentUserData.email || "Vous"
    return {
      id: currentUserData.id,
      displayName,
      code: currentUserData.code_gestionnaire ?? null,
      color: currentUserData.color ?? null,
      avatarUrl: currentUserData.avatar_url ?? null,
      roles: Array.isArray(currentUserData.roles) ? currentUserData.roles : [],
    }
  }, [currentUserData])

  // ---- État principal du formulaire ----
  // Si un draft existe (navigation artisan / transition Realtime), on le restaure
  const [formData, setFormData] = useState<InterventionFormData>(existingDraft?.formData ?? initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormReady, setIsFormReady] = useState(false)

  // ---- Géocodage ----
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions: locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocode: geocodeQuery,
  } = useGeocodeSearch({ initialQuery: existingDraft?.locationQuery ?? initialLocationQuery })
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)

  // ---- Périmètre ----
  const [perimeterKmInput, setPerimeterKmInput] = useState("50")
  const perimeterKmValue = useMemo(() => {
    const parsed = Number.parseFloat(perimeterKmInput)
    if (!Number.isFinite(parsed) || parsed <= 0) return 50
    return Math.min(parsed, MAX_RADIUS_KM)
  }, [perimeterKmInput])

  // ---- Sélection artisan ----
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(existingDraft?.selectedArtisanId ?? initialSelectedArtisanId)
  const [selectedSecondArtisanId, setSelectedSecondArtisanId] = useState<string | null>(existingDraft?.selectedSecondArtisanId ?? initialSelectedSecondArtisanId)
  const [searchSelectedArtisan, setSearchSelectedArtisan] = useState<NearbyArtisan | null>(null)
  const [searchSelectedSecondArtisan, setSearchSelectedSecondArtisan] = useState<NearbyArtisan | null>(null)
  // Artisans assignés depuis la DB (source de vérité) — fallback quand pas dans nearby ni search
  const [assignedPrimaryArtisan, setAssignedPrimaryArtisan] = useState<NearbyArtisan | null>(initialPrimaryArtisanData)
  const [assignedSecondaryArtisan, setAssignedSecondaryArtisan] = useState<NearbyArtisan | null>(initialSecondaryArtisanData)
  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())

  // ---- Sections collapsibles ----
  const [collapsibleState, setCollapsibleState] = useState<CollapsibleSectionsState>(
    existingDraft?.collapsibleState ?? getDefaultCollapsibleState
  )

  // ---- Modales de recherche artisan ----
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [showSecondArtisanSearch, setShowSecondArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const [secondArtisanSearchPosition, setSecondArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const artisanSearchContainerRef = useRef<HTMLDivElement>(null)
  const [artisanDisplayMode, setArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")

  // ---- Modales email ----
  const [isDevisEmailModalOpen, setIsDevisEmailModalOpen] = useState(false)
  const [isInterventionEmailModalOpen, setIsInterventionEmailModalOpen] = useState(false)
  const [selectedArtisanForEmail, setSelectedArtisanForEmail] = useState<string | null>(null)

  // ---- Hooks artisans à proximité ----
  const {
    artisans: nearbyArtisans,
    loading: isLoadingNearbyArtisans,
    error: nearbyArtisansError,
  } = useNearbyArtisans(
    formData.adresse_complete ? formData.latitude : null,
    formData.adresse_complete ? formData.longitude : null,
    {
      limit: 100,
      maxDistanceKm: perimeterKmValue,
      sampleSize: 400,
      metier_id: formData.metier_id || null,
    }
  )

  const {
    artisans: nearbyArtisansSecondMetier,
    loading: isLoadingNearbyArtisansSecondMetier,
  } = useNearbyArtisans(
    formData.adresse_complete ? formData.latitude : null,
    formData.adresse_complete ? formData.longitude : null,
    {
      limit: 100,
      maxDistanceKm: perimeterKmValue,
      sampleSize: 400,
      metier_id: formData.metierSecondArtisanId || null,
    }
  )

  // ---- Memos: artisan sélectionné ----
  // Priorité : nearby (données fraîches + distance) > search (session) > assigned (DB, toujours dispo)
  const selectedArtisanData = useMemo(() => {
    if (!selectedArtisanId) return null
    const nearbyArtisan = nearbyArtisans.find((artisan) => artisan.id === selectedArtisanId)
    if (nearbyArtisan) return nearbyArtisan
    if (searchSelectedArtisan) return searchSelectedArtisan
    return assignedPrimaryArtisan?.id === selectedArtisanId ? assignedPrimaryArtisan : null
  }, [selectedArtisanId, nearbyArtisans, searchSelectedArtisan, assignedPrimaryArtisan])

  const selectedSecondArtisanData = useMemo(() => {
    if (!selectedSecondArtisanId) return null
    const nearbyArtisan = nearbyArtisansSecondMetier.find((artisan) => artisan.id === selectedSecondArtisanId)
    if (nearbyArtisan) return nearbyArtisan
    if (searchSelectedSecondArtisan) return searchSelectedSecondArtisan
    return assignedSecondaryArtisan?.id === selectedSecondArtisanId ? assignedSecondaryArtisan : null
  }, [selectedSecondArtisanId, nearbyArtisansSecondMetier, searchSelectedSecondArtisan, assignedSecondaryArtisan])

  // ---- Memos: marges ----
  const margePrimaryArtisan = useMemo(() => {
    const sst1 = parseFloat(String(formData.coutSST)) || 0
    const mat1 = parseFloat(String(formData.coutMateriel)) || 0
    const sst2 = parseFloat(String(formData.coutSSTSecondArtisan)) || 0
    const mat2 = parseFloat(String(formData.coutMaterielSecondArtisan)) || 0
    return calculatePrimaryArtisanMargin(
      formData.coutIntervention,
      sst1 + sst2,
      mat1 + mat2
    )
  }, [formData.coutIntervention, formData.coutSST, formData.coutMateriel, formData.coutSSTSecondArtisan, formData.coutMaterielSecondArtisan])

  // ---- Memos: carte ----
  const mapMarkers = useMemo(() => {
    if (!refData?.artisanStatuses) {
      return nearbyArtisans.map((artisan) => ({
        id: artisan.id,
        lat: artisan.lat,
        lng: artisan.lng,
        color: artisan.id === selectedArtisanData?.id ? "#f97316" : "#2563eb",
        title: artisan.displayName,
      }))
    }

    const archiveStatuses = refData.artisanStatuses.filter(
      (s: any) => s.code === "ARCHIVE"
    )
    const archiveStatusIds = new Set(archiveStatuses.map((s: any) => s.id))
    const visibleArtisans =
      archiveStatusIds.size > 0
        ? nearbyArtisans.filter(
          (artisan) => !artisan.statut_id || !archiveStatusIds.has(artisan.statut_id),
        )
        : nearbyArtisans

    return visibleArtisans.map((artisan) => ({
      id: artisan.id,
      lat: artisan.lat,
      lng: artisan.lng,
      color: artisan.id === selectedArtisanData?.id ? "#f97316" : "#2563eb",
      title: artisan.displayName,
    }))
  }, [nearbyArtisans, selectedArtisanData, refData?.artisanStatuses])

  const mapSelectedConnection = useMemo(() => {
    if (!selectedArtisanData) return null
    return {
      lat: selectedArtisanData.lat,
      lng: selectedArtisanData.lng,
      distanceLabel: formatDistanceKm(selectedArtisanData.distanceKm),
    }
  }, [selectedArtisanData])

  // ---- Memos: validation ----
  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) return undefined
    return refData.interventionStatuses.find((status: any) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const requiresDefinitiveId = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DEFINITIVE_ID.has(code)) return true
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "devis envoyé" ||
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
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DATE_PREVUE.has(code)) return true
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "visite technique" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours"
    )
  }, [selectedStatus])

  const requiresArtisan = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    if ((ARTISAN_REQUIRED_STATUS_CODES as readonly string[]).includes(code)) return true
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "visite technique" ||
      normalizedLabel === "en cours" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours" ||
      normalizedLabel === "terminé" ||
      normalizedLabel === "termine" ||
      normalizedLabel === "attente acompte" ||
      normalizedLabel === "att acompte"
    )
  }, [selectedStatus])

  const requiresFacture = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (code === "INTER_TERMINEE") return true
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return normalizedLabel === "terminé" || normalizedLabel === "termine"
  }, [selectedStatus])

  // ---- Memos: validation (edit-specific rules) ----
  const requiresNomFacturation = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_NOM_FACTURATION.has(code) ||
      (selectedStatus.label ?? "").toLowerCase().includes("devis envoyé")
  }, [selectedStatus])

  const requiresAssignedUser = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_ASSIGNED_USER.has(code) ||
      (selectedStatus.label ?? "").toLowerCase().includes("devis envoyé")
  }, [selectedStatus])

  const requiresCouts = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_COUTS.has(code) ||
      (selectedStatus.label ?? "").toLowerCase().includes("inter en cours") ||
      (selectedStatus.label ?? "").toLowerCase().includes("intervention en cours")
  }, [selectedStatus])

  const requiresConsigneArtisan = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_CONSIGNE_ARTISAN.has(code) ||
      (selectedStatus.label ?? "").toLowerCase().includes("inter en cours") ||
      (selectedStatus.label ?? "").toLowerCase().includes("intervention en cours")
  }, [selectedStatus])

  const requiresClientInfo = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_CLIENT_INFO.has(code) ||
      (selectedStatus.label ?? "").toLowerCase().includes("inter en cours") ||
      (selectedStatus.label ?? "").toLowerCase().includes("intervention en cours")
  }, [selectedStatus])

  const requiresAgence = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_AGENCE.has(code)
  }, [selectedStatus])

  const requiresMetier = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_METIER.has(code)
  }, [selectedStatus])

  const requiresDevis = useMemo(() => {
    if (!selectedStatus) return false
    const code = (selectedStatus.code ?? "").toUpperCase()
    return STATUSES_REQUIRING_DEVIS.has(code)
  }, [selectedStatus])

  // ---- Memos: email ----
  const effectiveSelectedArtisanId = useMemo(() => {
    return selectedArtisanForEmail || selectedArtisanId || null
  }, [selectedArtisanForEmail, selectedArtisanId])

  const selectedArtisanEmail = useMemo(() => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''
    if (selectedArtisanData && selectedArtisanData.id === artisanId) {
      return selectedArtisanData.email || ''
    }
    if (selectedSecondArtisanData && selectedSecondArtisanData.id === artisanId) {
      return selectedSecondArtisanData.email || ''
    }
    return ''
  }, [effectiveSelectedArtisanId, selectedArtisanData, selectedSecondArtisanData])

  // ---- Effects ----

  // Sync location query initiale
  useEffect(() => {
    if (formData.adresse_complete && !locationQuery) {
      setLocationQuery(formData.adresse_complete)
    }
  }, [formData.adresse_complete]) // eslint-disable-line react-hooks/exhaustive-deps

  // Form ready
  useEffect(() => {
    setIsFormReady(true)
  }, [])

  // Unsaved changes
  const hasUnsavedChanges = useFormDataChanges(formData, isSubmitting, isFormReady, existingDraft?.hasPendingChanges ?? false)

  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onHasUnsavedChanges])

  // Persistance du draft (edit mode uniquement — survit aux cycles fermeture/réouverture du modal)
  useEffect(() => {
    if (mode !== "edit" || !interventionId || !isFormReady) return
    saveDraft(interventionId, {
      formData,
      locationQuery,
      selectedArtisanId,
      selectedSecondArtisanId,
      collapsibleState,
      hasPendingChanges: hasUnsavedChanges,
    })
  }, [mode, interventionId, isFormReady, formData, locationQuery, selectedArtisanId, selectedSecondArtisanId, collapsibleState, hasUnsavedChanges, saveDraft])

  const clearDraft = useCallback(() => {
    if (mode === "edit" && interventionId) {
      clearDraftStore(interventionId)
    } else if (mode === "create") {
      clearDraftStore(NEW_INTERVENTION_DRAFT_KEY)
    }
  }, [mode, interventionId, clearDraftStore])

  /** Sauvegarde l'état courant du formulaire comme draft de création (clé __new__) */
  const saveNewDraft = useCallback(() => {
    if (mode !== "create") return
    saveDraft(NEW_INTERVENTION_DRAFT_KEY, {
      formData,
      locationQuery,
      selectedArtisanId,
      selectedSecondArtisanId,
      collapsibleState,
      hasPendingChanges: hasUnsavedChanges,
    })
  }, [mode, saveDraft, formData, locationQuery, selectedArtisanId, selectedSecondArtisanId, collapsibleState, hasUnsavedChanges])

  // Absences artisans
  useEffect(() => {
    let cancelled = false
    const artisanIds = new Set<string>()

    nearbyArtisans.forEach((artisan) => artisanIds.add(artisan.id))
    nearbyArtisansSecondMetier.forEach((artisan) => artisanIds.add(artisan.id))
    if (searchSelectedArtisan?.id) artisanIds.add(searchSelectedArtisan.id)
    if (searchSelectedSecondArtisan?.id) artisanIds.add(searchSelectedSecondArtisan.id)

    if (artisanIds.size === 0) {
      setAbsentArtisanIds(new Set())
      return
    }

    setAbsentArtisanIds(new Set())
    const nowIso = new Date().toISOString()

    const loadAbsences = async () => {
      const { data, error } = await supabase
        .from("artisan_absences")
        .select("artisan_id")
        .in("artisan_id", Array.from(artisanIds))
        .lte("start_date", nowIso)
        .gte("end_date", nowIso)

      if (cancelled) return

      if (error) {
        console.warn(`[useInterventionFormState] Erreur lors du chargement des absences:`, error)
        setAbsentArtisanIds(new Set())
        return
      }

      setAbsentArtisanIds(
        new Set((data ?? []).map((absence: any) => absence.artisan_id).filter(Boolean)),
      )
    }

    loadAbsences()

    return () => {
      cancelled = true
    }
  }, [nearbyArtisans, nearbyArtisansSecondMetier, searchSelectedArtisan?.id, searchSelectedSecondArtisan?.id])

  // Cleanup suggestion blur timeout
  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  // Sync client name
  useEffect(() => {
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

  // Sync client phone
  useEffect(() => {
    onClientPhoneChange?.(formData.telephoneClient)
  }, [formData.telephoneClient, onClientPhoneChange])

  // Sync agency name
  useEffect(() => {
    if (refData?.agencies && formData.agence_id) {
      const agency = refData.agencies.find((a: any) => a.id === formData.agence_id)
      if (agency) {
        onAgencyNameChange?.(agency.label || "")
      }
    } else if (!formData.agence_id) {
      onAgencyNameChange?.("")
    }
  }, [formData.agence_id, refData?.agencies, onAgencyNameChange])

  // ---- Handlers ----

  const handleInputChange = useCallback((field: keyof InterventionFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setGeocodeError(null)
  }, [])

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
      setSelectedArtisanId(artisan.id)
      handleInputChange("artisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
      // Auto-select artisan for email if they have an email
      if (artisan.email) {
        setSelectedArtisanForEmail(artisan.id)
      }
    },
    [handleInputChange],
  )

  const handleRemoveSelectedArtisan = useCallback(() => {
    setSelectedArtisanId(null)
    setSearchSelectedArtisan(null)
  }, [])

  const handleSelectSecondArtisan = useCallback(
    (artisan: NearbyArtisan) => {
      setSelectedSecondArtisanId(artisan.id)
      handleInputChange("secondArtisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
      handleInputChange("secondArtisanTelephone", artisan.telephone || "")
      handleInputChange("secondArtisanEmail", artisan.email || "")
    },
    [handleInputChange],
  )

  const handleRemoveSecondArtisan = useCallback(() => {
    setSelectedSecondArtisanId(null)
    setSearchSelectedSecondArtisan(null)
    handleInputChange("secondArtisan", "")
    handleInputChange("secondArtisanTelephone", "")
    handleInputChange("secondArtisanEmail", "")
  }, [handleInputChange])

  const handleSecondArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = getArtisanDisplayName(artisan)

    setSelectedSecondArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      secondArtisan: displayName,
      secondArtisanTelephone: artisan.telephone || "",
      secondArtisanEmail: artisan.email || "",
    }))

    const isInProximity = nearbyArtisansSecondMetier.some(a => a.id === artisan.id)
    if (!isInProximity) {
      setSearchSelectedSecondArtisan(artisanSearchResultToNearbyArtisan(artisan, displayName))
    } else {
      setSearchSelectedSecondArtisan(null)
    }
  }, [nearbyArtisansSecondMetier])

  const handleArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = getArtisanDisplayName(artisan)

    setSelectedArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      artisan: displayName,
      artisanTelephone: artisan.telephone || "",
      artisanEmail: artisan.email || "",
    }))

    const isInProximity = nearbyArtisans.some(a => a.id === artisan.id)
    if (!isInProximity) {
      setSearchSelectedArtisan(artisanSearchResultToNearbyArtisan(artisan, displayName))
    } else {
      setSearchSelectedArtisan(null)
    }
  }, [nearbyArtisans])

  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
      suggestionBlurTimeoutRef.current = null
    }

    const addressParts = parseAddress(suggestion.label)

    clearSuggestions()
    setShowLocationSuggestions(false)

    setFormData((prev) => ({
      ...prev,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
      adresse_complete: suggestion.label,
      code_postal: addressParts.postalCode || prev.code_postal || "",
      ville: addressParts.city || prev.ville || "",
    }))

    setLocationQuery(suggestion.label)
    setGeocodeError(null)
  }, [clearSuggestions, setLocationQuery])

  const handleGeocodeAddress = useCallback(async () => {
    const fullAddress = locationQuery.trim()
    if (!fullAddress) {
      setGeocodeError("Adresse manquante")
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)
    clearSuggestions()
    setShowLocationSuggestions(false)

    try {
      const result = await geocodeQuery(fullAddress)
      if (!result) {
        setGeocodeError("Adresse introuvable")
        return
      }

      const addressParts = parseAddress(result.label)

      setFormData((prev) => ({
        ...prev,
        latitude: result.lat,
        longitude: result.lng,
        adresse_complete: result.label,
        code_postal: addressParts.postalCode || prev.code_postal || "",
        ville: addressParts.city || prev.ville || "",
      }))
      setLocationQuery(result.label)
    } catch (error) {
      console.error("[Geocode] Error:", error)
      setGeocodeError("Une erreur est survenue lors de la géolocalisation")
    } finally {
      setIsGeocoding(false)
    }
  }, [locationQuery, geocodeQuery, clearSuggestions, setLocationQuery])

  const handleOpenDevisEmailModal = useCallback((artisanId?: string) => {
    const targetArtisanId = artisanId || effectiveSelectedArtisanId
    if (!targetArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    if (artisanId) {
      setSelectedArtisanForEmail(artisanId)
    }
    setIsDevisEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  const handleOpenInterventionEmailModal = useCallback((artisanId?: string) => {
    const targetArtisanId = artisanId || effectiveSelectedArtisanId
    if (!targetArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    if (artisanId) {
      setSelectedArtisanForEmail(artisanId)
    }
    setIsInterventionEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  const generateEmailTemplateData = useCallback((artisanId: string): EmailTemplateData => {
    const nomClient = formData.nomPrenomClient || ''
    const telephoneClient = formData.telephoneClient || ''
    const adresse = formData.adresse
      ? `${formData.adresse}, ${formData.code_postal || ''} ${formData.ville || ''}`.trim()
      : ''
    const isPrimary = artisanId === selectedArtisanId
    const consigneArtisan = isPrimary
      ? (formData.consigne_intervention || '')
      : (formData.consigne_second_artisan || '')
    const coutSST = isPrimary
      ? (formData.coutSST || '')
      : (formData.coutSSTSecondArtisan || '')

    return {
      nomClient,
      telephoneClient,
      telephoneClient2: '',
      adresse,
      datePrevue: formData.date_prevue || undefined,
      consigneArtisan: consigneArtisan || undefined,
      coutSST,
      commentaire: undefined,
      idIntervention: formData.id_inter || undefined,
    }
  }, [formData, selectedArtisanId])

  const handleOpenArtisanModal = useCallback((artisanId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    openArtisanModal(artisanId, {
      origin: mode === "create" ? "new-intervention" : "intervention-edit",
    })
  }, [openArtisanModal, mode])

  // ---- Return ----

  return {
    // Données de référence
    refData,
    refDataLoading,
    currentUser,

    // État du formulaire
    formData,
    setFormData,
    isSubmitting,
    setIsSubmitting,
    isFormReady,
    hasUnsavedChanges,
    clearDraft,
    saveNewDraft,

    // Géocodage
    locationQuery,
    setLocationQuery,
    locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocodeQuery,
    showLocationSuggestions,
    setShowLocationSuggestions,
    isGeocoding,
    geocodeError,
    setGeocodeError,
    suggestionBlurTimeoutRef,

    // Périmètre
    perimeterKmInput,
    setPerimeterKmInput,
    perimeterKmValue,

    // Artisan principal
    selectedArtisanId,
    setSelectedArtisanId,
    selectedArtisanData,
    searchSelectedArtisan,
    setSearchSelectedArtisan,
    nearbyArtisans,
    isLoadingNearbyArtisans,
    nearbyArtisansError,
    // Artisans assignés (DB) — pour sync Realtime
    setAssignedPrimaryArtisan,
    setAssignedSecondaryArtisan,

    // Second artisan
    selectedSecondArtisanId,
    setSelectedSecondArtisanId,
    selectedSecondArtisanData,
    searchSelectedSecondArtisan,
    setSearchSelectedSecondArtisan,
    nearbyArtisansSecondMetier,
    isLoadingNearbyArtisansSecondMetier,

    // Absences
    absentArtisanIds,

    // Marges
    margePrimaryArtisan,

    // Carte
    mapMarkers,
    mapSelectedConnection,

    // Sections collapsibles
    collapsibleState,
    setCollapsibleState,

    // Recherche artisan
    showArtisanSearch,
    setShowArtisanSearch,
    showSecondArtisanSearch,
    setShowSecondArtisanSearch,
    artisanSearchPosition,
    setArtisanSearchPosition,
    secondArtisanSearchPosition,
    setSecondArtisanSearchPosition,
    artisanSearchContainerRef,
    artisanDisplayMode,
    setArtisanDisplayMode,

    // Modales email
    isDevisEmailModalOpen,
    setIsDevisEmailModalOpen,
    isInterventionEmailModalOpen,
    setIsInterventionEmailModalOpen,
    selectedArtisanForEmail,
    setSelectedArtisanForEmail,
    effectiveSelectedArtisanId,
    selectedArtisanEmail,

    // Validation
    selectedStatus,
    requiresDefinitiveId,
    requiresDatePrevue,
    requiresArtisan,
    requiresFacture,
    requiresNomFacturation,
    requiresAssignedUser,
    requiresCouts,
    requiresConsigneArtisan,
    requiresClientInfo,
    requiresAgence,
    requiresMetier,
    requiresDevis,

    // Handlers
    handleInputChange,
    handleLocationChange,
    applyArtisanSelection,
    handleSelectNearbyArtisan,
    handleRemoveSelectedArtisan,
    handleSelectSecondArtisan,
    handleRemoveSecondArtisan,
    handleSecondArtisanSearchSelect,
    handleArtisanSearchSelect,
    handleSuggestionSelect,
    handleGeocodeAddress,
    handleOpenDevisEmailModal,
    handleOpenInterventionEmailModal,
    generateEmailTemplateData,
    handleOpenArtisanModal,

    // For edit-mode custom wrappers
    openArtisanModal,
  }
}
