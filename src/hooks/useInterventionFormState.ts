// ===== HOOK PARTAGÉ POUR L'ÉTAT DES FORMULAIRES D'INTERVENTION =====
// Encapsule toute la logique commune entre NewInterventionForm et InterventionEditForm

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useInterventionDraftStore, NEW_INTERVENTION_DRAFT_KEY } from "@/stores/interventionDraft"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { useFormDataChanges } from "@/hooks/useFormDataChanges"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import type { EmailTemplateData } from "@/lib/email-templates/intervention-emails"
import { calculatePrimaryArtisanMargin } from "@/lib/utils/margin-calculator"
import { toast } from "sonner"

import { MAX_RADIUS_KM } from "@/lib/interventions/form-constants"
import { useInterventionValidation } from "@/hooks/useInterventionValidation"
import { formatDistanceKm, parseAddress } from "@/lib/interventions/form-utils"
import type { InterventionFormData, CollapsibleSectionsState } from "@/lib/interventions/form-types"
import { getDefaultCollapsibleState } from "@/lib/interventions/form-types"
import { useArtisanSelection } from "@/hooks/useArtisanSelection"
import { getUserDisplayName } from "@/utils/user-display-name"

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
  /** Données de fallback pour l'email template (edit mode — enrichit le template avec données intervention) */
  interventionFallbackData?: {
    tenants?: { plain_nom_client?: string; lastname?: string; firstname?: string; telephone?: string; telephone2?: string } | null
    consigne_intervention?: string | null
    consigne_second_artisan?: string | null
    adresse?: string | null
    date_prevue?: string | null
    commentaire_agent?: string | null
    id_inter?: string | null
    artisans?: Array<{ artisan_id: string; is_primary: boolean }>
  }
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
    interventionFallbackData,
    interventionId,
    restoreNewDraft = false,
    onClientNameChange,
    onAgencyNameChange,
    onClientPhoneChange,
    onHasUnsavedChanges,
  } = options

  // ---- Draft store ----
  const getDraft = useInterventionDraftStore((s) => s.getDraft)
  const saveDraft = useInterventionDraftStore((s) => s.saveDraft)
  const clearDraftStore = useInterventionDraftStore((s) => s.clearDraft)
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
    return {
      id: currentUserData.id,
      displayName: getUserDisplayName(currentUserData),
      code: currentUserData.code_gestionnaire ?? null,
      color: currentUserData.color ?? null,
      avatarUrl: currentUserData.avatar_url ?? null,
      roles: Array.isArray(currentUserData.roles) ? currentUserData.roles : [],
    }
  }, [currentUserData])

  // ---- État principal du formulaire ----
  const [formData, setFormData] = useState<InterventionFormData>(existingDraft?.formData ?? initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormReady, setIsFormReady] = useState(false)

  const handleInputChange = useCallback((field: keyof InterventionFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

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

  // ---- Artisan selection (extracted sub-hook) ----
  const artisanSelection = useArtisanSelection({
    formData,
    perimeterKmValue,
    initialSelectedArtisanId,
    initialSelectedSecondArtisanId,
    initialPrimaryArtisanData,
    initialSecondaryArtisanData,
    draftSelectedArtisanId: existingDraft?.selectedArtisanId,
    draftSelectedSecondArtisanId: existingDraft?.selectedSecondArtisanId,
    onFormDataChange: handleInputChange,
  })

  // ---- Sections collapsibles ----
  const [collapsibleState, setCollapsibleState] = useState<CollapsibleSectionsState>(() => {
    if (existingDraft?.collapsibleState) return existingDraft.collapsibleState
    const defaults = getDefaultCollapsibleState()
    return {
      ...defaults,
      isSecondArtisanOpen: initialSelectedSecondArtisanId != null || initialSecondaryArtisanData != null,
    }
  })

  // ---- Recherche artisan UI state ----
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [showSecondArtisanSearch, setShowSecondArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const [secondArtisanSearchPosition, setSecondArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const artisanSearchContainerRef = useRef<HTMLDivElement>(null)
  const [artisanDisplayMode, setArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")

  // ---- Modale email ----
  const [emailModalState, setEmailModalState] = useState<{
    type: 'devis' | 'intervention'
    artisanId: string
  } | null>(null)

  const effectiveSelectedArtisanId = useMemo(() => {
    return emailModalState?.artisanId || artisanSelection.selectedArtisanId || null
  }, [emailModalState, artisanSelection.selectedArtisanId])

  const selectedArtisanEmail = useMemo(() => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''
    if (artisanSelection.selectedArtisanData?.id === artisanId) {
      return artisanSelection.selectedArtisanData.email || ''
    }
    if (artisanSelection.selectedSecondArtisanData?.id === artisanId) {
      return artisanSelection.selectedSecondArtisanData.email || ''
    }
    return ''
  }, [effectiveSelectedArtisanId, artisanSelection.selectedArtisanData, artisanSelection.selectedSecondArtisanData])

  // ---- Memos: marges ----
  const margePrimaryArtisan = useMemo(() => {
    const sst1 = parseFloat(String(formData.coutSST)) || 0
    const mat1 = parseFloat(String(formData.coutMateriel)) || 0
    const sst2 = parseFloat(String(formData.coutSSTSecondArtisan)) || 0
    const mat2 = parseFloat(String(formData.coutMaterielSecondArtisan)) || 0
    return calculatePrimaryArtisanMargin(formData.coutIntervention, sst1 + sst2, mat1 + mat2)
  }, [formData.coutIntervention, formData.coutSST, formData.coutMateriel, formData.coutSSTSecondArtisan, formData.coutMaterielSecondArtisan])

  // ---- Memos: carte ----
  const mapMarkers = useMemo(() => {
    const artisans = artisanSelection.nearbyArtisans
    if (!refData?.artisanStatuses) {
      return artisans.map((artisan) => ({
        id: artisan.id,
        lat: artisan.lat,
        lng: artisan.lng,
        color: artisan.id === artisanSelection.selectedArtisanData?.id ? "#f97316" : "#2563eb",
        title: artisan.displayName,
      }))
    }

    const archiveStatusIds = new Set(
      refData.artisanStatuses.filter((s: any) => s.code === "ARCHIVE").map((s: any) => s.id),
    )
    const visibleArtisans = archiveStatusIds.size > 0
      ? artisans.filter((a) => !a.statut_id || !archiveStatusIds.has(a.statut_id))
      : artisans

    return visibleArtisans.map((artisan) => ({
      id: artisan.id,
      lat: artisan.lat,
      lng: artisan.lng,
      color: artisan.id === artisanSelection.selectedArtisanData?.id ? "#f97316" : "#2563eb",
      title: artisan.displayName,
    }))
  }, [artisanSelection.nearbyArtisans, artisanSelection.selectedArtisanData, refData?.artisanStatuses])

  const mapSelectedConnection = useMemo(() => {
    if (!artisanSelection.selectedArtisanData) return null
    return {
      lat: artisanSelection.selectedArtisanData.lat,
      lng: artisanSelection.selectedArtisanData.lng,
      distanceLabel: formatDistanceKm(artisanSelection.selectedArtisanData.distanceKm),
    }
  }, [artisanSelection.selectedArtisanData])

  // ---- Memos: validation ----
  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) return undefined
    return refData.interventionStatuses.find((status: any) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const validation = useInterventionValidation(selectedStatus)

  // ---- Effects ----

  // Sync location query initiale
  useEffect(() => {
    if (formData.adresse_complete && !locationQuery) {
      setLocationQuery(formData.adresse_complete)
    }
  }, [formData.adresse_complete]) // eslint-disable-line react-hooks/exhaustive-deps

  // Form ready
  useEffect(() => { setIsFormReady(true) }, [])

  // Unsaved changes
  const hasUnsavedChanges = useFormDataChanges(formData, isSubmitting, isFormReady, existingDraft?.hasPendingChanges ?? false)

  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onHasUnsavedChanges])

  // Draft persistence (edit mode)
  useEffect(() => {
    if (mode !== "edit" || !interventionId || !isFormReady) return
    saveDraft(interventionId, {
      formData,
      locationQuery,
      selectedArtisanId: artisanSelection.selectedArtisanId,
      selectedSecondArtisanId: artisanSelection.selectedSecondArtisanId,
      collapsibleState,
      hasPendingChanges: hasUnsavedChanges,
    })
  }, [mode, interventionId, isFormReady, formData, locationQuery, artisanSelection.selectedArtisanId, artisanSelection.selectedSecondArtisanId, collapsibleState, hasUnsavedChanges, saveDraft])

  const clearDraft = useCallback(() => {
    if (mode === "edit" && interventionId) {
      clearDraftStore(interventionId)
    } else if (mode === "create") {
      clearDraftStore(NEW_INTERVENTION_DRAFT_KEY)
    }
  }, [mode, interventionId, clearDraftStore])

  const saveNewDraft = useCallback(() => {
    if (mode !== "create") return
    saveDraft(NEW_INTERVENTION_DRAFT_KEY, {
      formData,
      locationQuery,
      selectedArtisanId: artisanSelection.selectedArtisanId,
      selectedSecondArtisanId: artisanSelection.selectedSecondArtisanId,
      collapsibleState,
      hasPendingChanges: hasUnsavedChanges,
    })
  }, [mode, saveDraft, formData, locationQuery, artisanSelection.selectedArtisanId, artisanSelection.selectedSecondArtisanId, collapsibleState, hasUnsavedChanges])

  // Cleanup suggestion blur timeout
  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  // Sync parent callbacks
  useEffect(() => { onClientNameChange?.(formData.nomPrenomClient) }, [formData.nomPrenomClient, onClientNameChange])
  useEffect(() => { onClientPhoneChange?.(formData.telephoneClient) }, [formData.telephoneClient, onClientPhoneChange])
  useEffect(() => {
    if (refData?.agencies && formData.agence_id) {
      const agency = refData.agencies.find((a: any) => a.id === formData.agence_id)
      if (agency) onAgencyNameChange?.(agency.label || "")
    } else if (!formData.agence_id) {
      onAgencyNameChange?.("")
    }
  }, [formData.agence_id, refData?.agencies, onAgencyNameChange])

  // ---- Handlers ----

  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
    setGeocodeError(null)
  }, [])

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
    if (!fullAddress) { setGeocodeError("Adresse manquante"); return }

    setIsGeocoding(true)
    setGeocodeError(null)
    clearSuggestions()
    setShowLocationSuggestions(false)

    try {
      const result = await geocodeQuery(fullAddress)
      if (!result) { setGeocodeError("Adresse introuvable"); return }
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

  const openEmailModal = useCallback((type: 'devis' | 'intervention', artisanId?: string) => {
    const targetArtisanId = artisanId || artisanSelection.selectedArtisanId || null
    if (!targetArtisanId) { toast.error('Veuillez sélectionner un artisan'); return }
    setEmailModalState({ type, artisanId: targetArtisanId })
  }, [artisanSelection.selectedArtisanId])

  const closeEmailModal = useCallback(() => { setEmailModalState(null) }, [])

  const generateEmailTemplateData = useCallback((artisanId: string): EmailTemplateData => {
    const fb = interventionFallbackData
    const tenant = fb?.tenants
    const dbArtisan = fb?.artisans?.find((a) => a.artisan_id === artisanId)
    const isPrimary = dbArtisan ? dbArtisan.is_primary : (artisanId === artisanSelection.selectedArtisanId)

    const nomClient = formData.nomPrenomClient
      || (tenant?.plain_nom_client || `${tenant?.lastname || ''} ${tenant?.firstname || ''}`.trim())
      || ''
    const consigneArtisan = isPrimary
      ? (formData.consigne_intervention || fb?.consigne_intervention || '')
      : (formData.consigne_second_artisan || fb?.consigne_second_artisan || '')
    const coutSST = isPrimary
      ? (formData.coutSST || '')
      : (formData.coutSSTSecondArtisan || '')

    return {
      nomClient,
      telephoneClient: formData.telephoneClient || tenant?.telephone || '',
      telephoneClient2: tenant?.telephone2 || '',
      adresse: formData.adresse || fb?.adresse || '',
      datePrevue: formData.date_prevue || fb?.date_prevue || undefined,
      consigneArtisan: consigneArtisan || undefined,
      coutSST,
      commentaire: formData.commentaire_agent || fb?.commentaire_agent || undefined,
      idIntervention: formData.id_inter || fb?.id_inter || undefined,
      isVacant: formData.is_vacant || false,
      keyCode: formData.key_code || '',
      floor: formData.floor || '',
      apartmentNumber: formData.apartment_number || '',
      vacantHousingInstructions: formData.vacant_housing_instructions || '',
    }
  }, [formData, artisanSelection.selectedArtisanId, interventionFallbackData])

  const handleOpenArtisanModal = useCallback((artisanId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    openArtisanModal(artisanId, { origin: mode === "create" ? "new-intervention" : "intervention-edit" })
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

    // Artisan (spread from sub-hook)
    ...artisanSelection,

    // Marges
    margePrimaryArtisan,

    // Carte
    mapMarkers,
    mapSelectedConnection,

    // Sections collapsibles
    collapsibleState,
    setCollapsibleState,

    // Recherche artisan UI
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

    // Modale email
    emailModalState,
    effectiveSelectedArtisanId,
    selectedArtisanEmail,

    // Validation
    selectedStatus,
    ...validation,

    // Handlers
    handleInputChange,
    handleLocationChange,
    handleSuggestionSelect,
    handleGeocodeAddress,
    openEmailModal,
    closeEmailModal,
    generateEmailTemplateData,
    handleOpenArtisanModal,

    // For edit-mode custom wrappers
    openArtisanModal,
  }
}
