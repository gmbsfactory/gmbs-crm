import { useCallback, useMemo, useState } from "react"
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { useArtisanAbsences } from "@/hooks/useArtisanAbsences"
import type { ArtisanSearchResult } from "@/lib/artisans/types"
import { getArtisanDisplayName, artisanSearchResultToNearbyArtisan } from "@/lib/interventions/form-utils"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface UseArtisanSelectionOptions {
  formData: InterventionFormData
  perimeterKmValue: number
  initialSelectedArtisanId?: string | null
  initialSelectedSecondArtisanId?: string | null
  initialPrimaryArtisanData?: NearbyArtisan | null
  initialSecondaryArtisanData?: NearbyArtisan | null
  /** Restored from draft */
  draftSelectedArtisanId?: string | null
  draftSelectedSecondArtisanId?: string | null
  onFormDataChange: (field: keyof InterventionFormData, value: any) => void
}

export function useArtisanSelection(options: UseArtisanSelectionOptions) {
  const {
    formData,
    perimeterKmValue,
    initialSelectedArtisanId = null,
    initialSelectedSecondArtisanId = null,
    initialPrimaryArtisanData = null,
    initialSecondaryArtisanData = null,
    draftSelectedArtisanId,
    draftSelectedSecondArtisanId,
    onFormDataChange,
  } = options

  // ---- State ----
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(draftSelectedArtisanId ?? initialSelectedArtisanId)
  const [selectedSecondArtisanId, setSelectedSecondArtisanId] = useState<string | null>(draftSelectedSecondArtisanId ?? initialSelectedSecondArtisanId)
  const [searchSelectedArtisan, setSearchSelectedArtisan] = useState<NearbyArtisan | null>(null)
  const [searchSelectedSecondArtisan, setSearchSelectedSecondArtisan] = useState<NearbyArtisan | null>(null)
  const [assignedPrimaryArtisan, setAssignedPrimaryArtisan] = useState<NearbyArtisan | null>(initialPrimaryArtisanData)
  const [assignedSecondaryArtisan, setAssignedSecondaryArtisan] = useState<NearbyArtisan | null>(initialSecondaryArtisanData)

  // ---- Nearby artisans queries ----
  const hasCoords = !!formData.adresse_complete
  const {
    artisans: nearbyArtisans,
    loading: isLoadingNearbyArtisans,
    error: nearbyArtisansError,
  } = useNearbyArtisans(
    hasCoords ? formData.latitude : null,
    hasCoords ? formData.longitude : null,
    { limit: 100, maxDistanceKm: perimeterKmValue, sampleSize: 400, metier_id: formData.metier_id || null },
  )

  const {
    artisans: nearbyArtisansSecondMetier,
    loading: isLoadingNearbyArtisansSecondMetier,
  } = useNearbyArtisans(
    hasCoords ? formData.latitude : null,
    hasCoords ? formData.longitude : null,
    { limit: 100, maxDistanceKm: perimeterKmValue, sampleSize: 400, metier_id: formData.metierSecondArtisanId || null },
  )

  // ---- Resolved artisan data (priority: nearby > search > assigned) ----
  const selectedArtisanData = useMemo(() => {
    if (!selectedArtisanId) return null
    return nearbyArtisans.find((a) => a.id === selectedArtisanId)
      ?? searchSelectedArtisan
      ?? (assignedPrimaryArtisan?.id === selectedArtisanId ? assignedPrimaryArtisan : null)
  }, [selectedArtisanId, nearbyArtisans, searchSelectedArtisan, assignedPrimaryArtisan])

  const selectedSecondArtisanData = useMemo(() => {
    if (!selectedSecondArtisanId) return null
    return nearbyArtisansSecondMetier.find((a) => a.id === selectedSecondArtisanId)
      ?? searchSelectedSecondArtisan
      ?? (assignedSecondaryArtisan?.id === selectedSecondArtisanId ? assignedSecondaryArtisan : null)
  }, [selectedSecondArtisanId, nearbyArtisansSecondMetier, searchSelectedSecondArtisan, assignedSecondaryArtisan])

  // ---- Absences ----
  const allArtisanIds = useMemo(() => {
    const ids = new Set<string>()
    nearbyArtisans.forEach((a) => ids.add(a.id))
    nearbyArtisansSecondMetier.forEach((a) => ids.add(a.id))
    if (searchSelectedArtisan?.id) ids.add(searchSelectedArtisan.id)
    if (searchSelectedSecondArtisan?.id) ids.add(searchSelectedSecondArtisan.id)
    return Array.from(ids)
  }, [nearbyArtisans, nearbyArtisansSecondMetier, searchSelectedArtisan?.id, searchSelectedSecondArtisan?.id])

  const absentArtisanIds = useArtisanAbsences(allArtisanIds)

  // ---- Handlers ----

  const applyArtisanSelection = useCallback((artisan: NearbyArtisan | null) => {
    setSelectedArtisanId(artisan?.id ?? null)
    onFormDataChange("artisan", artisan?.displayName ?? "")
    onFormDataChange("artisanTelephone", artisan?.telephone ?? "")
    onFormDataChange("artisanEmail", artisan?.email ?? "")
  }, [onFormDataChange])

  const handleSelectNearbyArtisan = useCallback((artisan: NearbyArtisan) => {
    setSelectedArtisanId(artisan.id)
    onFormDataChange("artisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
  }, [onFormDataChange])

  const handleRemoveSelectedArtisan = useCallback(() => {
    setSelectedArtisanId(null)
    setSearchSelectedArtisan(null)
  }, [])

  const handleSelectSecondArtisan = useCallback((artisan: NearbyArtisan) => {
    setSelectedSecondArtisanId(artisan.id)
    onFormDataChange("secondArtisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
    onFormDataChange("secondArtisanTelephone", artisan.telephone || "")
    onFormDataChange("secondArtisanEmail", artisan.email || "")
  }, [onFormDataChange])

  const handleRemoveSecondArtisan = useCallback(() => {
    setSelectedSecondArtisanId(null)
    setSearchSelectedSecondArtisan(null)
    onFormDataChange("secondArtisan", "")
    onFormDataChange("secondArtisanTelephone", "")
    onFormDataChange("secondArtisanEmail", "")
  }, [onFormDataChange])

  const handleArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = getArtisanDisplayName(artisan)
    setSelectedArtisanId(artisan.id)
    onFormDataChange("artisan", displayName)
    onFormDataChange("artisanTelephone", artisan.telephone || "")
    onFormDataChange("artisanEmail", artisan.email || "")

    const isInProximity = nearbyArtisans.some((a) => a.id === artisan.id)
    setSearchSelectedArtisan(isInProximity ? null : artisanSearchResultToNearbyArtisan(artisan, displayName))
  }, [nearbyArtisans, onFormDataChange])

  const handleSecondArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = getArtisanDisplayName(artisan)
    setSelectedSecondArtisanId(artisan.id)
    onFormDataChange("secondArtisan", displayName)
    onFormDataChange("secondArtisanTelephone", artisan.telephone || "")
    onFormDataChange("secondArtisanEmail", artisan.email || "")

    const isInProximity = nearbyArtisansSecondMetier.some((a) => a.id === artisan.id)
    setSearchSelectedSecondArtisan(isInProximity ? null : artisanSearchResultToNearbyArtisan(artisan, displayName))
  }, [nearbyArtisansSecondMetier, onFormDataChange])

  return {
    // Primary artisan
    selectedArtisanId,
    setSelectedArtisanId,
    selectedArtisanData,
    searchSelectedArtisan,
    setSearchSelectedArtisan,
    nearbyArtisans,
    isLoadingNearbyArtisans,
    nearbyArtisansError,
    setAssignedPrimaryArtisan,

    // Secondary artisan
    selectedSecondArtisanId,
    setSelectedSecondArtisanId,
    selectedSecondArtisanData,
    searchSelectedSecondArtisan,
    setSearchSelectedSecondArtisan,
    nearbyArtisansSecondMetier,
    isLoadingNearbyArtisansSecondMetier,
    setAssignedSecondaryArtisan,

    // Absences
    absentArtisanIds,

    // Handlers
    applyArtisanSelection,
    handleSelectNearbyArtisan,
    handleRemoveSelectedArtisan,
    handleSelectSecondArtisan,
    handleRemoveSecondArtisan,
    handleArtisanSearchSelect,
    handleSecondArtisanSearchSelect,
  }
}
