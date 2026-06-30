// ===== ORCHESTRATEUR DU FORMULAIRE D'INTERVENTION =====
// Compose les sous-hooks (data, UI, sélection artisan, géocodage) et expose
// une API unifiée à NewInterventionForm + InterventionEditForm.
//
// Découpage :
//   - useInterventionFormData    → formData, validation, refData, marge, périmètre
//   - useInterventionFormUI      → collapsibles, dropdowns artisan, modale email
//   - useArtisanSelection        → sélection artisan principal/second + nearby
//   - useGeocodeSearch           → recherche d'adresses
//
// La persistance du draft reste ici car elle agrège l'état des sous-hooks.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useInterventionDraftStore, NEW_INTERVENTION_DRAFT_KEY } from "@/stores/interventionDraft"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import type { EmailTemplateData } from "@/lib/email-templates/intervention-emails"

import { formatDistanceKm } from "@/lib/interventions/form-utils"
import { resolveSuggestionParts } from "@/lib/geocode/address-parts"
import type { InterventionFormData } from "@/lib/interventions/form-types"
import { useArtisanSelection } from "@/hooks/useArtisanSelection"
import { useInterventionFormUI } from "@/hooks/useInterventionFormUI"
import { useInterventionFormData } from "@/hooks/useInterventionFormData"

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

  // ---- Données + validation + marge + périmètre + parent callbacks ----
  const data = useInterventionFormData({
    mode,
    initialFormData,
    interventionId,
    restoreNewDraft,
    onClientNameChange,
    onAgencyNameChange,
    onClientPhoneChange,
    onHasUnsavedChanges,
  })
  const {
    refData,
    formData,
    setFormData,
    handleInputChange,
    isSubmitting,
    isFormReady,
    hasUnsavedChanges,
    existingDraft,
    validation,
  } = data

  // ---- Draft store (persistance — agrège data + UI + artisanSelection) ----
  const saveDraft = useInterventionDraftStore((s) => s.saveDraft)
  const clearDraftStore = useInterventionDraftStore((s) => s.clearDraft)

  // ---- Modale artisan (navigation) ----
  const { open: openArtisanModal } = useArtisanModal()

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

  // ---- Sélection artisan ----
  const artisanSelection = useArtisanSelection({
    formData,
    perimeterKmValue: data.perimeterKmValue,
    initialSelectedArtisanId,
    initialSelectedSecondArtisanId,
    initialPrimaryArtisanData,
    initialSecondaryArtisanData,
    draftSelectedArtisanId: existingDraft?.selectedArtisanId,
    draftSelectedSecondArtisanId: existingDraft?.selectedSecondArtisanId,
    onFormDataChange: handleInputChange,
  })

  // ---- UI chrome ----
  const ui = useInterventionFormUI({
    initialCollapsibleState: existingDraft?.collapsibleState,
    initialOpenSecondArtisan: initialSelectedSecondArtisanId != null || initialSecondaryArtisanData != null,
    getFallbackEmailArtisanId: useCallback(() => artisanSelection.selectedArtisanId || null, [artisanSelection.selectedArtisanId]),
  })
  const { collapsibleState, emailModalState, setShowLocationSuggestions, suggestionBlurTimeoutRef } = ui

  // ---- Sélection effective + email pour modale ----
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

  // ---- Effects ----

  // Sync location query initiale depuis formData.adresse_complete
  useEffect(() => {
    if (formData.adresse_complete && !locationQuery) {
      setLocationQuery(formData.adresse_complete)
    }
  }, [formData.adresse_complete]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ---- Handlers ----

  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
    setGeocodeError(null)
  }, [setFormData])

  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
      suggestionBlurTimeoutRef.current = null
    }
    const addressParts = resolveSuggestionParts(suggestion)
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
  }, [clearSuggestions, setLocationQuery, setFormData, setShowLocationSuggestions, suggestionBlurTimeoutRef])

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
      const addressParts = resolveSuggestionParts(result)
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
  }, [locationQuery, geocodeQuery, clearSuggestions, setLocationQuery, setFormData, setShowLocationSuggestions])

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
    // Données de référence + form state + validation + marge + périmètre
    refData: data.refData,
    refDataLoading: data.refDataLoading,
    currentUser: data.currentUser,
    formData,
    setFormData,
    isSubmitting,
    setIsSubmitting: data.setIsSubmitting,
    isFormReady,
    hasUnsavedChanges,
    selectedStatus: data.selectedStatus,
    margePrimaryArtisan: data.margePrimaryArtisan,
    perimeterKmInput: data.perimeterKmInput,
    setPerimeterKmInput: data.setPerimeterKmInput,
    perimeterKmValue: data.perimeterKmValue,
    ...validation,

    // Draft
    clearDraft,
    saveNewDraft,

    // Géocodage
    locationQuery,
    setLocationQuery,
    locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocodeQuery,
    isGeocoding,
    geocodeError,
    setGeocodeError,

    // Artisan (spread from sub-hook)
    ...artisanSelection,

    // Carte
    mapMarkers,
    mapSelectedConnection,

    // UI chrome (collapsibles, dropdowns artisan, modale email, suggestions visibility)
    ...ui,

    // Sélection effective dérivée (pour modale email)
    effectiveSelectedArtisanId,
    selectedArtisanEmail,

    // Handlers
    handleInputChange,
    handleLocationChange,
    handleSuggestionSelect,
    handleGeocodeAddress,
    generateEmailTemplateData,
    handleOpenArtisanModal,

    // For edit-mode custom wrappers
    openArtisanModal,
  }
}
