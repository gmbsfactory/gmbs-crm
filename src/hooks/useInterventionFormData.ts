// ===== DONNÉES D'UN FORMULAIRE D'INTERVENTION =====
// État formData + validation + données de référence + marge + périmètre.
// Lecture unique du draft au montage (la persistance reste dans l'orchestrateur
// car elle dépend de l'état UI et de la sélection artisan).

import { useCallback, useEffect, useMemo, useState } from "react"

import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useFormDataChanges } from "@/hooks/useFormDataChanges"
import { useInterventionValidation } from "@/hooks/useInterventionValidation"
import { useInterventionDraftStore, NEW_INTERVENTION_DRAFT_KEY } from "@/stores/interventionDraft"
import { calculatePrimaryArtisanMargin } from "@/lib/utils/margin-calculator"
import { MAX_RADIUS_KM } from "@/lib/interventions/form-constants"
import type { InterventionFormData } from "@/lib/interventions/form-types"
import { getUserDisplayName } from "@/utils/user-display-name"

export interface UseInterventionFormDataOptions {
  mode: "create" | "edit"
  initialFormData: InterventionFormData
  /** ID de l'intervention (edit mode) — déclenche la lecture du draft d'édition. */
  interventionId?: string
  /** En mode create, lit aussi le draft de création (désactiver si defaultValues fournis). */
  restoreNewDraft?: boolean

  // Callbacks de notification vers le parent
  onClientNameChange?: (name: string) => void
  onAgencyNameChange?: (name: string) => void
  onClientPhoneChange?: (phone: string) => void
  onHasUnsavedChanges?: (hasChanges: boolean) => void
}

export function useInterventionFormData(options: UseInterventionFormDataOptions) {
  const {
    mode,
    initialFormData,
    interventionId,
    restoreNewDraft = false,
    onClientNameChange,
    onAgencyNameChange,
    onClientPhoneChange,
    onHasUnsavedChanges,
  } = options

  // ---- Lecture du draft (une seule fois) ----
  const getDraft = useInterventionDraftStore((s) => s.getDraft)
  const [existingDraft] = useState(() =>
    mode === "edit" && interventionId
      ? getDraft(interventionId)
      : mode === "create" && restoreNewDraft
        ? getDraft(NEW_INTERVENTION_DRAFT_KEY)
        : null,
  )

  // ---- Données de référence ----
  const { data: refData, loading: refDataLoading } = useReferenceDataQuery()
  const { data: currentUserData } = useCurrentUser()

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

  // ---- État principal ----
  const [formData, setFormData] = useState<InterventionFormData>(existingDraft?.formData ?? initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormReady, setIsFormReady] = useState(false)

  const handleInputChange = useCallback((field: keyof InterventionFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  useEffect(() => {
    setIsFormReady(true)
  }, [])

  // ---- Périmètre ----
  const [perimeterKmInput, setPerimeterKmInput] = useState("50")
  const perimeterKmValue = useMemo(() => {
    const parsed = Number.parseFloat(perimeterKmInput)
    if (!Number.isFinite(parsed) || parsed <= 0) return 50
    return Math.min(parsed, MAX_RADIUS_KM)
  }, [perimeterKmInput])

  // ---- Marge artisan principal ----
  const margePrimaryArtisan = useMemo(() => {
    const sst1 = parseFloat(String(formData.coutSST)) || 0
    const mat1 = parseFloat(String(formData.coutMateriel)) || 0
    const sst2 = parseFloat(String(formData.coutSSTSecondArtisan)) || 0
    const mat2 = parseFloat(String(formData.coutMaterielSecondArtisan)) || 0
    return calculatePrimaryArtisanMargin(formData.coutIntervention, sst1 + sst2, mat1 + mat2)
  }, [
    formData.coutIntervention,
    formData.coutSST,
    formData.coutMateriel,
    formData.coutSSTSecondArtisan,
    formData.coutMaterielSecondArtisan,
  ])

  // ---- Validation ----
  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) return undefined
    return refData.interventionStatuses.find((status: any) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const validation = useInterventionValidation(selectedStatus)

  // ---- Unsaved changes ----
  const hasUnsavedChanges = useFormDataChanges(
    formData,
    isSubmitting,
    isFormReady,
    existingDraft?.hasPendingChanges ?? false,
  )

  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onHasUnsavedChanges])

  // ---- Sync parent callbacks ----
  useEffect(() => {
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

  useEffect(() => {
    onClientPhoneChange?.(formData.telephoneClient)
  }, [formData.telephoneClient, onClientPhoneChange])

  useEffect(() => {
    if (refData?.agencies && formData.agence_id) {
      const agency = refData.agencies.find((a: any) => a.id === formData.agence_id)
      if (agency) onAgencyNameChange?.(agency.label || "")
    } else if (!formData.agence_id) {
      onAgencyNameChange?.("")
    }
  }, [formData.agence_id, refData?.agencies, onAgencyNameChange])

  return {
    // Référence
    refData,
    refDataLoading,
    currentUser,

    // Form state
    formData,
    setFormData,
    handleInputChange,
    isSubmitting,
    setIsSubmitting,
    isFormReady,
    hasUnsavedChanges,

    // Draft (lecture seule)
    existingDraft,

    // Validation
    selectedStatus,
    validation,

    // Marge
    margePrimaryArtisan,

    // Périmètre
    perimeterKmInput,
    setPerimeterKmInput,
    perimeterKmValue,
  }
}
