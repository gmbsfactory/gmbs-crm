"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload, X, Search, Eye, Mail, MessageCircle } from "lucide-react"
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
import { EmailEditModal } from "@/components/interventions/EmailEditModal"
import { generateDevisEmailTemplate, generateInterventionEmailTemplate, generateDevisWhatsAppText, generateInterventionWhatsAppText, type EmailTemplateData } from "@/lib/email-templates/intervention-emails"
import { findOrCreateOwner, findOrCreateTenant } from "@/lib/interventions/owner-tenant-helpers"
import {
  isSSTDepositReceived,
  isClientDepositReceived,
  hasAnyDepositReceived,
  getStatusDisplayLabel
} from "@/lib/interventions/deposit-helpers"

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
  onClientNameChange?: (name: string) => void
  onAgencyNameChange?: (name: string) => void
  onClientPhoneChange?: (phone: string) => void
}

export function InterventionEditForm({
  intervention,
  onSuccess,
  onCancel,
  mode = "centerpage",
  formRef,
  onSubmittingChange,
  onClientNameChange,
  onAgencyNameChange,
  onClientPhoneChange
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

  // Email modal states
  const [isDevisEmailModalOpen, setIsDevisEmailModalOpen] = useState(false)
  const [isInterventionEmailModalOpen, setIsInterventionEmailModalOpen] = useState(false)
  const [selectedArtisanForEmail, setSelectedArtisanForEmail] = useState<string | null>(null)

  // Extraire les coûts et paiements
  const costs = intervention.intervention_costs || []
  const payments = intervention.intervention_payments || []
  const sstCost = costs.find(c => c.cost_type === 'sst')
  const materielCost = costs.find(c => c.cost_type === 'materiel')
  const interventionCost = costs.find(c => c.cost_type === 'intervention')

  // Extraire les paiements d'acomptes (calculés avant useState pour être utilisés dans l'initialisation)
  const sstPayment = payments.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = payments.find(p => p.payment_type === 'acompte_client')

  // Artisans liés - memoized pour éviter les changements à chaque render
  const artisans = useMemo(() => intervention.intervention_artisans || [], [intervention.intervention_artisans])
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

    // Logement vacant
    is_vacant: intervention.is_vacant || false,
    key_code: intervention.key_code || "",
    floor: intervention.floor || "",
    apartment_number: intervention.apartment_number || "",
    vacant_housing_instructions: intervention.vacant_housing_instructions || "",

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
  const [isCommentsOpen, setIsCommentsOpen] = useState(true)
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
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

  // Synchroniser formData.id_inter avec intervention.id_inter quand il change
  // (par exemple après une sauvegarde qui génère un nouvel ID)
  useEffect(() => {
    if (intervention.id_inter && intervention.id_inter !== formData.id_inter) {
      // Ne mettre à jour que si le champ est vide ou contient "AUTO" (ID provisoire)
      // pour éviter d'écraser une saisie utilisateur en cours
      const currentIdInter = formData.id_inter?.trim() || ""
      const isProvisionalId = currentIdInter.length === 0 || currentIdInter.toLowerCase().includes("auto")

      if (isProvisionalId) {
        setFormData((prev) => ({
          ...prev,
          id_inter: intervention.id_inter || prev.id_inter || "",
        }))
      }
    }
  }, [intervention.id_inter, formData.id_inter])

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

  // Sync client name with parent
  useEffect(() => {
    onClientNameChange?.(formData.nomClient)
  }, [formData.nomClient, onClientNameChange])

  // Sync client phone with parent
  useEffect(() => {
    onClientPhoneChange?.(formData.telephoneClient)
  }, [formData.telephoneClient, onClientPhoneChange])

  // Sync agency name with parent
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

  // --- Gestion des acomptes ---
  // Note: sstPayment et clientPayment sont déclarés plus haut

  const canEditAccomptes = useMemo(() => {
    const currentStatusCode = getInterventionStatusCode(formData.statut_id)
    // On autorise l'édition si le statut est ACCEPTE ou ATT_ACOMPTE (pour éviter de bloquer l'utilisateur pendant la saisie)
    return currentStatusCode === 'ACCEPTE' || currentStatusCode === 'ATT_ACOMPTE'
  }, [formData.statut_id, getInterventionStatusCode])

  const handleAccompteSSTChange = async (value: string) => {
    // Mettre à jour le formData local
    handleInputChange('accompteSST', value)
  }

  const handleAccompteSSTBlur = async () => {
    const value = formData.accompteSST
    const amount = parseFloat(value) || 0

    // Mettre à jour le paiement
    if (amount > 0) {
      try {
        await interventionsApi.upsertPayment(intervention.id, {
          payment_type: 'acompte_sst',
          amount: amount,
          currency: 'EUR'
        })

        // Si statut actuel est ACCEPTE, passer à ATT_ACOMPTE
        const currentStatusCode = getInterventionStatusCode(formData.statut_id)
        if (currentStatusCode === 'ACCEPTE') {
          const attAcompteStatus = refData?.interventionStatuses.find(s => s.code === 'ATT_ACOMPTE')
          if (attAcompteStatus) {
            handleInputChange('statut_id', attAcompteStatus.id)
            toast.success("Statut passé à 'Attente acompte'")
          }
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'acompte SST:', error)
        toast.error('Erreur lors de la sauvegarde de l\'acompte SST')
      }
    }
  }

  const handleAccompteClientChange = async (value: string) => {
    // Mettre à jour le formData local
    handleInputChange('accompteClient', value)
  }

  const handleAccompteClientBlur = async () => {
    const value = formData.accompteClient
    const amount = parseFloat(value) || 0

    // Mettre à jour le paiement
    if (amount > 0) {
      try {
        await interventionsApi.upsertPayment(intervention.id, {
          payment_type: 'acompte_client',
          amount: amount,
          currency: 'EUR'
        })

        // Si statut actuel est ACCEPTE, passer à ATT_ACOMPTE
        const currentStatusCode = getInterventionStatusCode(formData.statut_id)
        if (currentStatusCode === 'ACCEPTE') {
          const attAcompteStatus = refData?.interventionStatuses.find(s => s.code === 'ATT_ACOMPTE')
          if (attAcompteStatus) {
            handleInputChange('statut_id', attAcompteStatus.id)
            toast.success("Statut passé à 'Attente acompte'")
          }
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'acompte client:', error)
        toast.error('Erreur lors de la sauvegarde de l\'acompte client')
      }
    }
  }

  const handleAccompteSSTRecuChange = async (checked: boolean) => {
    try {
      await interventionsApi.upsertPayment(intervention.id, {
        payment_type: 'acompte_sst',
        is_received: checked,
        payment_date: checked ? (formData.dateAccompteSSTRecu || null) : null
      })

      // Mettre à jour le formData local
      handleInputChange('accompteSSTRecu', checked)

      // Si date saisie ET case cochée, passer à ACCEPTE
      if (checked && formData.dateAccompteSSTRecu) {
        const accepteStatus = refData?.interventionStatuses.find(s => s.code === 'ACCEPTE')
        if (accepteStatus) {
          handleInputChange('statut_id', accepteStatus.id)
          toast.success("Acompte reçu : Statut passé à 'Accepté'")
        }
      } else if (!checked) {
        // Si on décoche, vérifier si l'autre acompte est reçu, sinon remettre à ATT_ACOMPTE
        // Note: on utilise les valeurs du hook useMemo qui sont basées sur intervention.intervention_payments
        // Mais attention, intervention.intervention_payments n'est pas mis à jour en temps réel ici sauf si on invalide la query
        // Pour l'instant on fait confiance à la logique locale ou on vérifie l'autre acompte via formData si possible
        // Le mieux est de vérifier l'autre acompte via les props ou une refetch, mais ici on va simplifier

        const hasClientDepositReceived = clientPayment?.is_received && clientPayment?.payment_date

        if (!hasClientDepositReceived) {
          const currentStatusCode = getInterventionStatusCode(formData.statut_id)
          if (currentStatusCode === 'ACCEPTE') {
            const attAcompteStatus = refData?.interventionStatuses.find(s => s.code === 'ATT_ACOMPTE')
            if (attAcompteStatus) {
              handleInputChange('statut_id', attAcompteStatus.id)
              toast.info("Aucun acompte reçu : Statut passé à 'Attente acompte'")
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'acompte SST:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleDateAccompteSSTRecuChange = async (date: string) => {
    try {
      await interventionsApi.upsertPayment(intervention.id, {
        payment_type: 'acompte_sst',
        is_received: formData.accompteSSTRecu,
        payment_date: date || null
      })

      // Mettre à jour le formData local
      handleInputChange('dateAccompteSSTRecu', date)

      // Si case cochée ET date saisie, passer à ACCEPTE
      if (formData.accompteSSTRecu && date) {
        const accepteStatus = refData?.interventionStatuses.find(s => s.code === 'ACCEPTE')
        if (accepteStatus) {
          handleInputChange('statut_id', accepteStatus.id)
          toast.success("Acompte reçu : Statut passé à 'Accepté'")
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la date SST:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleAccompteClientRecuChange = async (checked: boolean) => {
    try {
      await interventionsApi.upsertPayment(intervention.id, {
        payment_type: 'acompte_client',
        is_received: checked,
        payment_date: checked ? (formData.dateAccompteClientRecu || null) : null
      })

      // Mettre à jour le formData local
      handleInputChange('accompteClientRecu', checked)

      // Si date saisie ET case cochée, passer à ACCEPTE
      if (checked && formData.dateAccompteClientRecu) {
        const accepteStatus = refData?.interventionStatuses.find(s => s.code === 'ACCEPTE')
        if (accepteStatus) {
          handleInputChange('statut_id', accepteStatus.id)
          toast.success("Acompte reçu : Statut passé à 'Accepté'")
        }
      } else if (!checked) {
        // Si on décoche, vérifier si l'autre acompte est reçu, sinon remettre à ATT_ACOMPTE
        const hasSSTDepositReceived = sstPayment?.is_received && sstPayment?.payment_date

        if (!hasSSTDepositReceived) {
          const currentStatusCode = getInterventionStatusCode(formData.statut_id)
          if (currentStatusCode === 'ACCEPTE') {
            const attAcompteStatus = refData?.interventionStatuses.find(s => s.code === 'ATT_ACOMPTE')
            if (attAcompteStatus) {
              handleInputChange('statut_id', attAcompteStatus.id)
              toast.info("Aucun acompte reçu : Statut passé à 'Attente acompte'")
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'acompte client:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleDateAccompteClientRecuChange = async (date: string) => {
    try {
      await interventionsApi.upsertPayment(intervention.id, {
        payment_type: 'acompte_client',
        is_received: formData.accompteClientRecu,
        payment_date: date || null
      })

      // Mettre à jour le formData local
      handleInputChange('dateAccompteClientRecu', date)

      // Si case cochée ET date saisie, passer à ACCEPTE
      if (formData.accompteClientRecu && date) {
        const accepteStatus = refData?.interventionStatuses.find(s => s.code === 'ACCEPTE')
        if (accepteStatus) {
          handleInputChange('statut_id', accepteStatus.id)
          toast.success("Acompte reçu : Statut passé à 'Accepté'")
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la date client:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // --- Fin Gestion des acomptes ---

  const handleInputChange = useCallback((field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

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

  // Get artisans with valid email from intervention_artisans AND from selected artisan in form
  const artisansWithEmail = useMemo(() => {
    const artisansFromIntervention = artisans
      .filter((ia: any) => ia.artisans?.email && ia.artisans.email.trim().length > 0)
      .map((ia: any) => ({
        id: ia.artisan_id,
        email: ia.artisans.email,
        telephone: ia.artisans.telephone || '',
        name: `${ia.artisans.prenom || ''} ${ia.artisans.nom || ''}`.trim() || ia.artisans.plain_nom || 'Artisan',
        is_primary: ia.is_primary,
      }))

    // Add selected artisan from form if it has an email and is not already in the list
    const selectedArtisanIds = new Set(artisansFromIntervention.map((a) => a.id))
    if (selectedArtisanData && selectedArtisanData.email && selectedArtisanData.email.trim().length > 0) {
      if (!selectedArtisanIds.has(selectedArtisanData.id)) {
        artisansFromIntervention.push({
          id: selectedArtisanData.id,
          email: selectedArtisanData.email,
          telephone: selectedArtisanData.telephone || '',
          name: selectedArtisanData.displayName || 'Artisan',
          is_primary: false, // Will be determined when saved
        })
      }
    }

    return artisansFromIntervention
  }, [artisans, selectedArtisanData])

  // Generate email template data from intervention
  const generateEmailTemplateData = useCallback((artisanId: string): EmailTemplateData => {
    // Check if artisan is from intervention_artisans or from selected artisan in form
    const selectedArtisan = artisans.find((ia: any) => ia.artisan_id === artisanId)
    const isFromIntervention = !!selectedArtisan
    const isPrimary = selectedArtisan?.is_primary || false

    // Get tenant data
    const tenant = intervention.tenants
    const nomClient = tenant
      ? `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || ''
      : ''
    const telephoneClient = tenant?.telephone || ''
    const telephoneClient2 = tenant?.telephone2 || ''
    const adresseComplete = (formData.adresse || intervention.adresse) && (formData.code_postal || intervention.code_postal || formData.ville || intervention.ville)
      ? `${formData.adresse || intervention.adresse}, ${formData.code_postal || intervention.code_postal || ''} ${formData.ville || intervention.ville || ''}`.trim()
      : ''

    // Get consigne based on artisan type
    // If artisan is not yet saved, use consigne_intervention as default
    const consigneArtisan = isFromIntervention
      ? (isPrimary
        ? (formData.consigne_intervention || intervention.consigne_intervention || '')
        : (formData.consigne_second_artisan || intervention.consigne_second_artisan || ''))
      : (formData.consigne_intervention || intervention.consigne_intervention || '')

    // Calculate coutSST
    const coutSST = sstCost
      ? `${sstCost.amount || 0} ${sstCost.currency || 'EUR'}`
      : 'Non spécifié'

    return {
      nomClient,
      telephoneClient,
      telephoneClient2,
      adresseComplete,
      datePrevue: formData.date_prevue || intervention.date_prevue || undefined,
      consigneArtisan: consigneArtisan || undefined,
      coutSST,
      commentaire: formData.commentaire_agent || intervention.commentaire_agent || undefined,
      idIntervention: formData.id_inter || intervention.id_inter || undefined,
    }
  }, [intervention, artisans, sstCost, formData])

  // Get the effective selected artisan ID (from Select or from form selection)
  const effectiveSelectedArtisanId = useMemo(() => {
    return selectedArtisanForEmail || selectedArtisanId || null
  }, [selectedArtisanForEmail, selectedArtisanId])

  // Handle opening devis email modal
  const handleOpenDevisEmailModal = useCallback(() => {
    if (!effectiveSelectedArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    setIsDevisEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  // Handle opening intervention email modal
  const handleOpenInterventionEmailModal = useCallback(() => {
    if (!effectiveSelectedArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    setIsInterventionEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  // Get selected artisan email
  const selectedArtisanEmail = useMemo(() => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''

    // First check in artisansWithEmail (from Select)
    const artisan = artisansWithEmail.find((a) => a.id === artisanId)
    if (artisan) return artisan.email

    // Fallback to selectedArtisanData (from form selection)
    if (selectedArtisanData && selectedArtisanData.id === artisanId) {
      return selectedArtisanData.email || ''
    }

    return ''
  }, [effectiveSelectedArtisanId, artisansWithEmail, selectedArtisanData])

  // Fonction pour obtenir le numéro de téléphone de l'artisan sélectionné
  const getSelectedArtisanPhone = useCallback((): string => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''

    // Chercher dans artisansWithEmail (depuis Select)
    const artisan = artisansWithEmail.find((a) => a.id === artisanId)
    if (artisan && artisan.telephone) return artisan.telephone

    // Chercher dans selectedArtisanData (depuis form)
    if (selectedArtisanData && selectedArtisanData.telephone) {
      return selectedArtisanData.telephone
    }

    return ''
  }, [effectiveSelectedArtisanId, artisansWithEmail, selectedArtisanData])

  // Fonction pour formater le numéro de téléphone pour WhatsApp
  const formatPhoneForWhatsApp = useCallback((phone: string): string => {
    if (!phone) return ''

    // Nettoyer le numéro (supprimer espaces, tirets, points, parenthèses)
    const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '')

    // Ajouter l'indicatif si nécessaire (format international)
    // Si le numéro commence par 0, le remplacer par +33 pour la France
    const formattedPhone = cleanPhone.startsWith('0')
      ? `+33${cleanPhone.slice(1)}`
      : cleanPhone.startsWith('+')
      ? cleanPhone
      : `+33${cleanPhone}`

    return formattedPhone
  }, [])

  // Fonction pour ouvrir WhatsApp avec le message prérempli
  const handleOpenWhatsApp = useCallback((
    emailType: 'devis' | 'intervention',
    artisanId: string,
    artisanPhone: string
  ) => {
    if (!artisanId) {
      toast.error('Artisan non sélectionné')
      return
    }

    if (!artisanPhone || artisanPhone.trim() === '') {
      toast.error('Numéro de téléphone de l\'artisan manquant')
      return
    }

    // Générer les données du template
    const templateData = generateEmailTemplateData(artisanId)

    // Générer le message WhatsApp selon le type
    const whatsappMessage = emailType === 'devis'
      ? generateDevisWhatsAppText(templateData)
      : generateInterventionWhatsAppText(templateData)

    // Formater le numéro de téléphone
    const formattedPhone = formatPhoneForWhatsApp(artisanPhone)

    // Encoder le message pour l'URL
    const encodedMessage = encodeURIComponent(whatsappMessage)

    // Détecter si on est sur mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    
    // Ouvrir WhatsApp avec le numéro et le message
    if (isMobile) {
      // Sur mobile : utiliser le protocole whatsapp:// pour ouvrir directement l'app
      const whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMessage}`
      window.location.href = whatsappUrl
    } else {
      // Sur desktop : ouvrir dans une nouvelle fenêtre qui se fermera automatiquement
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`
      const popup = window.open(whatsappUrl, '_blank', 'width=1,height=1')
      // Fermer la fenêtre après un court délai si elle existe encore
      setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close()
        }
      }, 1000)
    }
  }, [generateEmailTemplateData, formatPhoneForWhatsApp])

  const handleSelectNearbyArtisan = useCallback(
    (artisan: NearbyArtisan) => {
      if (selectedArtisanId === artisan.id) {
        // Désélectionner si on clique sur l'artisan déjà sélectionné
        // Mais on garde le comportement actuel de juste mettre à jour le champ texte
        // Si on veut permettre la désélection au clic, on pourrait le faire ici
        // Pour l'instant on suit la spec qui demande un bouton X explicite
      }

      setSelectedArtisanId(artisan.id)
      handleInputChange("artisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())

      // Si l'artisan a un email, on le présélectionne pour l'envoi d'email
      if (artisan.email) {
        setSelectedArtisanForEmail(artisan.id)
      }
    },
    [selectedArtisanId, handleInputChange],
  )

  const handleRemoveSelectedArtisan = useCallback(() => {
    setSelectedArtisanId(null)
    // Optionnel : vider le champ texte artisan si on désélectionne ?
    // handleInputChange("artisan", "")
  }, [])

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

      // Trouver ou créer le propriétaire et le client
      let ownerId: string | null = null
      let tenantId: string | null = null

      try {
        ownerId = await findOrCreateOwner({
          nomProprietaire: formData.nomProprietaire,
          prenomProprietaire: formData.prenomProprietaire,
          telephoneProprietaire: formData.telephoneProprietaire,
          emailProprietaire: formData.emailProprietaire,
        })
      } catch (error) {
        console.error("[InterventionEditForm] Erreur lors de la gestion du propriétaire:", error)
        toast.error("Erreur lors de la sauvegarde du propriétaire")
      }

      // Ne créer/trouver le tenant que si le logement n'est pas vacant
      if (!formData.is_vacant) {
        try {
          tenantId = await findOrCreateTenant({
            nomClient: formData.nomClient,
            prenomClient: formData.prenomClient,
            telephoneClient: formData.telephoneClient,
            emailClient: formData.emailClient,
          })
        } catch (error) {
          console.error("[InterventionEditForm] Erreur lors de la gestion du client:", error)
          toast.error("Erreur lors de la sauvegarde du client")
        }
      } else {
        // Si logement vacant, on doit mettre tenant_id à null explicitement
        tenantId = null
      }

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
        is_vacant: formData.is_vacant,
        // Toujours envoyer les champs de logement vacant, même s'ils sont vides
        key_code: formData.is_vacant ? (formData.key_code?.trim() || null) : null,
        floor: formData.is_vacant ? (formData.floor?.trim() || null) : null,
        apartment_number: formData.is_vacant ? (formData.apartment_number?.trim() || null) : null,
        vacant_housing_instructions: formData.is_vacant ? (formData.vacant_housing_instructions?.trim() || null) : null,
        owner_id: ownerId,
        tenant_id: tenantId, // null si is_vacant=true, sinon l'ID du tenant trouvé/créé
        // Note: client_id est un alias de tenant_id dans certains contextes, mais on utilise tenant_id ici
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
          id_inter: updateData.id_inter ?? null,
          reference_agence: updateData.reference_agence ?? null,
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
          is_vacant: updateData.is_vacant,
          key_code: updateData.key_code ?? null,
          floor: updateData.floor ?? null,
          apartment_number: updateData.apartment_number ?? null,
          vacant_housing_instructions: updateData.vacant_housing_instructions ?? null,
          owner_id: updateData.owner_id ?? null,
          tenant_id: updateData.tenant_id ?? null,
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
      let costsUpdated = false
      for (const cost of costsToUpdate) {
        try {
          await interventionsApi.upsertCost(intervention.id, {
            cost_type: cost.cost_type,
            label: cost.cost_type === "sst" ? "Coût SST" : cost.cost_type === "materiel" ? "Coût Matériel" : "Coût Intervention",
            amount: cost.amount,
            currency: "EUR",
          })
          costsUpdated = true
        } catch (costError) {
          console.error(`[InterventionEditForm] Erreur lors de la mise à jour du coût ${cost.cost_type}:`, costError)
          // Ne pas bloquer la soumission si un coût échoue
        }
      }

      // Invalider le cache du dashboard si des coûts ont été mis à jour
      if (costsUpdated) {
        // Invalider toutes les queries du dashboard admin pour forcer le rechargement
        await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })
        // Invalider aussi les queries de podium si elles existent
        await queryClient.invalidateQueries({ queryKey: ["podium"] })
        console.log('[InterventionEditForm] Cache dashboard invalidé après mise à jour des coûts')
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

      // Mettre à jour le formData avec les valeurs retournées par le serveur
      // pour synchroniser les champs qui peuvent avoir été modifiés côté serveur (comme id_inter)
      if (payload) {
        setFormData((prev) => ({
          ...prev,
          id_inter: payload.id_inter || prev.id_inter || "",
          statut_id: payload.statut_id || prev.statut_id || "",
          agence_id: payload.agence_id || prev.agence_id || "",
          reference_agence: payload.reference_agence || prev.reference_agence || "",
        }))
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

  // Expose client name to parent
  useEffect(() => {
    onClientNameChange?.(formData.nomClient)
  }, [formData.nomClient, onClientNameChange])

  // Expose agency name to parent
  useEffect(() => {
    onAgencyNameChange?.(selectedAgencyData?.label || "")
  }, [selectedAgencyData?.label, onAgencyNameChange])

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
    <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
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
                      {getStatusDisplayLabel(status.code, status.label, sstPayment, clientPayment)}
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



      {/* 2. GRANDE SECTION : LOCALISATION + ARTISANS + FINANCES */}
      <Card>
        <CardContent className="p-6 space-y-4">

          {/* PARTIE HAUTE : CONTEXTE + CONSIGNE (2 COLONNES) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="contexteIntervention" className="text-xs mb-2 block font-medium">Contexte intervention *</Label>
              <Textarea
                id="contexteIntervention"
                value={formData.contexte_intervention}
                onChange={
                  canEditContext
                    ? (event) => handleInputChange("contexte_intervention", event.target.value)
                    : undefined
                }
                placeholder="Décrivez le contexte de l&apos;intervention..."
                rows={5}
                className={cn(
                  "text-sm resize-none",
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
              <Label htmlFor="consigneIntervention" className="text-xs mb-2 block font-medium">Consigne pour l&apos;artisan</Label>
              <Textarea
                id="consigneIntervention"
                value={formData.consigne_intervention}
                onChange={(event) => handleInputChange("consigne_intervention", event.target.value)}
                placeholder="Consignes spécifiques pour l&apos;intervention..."
                rows={5}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <div className="border-t pt-4" />

          {/* PARTIE MILIEU : LOCALISATION + ARTISANS (2 COLONNES) */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

            {/* COLONNE GAUCHE : LOCALISATION */}
            <div className="flex flex-col h-full space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm">Localisation</h3>
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

              {/* Champs Adresse éditables */}
              <div className="space-y-2 pt-2 border-t">
                <div>
                  <Label htmlFor="adresse" className="text-xs">Adresse *</Label>
                  <Textarea
                    id="adresse"
                    value={formData.adresse}
                    onChange={(event) => handleInputChange("adresse", event.target.value)}
                    placeholder="Adresse complète"
                    rows={2}
                    className="text-sm mt-1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="codePostal" className="text-xs">Code postal</Label>
                    <Input
                      id="codePostal"
                      value={formData.code_postal}
                      onChange={(event) => handleInputChange("code_postal", event.target.value)}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ville" className="text-xs">Ville</Label>
                    <Input
                      id="ville"
                      value={formData.ville}
                      onChange={(event) => handleInputChange("ville", event.target.value)}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : ARTISANS */}
            <div className="flex flex-col h-full space-y-4">
              <h3 className="font-semibold flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Artisans à proximité
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Input
                      id="artisan"
                      value={formData.artisan}
                      onChange={(event) => handleInputChange("artisan", event.target.value)}
                      placeholder="Artisan sélectionné"
                      className="h-8 text-sm w-40"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setArtisanSearchPosition({
                          x: rect.left,
                          y: rect.top,
                          width: rect.width,
                          height: rect.height
                        })
                        setShowArtisanSearch(true)
                      }}
                      title="Rechercher un artisan"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </h3>

              {/* Grouper "Envoyer un email" et la carte sélectionnée pour éviter l'espacement de space-y-4 */}
              <div className="space-y-2">
                {/* Email sending section */}
                {artisansWithEmail.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                    <Label className="text-xs font-semibold">Envoyer un email</Label>
                    <div className="flex flex-col gap-2">
                      <Select
                        value={selectedArtisanForEmail || selectedArtisanId || ''}
                        onValueChange={setSelectedArtisanForEmail}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Sélectionner un artisan" />
                        </SelectTrigger>
                        <SelectContent>
                          {artisansWithEmail.map((artisan) => (
                            <SelectItem key={artisan.id} value={artisan.id}>
                              {artisan.name} ({artisan.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Ligne 1 : Boutons Email */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOpenDevisEmailModal}
                          disabled={!selectedArtisanForEmail && !selectedArtisanId}
                          className="flex-1 text-xs"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1.5" />
                          Mail demande de devis
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOpenInterventionEmailModal}
                          disabled={!selectedArtisanForEmail && !selectedArtisanId}
                          className="flex-1 text-xs"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1.5" />
                          Mail demande d&apos;intervention
                        </Button>
                      </div>

                      {/* Ligne 2 : Boutons WhatsApp (conditionnels) */}
                      {(() => {
                        const artisanPhone = getSelectedArtisanPhone()
                        const hasPhone = artisanPhone && artisanPhone.trim() !== ''
                        const isArtisanSelected = selectedArtisanForEmail || selectedArtisanId
                        const artisanId = effectiveSelectedArtisanId

                        if (!hasPhone || !isArtisanSelected || !artisanId) return null

                        return (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {}}
                              disabled={true}
                              className="flex-1 text-xs bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]/50 cursor-not-allowed opacity-50"
                              title="Fonctionnalité désactivée"
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                              WhatsApp demande de devis
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {}}
                              disabled={true}
                              className="flex-1 text-xs bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]/50 cursor-not-allowed opacity-50"
                              title="Fonctionnalité désactivée"
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                              WhatsApp demande d&apos;intervention
                            </Button>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Carte sélectionnée affichée juste après "Envoyer un email" */}
                {selectedArtisanId && selectedArtisanData && (() => {
                  const artisan = selectedArtisanData
                  const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                  const artisanInitials = artisanName
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "??"

                  const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                  const statutArtisan = artisanStatus?.label || ""
                  const statutArtisanColor = artisanStatus?.color || null

                  return (
                    <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <div
                        role="button"
                        tabIndex={0}
                        className="relative rounded-lg border border-primary/70 ring-2 ring-primary/50 bg-background/80 p-3 text-sm shadow-sm transition-all duration-300 ease-in-out opacity-100 scale-100"
                        onClick={() => handleRemoveSelectedArtisan()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            handleRemoveSelectedArtisan()
                          }
                        }}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-6 w-6 rounded-full bg-background/80 text-muted-foreground shadow-sm transition-colors hover:text-destructive z-20"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRemoveSelectedArtisan()
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
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
                                <Badge variant="default" className="flex-shrink-0">
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
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-4 pt-0 flex-1 flex flex-col min-h-[300px]">
                {isLoadingNearbyArtisans ? (
                  <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                    Recherche des artisans...
                  </div>
                ) : nearbyArtisansError ? (
                  <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {nearbyArtisansError}
                  </div>
                ) : nearbyArtisans.length === 0 ? (
                  <div className="rounded border border-border/50 bg-background px-3 py-3 text-xs text-muted-foreground">
                    Aucun artisan géolocalisé n’a été trouvé dans un rayon de {perimeterKmValue} km.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[500px]">
                    {sortedNearbyArtisans.map((artisan) => {
                      // Si un artisan est sélectionné, toutes les cartes (y compris la sélectionnée) disparaissent progressivement
                      // La carte sélectionnée est affichée séparément juste après "Envoyer un email"

                      const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                      const artisanInitials = artisanName
                        .split(" ")
                        .map((part) => part.charAt(0))
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "??"

                      const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                      const statutArtisan = artisanStatus?.label || ""
                      const statutArtisanColor = artisanStatus?.color || null

                      return (
                        <div
                          key={artisan.id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "relative rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm transition-all duration-300 ease-in-out",
                            selectedArtisanId
                              ? "opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none m-0 p-0 border-0"
                              : "hover:border-primary/40 opacity-100 scale-100"
                          )}
                          onClick={() => handleSelectNearbyArtisan(artisan)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              handleSelectNearbyArtisan(artisan)
                            }
                          }}
                        >
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
                                  <Badge variant="secondary" className="flex-shrink-0">
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
            </div>

          </div>

          <div className="border-t pt-4" />

          {/* PARTIE BASSE : FINANCES + PLANIFICATION */}
          <div className="space-y-4">
            {/* LIGNE COÛTS + DATE PRÉVUE */}
            <div>
              <Label className="mb-3 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Finances & Planification</Label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5 items-end">
                {/* Coûts */}
                <div>
                  <Label htmlFor="coutIntervention" className="text-xs">Coût inter.</Label>
                  <Input
                    id="coutIntervention"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.coutIntervention}
                    onChange={(event) => handleInputChange("coutIntervention", event.target.value)}
                    placeholder="0.00 €"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="coutSST" className="text-xs">Coût SST</Label>
                  <Input
                    id="coutSST"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.coutSST}
                    onChange={(event) => handleInputChange("coutSST", event.target.value)}
                    placeholder="0.00 €"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="coutMateriel" className="text-xs">Coût mat.</Label>
                  <Input
                    id="coutMateriel"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.coutMateriel}
                    onChange={(event) => handleInputChange("coutMateriel", event.target.value)}
                    placeholder="0.00 €"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                {/* Marge (Calculée) */}
                <div>
                  <Label className="text-xs">Marge</Label>
                  <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm items-center mt-1">
                    {(() => {
                      const inter = parseFloat(formData.coutIntervention) || 0
                      const sst = parseFloat(formData.coutSST) || 0
                      const mat = parseFloat(formData.coutMateriel) || 0
                      if (inter > 0) {
                        const marge = ((inter - (sst + mat)) / inter) * 100
                        return <span className={cn("font-medium", marge < 0 ? "text-destructive" : "text-green-600")}>{marge.toFixed(1)} %</span>
                      }
                      return <span className="text-muted-foreground">-- %</span>
                    })()}
                  </div>
                </div>
                {/* Date Prévue */}
                <div>
                  <Label htmlFor="datePrevue" className="text-xs">Date prévue {requiresDatePrevue && "*"}</Label>
                  <Input
                    id="datePrevue"
                    type="date"
                    value={formData.date_prevue}
                    onChange={(event) => handleInputChange("date_prevue", event.target.value)}
                    className="h-9 text-sm mt-1"
                    required={requiresDatePrevue}
                    title={requiresDatePrevue ? "Date prévue obligatoire pour ce statut" : undefined}
                  />
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* 4. SECTIONS PLEINE LARGEUR (Collapsibles) */}

      {/* Détails propriétaire et client */}
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
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Colonne 1 : Propriétaire */}
                <div>
                  <Label className="mb-2 block text-xs font-medium">Propriétaire</Label>
                  <div className="space-y-3">
                    {/* Ligne 1 : Nom et Prénom */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="nomProprietaire" className="text-xs">Nom</Label>
                        <Input
                          id="nomProprietaire"
                          value={formData.nomProprietaire}
                          onChange={(event) => handleInputChange("nomProprietaire", event.target.value)}
                          placeholder="Nom"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prenomProprietaire" className="text-xs">Prénom</Label>
                        <Input
                          id="prenomProprietaire"
                          value={formData.prenomProprietaire}
                          onChange={(event) => handleInputChange("prenomProprietaire", event.target.value)}
                          placeholder="Prénom"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    </div>
                    {/* Ligne 2 : Téléphone et Email */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="telephoneProprietaire" className="text-xs">Téléphone</Label>
                        <Input
                          id="telephoneProprietaire"
                          value={formData.telephoneProprietaire}
                          onChange={(event) => handleInputChange("telephoneProprietaire", event.target.value)}
                          placeholder="06 12 34 56 78"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emailProprietaire" className="text-xs">Email</Label>
                        <Input
                          id="emailProprietaire"
                          type="email"
                          value={formData.emailProprietaire}
                          onChange={(event) => handleInputChange("emailProprietaire", event.target.value)}
                          placeholder="email@example.com"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Colonne 2 : Client */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="block text-xs font-medium">Client</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_vacant"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={formData.is_vacant}
                        onChange={(e) => handleInputChange("is_vacant", e.target.checked)}
                      />
                      <Label htmlFor="is_vacant" className="text-xs font-normal cursor-pointer select-none">
                        logement vacant
                      </Label>
                    </div>
                  </div>

                  {formData.is_vacant ? (
                    <div className="space-y-3">
                      {/* Ligne 1 : Code clé, Etage, N° Appartement */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="key_code" className="text-xs uppercase">CODE CLÉ</Label>
                          <Input
                            id="key_code"
                            value={formData.key_code}
                            onChange={(event) => handleInputChange("key_code", event.target.value)}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="floor" className="text-xs">etage</Label>
                          <Input
                            id="floor"
                            value={formData.floor}
                            onChange={(event) => handleInputChange("floor", event.target.value)}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="apartment_number" className="text-xs">n° appartement</Label>
                          <Input
                            id="apartment_number"
                            value={formData.apartment_number}
                            onChange={(event) => handleInputChange("apartment_number", event.target.value)}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>
                      {/* Ligne 2 : Consigne */}
                      <div>
                        <Label htmlFor="vacant_housing_instructions" className="text-xs">Consigne</Label>
                        <Textarea
                          id="vacant_housing_instructions"
                          value={formData.vacant_housing_instructions}
                          onChange={(event) => handleInputChange("vacant_housing_instructions", event.target.value)}
                          placeholder="Consignes"
                          className="min-h-[80px] text-sm mt-1 resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Ligne 1 : Nom et Prénom */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="nomClient" className="text-xs">Nom</Label>
                          <Input
                            id="nomClient"
                            value={formData.nomClient}
                            onChange={(event) => handleInputChange("nomClient", event.target.value)}
                            placeholder="Nom"
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="prenomClient" className="text-xs">Prénom</Label>
                          <Input
                            id="prenomClient"
                            value={formData.prenomClient}
                            onChange={(event) => handleInputChange("prenomClient", event.target.value)}
                            placeholder="Prénom"
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>
                      {/* Ligne 2 : Téléphone et Email */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="telephoneClient" className="text-xs">Téléphone</Label>
                          <Input
                            id="telephoneClient"
                            value={formData.telephoneClient}
                            onChange={(event) => handleInputChange("telephoneClient", event.target.value)}
                            placeholder="06 12 34 56 78"
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="emailClient" className="text-xs">Email</Label>
                          <Input
                            id="emailClient"
                            type="email"
                            value={formData.emailClient}
                            onChange={(event) => handleInputChange("emailClient", event.target.value)}
                            placeholder="email@example.com"
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Gestion des acomptes */}
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
                    onChange={(event) => handleAccompteSSTChange(event.target.value)}
                    onBlur={handleAccompteSSTBlur}
                    placeholder="Montant"
                    className="h-8 text-sm"
                    disabled={!canEditAccomptes}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Acompte SST reçu</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.accompteSSTRecu}
                      onChange={(e) => handleAccompteSSTRecuChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Input
                      type="date"
                      value={formData.dateAccompteSSTRecu}
                      onChange={(e) => handleDateAccompteSSTRecuChange(e.target.value)}
                      className="h-8 text-sm"
                      required={formData.accompteSSTRecu && !formData.dateAccompteSSTRecu}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="accompteClient" className="text-xs">Acompte client</Label>
                  <Input
                    id="accompteClient"
                    value={formData.accompteClient}
                    onChange={(event) => handleAccompteClientChange(event.target.value)}
                    onBlur={handleAccompteClientBlur}
                    placeholder="Montant"
                    className="h-8 text-sm"
                    disabled={!canEditAccomptes}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Acompte client reçu</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.accompteClientRecu}
                      onChange={(e) => handleAccompteClientRecuChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Input
                      type="date"
                      value={formData.dateAccompteClientRecu}
                      onChange={(e) => handleDateAccompteClientRecuChange(e.target.value)}
                      className="h-8 text-sm"
                      required={formData.accompteClientRecu && !formData.dateAccompteClientRecu}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Les acomptes ne sont éditables que si le statut est &quot;Accepté&quot; ou &quot;Attente acompte&quot;.
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

      {/* Email Edit Modals */}
      {effectiveSelectedArtisanId && (
        <>
          <EmailEditModal
            isOpen={isDevisEmailModalOpen}
            onClose={() => setIsDevisEmailModalOpen(false)}
            emailType="devis"
            artisanId={effectiveSelectedArtisanId}
            artisanEmail={selectedArtisanEmail}
            interventionId={intervention.id}
            templateData={generateEmailTemplateData(effectiveSelectedArtisanId)}
          />
          <EmailEditModal
            isOpen={isInterventionEmailModalOpen}
            onClose={() => setIsInterventionEmailModalOpen(false)}
            emailType="intervention"
            artisanId={effectiveSelectedArtisanId}
            artisanEmail={selectedArtisanEmail}
            interventionId={intervention.id}
            templateData={generateEmailTemplateData(effectiveSelectedArtisanId)}
          />
        </>
      )}
    </form>
  )
}
