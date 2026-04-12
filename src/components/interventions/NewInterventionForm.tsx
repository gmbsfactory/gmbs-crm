"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload, X, Search, Eye, Mail, MessageCircle, Users, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireField } from "@/components/interventions/GestionnaireField"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { DocumentManager } from "@/components/documents"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { interventionsApi } from "@/lib/api/v2"

import type { CreateInterventionData } from "@/lib/api/v2/common/types"
import { cn } from "@/lib/utils"
import { formatMarginPercentage, getMarginColorClass } from "@/lib/utils/margin-calculator"
import { ArtisanSearchModal } from "@/components/artisans/ArtisanSearchModal"
import { Avatar } from "@/components/artisans/Avatar"
import { toast } from "sonner"
import { extractErrorMessage } from "@/lib/toast-helpers"
import { findOrCreateOwner, findOrCreateTenant } from "@/lib/interventions/owner-tenant-helpers"
import { runPostMutationTasks } from "@/lib/interventions/post-mutation-tasks"
import { applyRecuToggle } from "@/lib/interventions/deposit-helpers"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useModal } from "@/hooks/useModal"
import { EmailEditModal } from "@/components/interventions/EmailEditModal"
import { DuplicateInterventionDialog } from "@/components/interventions/DuplicateInterventionDialog"
import { SearchableBadgeSelect } from "@/components/ui/searchable-badge-select"
import {
  InterventionHeaderFields,
  InterventionOwnerSection,
  InterventionClientSection,
  InterventionDetailsSection,
  ArtisanPanel,
  SecondArtisanSection,
  PaymentSection,
  CustomStatusSection,
} from "@/components/interventions/form-sections"
import { normalizeArtisanData, getDisplayName } from "@/lib/artisans"
import { openWhatsApp } from "@/lib/interventions/whatsapp"
import { isInterventionEmailButtonDisabled } from "@/lib/interventions/derivations"

// Shared form utilities
import { useInterventionFormState } from "@/hooks/useInterventionFormState"
import { INTERVENTION_DOCUMENT_KINDS, STATUS_SORT_ORDER, MAX_RADIUS_KM } from "@/lib/interventions/form-constants"
import { formatDistanceKm, hexToRgba } from "@/lib/interventions/form-utils"

// Convert readonly INTERVENTION_DOCUMENT_KINDS to mutable for DocumentManager
const DOCUMENT_KINDS = [...INTERVENTION_DOCUMENT_KINDS] as { kind: string; label: string }[]
import { createNewFormData } from "@/lib/interventions/form-types"

interface NewInterventionFormProps {
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
  defaultValues?: Partial<{
    agence_id: string
    reference_agence: string
    assigned_user_id: string
    metier_id: string
    adresse: string
    code_postal: string
    ville: string
    latitude: number
    longitude: number
    datePrevue: string
    nomPrenomFacturation: string
    telephoneProprietaire: string
    emailProprietaire: string
    nomPrenomClient: string
    telephoneClient: string
    emailClient: string
    artisan: string
    coutIntervention: string
    coutSST: string
    coutMateriel: string
    artisanTelephone: string
    artisanEmail: string
    artisanId: string
    commentairesIntervention: string
    consigneSecondArtisan: string
  }>
  onPopoverOpenChange?: (isOpen: boolean) => void
}

