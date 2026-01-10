"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useScroll, useTransform, useSpring, type MotionValue } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload, X, Search, Eye, Mail, MessageCircle, Users, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { SearchableBadgeSelect } from "@/components/ui/searchable-badge-select"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { DocumentManager } from "@/components/documents/DocumentManager"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { useReferenceData } from "@/hooks/useReferenceData"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { useFormDataChanges } from "@/hooks/useFormDataChanges"
import { interventionsApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import { supabase } from "@/lib/supabase-client"
import type { Intervention, UpdateInterventionData } from "@/lib/api/v2/common/types"
import type { InterventionWithStatus } from "@/types/intervention"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
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
import { normalizeArtisanData, getDisplayName } from "@/lib/artisans"

const INTERVENTION_DOCUMENT_KINDS = [
  { kind: "devis", label: "Devis" },
  { kind: "facturesGMBS", label: "Facture GMBS" },
  { kind: "facturesMateriel", label: "Facture Matériel" },
  { kind: "photos", label: "Photos" },
  { kind: "facturesArtisans", label: "Facture Artisan" },
]

const MAX_RADIUS_KM = 10000

// Note: requires_reference est maintenant géré via la table agency_config en base de données
const STATUSES_REQUIRING_DATE_PREVUE = new Set(["VISITE_TECHNIQUE", "INTER_EN_COURS"])
const STATUSES_REQUIRING_DEFINITIVE_ID = new Set([
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
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
  onOpenSmsModal?: () => void
  onHasUnsavedChanges?: (hasChanges: boolean) => void
  onArtisanSearchOpenChange?: (isOpen: boolean) => void
  onEmailModalOpenChange?: (isOpen: boolean) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
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
  onClientPhoneChange,
  onOpenSmsModal,
  onHasUnsavedChanges,
  onArtisanSearchOpenChange,
  onEmailModalOpenChange,
  onStatusReasonModalOpenChange
}: InterventionEditFormProps) {
  const { data: refData, loading: refDataLoading } = useReferenceData()
  const queryClient = useQueryClient()
  const { update: updateMutation } = useInterventionsMutations()
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [pendingReasonType, setPendingReasonType] = useState<StatusReasonType | null>(null)

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
  const { can } = usePermissions()
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

  // Email modal states
  const [isDevisEmailModalOpen, setIsDevisEmailModalOpen] = useState(false)
  const [isInterventionEmailModalOpen, setIsInterventionEmailModalOpen] = useState(false)
  const [selectedArtisanForEmail, setSelectedArtisanForEmail] = useState<string | null>(null)
  useEffect(() => {
    onEmailModalOpenChange?.(isDevisEmailModalOpen || isInterventionEmailModalOpen)
  }, [isDevisEmailModalOpen, isInterventionEmailModalOpen, onEmailModalOpenChange])

  // Extraire les coûts et paiements
  const costs = intervention.intervention_costs || []
  const payments = intervention.intervention_payments || []
  // Coûts artisan principal (artisan_order = 1 ou undefined/null pour rétrocompatibilité)
  const sstCost = costs.find(c => c.cost_type === 'sst' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
  const materielCost = costs.find(c => c.cost_type === 'materiel' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
  const interventionCost = costs.find(c => c.cost_type === 'intervention')
  // Coûts second artisan (artisan_order = 2)
  const sstCostSecondArtisan = costs.find(c => c.cost_type === 'sst' && c.artisan_order === 2)
  const materielCostSecondArtisan = costs.find(c => c.cost_type === 'materiel' && c.artisan_order === 2)

  // Extraire les paiements d'acomptes (calculés avant useState pour être utilisés dans l'initialisation)
  const sstPayment = payments.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = payments.find(p => p.payment_type === 'acompte_client')

  // Artisans liés - memoized pour éviter les changements à chaque render
  const artisans = useMemo(() => intervention.intervention_artisans || [], [intervention.intervention_artisans])
  const primaryArtisan = artisans.find(a => a.is_primary)?.artisans
  const secondaryArtisan = artisans.find(a => !a.is_primary)?.artisans

  const [formData, setFormData] = useState({
    // Champs principaux
    statut_id: intervention.statut_id || "",
    id_inter: intervention.id_inter || "",
    agence_id: intervention.agence_id || "",
    reference_agence: (intervention as any).reference_agence || "",
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
    // Charger adresse_complete depuis la BDD ou construire à partir des champs si non disponible
    adresseComplete: (intervention as any).adresse_complete || [intervention.adresse, intervention.code_postal, intervention.ville]
      .filter(Boolean)
      .join(", ") || "",

    // Dates
    date: intervention.date?.split('T')[0] || "",
    date_prevue: intervention.date_prevue?.split('T')[0] || "",

    // SST
    numero_sst: (intervention as any).numero_sst || "",
    pourcentage_sst: (intervention as any).pourcentage_sst?.toString() || "",

    // Commentaires
    consigne_second_artisan: intervention.consigne_second_artisan || "",
    commentaire_agent: intervention.commentaire_agent || "",

    // Propriétaire (owner) - Champ fusionné nom-prénom
    nomPrenomFacturation: intervention.owner?.plain_nom_facturation ||
      `${intervention.owner?.owner_lastname || ''} ${intervention.owner?.owner_firstname || ''}`.trim() || "",
    telephoneProprietaire: intervention.owner?.telephone || "",
    emailProprietaire: intervention.owner?.email || "",

    // Client (tenant) - Champ fusionné nom-prénom
    nomPrenomClient: intervention.tenants?.plain_nom_client ||
      `${intervention.tenants?.lastname || ''} ${intervention.tenants?.firstname || ''}`.trim() || "",
    telephoneClient: intervention.tenants?.telephone || "",
    emailClient: intervention.tenants?.email || "",

    // Logement vacant
    is_vacant: (intervention as any).is_vacant || false,
    key_code: (intervention as any).key_code || "",
    floor: (intervention as any).floor || "",
    apartment_number: (intervention as any).apartment_number || "",
    vacant_housing_instructions: (intervention as any).vacant_housing_instructions || "",

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

    // Sous-statut personnalisé
    sousStatutText: (intervention as any).sous_statut_text || "",
    sousStatutTextColor: (intervention as any).sous_statut_text_color || "#000000",
    sousStatutBgColor: (intervention as any).sous_statut_bg_color || "transparent",

    // Deuxième artisan
    secondArtisan: secondaryArtisan ? `${secondaryArtisan.prenom || ''} ${secondaryArtisan.nom || ''}`.trim() : "",
    secondArtisanTelephone: secondaryArtisan?.telephone || "",
    secondArtisanEmail: secondaryArtisan?.email || "",
    metierSecondArtisanId: (intervention as any).metier_second_artisan_id || "",
    // Coûts du 2ème artisan depuis intervention_costs avec artisan_order = 2
    coutSSTSecondArtisan: sstCostSecondArtisan?.amount?.toString() || "",
    coutMaterielSecondArtisan: materielCostSecondArtisan?.amount?.toString() || "",
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
  const [selectedSecondArtisanId, setSelectedSecondArtisanId] = useState<string | null>(secondaryArtisan?.id ?? null)
  const secondaryArtisanIdRef = useRef<string | null>(secondaryArtisan?.id ?? null)
  const [secondArtisanSearchPosition, setSecondArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)

  // Utiliser adresse_complete si disponible, sinon vide
  const initialLocationQuery = (intervention as any).adresse_complete || ""

  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions: locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocode: geocodeQuery,
  } = useGeocodeSearch({ initialQuery: initialLocationQuery })
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormReady, setIsFormReady] = useState(false)

  // Marquer le formulaire comme prêt après l'initialisation complète
  useEffect(() => {
    // Attendre que tous les useEffect d'initialisation soient terminés
    setIsFormReady(true)
  }, [])

  // Détection des modifications non sauvegardées
  const hasUnsavedChanges = useFormDataChanges(formData, isSubmitting, isFormReady)

  // Notifier le parent des modifications non sauvegardées
  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onHasUnsavedChanges])
  useEffect(() => {
    onStatusReasonModalOpenChange?.(isStatusReasonModalOpen)
  }, [isStatusReasonModalOpen, onStatusReasonModalOpenChange])

  const [isProprietaireOpen, setIsProprietaireOpen] = useState(false)
  const [isClientOpen, setIsClientOpen] = useState(false)
  const [isAccompteOpen, setIsAccompteOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(true)
  const [isSecondArtisanOpen, setIsSecondArtisanOpen] = useState(false)
  const [isSousStatutOpen, setIsSousStatutOpen] = useState(false)
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [showSecondArtisanSearch, setShowSecondArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const artisanSearchContainerRef = useRef<HTMLDivElement>(null)
  const [artisanDisplayMode, setArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")
  const [secondArtisanDisplayMode, setSecondArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")
  // État pour stocker l'artisan sélectionné via recherche (qui peut ne pas être dans nearbyArtisans)
  const [searchSelectedArtisan, setSearchSelectedArtisan] = useState<NearbyArtisan | null>(null)
  // État pour stocker le second artisan sélectionné via recherche (qui peut ne pas être dans nearbyArtisansSecondMetier)
  const [searchSelectedSecondArtisan, setSearchSelectedSecondArtisan] = useState<NearbyArtisan | null>(null)
  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    onArtisanSearchOpenChange?.(showArtisanSearch || showSecondArtisanSearch)
  }, [showArtisanSearch, showSecondArtisanSearch, onArtisanSearchOpenChange])
  const DEFAULT_RIGHT_COLUMN_WIDTH = 320
  const rightColumnStorageKey = currentUser?.id
    ? `gmbs:intervention-form:right-column-width:${currentUser.id}`
    : null
  const [rightColumnWidth, setRightColumnWidth] = useState(DEFAULT_RIGHT_COLUMN_WIDTH)
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

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!rightColumnStorageKey) {
      setRightColumnWidth(DEFAULT_RIGHT_COLUMN_WIDTH)
      return
    }

    try {
      const saved = localStorage.getItem(rightColumnStorageKey)
      if (saved) {
        const parsed = Number.parseFloat(saved)
        if (Number.isFinite(parsed) && parsed >= 250 && parsed <= 600) {
          setRightColumnWidth(parsed)
          return
        }
      }
      setRightColumnWidth(DEFAULT_RIGHT_COLUMN_WIDTH)
    } catch (error) {
      console.warn("Erreur lors du chargement de la largeur de la colonne droite:", error)
      setRightColumnWidth(DEFAULT_RIGHT_COLUMN_WIDTH)
    }
  }, [rightColumnStorageKey])

  // Hook séparé pour les artisans du second métier
  const {
    artisans: nearbyArtisansSecondMetier,
    loading: isLoadingNearbyArtisansSecondMetier,
  } = useNearbyArtisans(formData.latitude, formData.longitude, {
    limit: 100,
    maxDistanceKm: perimeterKmValue,
    sampleSize: 400,
    metier_id: formData.metierSecondArtisanId || null,
  })

  const selectedArtisanData = useMemo(
    () => {
      if (!selectedArtisanId) return null
      // D'abord chercher dans les artisans à proximité
      const nearbyArtisan = nearbyArtisans.find((artisan) => artisan.id === selectedArtisanId)
      if (nearbyArtisan) return nearbyArtisan
      // Sinon utiliser l'artisan de la recherche (qui peut ne pas être à proximité)
      return searchSelectedArtisan
    },
    [selectedArtisanId, nearbyArtisans, searchSelectedArtisan],
  )

  // CORRECTIF: Initialiser searchSelectedArtisan avec primaryArtisan si non trouvé dans nearbyArtisans
  // Cela permet d'afficher la carte de l'artisan déjà sélectionné lors de l'ouverture du modal
  useEffect(() => {
    // Ne rien faire si pas d'artisan principal ou si loading en cours
    if (!primaryArtisan?.id || isLoadingNearbyArtisans) return

    // Vérifier si l'artisan principal est bien celui sélectionné
    if (selectedArtisanId !== primaryArtisan.id) return

    // Vérifier si l'artisan est déjà dans nearbyArtisans
    const isInNearbyArtisans = nearbyArtisans.some(a => a.id === primaryArtisan.id)
    if (isInNearbyArtisans) return

    // Vérifier si on a déjà un searchSelectedArtisan valide pour cet artisan
    if (searchSelectedArtisan?.id === primaryArtisan.id) return

    // Créer un objet NearbyArtisan à partir de primaryArtisan
    const displayName = primaryArtisan.plain_nom
      || [primaryArtisan.prenom, primaryArtisan.nom].filter(Boolean).join(" ")
      || "Artisan sans nom"

    setSearchSelectedArtisan({
      id: primaryArtisan.id,
      displayName,
      distanceKm: 0,
      telephone: primaryArtisan.telephone || null,
      telephone2: primaryArtisan.telephone2 || null,
      email: primaryArtisan.email || null,
      adresse: null,
      ville: null,
      codePostal: null,
      lat: 0,
      lng: 0,
      prenom: primaryArtisan.prenom || null,
      nom: primaryArtisan.nom || null,
      raison_sociale: primaryArtisan.raison_sociale || null,
      statut_id: null,
      photoProfilMetadata: null,
    })
  }, [primaryArtisan, selectedArtisanId, isLoadingNearbyArtisans, nearbyArtisans, searchSelectedArtisan])
  const selectedSecondArtisanData = useMemo(
    () => {
      if (!selectedSecondArtisanId) return null
      // D'abord chercher dans les artisans à proximité du second métier
      const nearbyArtisan = nearbyArtisansSecondMetier.find((artisan) => artisan.id === selectedSecondArtisanId)
      if (nearbyArtisan) return nearbyArtisan
      // Sinon utiliser l'artisan de la recherche (qui peut ne pas être à proximité)
      return searchSelectedSecondArtisan
    },
    [selectedSecondArtisanId, nearbyArtisansSecondMetier, searchSelectedSecondArtisan],
  )

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
        console.warn("[InterventionEditForm] Erreur lors du chargement des absences:", error)
        setAbsentArtisanIds(new Set())
        return
      }

      setAbsentArtisanIds(
        new Set((data ?? []).map((absence) => absence.artisan_id).filter(Boolean)),
      )
    }

    loadAbsences()

    return () => {
      cancelled = true
    }
  }, [
    nearbyArtisans,
    nearbyArtisansSecondMetier,
    searchSelectedArtisan?.id,
    searchSelectedSecondArtisan?.id,
  ])

  // Calcul de la marge du 2ème artisan en pourcentage
  // Formule: coutInter2 = coutIntervention - (coutSST1 + coutMat1)
  //          marge2 = coutInter2 - (coutSST2 + coutMat2)
  //          marge2Pct = (marge2 / coutInter2) * 100
  const margeSecondArtisanPct = useMemo(() => {
    const coutInter = parseFloat(formData.coutIntervention) || 0
    const coutSST1 = parseFloat(formData.coutSST) || 0
    const coutMat1 = parseFloat(formData.coutMateriel) || 0
    const coutSST2 = parseFloat(formData.coutSSTSecondArtisan) || 0
    const coutMat2 = parseFloat(formData.coutMaterielSecondArtisan) || 0

    // coutInter2 = coutIntervention - (coutSST1 + coutMat1)
    const coutInter2 = coutInter - (coutSST1 + coutMat1)

    // marge2 = coutInter2 - (coutSST2 + coutMat2)
    const marge2 = coutInter2 - (coutSST2 + coutMat2)

    // Calcul du pourcentage (éviter division par zéro)
    if (coutInter2 <= 0) return 0
    return (marge2 / coutInter2) * 100
  }, [formData.coutIntervention, formData.coutSST, formData.coutMateriel, formData.coutSSTSecondArtisan, formData.coutMaterielSecondArtisan])

  // Fonction helper pour obtenir le nom à afficher selon le mode
  // Uses centralized artisan display utilities
  const getArtisanDisplayName = useCallback((artisan: NearbyArtisan, mode: "nom" | "rs" | "tel"): string => {
    const displayData = normalizeArtisanData(artisan, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getDisplayName(displayData, mode)
  }, [refData?.artisanStatuses])

  // Référence pour tracker si l'utilisateur a modifié manuellement le champ id_inter
  const userEditedIdInterRef = useRef(false)

  // Réinitialiser le flag quand on change d'intervention
  useEffect(() => {
    userEditedIdInterRef.current = false
  }, [intervention.id])

  // Synchroniser formData.id_inter avec intervention.id_inter quand il change
  // (par exemple après une sauvegarde qui génère un nouvel ID)
  // Ne PAS inclure formData.id_inter dans les dépendances pour éviter la boucle
  useEffect(() => {
    // Ne pas écraser si l'utilisateur a explicitement modifié le champ
    if (userEditedIdInterRef.current) {
      return
    }

    if (intervention.id_inter) {
      setFormData((prev) => {
        const currentIdInter = prev.id_inter?.trim() || ""
        const isProvisionalId = currentIdInter.length === 0 || currentIdInter.toLowerCase().includes("auto")

        // Ne mettre à jour que si le champ est vide ou contient "AUTO" (ID provisoire)
        if (isProvisionalId && intervention.id_inter !== currentIdInter) {
          return {
            ...prev,
            id_inter: intervention.id_inter || "",
          }
        }
        return prev
      })
    }
  }, [intervention.id_inter])

  // Synchroniser les champs d'adresse avec intervention quand l'intervention change
  // (par exemple quand on rouvre le modal avec de nouvelles données)
  useEffect(() => {
    setFormData((prev) => {
      // Ne mettre à jour que si les valeurs ont réellement changé pour éviter les re-renders inutiles
      const hasAddressChanged =
        intervention.adresse !== prev.adresse ||
        intervention.code_postal !== prev.code_postal ||
        intervention.ville !== prev.ville ||
        intervention.latitude !== prev.latitude ||
        intervention.longitude !== prev.longitude

      if (hasAddressChanged) {
        // Charger adresse_complete depuis la BDD (ne pas reconstruire automatiquement)
        const newAdresseComplete = (intervention as any).adresse_complete || ""

        // Synchroniser le champ de recherche d'adresse avec adresse_complete
        setLocationQuery(newAdresseComplete)

        return {
          ...prev,
          adresse: intervention.adresse || prev.adresse || "",
          code_postal: intervention.code_postal || prev.code_postal || "",
          ville: intervention.ville || prev.ville || "",
          latitude: intervention.latitude ?? prev.latitude ?? 48.8566,
          longitude: intervention.longitude ?? prev.longitude ?? 2.3522,
          adresseComplete: newAdresseComplete,
        }
      }
      return prev
    })
  }, [intervention, setLocationQuery])

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

  useEffect(() => {
    primaryArtisanIdRef.current = primaryArtisan?.id ?? null
  }, [primaryArtisan?.id])

  useEffect(() => {
    secondaryArtisanIdRef.current = secondaryArtisan?.id ?? null
  }, [secondaryArtisan?.id])

  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  // Sync client name with parent
  useEffect(() => {
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

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

  const canWriteInterventions = can("write_interventions")
  const canEditClosedInterventions = can("edit_closed_interventions")

  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) {
      return undefined
    }
    return refData.interventionStatuses.find((status) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const isClosedStatus = useMemo(() => {
    const code = (selectedStatus?.code ?? "").toUpperCase()
    const label = (selectedStatus?.label ?? "").toLowerCase()
    const normalizedLabel = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (code === "INTER_TERMINEE" || code === "TERMINE" || code === "TERMINEE" || code === "CLOTURE" || code === "CLOTUREE") {
      return true
    }
    return normalizedLabel.includes("termine") || normalizedLabel.includes("clotur")
  }, [selectedStatus?.code, selectedStatus?.label])

  const canEditIntervention = canWriteInterventions && (!isClosedStatus || canEditClosedInterventions)

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
    // Marquer que l'utilisateur a modifié manuellement le champ id_inter
    if (field === "id_inter") {
      userEditedIdInterRef.current = true
    }
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

  // Handle opening intervention email modal
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

  // Get selected artisan email
  const selectedArtisanEmail = useMemo(() => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''

    // First check in artisansWithEmail (from intervention_artisans)
    const artisan = artisansWithEmail.find((a) => a.id === artisanId)
    if (artisan) return artisan.email

    // Vérifier si c'est le premier artisan sélectionné dans le form
    if (selectedArtisanData && selectedArtisanData.id === artisanId) {
      return selectedArtisanData.email || ''
    }

    // Vérifier si c'est le second artisan sélectionné dans le form
    if (selectedSecondArtisanData && selectedSecondArtisanData.id === artisanId) {
      return selectedSecondArtisanData.email || ''
    }

    return ''
  }, [effectiveSelectedArtisanId, artisansWithEmail, selectedArtisanData, selectedSecondArtisanData])

  // Fonction pour obtenir le numéro de téléphone de l'artisan sélectionné
  const getSelectedArtisanPhone = useCallback((): string => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''

    // Chercher dans artisansWithEmail (depuis intervention_artisans)
    const artisan = artisansWithEmail.find((a) => a.id === artisanId)
    if (artisan && artisan.telephone) return artisan.telephone

    // Vérifier si c'est le premier artisan sélectionné dans le form
    if (selectedArtisanData && selectedArtisanData.id === artisanId && selectedArtisanData.telephone) {
      return selectedArtisanData.telephone
    }

    // Vérifier si c'est le second artisan sélectionné dans le form
    if (selectedSecondArtisanData && selectedSecondArtisanData.id === artisanId && selectedSecondArtisanData.telephone) {
      return selectedSecondArtisanData.telephone
    }

    return ''
  }, [effectiveSelectedArtisanId, artisansWithEmail, selectedArtisanData, selectedSecondArtisanData])

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
      // Sur desktop : ouvrir dans une nouvelle fenêtre centrée et de taille confortable
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`
      // Taille de la fenêtre (30% plus grande que standard)
      const popupWidth = 780
      const popupHeight = 910
      // Centrer la fenêtre sur l'écran
      const left = Math.round((window.screen.width - popupWidth) / 2)
      const top = Math.round((window.screen.height - popupHeight) / 2)
      window.open(
        whatsappUrl,
        '_blank',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )
    }
  }, [generateEmailTemplateData, formatPhoneForWhatsApp])

  // Hook pour gérer le redimensionnement de la colonne droite
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const startWidth = rightColumnWidth

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const diff = startX - currentX // Inversé car on redimensionne depuis la gauche
      const newWidth = Math.max(250, Math.min(600, startWidth + diff)) // Min 250px, Max 600px
      setRightColumnWidth(newWidth)
      if (!rightColumnStorageKey || typeof window === "undefined") return
      try {
        localStorage.setItem(rightColumnStorageKey, String(newWidth))
      } catch (error) {
        console.warn("Erreur lors de la sauvegarde de la largeur de la colonne droite:", error)
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleMouseMove, { passive: false })
    document.addEventListener('touchend', handleMouseUp)
  }, [rightColumnWidth, rightColumnStorageKey])

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
    setSearchSelectedArtisan(null)
    // Optionnel : vider le champ texte artisan si on désélectionne ?
    // handleInputChange("artisan", "")
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
    const displayName = artisan.raison_sociale
      || artisan.plain_nom
      || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
      || "Artisan sans nom"

    setSelectedSecondArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      secondArtisan: displayName,
      secondArtisanTelephone: artisan.telephone || "",
      secondArtisanEmail: artisan.email || "",
    }))

    // Si l'artisan sélectionné via recherche n'est pas dans la liste de proximité,
    // on le convertit au format NearbyArtisan et on le stocke pour l'afficher
    const isInProximity = nearbyArtisansSecondMetier.some(a => a.id === artisan.id)
    if (!isInProximity) {
      // Convertir l'artisan de la recherche au format NearbyArtisan
      const nearbyArtisanFormat: NearbyArtisan = {
        id: artisan.id,
        displayName: displayName,
        distanceKm: 0, // Distance inconnue pour artisan hors proximité
        telephone: artisan.telephone || null,
        telephone2: artisan.telephone2 || null,
        email: artisan.email || null,
        adresse: artisan.adresse_intervention || artisan.adresse_siege_social || null,
        ville: artisan.ville_intervention || artisan.ville_siege_social || null,
        codePostal: artisan.code_postal_intervention || artisan.code_postal_siege_social || null,
        lat: 0,
        lng: 0,
        prenom: artisan.prenom || null,
        nom: artisan.nom || null,
        raison_sociale: artisan.raison_sociale || null,
        statut_id: artisan.statut_id || null,
        photoProfilMetadata: null,
      }
      setSearchSelectedSecondArtisan(nearbyArtisanFormat)
    } else {
      // Si l'artisan est dans la liste de proximité, pas besoin de le stocker séparément
      setSearchSelectedSecondArtisan(null)
    }
  }, [nearbyArtisansSecondMetier])

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
    // on le convertit au format NearbyArtisan et on le stocke pour l'afficher
    const isInProximity = nearbyArtisans.some(a => a.id === artisan.id)
    if (!isInProximity) {
      // Convertir l'artisan de la recherche au format NearbyArtisan
      const nearbyArtisanFormat: NearbyArtisan = {
        id: artisan.id,
        displayName: displayName,
        distanceKm: 0, // Distance inconnue pour artisan hors proximité
        telephone: artisan.telephone || null,
        telephone2: artisan.telephone2 || null,
        email: artisan.email || null,
        adresse: artisan.adresse_intervention || artisan.adresse_siege_social || null,
        ville: artisan.ville_intervention || artisan.ville_siege_social || null,
        codePostal: artisan.code_postal_intervention || artisan.code_postal_siege_social || null,
        lat: 0,
        lng: 0,
        prenom: artisan.prenom || null,
        nom: artisan.nom || null,
        raison_sociale: artisan.raison_sociale || null,
        statut_id: artisan.statut_id || null,
        photoProfilMetadata: null,
      }
      setSearchSelectedArtisan(nearbyArtisanFormat)
    } else {
      // Si l'artisan est dans la liste de proximité, pas besoin de le stocker séparément
      setSearchSelectedArtisan(null)
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

    // Mettre à jour les champs de géocodage uniquement
    setFormData((prev) => ({
      ...prev,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
      adresseComplete: suggestion.label,
      // Mettre à jour adresse si elle est vide, sinon garder la valeur existante
      adresse: prev.adresse || addressParts.street || "",
      // Ne modifier code_postal et ville que s'ils sont vides
      code_postal: prev.code_postal || addressParts.postalCode || "",
      ville: prev.ville || addressParts.city || "",
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
        // Mettre à jour adresse si elle est vide, sinon garder la valeur existante
        adresse: prev.adresse || addressParts.street || "",
        // Ne modifier code_postal et ville que s'ils sont vides
        code_postal: prev.code_postal || addressParts.postalCode || "",
        ville: prev.ville || addressParts.city || "",
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
          nomPrenomFacturation: formData.nomPrenomFacturation,
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
            nomPrenomClient: formData.nomPrenomClient,
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
        adresse_complete: formData.adresseComplete || null,
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
        // Sous-statut personnalisé
        sous_statut_text: formData.sousStatutText?.trim() || null,
        sous_statut_text_color: formData.sousStatutTextColor || '#000000',
        sous_statut_bg_color: formData.sousStatutBgColor || 'transparent',
        // Deuxième artisan - métier
        metier_second_artisan_id: formData.metierSecondArtisanId || null,
        // Note: client_id est un alias de tenant_id dans certains contextes, mais on utilise tenant_id ici
        // Note: Les coûts du 2ème artisan sont gérés via intervention_costs avec artisan_order = 2
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
          adresse_complete: updateData.adresse_complete ?? null,
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
          sous_statut_text: updateData.sous_statut_text ?? null,
          sous_statut_text_color: updateData.sous_statut_text_color ?? '#000000',
          sous_statut_bg_color: updateData.sous_statut_bg_color ?? 'transparent',
          metier_second_artisan_id: updateData.metier_second_artisan_id ?? null,
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

      // Mettre à jour chaque coût (artisan principal = artisan_order 1, sauf pour 'intervention' qui est global)
      let costsUpdated = false
      for (const cost of costsToUpdate) {
        try {
          await interventionsApi.upsertCost(intervention.id, {
            cost_type: cost.cost_type,
            label: cost.cost_type === "sst" ? "Coût SST" : cost.cost_type === "materiel" ? "Coût Matériel" : "Coût Intervention",
            amount: cost.amount,
            // artisan_order: null pour 'intervention' (coût global), 1 pour sst/materiel de l'artisan principal
            artisan_order: cost.cost_type === "intervention" ? null : 1,
          })
          costsUpdated = true
        } catch (costError) {
          console.error(`[InterventionEditForm] Erreur lors de la mise à jour du coût ${cost.cost_type}:`, costError)
          // Ne pas bloquer la soumission si un coût échoue
        }
      }

      // Mettre à jour les coûts du 2ème artisan (artisan_order = 2)
      const coutSST2Value = parseFloat(formData.coutSSTSecondArtisan) || 0
      const coutMateriel2Value = parseFloat(formData.coutMaterielSecondArtisan) || 0

      if (selectedSecondArtisanId) {
        // Si un 2ème artisan est sélectionné, créer/mettre à jour ses coûts
        try {
          await interventionsApi.upsertCost(intervention.id, {
            cost_type: "sst",
            label: "Coût SST 2ème artisan",
            amount: coutSST2Value,
            artisan_order: 2,
          })
          await interventionsApi.upsertCost(intervention.id, {
            cost_type: "materiel",
            label: "Coût Matériel 2ème artisan",
            amount: coutMateriel2Value,
            artisan_order: 2,
          })
          costsUpdated = true
        } catch (costError) {
          console.error(`[InterventionEditForm] Erreur lors de la mise à jour des coûts du 2ème artisan:`, costError)
        }
      } else {
        // Si pas de 2ème artisan, supprimer ses coûts
        try {
          await interventionsApi.deleteCost(intervention.id, "sst", 2)
          await interventionsApi.deleteCost(intervention.id, "materiel", 2)
        } catch (deleteError) {
          // Ignorer les erreurs de suppression (le coût n'existait peut-être pas)
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
      const currentSecondaryId = secondaryArtisanIdRef.current
      const nextSecondaryId = selectedSecondArtisanId ?? null

      let payload: InterventionWithStatus = updated as InterventionWithStatus

      // Gérer l'artisan principal
      if (currentPrimaryId !== nextPrimaryId) {
        await interventionsApi.setPrimaryArtisan(intervention.id, nextPrimaryId)
        primaryArtisanIdRef.current = nextPrimaryId
      }

      // Gérer l'artisan secondaire
      if (currentSecondaryId !== nextSecondaryId) {
        await interventionsApi.setSecondaryArtisan(intervention.id, nextSecondaryId)
        secondaryArtisanIdRef.current = nextSecondaryId
      }

      // Recharger les données pour avoir les coûts et artisans à jour
      payload = await interventionsApi.getById(intervention.id)

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
          reference_agence: (payload as any).reference_agence || prev.reference_agence || "",
          // Synchroniser les champs d'adresse avec les données sauvegardées
          adresse: payload.adresse || prev.adresse || "",
          code_postal: payload.code_postal || prev.code_postal || "",
          ville: payload.ville || prev.ville || "",
          latitude: payload.latitude ?? prev.latitude ?? 48.8566,
          longitude: payload.longitude ?? prev.longitude ?? 2.3522,
          // Préserver adresseComplete indépendamment des autres champs d'adresse
          adresseComplete: prev.adresseComplete || "",
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
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

  // Expose agency name to parent
  useEffect(() => {
    onAgencyNameChange?.(selectedAgencyData?.label || "")
  }, [selectedAgencyData?.label, onAgencyNameChange])

  const showReferenceField = useMemo(() => {
    if (!selectedAgencyData) {
      return false
    }
    // Utilise la configuration depuis agency_config en base de données
    return selectedAgencyData.requires_reference === true
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
        {!canEditIntervention && (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Cette intervention est en lecture seule. Permission requise :{" "}
            {isClosedStatus ? "edit_closed_interventions" : "write_interventions"}
          </div>
        )}
        <fieldset
          disabled={!canEditIntervention}
          className={cn("flex-1 min-h-0 flex flex-col", !canEditIntervention && "opacity-70")}
        >
          {/* LAYOUT DEUX COLONNES DISTINCTES - Chaque colonne a son propre scroll */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* COLONNE GAUCHE - Scroll indépendant avec scrollbar minimale à gauche */}
            <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal scrollbar-left">
              <div
                className="grid gap-3 pb-4"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gridTemplateRows: `auto auto auto ${mapSectionHeight} auto auto`,
                }}
              >
                {/* DIV1: HEADER PRINCIPAL - Row 1, Cols 1-4 */}
                <Card className="legacy-form-card" style={{ gridArea: "1 / 1 / 2 / 5" }}>
                  <CardContent className="py-0.5 px-3">
                    <div
                      className="grid gap-2 items-end"
                      style={{
                        gridTemplateColumns: showReferenceField
                          ? "auto 1fr 1fr 1fr 1fr 1fr"
                          : "auto 1fr 1fr 1fr 1fr"
                      }}
                    >
                      {/* Badge utilisateur assigné - Largeur fixe à gauche */}
                      <div className="flex items-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex items-center justify-center h-7 w-7 cursor-pointer group rounded-full">
                              {(() => {
                                const assignedUser = refData?.users.find(u => u.id === formData.assigned_user_id)
                                return (
                                  <GestionnaireBadge
                                    firstname={assignedUser?.firstname}
                                    lastname={assignedUser?.lastname}
                                    color={assignedUser?.color}
                                    avatarUrl={assignedUser?.avatar_url}
                                    size="sm"
                                    className="transition-transform group-hover:scale-110 h-7 w-7"
                                  />
                                )
                              })()}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2 z-[100]" align="start">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Attribuer à ({refData?.users?.length || 0} utilisateurs)</p>
                              <div className="space-y-1">
                                {refData?.users && refData.users.length > 0 ? (
                                  refData.users.map((user) => {
                                    const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
                                    const isSelected = user.id === formData.assigned_user_id
                                    return (
                                      <button
                                        key={user.id}
                                        type="button"
                                        className={cn(
                                          "w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-colors",
                                          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                        )}
                                        onClick={() => handleInputChange("assigned_user_id", user.id)}
                                      >
                                        <GestionnaireBadge
                                          firstname={user.firstname}
                                          lastname={user.lastname}
                                          color={user.color}
                                          avatarUrl={user.avatar_url}
                                          size="sm"
                                          showBorder={false}
                                        />
                                        <span className="text-xs truncate flex-1">
                                          {user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName}
                                        </span>
                                      </button>
                                    )
                                  })
                                ) : (
                                  <p className="text-xs text-muted-foreground">Aucun utilisateur disponible</p>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Statut - Badge coloré */}
                      <SearchableBadgeSelect
                        label="Statut"
                        required
                        hideLabel
                        value={formData.statut_id}
                        onChange={(value) => handleInputChange("statut_id", value)}
                        placeholder="Statut"
                        searchPlaceholder="Rechercher un statut..."
                        options={(refData?.interventionStatuses || []).map(s => ({
                          id: s.id,
                          label: getStatusDisplayLabel(s.code, s.label, sstPayment, clientPayment),
                          color: s.color,
                        }))}
                      />

                      {/* Agence - Badge coloré */}
                      <SearchableBadgeSelect
                        label="Agence"
                        value={formData.agence_id}
                        options={refData.agencies}
                        onChange={(value) => handleInputChange("agence_id", value)}
                        placeholder="Agence"
                        minWidth="70px"
                        searchPlaceholder="Rechercher une agence..."
                        emptyText="Aucune agence trouvée"
                      />

                      {/* Réf. agence - Input conditionnel */}
                      {showReferenceField && (
                        <div className="flex items-center">
                          <Input
                            id="reference_agence"
                            name="reference_agence"
                            value={formData.reference_agence}
                            onChange={(event) => handleInputChange("reference_agence", event.target.value)}
                            placeholder="Réf. agence"
                            className="h-7 text-xs rounded-full px-3"
                            autoComplete="off"
                          />
                        </div>
                      )}

                      {/* Métier - Badge coloré */}
                      <SearchableBadgeSelect
                        label="Métier"
                        hideLabel
                        value={formData.metier_id}
                        onChange={(value) => handleInputChange("metier_id", value)}
                        placeholder="Métier"
                        searchPlaceholder="Rechercher un métier..."
                        minWidth="100px"
                        options={(refData?.metiers || []).map(m => ({
                          id: m.id,
                          label: m.label,
                          color: m.color,
                        }))}
                      />

                      {/* ID Intervention - Input */}
                      <div className="flex items-center">
                        <Input
                          id="idIntervention"
                          value={formData.id_inter}
                          onChange={(event) => handleInputChange("id_inter", event.target.value)}
                          placeholder="ID Inter."
                          className="h-7 text-xs rounded-full px-3"
                          required={requiresDefinitiveId}
                          pattern={requiresDefinitiveId ? "^(?!.*(?:[Aa][Uu][Tt][Oo])).+$" : undefined}
                          title={requiresDefinitiveId ? "ID définitif requis" : undefined}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                              window.clearTimeout(suggestionBlurBlurTimeoutRef.current)
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
                      <Card className="h-full flex flex-col overflow-hidden rounded-l-none border-l-0">
                        <CardContent className="p-3 flex flex-col h-full overflow-hidden">
                          {/* Header artisans */}
                          <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0 flex-wrap min-w-0">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                              <h3 className="font-semibold text-sm flex items-center gap-2 flex-shrink-0">
                                <Building className="h-4 w-4" />
                                Artisans
                              </h3>
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant={artisanDisplayMode === "nom" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setArtisanDisplayMode("nom")}
                                >
                                  nom
                                </Button>
                                <Button
                                  type="button"
                                  variant={artisanDisplayMode === "rs" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setArtisanDisplayMode("rs")}
                                >
                                  RS
                                </Button>
                                <Button
                                  type="button"
                                  variant={artisanDisplayMode === "tel" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setArtisanDisplayMode("tel")}
                                >
                                  tel
                                </Button>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
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
                                <Search className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Artisan sélectionné */}
                          {selectedArtisanId && selectedArtisanData && (() => {
                            const artisan = selectedArtisanData
                            const artisanDisplayName = getArtisanDisplayName(artisan, artisanDisplayMode)
                            const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                            const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                            const statutArtisan = artisanStatus?.label || ""
                            const statutArtisanColor = artisanStatus?.color || null

                            return (
                              <div className="mb-2 flex-shrink-0">
                                <div className="relative rounded-lg border border-primary/70 ring-2 ring-primary/50 bg-background/80 p-2 text-xs shadow-sm">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-5 w-5 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-destructive z-20"
                                    onClick={() => handleRemoveSelectedArtisan()}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                                    <span className="font-semibold text-foreground truncate text-xs min-w-0 flex-1">{artisanDisplayName}</span>
                                    {statutArtisan && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                        {statutArtisan}
                                      </Badge>
                                    )}
                                    {absentArtisanIds.has(artisan.id) && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                                        Indisponible
                                      </Badge>
                                    )}
                                    <Badge variant="default" className="text-[9px] px-1 py-0 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                                    {artisan.telephone && (
                                      <span className="text-[10px] text-muted-foreground truncate flex-shrink-0">📞 {artisan.telephone}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Email sending section */}
                          {selectedArtisanId && selectedArtisanData && (
                            <div className="flex flex-col gap-1 p-2 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 dark:border-primary/30 mb-2 flex-shrink-0">
                              {/* Boutons Email */}
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDevisEmailModal()}
                                  disabled={!selectedArtisanId}
                                  className="flex-1 text-[10px] h-7 px-2 border-primary/30 hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/20"
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Devis
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenInterventionEmailModal()}
                                  disabled={!selectedArtisanId}
                                  className="flex-1 text-[10px] h-7 px-2 border-primary/30 hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/20"
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Inter.
                                </Button>
                              </div>
                              {/* Boutons WhatsApp */}
                              {selectedArtisanData.telephone && (
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenWhatsApp('devis', selectedArtisanId, selectedArtisanData.telephone || '')}
                                    className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                                  >
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    WA Devis
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenWhatsApp('intervention', selectedArtisanId, selectedArtisanData.telephone || '')}
                                    className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                                  >
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    WA Inter.
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Liste des artisans - max 8 visibles avec scroll */}
                          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-minimal">
                            {isLoadingNearbyArtisans ? (
                              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Recherche...</div>
                            ) : nearbyArtisansError ? (
                              <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">{nearbyArtisansError}</div>
                            ) : nearbyArtisans.length === 0 ? (
                              <div className="rounded border border-border/50 bg-background px-2 py-2 text-[10px] text-muted-foreground">Aucun artisan dans un rayon de {perimeterKmValue} km.</div>
                            ) : (
                              nearbyArtisans.map((artisan) => {
                                const artisanDisplayName = getArtisanDisplayName(artisan, artisanDisplayMode)
                                const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                                const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                                const statutArtisan = artisanStatus?.label || ""
                                const statutArtisanColor = artisanStatus?.color || null

                                return (
                                  <div
                                    key={artisan.id}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                      "rounded-lg border border-border/60 bg-background/80 p-2 text-xs shadow-sm transition-all cursor-pointer",
                                      selectedArtisanId ? "opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none m-0 p-0 border-0" : "hover:border-primary/40"
                                    )}
                                    onClick={() => handleSelectNearbyArtisan(artisan)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectNearbyArtisan(artisan) } }}
                                  >
                                    <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                                      <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                                      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                                        <span className="font-medium text-foreground truncate text-[11px] min-w-0">{artisanDisplayName}</span>
                                        {absentArtisanIds.has(artisan.id) && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                                            Indisponible
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                                        {statutArtisan && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                            {statutArtisan}
                                          </Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={(e) => handleOpenArtisanModal(artisan.id, e)}>
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>

                {/* DIV5: CONTEXTE INTERVENTION - Row 5, Cols 1-2 */}
                <Card style={{ gridArea: "5 / 1 / 6 / 3" }}>
                  <CardContent className="p-4">
                    <Label htmlFor="contexteIntervention" className="text-xs font-medium mb-2 block">Contexte intervention *</Label>
                    <Textarea
                      id="contexteIntervention"
                      value={formData.contexte_intervention}
                      onChange={canEditContext ? (event) => handleInputChange("contexte_intervention", event.target.value) : undefined}
                      placeholder="Décrivez le contexte..."
                      rows={4}
                      className={cn("text-sm resize-none", !canEditContext && "cursor-not-allowed bg-muted/50 text-muted-foreground")}
                      readOnly={!canEditContext}
                      aria-readonly={!canEditContext}
                      required
                    />
                    {!canEditContext && <p className="mt-1 text-[10px] text-muted-foreground">Admin uniquement</p>}
                  </CardContent>
                </Card>

                {/* DIV6: CONSIGNE INTERVENTION - Row 5, Cols 3-4 */}
                <Card style={{ gridArea: "5 / 3 / 6 / 5" }}>
                  <CardContent className="p-4">
                    <Label htmlFor="consigneIntervention" className="text-xs font-medium mb-2 block">Consigne pour l&apos;artisan</Label>
                    <Textarea
                      id="consigneIntervention"
                      value={formData.consigne_intervention}
                      onChange={(event) => handleInputChange("consigne_intervention", event.target.value)}
                      placeholder="Consignes spécifiques..."
                      rows={4}
                      className="text-sm resize-none"
                    />
                  </CardContent>
                </Card>

                {/* DIV4: FINANCES & PLANIFICATION - Row 6, Cols 1-4 */}
                <Card style={{ gridArea: "6 / 1 / 7 / 5" }}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-5 gap-3 items-end">
                      <div>
                        <Label htmlFor="coutIntervention" className="text-xs">Coût inter.</Label>
                        <Input id="coutIntervention" type="number" step="0.01" min="0" value={formData.coutIntervention} onChange={(e) => handleInputChange("coutIntervention", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="coutSST" className="text-xs">Coût SST</Label>
                        <Input id="coutSST" type="number" step="0.01" min="0" value={formData.coutSST} onChange={(e) => handleInputChange("coutSST", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="coutMateriel" className="text-xs">Coût mat.</Label>
                        <Input id="coutMateriel" type="number" step="0.01" min="0" value={formData.coutMateriel} onChange={(e) => handleInputChange("coutMateriel", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Marge</Label>
                        <div className="flex h-8 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm items-center mt-1">
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
                      <div>
                        <Label htmlFor="datePrevue" className="text-xs">Date prévue {requiresDatePrevue && "*"}</Label>
                        <Input id="datePrevue" type="date" value={formData.date_prevue} onChange={(e) => handleInputChange("date_prevue", e.target.value)} className="h-8 text-sm mt-1" required={requiresDatePrevue} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                <Collapsible open={isProprietaireOpen} onOpenChange={setIsProprietaireOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          Détails facturation
                          {isProprietaireOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3">
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="nomPrenomFacturation" className="text-[10px]">Nom Prénom</Label>
                            <Input id="nomPrenomFacturation" value={formData.nomPrenomFacturation} onChange={(e) => handleInputChange("nomPrenomFacturation", e.target.value)} placeholder="Nom Prénom" className="h-7 text-xs mt-1" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="telephoneProprietaire" className="text-[10px]">Téléphone</Label>
                              <Input id="telephoneProprietaire" value={formData.telephoneProprietaire} onChange={(e) => handleInputChange("telephoneProprietaire", e.target.value)} placeholder="06..." className="h-7 text-xs mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="emailProprietaire" className="text-[10px]">Email</Label>
                              <Input id="emailProprietaire" type="email" value={formData.emailProprietaire} onChange={(e) => handleInputChange("emailProprietaire", e.target.value)} placeholder="email@..." className="h-7 text-xs mt-1" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Détails client */}
                <Collapsible open={isClientOpen} onOpenChange={setIsClientOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          Détails client
                          {isClientOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <input type="checkbox" id="is_vacant" className="h-3 w-3 rounded border-gray-300" checked={formData.is_vacant} onChange={(e) => handleInputChange("is_vacant", e.target.checked)} />
                            <Label htmlFor="is_vacant" className="text-[10px] font-normal cursor-pointer">logement vacant</Label>
                          </div>
                          {!formData.is_vacant && onOpenSmsModal && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] flex items-center gap-1"
                              onClick={onOpenSmsModal}
                              disabled={!formData.nomPrenomClient || !formData.telephoneClient}
                            >
                              <MessageSquare className="h-3 w-3" />
                              SMS
                            </Button>
                          )}
                        </div>
                        {formData.is_vacant ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label htmlFor="key_code" className="text-[10px]">CODE CLÉ</Label>
                                <Input id="key_code" value={formData.key_code} onChange={(e) => handleInputChange("key_code", e.target.value)} className="h-7 text-xs mt-1" />
                              </div>
                              <div>
                                <Label htmlFor="floor" className="text-[10px]">Étage</Label>
                                <Input id="floor" value={formData.floor} onChange={(e) => handleInputChange("floor", e.target.value)} className="h-7 text-xs mt-1" />
                              </div>
                              <div>
                                <Label htmlFor="apartment_number" className="text-[10px]">N° appart.</Label>
                                <Input id="apartment_number" value={formData.apartment_number} onChange={(e) => handleInputChange("apartment_number", e.target.value)} className="h-7 text-xs mt-1" />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="vacant_housing_instructions" className="text-[10px]">Consigne</Label>
                              <Textarea id="vacant_housing_instructions" value={formData.vacant_housing_instructions} onChange={(e) => handleInputChange("vacant_housing_instructions", e.target.value)} placeholder="Consignes..." className="min-h-[60px] text-xs mt-1 resize-none" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor="nomPrenomClient" className="text-[10px]">Nom Prénom</Label>
                              <Input id="nomPrenomClient" value={formData.nomPrenomClient} onChange={(e) => handleInputChange("nomPrenomClient", e.target.value)} placeholder="Nom Prénom" className="h-7 text-xs mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="telephoneClient" className="text-[10px]">Téléphone</Label>
                                <Input id="telephoneClient" value={formData.telephoneClient} onChange={(e) => handleInputChange("telephoneClient", e.target.value)} placeholder="06..." className="h-7 text-xs mt-1" />
                              </div>
                              <div>
                                <Label htmlFor="emailClient" className="text-[10px]">Email</Label>
                                <Input id="emailClient" type="email" value={formData.emailClient} onChange={(e) => handleInputChange("emailClient", e.target.value)} placeholder="email@..." className="h-7 text-xs mt-1" />
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Gestion des acomptes */}
                <Collapsible open={isAccompteOpen} onOpenChange={setIsAccompteOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          Gestion des acomptes
                          {isAccompteOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="accompteSST" className="text-[10px]">Acompte SST</Label>
                            <Input id="accompteSST" value={formData.accompteSST} onChange={(e) => handleAccompteSSTChange(e.target.value)} onBlur={handleAccompteSSTBlur} placeholder="Montant" className="h-7 text-xs" disabled={!canEditAccomptes} type="number" step="0.01" min="0" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Reçu</Label>
                            <div className="flex items-center gap-1">
                              <input type="checkbox" checked={formData.accompteSSTRecu} onChange={(e) => handleAccompteSSTRecuChange(e.target.checked)} className="h-3 w-3" />
                              <Input type="date" value={formData.dateAccompteSSTRecu} onChange={(e) => handleDateAccompteSSTRecuChange(e.target.value)} className="h-7 text-xs flex-1" />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="accompteClient" className="text-[10px]">Acompte client</Label>
                            <Input id="accompteClient" value={formData.accompteClient} onChange={(e) => handleAccompteClientChange(e.target.value)} onBlur={handleAccompteClientBlur} placeholder="Montant" className="h-7 text-xs" disabled={!canEditAccomptes} type="number" step="0.01" min="0" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Reçu</Label>
                            <div className="flex items-center gap-1">
                              <input type="checkbox" checked={formData.accompteClientRecu} onChange={(e) => handleAccompteClientRecuChange(e.target.checked)} className="h-3 w-3" />
                              <Input type="date" value={formData.dateAccompteClientRecu} onChange={(e) => handleDateAccompteClientRecuChange(e.target.value)} className="h-7 text-xs flex-1" />
                            </div>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground">Éditable si statut = Accepté ou Attente acompte</p>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Documents */}
                <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          <Upload className="h-3 w-3" />
                          Documents
                          {isDocumentsOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3">
                        <DocumentManager entityType="intervention" entityId={intervention.id} kinds={INTERVENTION_DOCUMENT_KINDS} currentUser={currentUser ?? undefined} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Deuxième artisan */}
                <Collapsible open={isSecondArtisanOpen} onOpenChange={setIsSecondArtisanOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          <Users className="h-3 w-3" />
                          Deuxième artisan
                          {isSecondArtisanOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3">
                        <div className="space-y-3">
                          {/* Header artisans - même style que colonne gauche */}
                          <div className="flex items-center justify-between gap-2 flex-shrink-0 pt-[13px] flex-wrap min-w-0">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                              <SearchableBadgeSelect
                                label="Métier"
                                value={formData.metierSecondArtisanId}
                                options={(refData?.metiers || []).map(m => ({
                                  id: m.id,
                                  label: m.label,
                                  color: m.color,
                                }))}
                                onChange={(value) => handleInputChange("metierSecondArtisanId", value)}
                                placeholder="Métier..."
                                minWidth="100px"
                                hideLabel
                                searchPlaceholder="Rechercher un métier..."
                                emptyText="Aucun métier trouvé"
                              />
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant={secondArtisanDisplayMode === "nom" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setSecondArtisanDisplayMode("nom")}
                                >
                                  nom
                                </Button>
                                <Button
                                  type="button"
                                  variant={secondArtisanDisplayMode === "rs" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setSecondArtisanDisplayMode("rs")}
                                >
                                  RS
                                </Button>
                                <Button
                                  type="button"
                                  variant={secondArtisanDisplayMode === "tel" ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => setSecondArtisanDisplayMode("tel")}
                                >
                                  tel
                                </Button>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setSecondArtisanSearchPosition({
                                  x: rect.left,
                                  y: rect.top,
                                  width: rect.width,
                                  height: rect.height
                                })
                                setShowSecondArtisanSearch(true)
                              }}
                              title="Rechercher un artisan"
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Artisan secondaire sélectionné */}
                          {selectedSecondArtisanId && selectedSecondArtisanData && (() => {
                            const artisan = selectedSecondArtisanData
                            const artisanDisplayName = getArtisanDisplayName(artisan, secondArtisanDisplayMode)
                            const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                            const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                            const statutArtisan = artisanStatus?.label || ""
                            const statutArtisanColor = artisanStatus?.color || null

                            return (
                              <div className="relative rounded-lg border border-orange-500/70 ring-2 ring-orange-500/50 bg-background/80 p-2 text-xs shadow-sm">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1 h-5 w-5 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-destructive z-20"
                                  onClick={() => handleRemoveSecondArtisan()}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                                  <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                                  <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                                    <span className="font-semibold text-foreground truncate text-xs min-w-0">{artisanDisplayName}</span>
                                    {absentArtisanIds.has(artisan.id) && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                                        Indisponible
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap flex-shrink-0 ml-auto">
                                    {statutArtisan && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                        {statutArtisan}
                                      </Badge>
                                    )}
                                    <Badge variant="default" className="text-[9px] px-1 py-0 bg-orange-500 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                                  </div>
                                </div>
                                {artisan.telephone && (
                                  <div className="mt-1 text-[10px] text-muted-foreground truncate">
                                    📞 {artisan.telephone}
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Email sending section for second artisan */}
                          {selectedSecondArtisanId && selectedSecondArtisanData && (
                            <div className="flex flex-col gap-1 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800/50">
                              {/* Boutons Email */}
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDevisEmailModal(selectedSecondArtisanId)}
                                  className="flex-1 text-[10px] h-7 px-2 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/30"
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Devis
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenInterventionEmailModal(selectedSecondArtisanId)}
                                  className="flex-1 text-[10px] h-7 px-2 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/30"
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Inter.
                                </Button>
                              </div>
                              {/* Boutons WhatsApp */}
                              {selectedSecondArtisanData.telephone && (
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenWhatsApp('devis', selectedSecondArtisanId, selectedSecondArtisanData.telephone || '')}
                                    className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                                  >
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    WA Devis
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenWhatsApp('intervention', selectedSecondArtisanId, selectedSecondArtisanData.telephone || '')}
                                    className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                                  >
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    WA Inter.
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Liste des artisans pour sélection (affichée uniquement si pas d'artisan sélectionné) */}
                          {!selectedSecondArtisanId && (
                            <div className="max-h-[150px] overflow-y-auto space-y-1 scrollbar-minimal">
                              {nearbyArtisansSecondMetier
                                .filter(artisan => artisan.id !== selectedArtisanId) // Exclure l'artisan principal
                                .slice(0, 5)
                                .map((artisan) => {
                                  const artisanDisplayName = getArtisanDisplayName(artisan, secondArtisanDisplayMode)
                                  const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                                  const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                                  const statutArtisan = artisanStatus?.label || ""
                                  const statutArtisanColor = artisanStatus?.color || null

                                  return (
                                    <div
                                      key={artisan.id}
                                      role="button"
                                      tabIndex={0}
                                      className="rounded-lg border border-border/60 bg-background/80 p-2 text-xs shadow-sm transition-all cursor-pointer hover:border-orange-500/40"
                                      onClick={() => handleSelectSecondArtisan(artisan)}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectSecondArtisan(artisan) } }}
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                                        <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                                        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                                          <span className="font-medium text-foreground truncate text-[11px] min-w-0">{artisanDisplayName}</span>
                                          {absentArtisanIds.has(artisan.id) && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                                              Indisponible
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap flex-shrink-0 ml-auto">
                                          {statutArtisan && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                              {statutArtisan}
                                            </Badge>
                                          )}
                                          <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          )}

                          {/* Consigne pour le deuxième artisan */}
                          <div>
                            <Label htmlFor="consigne_second_artisan" className="text-[10px]">Consigne 2ème artisan</Label>
                            <Textarea
                              id="consigne_second_artisan"
                              value={formData.consigne_second_artisan}
                              onChange={(e) => handleInputChange("consigne_second_artisan", e.target.value)}
                              placeholder="Consignes spécifiques..."
                              className="min-h-[50px] text-xs mt-1 resize-none"
                            />
                          </div>

                          {/* Coûts du 2ème artisan */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label htmlFor="coutSSTSecondArtisan" className="text-[10px]">Coût SST</Label>
                              <Input
                                id="coutSSTSecondArtisan"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.coutSSTSecondArtisan}
                                onChange={(e) => handleInputChange("coutSSTSecondArtisan", e.target.value)}
                                placeholder="0.00 €"
                                className="h-7 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="coutMaterielSecondArtisan" className="text-[10px]">Coût mat.</Label>
                              <Input
                                id="coutMaterielSecondArtisan"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.coutMaterielSecondArtisan}
                                onChange={(e) => handleInputChange("coutMaterielSecondArtisan", e.target.value)}
                                placeholder="0.00 €"
                                className="h-7 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Marge 2</Label>
                              <div className="flex h-7 w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm items-center mt-1">
                                <span className={cn("font-medium", margeSecondArtisanPct < 0 ? "text-destructive" : "text-green-600")}>
                                  {margeSecondArtisanPct.toFixed(1)} %
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

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
                <Collapsible open={isSousStatutOpen} onOpenChange={setIsSousStatutOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                        <CardTitle className="flex items-center gap-2 text-xs">
                          <Palette className="h-3 w-3" />
                          Sous-statut
                          {formData.sousStatutText && (
                            <span
                              className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{
                                color: formData.sousStatutTextColor,
                                backgroundColor: formData.sousStatutBgColor !== 'transparent' ? formData.sousStatutBgColor : undefined
                              }}
                            >
                              {formData.sousStatutText}
                            </span>
                          )}
                          {isSousStatutOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-3 pb-3">
                        <div className="space-y-3">
                          <p className="text-[10px] text-muted-foreground">
                            Ajoutez un sous-statut personnalisé pour cette intervention (max 25 caractères).
                          </p>
                          <div>
                            <Label htmlFor="sousStatutText" className="text-[10px]">Texte du sous-statut</Label>
                            <Input
                              id="sousStatutText"
                              value={formData.sousStatutText}
                              onChange={(e) => handleInputChange("sousStatutText", e.target.value)}
                              placeholder="Ex: Devis supp, Urgent..."
                              maxLength={25}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label htmlFor="sousStatutTextColor" className="text-[10px]">Couleur du texte</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  id="sousStatutTextColor"
                                  value={formData.sousStatutTextColor}
                                  onChange={(e) => handleInputChange("sousStatutTextColor", e.target.value)}
                                  className="h-7 w-12 rounded border border-input cursor-pointer p-0.5"
                                  title="Couleur du texte"
                                />
                                <span className="text-[10px] text-muted-foreground">{formData.sousStatutTextColor}</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="sousStatutBgColor" className="text-[10px]">Surlignage</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  id="sousStatutBgColor"
                                  value={formData.sousStatutBgColor === 'transparent' ? '#ffffff' : formData.sousStatutBgColor}
                                  onChange={(e) => handleInputChange("sousStatutBgColor", e.target.value)}
                                  className="h-7 w-12 rounded border border-input cursor-pointer p-0.5"
                                  title="Couleur de surlignage"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[9px]"
                                  onClick={() => handleInputChange("sousStatutBgColor", "transparent")}
                                  title="Supprimer le surlignage"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {formData.sousStatutText && (
                            <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                              <p className="text-[10px] text-muted-foreground mb-1">Aperçu :</p>
                              <span
                                className="text-sm font-medium px-1.5 py-0.5 rounded"
                                style={{
                                  color: formData.sousStatutTextColor,
                                  backgroundColor: formData.sousStatutBgColor !== 'transparent' ? formData.sousStatutBgColor : undefined
                                }}
                              >
                                {formData.sousStatutText}
                              </span>
                            </div>
                          )}
                          {formData.sousStatutText && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-destructive hover:text-destructive"
                              onClick={() => {
                                handleInputChange("sousStatutText", "")
                                handleInputChange("sousStatutTextColor", "#000000")
                                handleInputChange("sousStatutBgColor", "transparent")
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Effacer le sous-statut
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
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
        </fieldset>
        <div ref={artisanSearchContainerRef} />
      </form>
      {/* Modal de recherche d'artisan principal */}
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

      {/* Modal de recherche d'artisan secondaire */}
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
}
