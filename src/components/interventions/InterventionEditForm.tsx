"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GestionnaireField } from "@/components/interventions/GestionnaireField"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import type { Intervention } from "@/lib/api/v2/common/types"
import { usePermissions } from "@/hooks/usePermissions"
import type { StatusReasonType } from "@/lib/comments/statusReason"
import { cn } from "@/lib/utils"
import { ArtisanSearchModal } from "@/components/artisans/ArtisanSearchModal"
import { EmailEditModal } from "@/components/interventions/EmailEditModal"
import { SectionLock } from "@/components/ui/SectionLock"
import { openWhatsApp } from "@/lib/interventions/whatsapp"
import { normalizeArtisanData, getDisplayName } from "@/lib/artisans"

// Shared form state hook
import { useInterventionFormState } from "@/hooks/useInterventionFormState"
import { useInterventionSubmit } from "@/hooks/useInterventionSubmit"
import { useInterventionRealtime } from "@/hooks/useInterventionRealtime"
import { useInterventionDocumentChecks } from "@/hooks/useInterventionDocumentChecks"
import { usePanelResize } from "@/hooks/usePanelResize"
import { useInterventionAccomptes } from "@/hooks/useInterventionAccomptes"
import { useFieldPresenceDelegation } from "@/hooks/useFieldPresenceDelegation"
import { useDocumentReclassification } from "@/hooks/useDocumentReclassification"
import { useFieldPresence } from "@/contexts/FieldPresenceContext"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import {
  InterventionHeaderFields, InterventionOwnerSection, InterventionClientSection, InterventionDetailsSection,
  ArtisanPanel, SecondArtisanSection, PaymentSection, DocumentSection, CustomStatusSection,
} from "@/components/interventions/form-sections"

// Shared form utilities
import { INTERVENTION_DOCUMENT_KINDS, MAX_RADIUS_KM } from "@/lib/interventions/form-constants"
import { dbArtisanToNearbyArtisan } from "@/lib/interventions/form-utils"
import { createEditFormData } from "@/lib/interventions/form-types"
import {
  getArtisansWithEmail,
  isInterventionEmailButtonDisabled,
} from "@/lib/interventions/derivations"

// Convert readonly INTERVENTION_DOCUMENT_KINDS to mutable for DocumentManager
const DOCUMENT_KINDS = [...INTERVENTION_DOCUMENT_KINDS] as { kind: string; label: string }[]

interface InterventionEditFormProps {
  intervention: Intervention & { tenants?: any; owner?: any; intervention_artisans?: any[]; intervention_costs?: any[]; intervention_payments?: any[] }
  onSuccess?: (data: any) => void
  onCancel?: () => void
  mode?: "halfpage" | "centerpage" | "fullpage"
  formRef?: React.RefObject<HTMLFormElement | null>
  onSubmittingChange?: (isSubmitting: boolean) => void
  onClientNameChange?: (name: string) => void
  onAgencyNameChange?: (name: string) => void
  onClientPhoneChange?: (phone: string) => void
  onOpenSmsModal?: () => void
  onHasUnsavedChanges?: (hasChanges: boolean) => void
  onArtisanSearchOpenChange?: (isOpen: boolean) => void
  onEmailModalOpenChange?: (isOpen: boolean) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
  onPopoverOpenChange?: (isOpen: boolean) => void
  onReclassifyModalOpenChange?: (isOpen: boolean) => void
  readOnly?: boolean
}