export function NewInterventionForm({
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
  defaultValues,
  onPopoverOpenChange
}: NewInterventionFormProps) {
  const queryClient = useQueryClient()
  const { open: openInterventionModal } = useInterventionModal()
  const { open: openModal } = useModal()

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
    isFormReady,
    hasUnsavedChanges,
    clearDraft,
    saveNewDraft,

    // Geocoding
    locationQuery,
    setLocationQuery,
    locationSuggestions,
    isSuggesting,
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
    searchSelectedArtisan,
    setSearchSelectedArtisan,
    nearbyArtisans,
    isLoadingNearbyArtisans,
    nearbyArtisansError,

    // Secondary artisan
    selectedSecondArtisanId,
    setSelectedSecondArtisanId,
    selectedSecondArtisanData,
    searchSelectedSecondArtisan,
    setSearchSelectedSecondArtisan,
    nearbyArtisansSecondMetier,
    isLoadingNearbyArtisansSecondMetier,

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
    openEmailModal,
    closeEmailModal,
    generateEmailTemplateData,
    handleOpenArtisanModal,
  } = useInterventionFormState({
    mode: "create",
    restoreNewDraft: !defaultValues,
    initialFormData: createNewFormData(defaultValues),
    initialLocationQuery: defaultValues?.adresse && defaultValues?.ville
      ? `${defaultValues.adresse}, ${defaultValues.ville}`
      : "",
    initialSelectedArtisanId: defaultValues?.artisanId ?? null,
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

  // Form-specific state (not in shared hook)
  const [createdInterventionId, setCreatedInterventionId] = useState<string | null>(null)
  const [secondArtisanDisplayMode, setSecondArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")

  const getArtisanDisplayName = useCallback(
    (artisan: NearbyArtisan, mode: "nom" | "rs" | "tel"): string => {
      const displayData = normalizeArtisanData(artisan, {
        refData: { statuts: refData?.artisanStatuses },
        addressPriority: 'intervention',
      })
      return getDisplayName(displayData, mode)
    },
    [refData?.artisanStatuses],
  )

  const handleOpenWhatsApp = useCallback(
    (emailType: 'devis' | 'intervention', artisanId: string, artisanPhone: string) => {
      openWhatsApp({ emailType, artisanId, artisanPhone, generateEmailTemplateData })
    },
    [generateEmailTemplateData],
  )

  // Acompte handler shims — NewInterventionForm has no status-based gating,
  // so we delegate to the generic handleInputChange and mark the section as always editable.
  // Invariant partagé avec l'édition : cocher Reçu/Envoyé auto-remplit la date à aujourd'hui ;
  // décocher la vide. Logique centralisée dans applyRecuToggle.
  const handleAccompteSSTChange = useCallback((value: string) => handleInputChange("accompteSST", value), [handleInputChange])
  const handleAccompteClientChange = useCallback((value: string) => handleInputChange("accompteClient", value), [handleInputChange])
  const handleAccompteSSTBlur = useCallback(() => { /* no-op on create: no prefill-on-blur logic */ }, [])
  const handleAccompteClientBlur = useCallback(() => { /* no-op on create */ }, [])
  const handleAccompteSSTRecuChange = useCallback((checked: boolean) => {
    const { recu, date } = applyRecuToggle(checked, formData.dateAccompteSSTRecu)
    handleInputChange("accompteSSTRecu", recu)
    handleInputChange("dateAccompteSSTRecu", date)
  }, [handleInputChange, formData.dateAccompteSSTRecu])
  const handleAccompteClientRecuChange = useCallback((checked: boolean) => {
    const { recu, date } = applyRecuToggle(checked, formData.dateAccompteClientRecu)
    handleInputChange("accompteClientRecu", recu)
    handleInputChange("dateAccompteClientRecu", date)
  }, [handleInputChange, formData.dateAccompteClientRecu])
  const handleDateAccompteSSTRecuChange = useCallback((value: string) => handleInputChange("dateAccompteSSTRecu", value), [handleInputChange])
  const handleDateAccompteClientRecuChange = useCallback((value: string) => handleInputChange("dateAccompteClientRecu", value), [handleInputChange])

  const isDevisButtonDisabled = !selectedArtisanId
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

  // États pour la gestion des doublons
  const [confirmableDuplicates, setConfirmableDuplicates] = useState<Array<{
    id: string
    name: string
    address: string
    agencyId?: string | null
    agencyLabel?: string | null
    managerName?: string | null
  }>>([])
  // Utiliser useRef pour éviter la race condition avec le state async
  // Le ref est synchrone et garantit que la valeur est mise à jour avant requestSubmit()
  const skipDuplicateCheckRef = useRef(false)

  // Initialiser le statut par défaut à "DEMANDE"
  useEffect(() => {
    if (!refData?.interventionStatuses || formData.statut_id) {
      return
    }
    const defaultStatus = refData.interventionStatuses.find(
      (status: any) =>
        status.code === "DEMANDE" ||
        status.label?.toLowerCase() === "demandé" ||
        status.label?.toLowerCase() === "demande",
    )
    if (defaultStatus?.id) {
      setFormData((prev) => ({ ...prev, statut_id: defaultStatus.id }))
    }
  }, [refData, formData.statut_id, setFormData])

  // Handlers pour la gestion des doublons
  const handleConfirmDuplicate = useCallback(() => {
    // Utiliser le ref (synchrone) pour éviter la race condition
    // avec le state async qui causait la réapparition de la popup
    skipDuplicateCheckRef.current = true
    setConfirmableDuplicates([])
    // Re-soumettre le formulaire
    if (formRef?.current) {
      formRef.current.requestSubmit()
    }
  }, [formRef])

  const handleCancelDuplicate = useCallback(() => {
    setConfirmableDuplicates([])
    setIsSubmitting(false)
    onSubmittingChange?.(false)
  }, [onSubmittingChange, setIsSubmitting])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    // Validation obligatoire : Agence et Métier à la création
    if (!formData.agence_id) {
      toast.error("L'agence est obligatoire pour créer une intervention")
      return
    }
    if (showReferenceField && !formData.reference_agence?.trim()) {
      toast.error("La référence agence est obligatoire pour cette agence")
      return
    }
    if (!formData.metier_id) {
      toast.error("Le métier est obligatoire pour créer une intervention")
      return
    }

    let idInterValue: string = formData.id_inter?.trim() ?? ""
    if (requiresDefinitiveId) {
      if (idInterValue.length === 0 || idInterValue.toLowerCase().includes("auto")) {
        form.reportValidity()
        return
      }
    }
    // Si id_inter n'est pas fourni et n'est pas requis, laisser vide (null)
    // Cela s'affichera comme "--" dans la TableView

    const datePrevueValue = formData.date_prevue?.trim() ?? ""
    if (requiresDatePrevue && datePrevueValue.length === 0) {
      form.reportValidity()
      return
    }

    // === VALIDATIONS CUMULATIVES (quand le statut sélectionné n'est pas DEMANDE) ===
    if (requiresNomFacturation && !formData.nomPrenomFacturation?.trim()) {
      toast.error("Le nom/prénom de facturation (propriétaire) est obligatoire pour ce statut")
      return
    }

    if (requiresAssignedUser && !formData.assigned_user_id) {
      toast.error("L'intervention doit être assignée à un gestionnaire pour ce statut")
      return
    }

    if (requiresCouts) {
      const coutInterValue = parseFloat(formData.coutIntervention) || 0
      const coutSSTValue = parseFloat(formData.coutSST) || 0

      if (coutInterValue <= 0) {
        toast.error("Le coût d'intervention doit être renseigné pour ce statut")
        return
      }
      if (coutSSTValue <= 0) {
        toast.error("Le coût SST doit être renseigné pour ce statut")
        return
      }
    }

    if (requiresConsigneArtisan && !formData.consigne_intervention?.trim()) {
      toast.error("La consigne pour l'artisan doit être renseignée pour ce statut")
      return
    }

    if (requiresClientInfo) {
      if (!formData.nomPrenomClient?.trim()) {
        toast.error("Le nom/prénom du client doit être renseigné pour ce statut")
        return
      }
      if (!formData.telephoneClient?.trim()) {
        toast.error("Le téléphone du client doit être renseigné pour ce statut")
        return
      }
    }

    if (requiresArtisan && (!selectedArtisanId || !selectedArtisanData)) {
      toast.error("Un artisan est obligatoire pour ce statut")
      return
    }

    if (requiresFacture) {
      // Pour une nouvelle intervention, on ne peut pas encore vérifier les documents en base,
      // mais on peut vérifier si des documents ont été préparés dans le DocumentManager si possible.
      // Cependant, INTER_TERMINEE à la création est un cas limite.
      // Pour l'instant, on bloque simplement en demandant le document.
      toast.error("Le statut terminé nécessite une facture GMBS. Veuillez créer l'intervention dans un autre statut d'abord, puis téléverser la facture.")
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)

    try {
      const referenceAgenceValue = formData.reference_agence?.trim() ?? ""

      // Trouver ou créer le propriétaire et le client
      let ownerId: string | null = null
      let tenantId: string | null = null

      try {
        ownerId = await findOrCreateOwner({
          nomPrenomFacturation: formData.nomPrenomFacturation,
          telephoneProprietaire: formData.telephoneProprietaire,
          emailProprietaire: formData.emailProprietaire,
        })
      } catch (error) {
        console.error("[NewInterventionForm] Erreur lors de la gestion du propriétaire:", error)
        toast.error("Erreur lors de la sauvegarde du propriétaire")
      }

      if (!formData.is_vacant) {
        try {
          tenantId = await findOrCreateTenant({
            nomPrenomClient: formData.nomPrenomClient,
            telephoneClient: formData.telephoneClient,
            emailClient: formData.emailClient,
          })
        } catch (error) {
          console.error("[NewInterventionForm] Erreur lors de la gestion du client:", error)
          toast.error("Erreur lors de la sauvegarde du client")
        }
      } else {
        tenantId = null
      }

      const createData: CreateInterventionData = {
        statut_id: formData.statut_id || undefined,
        agence_id: formData.agence_id || undefined,
        reference_agence: referenceAgenceValue.length > 0 ? referenceAgenceValue : null,
        assigned_user_id: formData.assigned_user_id || undefined,
        metier_id: formData.metier_id || undefined,
        date: formData.date || new Date().toISOString(),
        date_prevue: formData.date_prevue || undefined,
        contexte_intervention: formData.contexte_intervention || undefined,
        consigne_intervention: formData.consigne_intervention || undefined,
        consigne_second_artisan: formData.consigne_second_artisan || undefined,
        adresse: formData.adresse || undefined,
        code_postal: formData.code_postal || undefined,
        ville: formData.ville || undefined,
        adresse_complete: formData.adresse_complete || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        ...(idInterValue.length > 0 && { id_inter: idInterValue }),
        is_vacant: formData.is_vacant,
        key_code: formData.is_vacant ? (formData.key_code?.trim() || undefined) : undefined,
        floor: formData.is_vacant ? (formData.floor?.trim() || null) : null,
        apartment_number: formData.is_vacant ? (formData.apartment_number?.trim() || null) : null,
        vacant_housing_instructions: formData.is_vacant ? (formData.vacant_housing_instructions?.trim() || null) : null,
        owner_id: ownerId || undefined,
        tenant_id: tenantId || undefined,
        // Sous-statut personnalisé
        sous_statut_text: formData.sousStatutText?.trim() || null,
        sous_statut_text_color: formData.sousStatutTextColor || '#000000',
        sous_statut_bg_color: formData.sousStatutBgColor || 'transparent',
        // Deuxième artisan - métier
        metier_second_artisan_id: formData.metierSecondArtisanId || null,
      }

      Object.keys(createData).forEach((key) => {
        if (createData[key as keyof CreateInterventionData] === undefined) {
          delete createData[key as keyof CreateInterventionData]
        }
      })

      // Vérifier les doublons sauf si l'utilisateur a déjà confirmé
      if (!skipDuplicateCheckRef.current && createData.adresse && createData.agence_id) {
        const duplicates = await interventionsApi.getDuplicateDetails(
          createData.adresse,
          createData.agence_id
        )

        if (duplicates && duplicates.length > 0) {
          setConfirmableDuplicates(duplicates)
          setIsSubmitting(false)
          onSubmittingChange?.(false)
          return
        }
      }

      // Réinitialiser le flag après vérification
      skipDuplicateCheckRef.current = false

      // === NOUVEAU FLOW: Fermer le modal AVANT l'appel API ===
      // Sauvegarder le draft avant fermeture pour récupération en cas d'erreur
      saveNewDraft()
      onSuccess?.(null)
      setIsSubmitting(false)
      onSubmittingChange?.(false)

      const toastId = toast.loading("Création de l'intervention en cours...")

      try {
        const created = await interventionsApi.create(createData)
        setCreatedInterventionId(created.id)

        // Succès : effacer le draft de création
        clearDraft()

        toast.success("Intervention créée avec succès", {
          id: toastId,
          action: {
            label: "Voir",
            onClick: () => openInterventionModal(created.id),
          },
        })

        // Préparer les coûts (uniquement ceux avec montant > 0 pour la création)
        const coutSSTValue = parseFloat(formData.coutSST) || 0
        const coutMaterielValue = parseFloat(formData.coutMateriel) || 0
        const coutInterventionValue = parseFloat(formData.coutIntervention) || 0
        const coutSST2Value = parseFloat(formData.coutSSTSecondArtisan) || 0
        const coutMateriel2Value = parseFloat(formData.coutMaterielSecondArtisan) || 0

        const costs: Array<{ cost_type: 'sst' | 'materiel' | 'intervention' | 'marge'; amount: number; artisan_order?: 1 | 2 | null; label?: string | null }> = []

        if (coutSSTValue > 0) costs.push({ cost_type: "sst", label: "Coût SST", amount: coutSSTValue, artisan_order: 1 })
        if (coutMaterielValue > 0) costs.push({ cost_type: "materiel", label: "Coût Matériel", amount: coutMaterielValue, artisan_order: 1 })
        if (coutInterventionValue > 0) costs.push({ cost_type: "intervention", label: "Coût Intervention", amount: coutInterventionValue, artisan_order: null })
        console.log('[DEBUG NewForm] selectedSecondArtisanId:', selectedSecondArtisanId, 'coutSST2Value:', coutSST2Value, 'coutMateriel2Value:', coutMateriel2Value)
        if (selectedSecondArtisanId && coutSST2Value > 0) costs.push({ cost_type: "sst", label: "Coût SST 2ème artisan", amount: coutSST2Value, artisan_order: 2 })
        if (selectedSecondArtisanId && coutMateriel2Value > 0) costs.push({ cost_type: "materiel", label: "Coût Matériel 2ème artisan", amount: coutMateriel2Value, artisan_order: 2 })

        // Préparer le commentaire initial
        const trimmedInitialComment = formData.commentaire_initial.trim()

        // Lancer toutes les tâches secondaires en arrière-plan (fire-and-forget)
        runPostMutationTasks({
          interventionId: created.id,
          artisans: {
            primary: { current: null, next: selectedArtisanId },
            secondary: { current: null, next: selectedSecondArtisanId },
          },
          costs: costs.length > 0 ? costs : undefined,
          comment: trimmedInitialComment.length > 0 ? {
            entity_type: "intervention",
            content: trimmedInitialComment,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id,
          } : undefined,
        })
      } catch (apiError) {
        console.error("Erreur lors de la création:", apiError)
        const description = extractErrorMessage(apiError)
        const isDuplicateKey = description?.toLowerCase().includes("duplicate key") || description?.toLowerCase().includes("unique constraint")

        if (isDuplicateKey) {
          // Capturer la référence openModal avant que le composant soit démonté
          const openNewModal = () => openModal("new", { content: "new-intervention" })
          toast.error("Erreur : ID d'intervention déjà utilisé", {
            id: toastId,
            duration: Infinity,
            action: {
              label: "Re-ouvrir",
              onClick: openNewModal,
            },
          })
        } else {
          toast.error("Erreur lors de la création de l'intervention", {
            id: toastId,
            duration: Infinity,
            description,
          })
        }
      }

    } catch (error) {
      console.error("Erreur lors de la préparation:", error)
      toast.error("Erreur lors de la création de l'intervention")
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

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
    // Utilise la configuration depuis agency_config en base de données
    return selectedAgencyData.requires_reference === true
  }, [selectedAgencyData])

  if (refDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Chargement des données...</div>
      </div>
    )
  }

  // Hauteur de la section carte+artisans basée sur la sélection d'artisan
  const mapSectionHeight = selectedArtisanId ? "150px" : "220px"

  const DEFAULT_MAP_PANEL_SIZE = 70
  const DEFAULT_ARTISANS_PANEL_SIZE = 30
  const panelStorageId = currentUser?.id
    ? `gmbs:intervention-form:panel-size:${currentUser.id}`
    : null

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      {/* LAYOUT DEUX COLONNES DISTINCTES - Chaque colonne a son propre scroll */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* COLONNE GAUCHE - Scroll indépendant */}
        <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal scrollbar-left">
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
              onPopoverOpenChange={onPopoverOpenChange}
              renderUserBadge={() => (
                <GestionnaireField
                  value={formData.assigned_user_id}
                  onChange={(userId) => handleInputChange("assigned_user_id", userId || null)}
                  interventionDate={formData.date}
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
                  <Input
                    id="adresse"
                    value={formData.adresse}
                    onChange={(event) => handleInputChange("adresse", event.target.value)}
                    placeholder="Adresse complète de l'intervention..."
                    className="h-7 text-xs flex-1"
                    required
                  />
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
                <ResizablePanel defaultSize={30} minSize={15} maxSize={70}>
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
            />
          </div>
        </div>

        {/* COLONNE DROITE - Collapsibles avec scroll indépendant */}
        <div className="w-[320px] flex-shrink-0 overflow-y-auto min-h-0 scrollbar-minimal">
          <div className="flex flex-col gap-2 pb-4">
            {/* Détails facturation */}
            <InterventionOwnerSection
              formData={formData}
              onChange={handleInputChange}
              isOpen={isProprietaireOpen}
              onOpenChange={setIsProprietaireOpen}
            />

            {/* Détails client */}
            <InterventionClientSection
              formData={formData}
              onChange={handleInputChange}
              isOpen={isClientOpen}
              onOpenChange={setIsClientOpen}
              onOpenSmsModal={onOpenSmsModal}
            />

            {/* Acomptes */}
            <PaymentSection
              isOpen={isAccompteOpen}
              onOpenChange={setIsAccompteOpen}
              formData={formData}
              canEditAccomptes={true}
              handleAccompteSSTChange={handleAccompteSSTChange}
              handleAccompteClientChange={handleAccompteClientChange}
              handleAccompteSSTBlur={handleAccompteSSTBlur}
              handleAccompteClientBlur={handleAccompteClientBlur}
              handleAccompteSSTRecuChange={handleAccompteSSTRecuChange}
              handleAccompteClientRecuChange={handleAccompteClientRecuChange}
              handleDateAccompteSSTRecuChange={handleDateAccompteSSTRecuChange}
              handleDateAccompteClientRecuChange={handleDateAccompteClientRecuChange}
            />

            {/* Deuxième artisan */}
            <SecondArtisanSection
              isOpen={isSecondArtisanOpen}
              onOpenChange={setIsSecondArtisanOpen}
              formData={formData}
              onChange={handleInputChange as (field: string, value: any) => void}
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

            {/* Documents */}
            <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
              <Card className={cn(requiresFacture && "ring-2 ring-orange-400/50")}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <Upload className="h-3 w-3" />
                      Documents {requiresFacture && <span className="text-orange-500">*</span>}
                      {requiresFacture && (
                        <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Facture GMBS obligatoire" />
                      )}
                      {isDocumentsOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 px-3 pb-3">
                    {createdInterventionId ? (
                      <DocumentManager entityType="intervention" entityId={createdInterventionId} kinds={DOCUMENT_KINDS} currentUser={currentUser ?? undefined} />
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        Les documents pourront être ajoutés après la création de l&apos;intervention.
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Commentaires - ouvert par défaut, avec uniquement le commentaire initial */}
            <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
              <Card className="flex-1 flex flex-col">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <MessageSquare className="h-3 w-3" />
                      Commentaire initial
                      <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", isCommentsOpen && "rotate-180")} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex-1">
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="space-y-2">
                      <Textarea
                        id="commentaireInitial"
                        value={formData.commentaire_initial}
                        onChange={(event) => handleInputChange("commentaire_initial", event.target.value)}
                        placeholder="Commentaire initial sur l'intervention..."
                        rows={4}
                        className="text-sm resize-none"
                        disabled={isSubmitting}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Ce commentaire sera enregistré automatiquement après la création.
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Sous-statut personnalisé */}
            <CustomStatusSection
              isOpen={isSousStatutOpen}
              onOpenChange={setIsSousStatutOpen}
              formData={formData}
              onChange={handleInputChange as (field: string, value: string) => void}
            />
          </div>
        </div>
      </div>

      {/* Modal de recherche d'artisan principal */}
      <ArtisanSearchModal
        open={showArtisanSearch}
        onClose={() => {
          setShowArtisanSearch(false)
          setArtisanSearchPosition(null)
        }}
        onSelect={handleArtisanSearchSelect}
        position={artisanSearchPosition}
        latitude={formData.latitude}
        longitude={formData.longitude}
        metier_id={formData.metier_id}
      />

      {/* Modal de recherche du 2ème artisan */}
      <ArtisanSearchModal
        open={showSecondArtisanSearch}
        onClose={() => {
          setShowSecondArtisanSearch(false)
          setSecondArtisanSearchPosition(null)
        }}
        onSelect={handleSecondArtisanSearchSelect}
        position={secondArtisanSearchPosition}
        latitude={formData.latitude}
        longitude={formData.longitude}
        metier_id={formData.metier_id}
      />

      {/* Modal Email */}
      {emailModalState && (
        <EmailEditModal
          isOpen
          onClose={closeEmailModal}
          emailType={emailModalState.type}
          artisanId={emailModalState.artisanId}
          artisanEmail={selectedArtisanEmail}
          interventionId={createdInterventionId || `temp-${Date.now()}`}
          templateData={generateEmailTemplateData(emailModalState.artisanId)}
        />
      )}

      {/* Dialog de confirmation pour les doublons */}
      <DuplicateInterventionDialog
        duplicates={confirmableDuplicates}
        onConfirm={handleConfirmDuplicate}
        onCancel={handleCancelDuplicate}
      />
    </form>
  )
}

export default NewInterventionForm