export const InterventionEditForm = memo(function InterventionEditForm({
  intervention,
  onSuccess,
  onCancel,
  mode = "centerpage",
  formRef,
  onSubmittingChange,
  onClientNameChange,
  onAgencyNameChange,
  onClientPhoneChange,
  onOpenSmsModal,
  onHasUnsavedChanges,
  onArtisanSearchOpenChange,
  onEmailModalOpenChange,
  onStatusReasonModalOpenChange,
  onPopoverOpenChange,
  onReclassifyModalOpenChange,
  readOnly = false
}: InterventionEditFormProps) {
  const { can } = usePermissions()

  // Field-level presence tracking (soft lock)
  const { trackField, clearField } = useFieldPresence()
  useFieldPresenceDelegation(formRef ?? { current: null }, trackField, clearField)

  // Edit-specific state
  const [pendingReasonType, setPendingReasonType] = useState<StatusReasonType | null>(null)
  const [secondArtisanDisplayMode, setSecondArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")

  // Document checks (facture GMBS + devis)
  const { hasFactureGMBS, hasDevis, refreshFactureGMBS, refreshDevis } = useInterventionDocumentChecks(intervention.id)
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false)

  const handleReclassifyModalOpenChange = useCallback((open: boolean) => {
    setIsReclassifyModalOpen(open)
    onReclassifyModalOpenChange?.(open)
  }, [onReclassifyModalOpenChange])

  const { documentsToReclassify } = useDocumentReclassification({
    entityType: "intervention",
    entityId: intervention.id,
  })

  // Extraire les coûts et paiements (needed for createEditFormData)
  const costs = intervention.intervention_costs || []
  const payments = intervention.intervention_payments || []
  const sstCost = costs.find(c => c.cost_type === 'sst' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
  const materielCost = costs.find(c => c.cost_type === 'materiel' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
  const interventionCost = costs.find(c => c.cost_type === 'intervention')
  const sstCostSecondArtisan = costs.find(c => c.cost_type === 'sst' && c.artisan_order === 2)
  const materielCostSecondArtisan = costs.find(c => c.cost_type === 'materiel' && c.artisan_order === 2)
  const sstPayment = payments.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = payments.find(p => p.payment_type === 'acompte_client')

  // Artisans liés
  const artisans = useMemo(() => intervention.intervention_artisans || [], [intervention.intervention_artisans])
  const primaryArtisan = artisans.find(a => a.is_primary)?.artisans
  const secondaryArtisan = artisans.find(a => !a.is_primary)?.artisans

  // Use the shared form state hook
  const {
    // Reference data
    refData,
    refDataLoading,
    currentUser,

    // Form state
    formData,
    setFormData,
    isSubmitting,
    setIsSubmitting,
    clearDraft,

    // Geocoding
    locationQuery,
    setLocationQuery,
    locationSuggestions,
    clearSuggestions,
    showLocationSuggestions,
    setShowLocationSuggestions,
    isGeocoding,
    geocodeError,
    setGeocodeError,
    suggestionBlurTimeoutRef,

    // Perimeter
    perimeterKmInput,
    setPerimeterKmInput,
    perimeterKmValue,

    // Primary artisan
    selectedArtisanId,
    setSelectedArtisanId,
    selectedArtisanData,
    nearbyArtisans,
    isLoadingNearbyArtisans,
    nearbyArtisansError,
    setAssignedPrimaryArtisan,
    setAssignedSecondaryArtisan,

    // Secondary artisan
    selectedSecondArtisanId,
    setSelectedSecondArtisanId,
    selectedSecondArtisanData,
    nearbyArtisansSecondMetier,

    // Absences
    absentArtisanIds,

    // Margins
    margePrimaryArtisan,

    // Map
    mapMarkers,
    mapSelectedConnection,

    // Collapsible sections
    collapsibleState,
    setCollapsibleState,

    // Artisan search
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

    // Email modal
    emailModalState,
    selectedArtisanEmail,

    // Validation
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

    // Handlers (from shared hook)
    handleInputChange: baseHandleInputChange,
    handleLocationChange,
    handleSelectNearbyArtisan,
    handleRemoveSelectedArtisan,
    handleSelectSecondArtisan,
    handleRemoveSecondArtisan,
    handleSecondArtisanSearchSelect,
    handleArtisanSearchSelect,
    handleSuggestionSelect,
    handleGeocodeAddress,
    openEmailModal,
    closeEmailModal,
    generateEmailTemplateData,

    // For edit-specific wrappers
    openArtisanModal,
  } = useInterventionFormState({
    mode: "edit",
    interventionId: intervention.id,
    initialFormData: createEditFormData(
      intervention,
      primaryArtisan,
      secondaryArtisan,
      { sstCost, materielCost, interventionCost, sstCostSecondArtisan, materielCostSecondArtisan },
      { sstPayment, clientPayment }
    ),
    initialLocationQuery: (intervention as any).adresse_complete || "",
    initialSelectedArtisanId: primaryArtisan?.id ?? null,
    initialSelectedSecondArtisanId: secondaryArtisan?.id ?? null,
    initialPrimaryArtisanData: dbArtisanToNearbyArtisan(primaryArtisan),
    initialSecondaryArtisanData: dbArtisanToNearbyArtisan(secondaryArtisan),
    interventionFallbackData: {
      tenants: intervention.tenants,
      consigne_intervention: intervention.consigne_intervention,
      consigne_second_artisan: intervention.consigne_second_artisan,
      adresse: intervention.adresse,
      date_prevue: intervention.date_prevue,
      commentaire_agent: intervention.commentaire_agent,
      id_inter: intervention.id_inter,
      artisans: artisans.map(a => ({ artisan_id: a.artisan_id, is_primary: a.is_primary })),
    },
    onClientNameChange,
    onAgencyNameChange,
    onClientPhoneChange,
    onHasUnsavedChanges,
    onSubmittingChange,
  })

  // Destructure collapsible state for easier access
  const {
    isProprietaireOpen,
    isClientOpen,
    isAccompteOpen,
    isDocumentsOpen,
    isCommentsOpen,
    isSecondArtisanOpen,
    isSousStatutOpen,
  } = collapsibleState

  // Helper functions to update collapsible state
  const setIsProprietaireOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isProprietaireOpen: open })), [setCollapsibleState])
  const setIsClientOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isClientOpen: open })), [setCollapsibleState])
  const setIsAccompteOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isAccompteOpen: open })), [setCollapsibleState])
  const setIsDocumentsOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isDocumentsOpen: open })), [setCollapsibleState])
  const setIsCommentsOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isCommentsOpen: open })), [setCollapsibleState])
  const setIsSecondArtisanOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isSecondArtisanOpen: open })), [setCollapsibleState])
  const setIsSousStatutOpen = useCallback((open: boolean) => setCollapsibleState(prev => ({ ...prev, isSousStatutOpen: open })), [setCollapsibleState])

  // Edit-specific: Status reason modal state
  const isStatusReasonModalOpen = pendingReasonType !== null

  // Edit-specific effects
  useEffect(() => {
    onEmailModalOpenChange?.(emailModalState !== null)
  }, [emailModalState, onEmailModalOpenChange])

  useEffect(() => {
    onStatusReasonModalOpenChange?.(isStatusReasonModalOpen)
  }, [isStatusReasonModalOpen, onStatusReasonModalOpenChange])

  useEffect(() => {
    onArtisanSearchOpenChange?.(showArtisanSearch || showSecondArtisanSearch)
  }, [showArtisanSearch, showSecondArtisanSearch, onArtisanSearchOpenChange])

  // Right column panel resize
  const rightColumnStorageKey = currentUser?.id
    ? `gmbs:intervention-form:right-column-width:${currentUser.id}`
    : null
  const { width: rightColumnWidth, handleResizeStart } = usePanelResize({
    storageKey: rightColumnStorageKey,
  })

  // Fonction helper pour obtenir le nom à afficher selon le mode
  // Uses centralized artisan display utilities
  const getArtisanDisplayName = useCallback((artisan: NearbyArtisan, mode: "nom" | "rs" | "tel"): string => {
    const displayData = normalizeArtisanData(artisan, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getDisplayName(displayData, mode)
  }, [refData?.artisanStatuses])

  // Realtime sync: reset form when another user modifies the intervention
  useInterventionRealtime({
    intervention,
    setFormData,
    setSelectedArtisanId,
    setSelectedSecondArtisanId,
    setAssignedPrimaryArtisan,
    setAssignedSecondaryArtisan,
  })

  // Edit-specific: Permission checks
  const canEditContext = useMemo(() => {
    const roles = currentUser?.roles ?? []
    return roles.some((role) => typeof role === "string" && role.toLowerCase().includes("admin"))
  }, [currentUser])

  const canWriteInterventions = can("write_interventions")
  const canEditClosedInterventions = can("edit_closed_interventions")

  const isClosedStatus = useMemo(() => {
    if (!intervention.statut_id || !refData?.interventionStatuses) return false

    const initialStatus = refData.interventionStatuses.find((s) => s.id === intervention.statut_id)
    if (!initialStatus) return false

    // On ne bloque que si le code est INTER_TERMINEE en base au chargement
    return initialStatus.code === "INTER_TERMINEE"
  }, [intervention.statut_id, refData?.interventionStatuses])

  const canEditIntervention = canWriteInterventions && (!isClosedStatus || canEditClosedInterventions)

  // Edit-specific: Helper to get status code
  const getInterventionStatusCode = useCallback(
    (statusId?: string | null) => {
      if (!statusId || !refData?.interventionStatuses) {
        return ""
      }
      return refData.interventionStatuses.find((status: any) => status.id === statusId)?.code ?? ""
    },
    [refData?.interventionStatuses],
  )

  const initialStatusCode = useMemo(
    () => getInterventionStatusCode(intervention.statut_id),
    [intervention.statut_id, getInterventionStatusCode],
  )

  // Edit-specific: Wrapper for handleInputChange with auto-open collapsible sections
  const handleInputChange = useCallback((field: string, value: any) => {
    // Call the base handler from the hook
    baseHandleInputChange(field as any, value)

    // Auto-open collapsible sections based on status change
    if (field === "statut_id" && value && refData?.interventionStatuses) {
      const status = refData.interventionStatuses.find((s: any) => s.id === value)
      if (status) {
        const statusCode = (status.code ?? "").toUpperCase()
        const statusLabel = (status.label ?? "").toLowerCase()

        // For DEVIS_ENVOYE: open "Détails facturation" if field is empty
        if (statusCode === "DEVIS_ENVOYE" || statusLabel.includes("devis envoyé")) {
          setFormData((currentFormData: any) => {
            if (!currentFormData.nomPrenomFacturation?.trim()) {
              setIsProprietaireOpen(true)
            }
            return currentFormData
          })
        }

        // For INTER_EN_COURS: open "Détails client" if fields are empty
        if (statusCode === "INTER_EN_COURS" || statusLabel.includes("inter en cours") || statusLabel.includes("intervention en cours")) {
          setFormData((currentFormData: any) => {
            if (!currentFormData.nomPrenomClient?.trim() || !currentFormData.telephoneClient?.trim()) {
              setIsClientOpen(true)
            }
            return currentFormData
          })
        }
      }
    }
  }, [baseHandleInputChange, refData?.interventionStatuses, setFormData, setIsProprietaireOpen, setIsClientOpen])

  // --- Gestion des acomptes ---
  const {
    canEditAccomptes,
    handleAccompteSSTChange,
    handleAccompteClientChange,
    handleAccompteSSTBlur,
    handleAccompteClientBlur,
    handleAccompteSSTRecuChange,
    handleAccompteClientRecuChange,
    handleDateAccompteSSTRecuChange,
    handleDateAccompteClientRecuChange,
  } = useInterventionAccomptes({
    interventionId: intervention.id,
    formData,
    interventionStatuses: refData?.interventionStatuses,
    handleInputChange,
  })

  // Artisans with valid email (from intervention_artisans + currently-selected)
  const artisansWithEmail = useMemo(
    () => getArtisansWithEmail(artisans, selectedArtisanData),
    [artisans, selectedArtisanData],
  )


  // WhatsApp handler using extracted utility
  const handleOpenWhatsApp = useCallback((
    emailType: 'devis' | 'intervention',
    artisanId: string,
    artisanPhone: string
  ) => {
    openWhatsApp({ emailType, artisanId, artisanPhone, generateEmailTemplateData })
  }, [generateEmailTemplateData])

  // Conditions de blocage des boutons Mail/WhatsApp
  // Devis → lié aux requirements de VISITE_TECHNIQUE (artisan requis)
  const isDevisButtonDisabled = !selectedArtisanId
  // Inter. → lié aux requirements de INTER_EN_COURS (client fields optional if vacant)
  const isInterButtonDisabled = useMemo(
    () => isInterventionEmailButtonDisabled({ selectedArtisanId, formData }),
    [
      selectedArtisanId,
      formData.id_inter,
      formData.coutIntervention,
      formData.coutSST,
      formData.consigne_intervention,
      formData.nomPrenomClient,
      formData.telephoneClient,
      formData.date_prevue,
      formData.is_vacant,
    ],
  )

  // Edit-specific: handleOpenArtisanModal with intervention context
  const handleOpenArtisanModal = useCallback((artisanId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    // Ouvrir le modal d'artisan avec le layoutId de l'intervention actuelle
    // pour pouvoir revenir à cette intervention à la fermeture
    openArtisanModal(artisanId, {
      layoutId: intervention.id,
      origin: `intervention:${intervention.id}`,
    })
  }, [intervention.id, openArtisanModal])

  // Agency data (needed before submit hook for showReferenceField)
  const selectedAgencyId = formData.agence_id
  const selectedAgencyData = useMemo(() => {
    if (!selectedAgencyId || !refData?.agencies) return undefined
    return refData.agencies.find((agency) => agency.id === selectedAgencyId)
  }, [selectedAgencyId, refData])

  const showReferenceField = useMemo(() => {
    if (!selectedAgencyData) return false
    return selectedAgencyData.requires_reference === true
  }, [selectedAgencyData])

  // Submit logic (extracted hook)
  const { executeSubmit, handleSubmit: baseHandleSubmit } = useInterventionSubmit({
    interventionId: intervention.id,
    formData,
    currentUser,
    selectedArtisanId,
    selectedArtisanData,
    selectedSecondArtisanId,
    primaryArtisanId: primaryArtisan?.id ?? null,
    secondaryArtisanId: secondaryArtisan?.id ?? null,
    canEditContext,
    readOnly,
    initialStatusCode,
    showReferenceField,
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
    setIsSubmitting,
    onSubmittingChange,
    onSuccess,
    clearDraft,
    getInterventionStatusCode,
  })

  // Wrap handleSubmit to handle status reason modal
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    const result = await baseHandleSubmit(event)
    if (result?.pendingReasonType) {
      setPendingReasonType(result.pendingReasonType)
    }
  }, [baseHandleSubmit])

  const handleStatusReasonCancel = () => {
    setPendingReasonType(null)
  }

  const handleStatusReasonConfirm = async (reason: string) => {
    const reasonType = pendingReasonType
    if (!reasonType) return
    setPendingReasonType(null)
    await executeSubmit({ reason, reasonType })
  }

  // Expose client name to parent
  useEffect(() => {
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

  // Expose agency name to parent
  useEffect(() => {
    onAgencyNameChange?.(selectedAgencyData?.label || "")
  }, [selectedAgencyData?.label, onAgencyNameChange])

  if (refDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Chargement des données...</div>
      </div>
    )
  }

  // Hauteur de la section carte+artisans basée sur la sélection d'artisan
  // Cette hauteur reste fixe une fois l'artisan sélectionné pour éviter les redimensionnements
  const mapSectionHeight = selectedArtisanId ? "150px" : "220px"

  const DEFAULT_MAP_PANEL_SIZE = 70
  const DEFAULT_ARTISANS_PANEL_SIZE = 30
  const panelStorageId = currentUser?.id
    ? `gmbs:intervention-form:panel-size:${currentUser.id}`
    : null

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        {!canEditIntervention && !readOnly && (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Cette intervention est en lecture seule. Permission requise :{" "}
            {isClosedStatus ? "edit_closed_interventions" : "write_interventions"}
          </div>
        )}
        <fieldset className={cn("flex-1 min-h-0 flex flex-col", readOnly && "pointer-events-none select-none")} disabled={readOnly}>
          {/* LAYOUT DEUX COLONNES DISTINCTES - Chaque colonne a son propre scroll */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* COLONNE GAUCHE - Scroll indépendant avec scrollbar minimale à gauche */}
            <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal scrollbar-left">
              <SectionLock isLocked={!canEditIntervention}>
                <div
                  className="grid gap-3 pb-4"
                  style={{
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gridTemplateRows: `auto auto auto ${mapSectionHeight} auto auto`,
                  }}
                >
                  {/* DIV1: HEADER PRINCIPAL - Row 1, Cols 1-4 */}
                  <InterventionHeaderFields
                    formData={formData}
                    onChange={handleInputChange}
                    refData={refData}
                    showReferenceField={showReferenceField}
                    requiresDefinitiveId={requiresDefinitiveId}
                    withPresence
                    onPopoverOpenChange={onPopoverOpenChange}
                    renderUserBadge={() => (
                      <GestionnaireField
                        value={formData.assigned_user_id}
                        onChange={(userId) => handleInputChange("assigned_user_id", userId || null)}
                        interventionDate={(intervention as any).date ?? (intervention as any).date_intervention ?? formData?.date}
                        required={requiresAssignedUser}
                        onOpenChange={onPopoverOpenChange}
                      />
                    )}
                  />

                  {/* DIV2: ADRESSE - Row 2, Cols 1-4 */}
                  <Card style={{ gridArea: "2 / 1 / 3 / 5" }}>
                    <CardContent className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="adresse" className="text-[10px] text-muted-foreground whitespace-nowrap">Adresse *</Label>
                        <PresenceFieldIndicator fieldName="adresse">
                        <Input
                          id="adresse"
                          value={formData.adresse}
                          onChange={(event) => handleInputChange("adresse", event.target.value)}
                          placeholder="Adresse complète de l'intervention..."
                          className="h-7 text-xs flex-1"
                          required
                        />
                        </PresenceFieldIndicator>
                      </div>
                    </CardContent>
                  </Card>

                  {/* DIV3: LOCALISATION + RAYON + BOUTON - Row 3, Cols 1-4 */}
                  <Card style={{ gridArea: "3 / 1 / 4 / 5" }}>
                    <CardContent className="py-2 px-3">
                      <div className="flex items-center gap-2">
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
                            placeholder="Rechercher une adresse pour localiser..."
                            className="h-7 text-xs"
                          />
                          {showLocationSuggestions && locationSuggestions.length > 0 && (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-muted bg-background shadow-lg">
                              <ul className="divide-y divide-border text-left text-xs">
                                {locationSuggestions.map((suggestion) => (
                                  <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                                    <button
                                      type="button"
                                      className="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left transition hover:bg-muted/80 focus:bg-muted/80"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => handleSuggestionSelect(suggestion)}
                                    >
                                      <span className="truncate font-medium">{suggestion.label}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {suggestion.lat.toFixed(4)} • {suggestion.lng.toFixed(4)}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
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
                          placeholder="km"
                          className="h-7 w-18 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground">km</span>
                        <Button type="button" variant="secondary" size="sm" className="h-7 text-xs px-2" onClick={handleGeocodeAddress} disabled={isGeocoding}>
                          {isGeocoding ? "..." : "Localiser"}
                        </Button>
                      </div>
                      {geocodeError && (
                        <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive mt-1">
                          {geocodeError}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* DIV7+8: CARTE + ARTISANS REDIMENSIONNABLES - Row 4, Cols 1-4 */}
                  <div style={{ gridArea: "4 / 1 / 5 / 5", height: mapSectionHeight }}>
                    <ResizablePanelGroup
                      key={`panel-group-${currentUser?.id ?? "anonymous"}`}
                      direction="horizontal"
                      className="h-full rounded-lg"
                      autoSaveId={panelStorageId}
                    >
                      {/* Panel Carte */}
                      <ResizablePanel defaultSize={DEFAULT_MAP_PANEL_SIZE} minSize={30} maxSize={85}>
                        <Card className="h-full overflow-hidden rounded-r-none border-r-0">
                          <CardContent className="p-0 h-full">
                            <MapLibreMap
                              lat={formData.latitude}
                              lng={formData.longitude}
                              height="100%"
                              onLocationChange={handleLocationChange}
                              markers={mapMarkers}
                              circleRadiusKm={perimeterKmValue}
                              selectedConnection={mapSelectedConnection ?? undefined}
                            />
                          </CardContent>
                        </Card>
                      </ResizablePanel>

                      {/* Handle de redimensionnement avec trois points */}
                      <ResizableHandle className="w-2 bg-muted/50 hover:bg-primary/20 transition-colors data-[resize-handle-active]:bg-primary/30 group cursor-col-resize flex-shrink-0 relative flex items-center justify-center">
                        <div className="flex h-full items-center justify-center">
                          <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-70 transition-opacity">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                          </div>
                        </div>
                      </ResizableHandle>

                      {/* Panel Artisans */}
                      <ResizablePanel defaultSize={DEFAULT_ARTISANS_PANEL_SIZE} minSize={15} maxSize={70}>
                        <ArtisanPanel
                          selectedArtisanId={selectedArtisanId}
                          selectedArtisanData={selectedArtisanData}
                          nearbyArtisans={nearbyArtisans}
                          isLoadingNearbyArtisans={isLoadingNearbyArtisans}
                          nearbyArtisansError={nearbyArtisansError}
                          absentArtisanIds={absentArtisanIds}
                          perimeterKmValue={perimeterKmValue}
                          requiresArtisan={requiresArtisan}
                          artisanDisplayMode={artisanDisplayMode}
                          setArtisanDisplayMode={setArtisanDisplayMode}
                          getArtisanDisplayName={getArtisanDisplayName}
                          artisanStatuses={refData?.artisanStatuses}
                          isDevisButtonDisabled={isDevisButtonDisabled}
                          isInterButtonDisabled={isInterButtonDisabled}
                          openEmailModal={openEmailModal}
                          handleOpenWhatsApp={handleOpenWhatsApp}
                          handleSelectNearbyArtisan={handleSelectNearbyArtisan}
                          handleRemoveSelectedArtisan={handleRemoveSelectedArtisan}
                          handleOpenArtisanModal={handleOpenArtisanModal}
                          onSearchClick={(pos) => { setArtisanSearchPosition(pos); setShowArtisanSearch(true) }}
                        />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>

                  {/* DIV5+6+4: CONTEXTE + CONSIGNE + FINANCES */}
                  <InterventionDetailsSection
                    formData={formData}
                    onChange={handleInputChange}
                    margePrimaryArtisan={margePrimaryArtisan}
                    requiresDatePrevue={requiresDatePrevue}
                    canEditContext={canEditContext}
                    requiresConsigneArtisan={requiresConsigneArtisan}
                    requiresCouts={requiresCouts}
                    withPresence
                  />
                  {/* END DIV5+6+4 — replaced inline sections */}
                </div>
              </SectionLock>
            </div>

            {/* HANDLE DE REDIMENSIONNEMENT */}
            <div
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              className="w-2 bg-muted/50 hover:bg-primary/20 transition-colors cursor-col-resize flex-shrink-0 group relative flex items-center justify-center"
              style={{ touchAction: 'none', userSelect: 'none' }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-70 transition-opacity">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                </div>
              </div>
            </div>

            {/* COLONNE DROITE - Collapsibles avec scroll indépendant et scrollbar minimale */}
            <div
              className="flex-shrink-0 overflow-y-auto min-h-0 scrollbar-minimal"
              style={{ width: `${rightColumnWidth}px` }}
            >
              <div className="flex flex-col gap-2 pb-4">
                {/* Détails facturation */}
                <SectionLock isLocked={!canEditIntervention}>
                  <InterventionOwnerSection
                    formData={formData}
                    onChange={handleInputChange}
                    isOpen={isProprietaireOpen}
                    onOpenChange={setIsProprietaireOpen}
                    requiresNomFacturation={requiresNomFacturation}
                    withPresence
                  />
                </SectionLock>

                {/* Détails client */}
                <SectionLock isLocked={!canEditIntervention}>
                  <InterventionClientSection
                    formData={formData}
                    onChange={handleInputChange}
                    isOpen={isClientOpen}
                    onOpenChange={setIsClientOpen}
                    requiresClientInfo={requiresClientInfo}
                    withPresence
                    onOpenSmsModal={onOpenSmsModal}
                  />
                </SectionLock>

                {/* Gestion des acomptes */}
                <SectionLock isLocked={!canEditIntervention}>
                  <PaymentSection
                    isOpen={isAccompteOpen}
                    onOpenChange={setIsAccompteOpen}
                    formData={formData}
                    canEditAccomptes={canEditAccomptes}
                    handleAccompteSSTChange={handleAccompteSSTChange}
                    handleAccompteClientChange={handleAccompteClientChange}
                    handleAccompteSSTBlur={handleAccompteSSTBlur}
                    handleAccompteClientBlur={handleAccompteClientBlur}
                    handleAccompteSSTRecuChange={handleAccompteSSTRecuChange}
                    handleAccompteClientRecuChange={handleAccompteClientRecuChange}
                    handleDateAccompteSSTRecuChange={handleDateAccompteSSTRecuChange}
                    handleDateAccompteClientRecuChange={handleDateAccompteClientRecuChange}
                  />
                </SectionLock>

                <DocumentSection
                  isOpen={isDocumentsOpen}
                  onOpenChange={setIsDocumentsOpen}
                  interventionId={intervention.id}
                  currentUser={currentUser}
                  documentKinds={DOCUMENT_KINDS}
                  requiresFacture={requiresFacture}
                  requiresDevis={requiresDevis}
                  hasFactureGMBS={hasFactureGMBS}
                  hasDevis={hasDevis}
                  documentsToReclassify={documentsToReclassify}
                  isReclassifyModalOpen={isReclassifyModalOpen}
                  onReclassifyModalOpenChange={handleReclassifyModalOpenChange}
                  onDocumentsChange={() => { void refreshFactureGMBS(); void refreshDevis() }}
                />

                {/* Deuxième artisan */}
                <SectionLock isLocked={!canEditIntervention}>
                  <SecondArtisanSection
                    isOpen={isSecondArtisanOpen}
                    onOpenChange={setIsSecondArtisanOpen}
                    formData={formData}
                    onChange={handleInputChange}
                    selectedArtisanId={selectedArtisanId}
                    selectedSecondArtisanId={selectedSecondArtisanId}
                    selectedSecondArtisanData={selectedSecondArtisanData}
                    nearbyArtisansSecondMetier={nearbyArtisansSecondMetier}
                    absentArtisanIds={absentArtisanIds}
                    secondArtisanDisplayMode={secondArtisanDisplayMode}
                    setSecondArtisanDisplayMode={setSecondArtisanDisplayMode}
                    getArtisanDisplayName={getArtisanDisplayName}
                    artisanStatuses={refData?.artisanStatuses}
                    metiers={refData?.metiers}
                    isInterButtonDisabled={isInterButtonDisabled}
                    openEmailModal={openEmailModal}
                    handleOpenWhatsApp={handleOpenWhatsApp}
                    handleSelectSecondArtisan={handleSelectSecondArtisan}
                    handleRemoveSecondArtisan={handleRemoveSecondArtisan}
                    handleOpenArtisanModal={handleOpenArtisanModal}
                    onSearchClick={(pos) => { setSecondArtisanSearchPosition(pos); setShowSecondArtisanSearch(true) }}
                    onPopoverOpenChange={onPopoverOpenChange}
                  />
                </SectionLock>

                {/* Commentaires - ouvert par défaut */}
                <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
                  <Card className="flex-1 flex flex-col">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          <MessageSquare className="h-3 w-3" />
                          Commentaires
                          <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", isCommentsOpen && "rotate-180")} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="flex-1">
                      <CardContent className="pt-0 px-3 pb-3">
                        <CommentSection entityType="intervention" entityId={intervention.id} currentUserId={currentUser?.id} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Sous-statut personnalisé */}
                <SectionLock isLocked={!canEditIntervention}>
                  <CustomStatusSection
                    isOpen={isSousStatutOpen}
                    onOpenChange={setIsSousStatutOpen}
                    formData={formData}
                    onChange={handleInputChange}
                  />
                </SectionLock>
              </div>
            </div>
          </div>

          <StatusReasonModal
            open={isStatusReasonModalOpen}
            type={pendingReasonType ?? "archive"}
            onCancel={handleStatusReasonCancel}
            onConfirm={(reason) => {
              void handleStatusReasonConfirm(reason)
            }}
            isSubmitting={isSubmitting}
          />

          {emailModalState && (
            <EmailEditModal
              isOpen
              onClose={closeEmailModal}
              emailType={emailModalState.type}
              artisanId={emailModalState.artisanId}
              artisanEmail={
                artisansWithEmail.find(a => a.id === emailModalState.artisanId)?.email || selectedArtisanEmail
              }
              interventionId={intervention.id}
              templateData={generateEmailTemplateData(emailModalState.artisanId)}
            />
          )}
        </fieldset>
        <div ref={artisanSearchContainerRef} />
      </form>
      <ArtisanSearchModal
        open={showArtisanSearch}
        onClose={() => {
          setShowArtisanSearch(false)
          setArtisanSearchPosition(null)
        }}
        onSelect={handleArtisanSearchSelect}
        position={artisanSearchPosition}
        container={artisanSearchContainerRef.current}
        latitude={formData.latitude}
        longitude={formData.longitude}
        metier_id={formData.metier_id}
      />

      <ArtisanSearchModal
        open={showSecondArtisanSearch}
        onClose={() => {
          setShowSecondArtisanSearch(false)
          setSecondArtisanSearchPosition(null)
        }}
        onSelect={handleSecondArtisanSearchSelect}
        position={secondArtisanSearchPosition}
        container={artisanSearchContainerRef.current}
        latitude={formData.latitude}
        longitude={formData.longitude}
        metier_id={formData.metier_id}
      />
    </>
  )
})
