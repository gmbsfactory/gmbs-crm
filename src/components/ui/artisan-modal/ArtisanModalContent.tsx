"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  Upload,
  X,
  User,
  Building2,
  Landmark,
  UserCheck,
  MessageSquare,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  History,
  Info,
  MapPin,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DocumentManager } from "@/components/documents"
import { ModeIcons } from "@/components/ui/mode-selector"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { Avatar } from "@/components/artisans/Avatar"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ArtisanHistoryPanel } from "@/components/artisans/history/ArtisanHistoryPanel"
import { ArtisanFinancesSection } from "./ArtisanFinancesSection"
import { ArtisanInterventionsTable } from "./ArtisanInterventionsTable"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useGeocodeSearch, type GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { interventionsApi } from "@/lib/api/v2"
import { toast } from "sonner"
import { artisansApi } from "@/lib/api/v2"
import type { Artisan } from "@/lib/api/v2/common/types"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { getReasonTypeForTransition, type StatusReasonType } from "@/lib/comments/statusReason"
import { cn } from "@/lib/utils"
import type { ModalDisplayMode } from "@/types/modal-display"
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"
import { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { validateSiret } from "@/lib/siret-validation"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"
import { useArtisanPresence } from "@/hooks/useArtisanPresence"
import { PresenceAvatars } from "@/components/ui/intervention-modal/PresenceAvatars"
import { ReadOnlyBanner } from "@/components/ui/intervention-modal/ReadOnlyBanner"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"

// ===== HELPERS =====

// Fonction pour calculer la couleur de texte lisible (blanc ou noir)
function getReadableTextColor(bgColor: string | null | undefined): string {
  if (!bgColor) return "#1f2937"
  const hex = bgColor.replace("#", "")
  if (hex.length !== 6) return "#1f2937"
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Formule de luminance relative
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#1f2937" : "#ffffff"
}

// Helpers pour les badges de statut
const FALLBACK_STATUS_COLOR = "#4B5563"

function normalizeHex(hex?: string | null): string {
  if (!hex) return FALLBACK_STATUS_COLOR
  let value = hex.trim()
  if (!value.startsWith("#")) {
    value = `#${value}`
  }
  if (value.length === 4) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    value = `#${r}${r}${g}${g}${b}${b}`
  }
  if (value.length !== 7) {
    return FALLBACK_STATUS_COLOR
  }
  return value.toUpperCase()
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

function hexToRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return `rgba(75, 85, 99, ${alpha})`
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function computeBadgeStyle(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    backgroundColor: hexToRgba(normalized, 0.15),
    border: `1px solid ${hexToRgba(normalized, 0.35)}`,
    color: normalized,
  }
}

// ===== CONSTANTES =====

const STATUT_JURIDIQUE_OPTIONS = [
  { value: "SARL", label: "SARL" },
  { value: "EIRL", label: "EIRL" },
  { value: "EURL", label: "EURL" },
  { value: "SAS", label: "SAS" },
  { value: "SASU", label: "SASU" },
  { value: "Auto-entrepreneur", label: "Auto-entrepreneur" },
  { value: "SA", label: "SA" },
  { value: "SNC", label: "SNC" },
  { value: "SCS", label: "SCS" },
  { value: "SCA", label: "SCA" },
]

const ZONE_INTERVENTION_OPTIONS = [
  { value: "20", label: "0 à 20 km" },
  { value: "35", label: "20 à 35 km" },
  { value: "50", label: "35 à 50 km" },
  { value: "150", label: "50 et + km" },
]

const IBAN_LENGTH = 27
const IBAN_GROUPS = [4, 4, 4, 4, 4, 4, 3]

type ArtisanWithRelations = Artisan & {
  artisan_metiers?: Array<{
    metier_id: string
    is_primary?: boolean | null
    metiers?: { id: string; code: string | null; label: string | null; color?: string | null } | null
  }>
  artisan_zones?: Array<{
    zone_id: string
    zones?: { id: string; code: string | null; label: string | null } | null
  }>
  artisan_attachments?: Array<{
    id: string
    kind: string
    url: string
    filename: string | null
    created_at?: string | null
    content_hash?: string | null
    derived_sizes?: Record<string, string> | null
    mime_preferred?: string | null
    mime_type?: string | null
  }>
  artisan_absences?: Array<{
    id: string
    start_date: string | null
    end_date: string | null
    reason: string | null
    is_confirmed?: boolean | null
  }>
  commentHistories?: Array<{
    id: string
    comment?: string | null
    modifiedAt?: string | null
    created_at?: string | null
    user?: {
      username?: string | null
      firstname?: string | null
      lastname?: string | null
    } | null
  }>
  statutDossier?: string | null
}

type ArtisanFormValues = {
  raison_sociale: string
  prenom: string
  nom: string
  telephone: string
  telephone2: string
  email: string
  adresse_intervention: string
  code_postal_intervention: string
  ville_intervention: string
  adresse_siege_social: string
  code_postal_siege_social: string
  ville_siege_social: string
  statut_juridique: string
  siret: string
  iban: string
  metiers: string[]
  zone_intervention: string
  gestionnaire_id: string
  statut_id: string
  numero_associe: string
  intervention_latitude: number | null
  intervention_longitude: number | null
}

type Props = {
  artisanId: string
  mode: ModalDisplayMode
  onClose: () => void
  onNext?: () => void
  onPrevious?: () => void
  canNext?: boolean
  canPrevious?: boolean
  onCycleMode?: () => void
  activeIndex?: number
  totalCount?: number
  defaultView?: "informations" | "statistics"
  onUnsavedChangesStateChange?: (hasChanges: boolean, submitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
}

const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date)
  } catch {
    return value
  }
}

const dossierStatusTheme: Record<string, string> = {
  complet: "bg-emerald-100 text-emerald-700 border-emerald-200",
  en_attente: "bg-amber-100 text-amber-700 border-amber-200",
  incomplet: "bg-red-100 text-red-700 border-red-200",
  a_verifier: "bg-blue-100 text-blue-700 border-blue-200",
  bloque: "bg-slate-200 text-slate-700 border-slate-300",
}

const ARTISAN_DOCUMENT_KINDS = [
  { kind: "kbis", label: "Extrait Kbis" },
  { kind: "assurance", label: "Attestation d'assurance" },
  { kind: "cni_recto_verso", label: "CNI recto/verso" },
  { kind: "iban", label: "IBAN" },
  { kind: "decharge_partenariat", label: "Décharge partenariat" },
  { kind: "photo_profil", label: "Photo de profil" },
  { kind: "autre", label: "Autre document" },
]

const mapArtisanToForm = (artisan: ArtisanWithRelations | any): ArtisanFormValues => {
  // Gérer les deux formats possibles : ArtisanWithRelations (avec relations) ou Artisan (format API)
  const artisanAny = artisan as any

  // Extraire les métiers - gérer plusieurs formats possibles
  const metierIds = (() => {
    // Format 1: artisan_metiers avec relations (format attendu par ArtisanWithRelations)
    if (Array.isArray(artisanAny.artisan_metiers)) {
      return artisanAny.artisan_metiers
        .map((item: any) => {
          // Priorité 1: metier_id (ID direct de la relation)
          if (item.metier_id) return item.metier_id
          // Priorité 2: metiers.id (ID depuis la relation jointe)
          if (item.metiers?.id) return item.metiers.id
          // Priorité 3: metiers.code (code du métier - à convertir en ID si nécessaire)
          if (item.metiers?.code) {
            // Si on a referenceData, chercher l'ID correspondant au code
            // Sinon, retourner le code tel quel (sera géré par le formulaire)
            return item.metiers.code
          }
          // Priorité 4: metiers.label (label du métier)
          if (item.metiers?.label) return item.metiers.label
          // Priorité 5: valeur directe si c'est une string
          if (typeof item === 'string') return item
          return null
        })
        .filter((value: any): value is string => Boolean(value))
    }

    // Format 2: metiers comme tableau de strings (format retourné par mapArtisanRecord)
    // Ces strings peuvent être des IDs, des codes ou des labels
    if (Array.isArray(artisanAny.metiers)) {
      return artisanAny.metiers.filter((value: any): value is string => Boolean(value))
    }

    return []
  })()

  // Extraire la zone d'intervention - gérer plusieurs formats possibles
  // IMPORTANT: Utiliser zones.code en priorité car les options du Select utilisent les codes ("20", "35", etc.)
  // et non les UUIDs (zone_id)
  const zoneValue = (() => {
    // Format 1: artisan_zones avec relations
    if (Array.isArray(artisanAny.artisan_zones) && artisanAny.artisan_zones.length > 0) {
      const first = artisanAny.artisan_zones[0]
      // Priorité au code de la zone car les options utilisent des codes, pas des UUIDs
      if (first.zones?.code) return String(first.zones.code)
      if (first.zones?.label) return String(first.zones.label)
      // Fallback sur zone_id seulement si pas de code/label disponible
      if (first.zone_id) return String(first.zone_id)
    }

    // Format 2: zones comme tableau de strings
    if (Array.isArray(artisanAny.zones) && artisanAny.zones.length > 0) {
      return String(artisanAny.zones[0] ?? "")
    }

    // Format 3: zoneIntervention comme valeur directe
    if (artisanAny.zoneIntervention) {
      return String(artisanAny.zoneIntervention)
    }

    return ""
  })()

  return {
    raison_sociale: artisanAny.raison_sociale ?? "",
    prenom: artisanAny.prenom ?? "",
    nom: artisanAny.nom ?? "",
    telephone: artisanAny.telephone ?? "",
    telephone2: artisanAny.telephone2 ?? "",
    email: artisanAny.email ?? "",
    adresse_intervention: artisanAny.adresse_intervention ?? "",
    code_postal_intervention: artisanAny.code_postal_intervention ?? "",
    ville_intervention: artisanAny.ville_intervention ?? "",
    adresse_siege_social: artisanAny.adresse_siege_social ?? "",
    code_postal_siege_social: artisanAny.code_postal_siege_social ?? "",
    ville_siege_social: artisanAny.ville_siege_social ?? "",
    statut_juridique: artisanAny.statut_juridique ?? "",
    siret: artisanAny.siret ?? "",
    // Normaliser l'IBAN en majuscules dès le mapping pour éviter que le toUpperCase() 
    // dans le onChange du InputOTP ne marque le champ comme modifié
    iban: (artisanAny.iban ?? "").toUpperCase(),
    metiers: metierIds,
    zone_intervention: zoneValue,
    gestionnaire_id: artisanAny.gestionnaire_id ?? "",
    statut_id: artisanAny.statut_id ?? "",
    numero_associe: artisanAny.numero_associe ?? "",
    intervention_latitude: artisanAny.intervention_latitude ?? null,
    intervention_longitude: artisanAny.intervention_longitude ?? null,
  }
}

const buildUpdatePayload = (values: ArtisanFormValues) => {
  // Normaliser le SIRET : soit vide, soit exactement 14 chiffres
  const normalizedSiret = (() => {
    const siret = values.siret?.trim() || ""
    if (siret.length === 0) return undefined
    if (siret.length === 14 && /^\d+$/.test(siret)) return siret
    // Si partiellement rempli, retourner undefined (ne pas enregistrer)
    return undefined
  })()

  const normalizedIban = (() => {
    const iban = values.iban?.replace(/\s/g, "").toUpperCase() || ""
    if (iban.length === 0) return undefined
    if (iban.length !== IBAN_LENGTH) return undefined
    if (!/^[A-Z0-9]+$/.test(iban)) return undefined
    return iban
  })()

  return {
    raison_sociale: values.raison_sociale || undefined,
    prenom: values.prenom || undefined,
    nom: values.nom || undefined,
    telephone: values.telephone || undefined,
    telephone2: values.telephone2 || undefined,
    email: values.email || undefined,
    adresse_intervention: values.adresse_intervention || undefined,
    code_postal_intervention: values.code_postal_intervention || undefined,
    ville_intervention: values.ville_intervention || undefined,
    adresse_siege_social: values.adresse_siege_social || undefined,
    code_postal_siege_social: values.code_postal_siege_social || undefined,
    ville_siege_social: values.ville_siege_social || undefined,
    statut_juridique: values.statut_juridique || undefined,
    siret: normalizedSiret,
    iban: normalizedIban,
    zones: values.zone_intervention ? [values.zone_intervention] : [],
    metiers: values.metiers ?? [],
    gestionnaire_id: values.gestionnaire_id || undefined,
    statut_id: values.statut_id || undefined,
    numero_associe: values.numero_associe || undefined,
    intervention_latitude: values.intervention_latitude ?? undefined,
    intervention_longitude: values.intervention_longitude ?? undefined,
  }
}

export function ArtisanModalContent({
  artisanId,
  mode,
  onClose,
  onNext,
  onPrevious,
  canNext,
  canPrevious,
  onCycleMode,
  activeIndex,
  totalCount,
  defaultView,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
  onStatusReasonModalOpenChange,
  onUnsavedDialogOpenChange,
}: Props) {
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const { data: referenceData } = useReferenceDataQuery()
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)

  // États pour les sections collapsibles
  const [isAbsencesOpen, setIsAbsencesOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(true) // Toujours déplié par défaut

  // Toggle entre vue Informations et vue Statistiques
  // Initialiser avec la vue par défaut si spécifiée
  const [showStats, setShowStats] = useState(defaultView === "statistics")
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)

  // Gestion des absences
  const [newAbsence, setNewAbsence] = useState({ start_date: "", end_date: "", reason: "" })

  const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
  const labelClass = "text-xs font-medium text-foreground/80"

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    setValue,
    formState: { isDirty, dirtyFields, errors },
  } = useForm<ArtisanFormValues>({
    defaultValues: {
      raison_sociale: "",
      prenom: "",
      nom: "",
      telephone: "",
      telephone2: "",
      email: "",
      adresse_intervention: "",
      code_postal_intervention: "",
      ville_intervention: "",
      adresse_siege_social: "",
      code_postal_siege_social: "",
      ville_siege_social: "",
      statut_juridique: "",
      siret: "",
      iban: "",
      metiers: [],
      zone_intervention: "",
      gestionnaire_id: "",
      statut_id: "",
      numero_associe: "",
      intervention_latitude: null,
      intervention_longitude: null,
    },
  })

  // Hook géocodage pour l'adresse du siège social
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isSuggesting,
    clearSuggestions,
  } = useGeocodeSearch({ minQueryLength: 3, debounceMs: 300 })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionBlurTimeoutRef = useRef<number | null>(null)

  // Cleanup du timeout
  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  // Gestionnaire de sélection d'une suggestion d'adresse (siège social)
  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
    }

    const parts = suggestion.label.split(',').map(p => p.trim())
    const postalMatch = suggestion.label.match(/\b(\d{5})\b/)

    let street = parts[0] || suggestion.label
    let postalCode = postalMatch?.[1] || ""
    let city = ""

    for (const part of parts) {
      if (postalMatch && part.includes(postalMatch[1])) {
        const cityMatch = part.replace(postalMatch[1], '').trim()
        if (cityMatch) city = cityMatch
      } else if (!part.toLowerCase().includes("france") && !postalMatch?.[1]?.includes(part) && part !== street && part.length > 1) {
        if (!city) city = part
      }
    }

    setValue("adresse_siege_social", street)
    setValue("code_postal_siege_social", postalCode)
    setValue("ville_siege_social", city)
    setValue("intervention_latitude", suggestion.lat)
    setValue("intervention_longitude", suggestion.lng)

    setAddressQuery(suggestion.label)
    clearSuggestions()
    setShowSuggestions(false)
  }, [setValue, clearSuggestions, setAddressQuery])

  // Watch les coordonnées GPS
  const watchedLat = watch("intervention_latitude")
  const watchedLng = watch("intervention_longitude")

  const {
    data: artisan,
    isLoading,
    error,
    refetch: refetchArtisan,
  } = useQuery({
    queryKey: ["artisan", artisanId],
    enabled: Boolean(artisanId),
    queryFn: () => artisansApi.getById(artisanId),
  })

  // Charger les interventions de l'artisan pour les graphiques et le tableau
  const {
    data: interventionsResponse,
  } = useQuery({
    queryKey: ["interventions", "artisan", artisanId],
    enabled: Boolean(artisanId),
    queryFn: async () => {
      const result = await interventionsApi.getByArtisan(artisanId, {
        limit: 5000,
      })
      return result
    },
  })

  const artisanInterventions = interventionsResponse?.data || []

  const [pendingReason, setPendingReason] = useState<{ type: StatusReasonType; values: ArtisanFormValues } | null>(null)
  const [pendingArchive, setPendingArchive] = useState<boolean>(false)
  const isStatusReasonModalOpen = pendingReason !== null || pendingArchive

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
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
    }
  }, [currentUserData])
  const { can } = usePermissions()
  const canWriteArtisans = can("write_artisans")

  // ─── Presence: who is currently viewing/editing this artisan? ─────────────
  const { viewers, activeEditor, fieldLockMap, trackField, clearField } = useArtisanPresence(artisanId)

  // Read-only mode: another user is the active editor
  const isReadOnly = Boolean(activeEditor && currentUserData && activeEditor.userId !== currentUserData.id)

  // Ref for auto-refetch on editor promotion
  const refetchRef = useRef<(() => void) | null>(null)
  refetchRef.current = refetchArtisan

  const prevReadOnlyRef = useRef(false)
  useEffect(() => {
    if (prevReadOnlyRef.current && !isReadOnly) {
      refetchRef.current?.()
    }
    prevReadOnlyRef.current = isReadOnly
  }, [isReadOnly])

  // Page presence — signal that this modal is showing an artisan
  const pagePresenceCtx = usePagePresenceContext()
  useEffect(() => {
    if (!pagePresenceCtx?.updateActiveArtisan) return
    pagePresenceCtx.updateActiveArtisan(artisanId)
    return () => {
      pagePresenceCtx.updateActiveArtisan(null)
    }
  }, [artisanId, pagePresenceCtx])

  useEffect(() => {
    setPendingReason(null)
    setPendingArchive(false)
  }, [artisanId])

  useEffect(() => {
    onStatusReasonModalOpenChange?.(isStatusReasonModalOpen)
  }, [isStatusReasonModalOpen, onStatusReasonModalOpenChange])

  // État pour suivre si les données ont été chargées et réinitialisées
  const [isFormInitialized, setIsFormInitialized] = useState(false)
  // Ref pour tracker l'ID de l'artisan qui a été initialisé (évite les re-renders inutiles)
  const initializedArtisanIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (artisan) {
      // Ne pas re-reset si c'est le même artisan et que le formulaire est déjà initialisé
      if (initializedArtisanIdRef.current === artisan.id) {
        return
      }

      const formValues = mapArtisanToForm(artisan)

      // Marquer immédiatement comme initialisé pour éviter les doubles resets
      initializedArtisanIdRef.current = artisan.id

      // Réinitialiser le formulaire avec les nouvelles valeurs et réinitialiser isDirty
      reset(formValues, { keepDefaultValues: false, keepDirtyValues: false })

      // Mettre à jour l'adresse query pour le géocodage
      const artisanAny = artisan as any
      const fullAddress = [
        artisanAny.adresse_siege_social,
        artisanAny.code_postal_siege_social,
        artisanAny.ville_siege_social
      ].filter(Boolean).join(", ")
      if (fullAddress) {
        setAddressQuery(fullAddress)
      }

      // Marquer le formulaire comme initialisé après un court délai pour laisser reset() se terminer
      setTimeout(() => {
        setIsFormInitialized(true)
      }, 150)
    } else {
      setIsFormInitialized(false)
      initializedArtisanIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan])

  // Réinitialiser le flag quand l'artisan change
  useEffect(() => {
    if (artisanId !== initializedArtisanIdRef.current) {
      setIsFormInitialized(false)
      initializedArtisanIdRef.current = null
    }
  }, [artisanId])

  const getArtisanStatusCode = useCallback(
    (statusId?: string | null) => {
      if (!statusId || !referenceData?.artisanStatuses) {
        return null
      }
      return referenceData.artisanStatuses.find((status) => status.id === statusId)?.code ?? null
    },
    [referenceData?.artisanStatuses],
  )

  const previousArtisanStatusCode = useMemo(
    () => getArtisanStatusCode(artisan?.statut_id ?? null),
    [artisan?.statut_id, getArtisanStatusCode],
  )

  const updateArtisan = useMutation({
    mutationFn: (payload: ReturnType<typeof buildUpdatePayload>) => artisansApi.update(artisanId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["artisan", artisanId] })
      void queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
    },
  })

  const submitArtisanUpdate = async (
    values: ArtisanFormValues,
    reasonPayload?: { type: StatusReasonType; comment: string },
  ) => {
    const payload = buildUpdatePayload(values)
    try {
      const updated = await updateArtisan.mutateAsync(payload)

      if (reasonPayload) {
        try {
          await commentsApi.create({
            entity_id: artisanId,
            entity_type: "artisan",
            content: reasonPayload.comment,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id ?? undefined,
            reason_type: reasonPayload.type,
          })
          await queryClient.invalidateQueries({ queryKey: ["comments", "artisan", artisanId] })
        } catch (commentError) {
          console.error("[ArtisanModalContent] Impossible d'ajouter le commentaire obligatoire", commentError)
          throw new Error("Le commentaire obligatoire n'a pas pu être enregistré. Merci de réessayer.")
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("artisan-updated", {
            detail: {
              id: artisanId,
              data: updated,
              optimistic: false,
              type: "update",
            },
          }),
        )
      }

      toast.success("Artisan mis à jour", {
        description: "Les informations de l'artisan ont été enregistrées.",
      })
      reset(values)

      // Fermer le modal après sauvegarde réussie
      shouldCloseAfterSave.current = false
      onClose()
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Une erreur est survenue."
      toast.error("Échec de l'enregistrement", {
        description: message,
      })
    }
  }

  const onSubmit = async (values: ArtisanFormValues) => {
    const nextStatusCode = getArtisanStatusCode(values.statut_id)
    const reasonType = getReasonTypeForTransition(previousArtisanStatusCode, nextStatusCode)

    if (reasonType) {
      setPendingReason({ type: reasonType, values })
      return
    }

    await submitArtisanUpdate(values)
  }

  const handleReasonCancel = () => {
    setPendingReason(null)
  }

  const handleReasonConfirm = async (comment: string) => {
    if (pendingArchive) {
      // Gérer l'archivage direct
      const archiveStatusId = referenceData?.artisanStatuses?.find((status) => status.code === "ARCHIVE")?.id
      if (!archiveStatusId) {
        toast.error("Erreur", {
          description: "Impossible de trouver le statut ARCHIVE",
        })
        setPendingArchive(false)
        return
      }

      const formValues = getValues()
      const valuesWithArchive: ArtisanFormValues = {
        ...formValues,
        statut_id: archiveStatusId,
      }

      setPendingArchive(false)
      await submitArtisanUpdate(valuesWithArchive, { type: "archive", comment })
      return
    }

    if (!pendingReason) {
      return
    }
    const { type, values } = pendingReason
    setPendingReason(null)
    await submitArtisanUpdate(values, { type, comment })
  }

  const handleArchiveClick = () => {
    if (!artisan) return
    const currentStatusCode = getArtisanStatusCode(artisan.statut_id ?? null)
    if (currentStatusCode === "ARCHIVE") {
      // Déjà archivé, ne rien faire
      return
    }
    setPendingArchive(true)
  }

  const handleArchiveCancel = () => {
    setPendingArchive(false)
  }

  const displayName = useMemo(() => {
    if (!artisan) return "Artisan"
    const fromName = [artisan.prenom, artisan.nom].filter(Boolean).join(" ").trim()
    return fromName || (artisan as any)?.plain_nom || artisan.raison_sociale || "Artisan"
  }, [artisan])

  // Construire les métadonnées de photo de profil à partir des attachments
  const photoProfilMetadata = useMemo(() => {
    if (!artisan?.artisan_attachments) return null
    const photoProfilAttachment = artisan.artisan_attachments.find(
      (att) => att.kind === 'photo_profil'
    )
    if (!photoProfilAttachment) return null

    return {
      hash: photoProfilAttachment.content_hash || null,
      sizes: photoProfilAttachment.derived_sizes || {},
      mime_preferred: photoProfilAttachment.mime_preferred || photoProfilAttachment.mime_type || 'image/jpeg',
      baseUrl: photoProfilAttachment.url || null
    }
  }, [artisan])

  // Calculer les initiales pour l'avatar
  const avatarInitials = useMemo(() => {
    if (!artisan) return "??"
    const prenom = artisan.prenom?.trim() || ""
    const nom = artisan.nom?.trim() || ""
    if (prenom && nom) {
      return `${prenom[0]}${nom[0]}`.toUpperCase()
    }
    if (prenom) {
      return prenom.substring(0, 2).toUpperCase()
    }
    if (nom) {
      return nom.substring(0, 2).toUpperCase()
    }
    if (artisan.raison_sociale) {
      return artisan.raison_sociale.substring(0, 2).toUpperCase()
    }
    return "??"
  }, [artisan])

  const companyName = artisan?.raison_sociale ?? null
  const dossierStatus = artisan?.statutDossier ?? null
  const dossierBadge = (() => {
    if (!dossierStatus) {
      return <Badge variant="outline">Non renseigné</Badge>
    }

    // Si le statut est "À compléter", utiliser un style rouge
    const statusLower = dossierStatus.toLowerCase()
    if (statusLower === "à compléter" || statusLower === "a compléter") {
      return (
        <Badge className={cn("border border-red-500/30 bg-red-500/15 text-red-700")}>
          {dossierStatus}
        </Badge>
      )
    }

    // Pour les autres statuts, utiliser les thèmes par défaut
    const slug = dossierStatus.toLowerCase().replace(/\s+/g, "_")
    const dossierStatusTheme: Record<string, string> = {
      complet: "bg-emerald-100 text-emerald-700 border-emerald-300",
      en_attente: "bg-amber-100 text-amber-700 border-amber-300",
      incomplet: "bg-red-100 text-red-700 border-red-300",
      a_verifier: "bg-blue-100 text-blue-700 border-blue-300",
      bloque: "bg-gray-200 text-gray-700 border-gray-300",
    }
    const theme = dossierStatusTheme[slug] ?? "bg-slate-100 text-slate-700 border-slate-200"
    return (
      <Badge className={cn("border", theme)}>
        {dossierStatus}
      </Badge>
    )
  })()

  const absences = useMemo(() => {
    const raw = artisan?.artisan_absences ?? []
    if (!Array.isArray(raw)) return []
    return raw
      .filter((absence) => absence?.start_date || absence?.end_date)
      .map((absence) => ({
        id: absence.id ?? `${absence.start_date ?? ""}-${absence.end_date ?? ""}`,
        startDate: absence.start_date ?? null,
        endDate: absence.end_date ?? null,
        reason: absence.reason ?? null,
        isConfirmed: absence.is_confirmed ?? null,
      }))
  }, [artisan])

  const attachmentCount = useMemo(() => {
    const raw = artisan?.artisan_attachments
    if (!Array.isArray(raw)) return 0
    return raw.filter((attachment) => Boolean(attachment?.url)).length
  }, [artisan?.artisan_attachments])

  const handleDocumentsChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["artisan", artisanId] })
  }, [artisanId, queryClient])

  // Gestion des absences
  const handleAddAbsence = useCallback(async () => {
    if (!newAbsence.start_date || !newAbsence.end_date) {
      toast.error("Veuillez renseigner les dates de début et de fin")
      return
    }

    try {
      await artisansApi.createAbsence(artisanId, {
        start_date: newAbsence.start_date,
        end_date: newAbsence.end_date,
        reason: newAbsence.reason || undefined,
        is_confirmed: false,
      })
      setNewAbsence({ start_date: "", end_date: "", reason: "" })
      queryClient.invalidateQueries({ queryKey: ["artisan", artisanId] })
      toast.success("Absence ajoutée")
    } catch (error) {
      toast.error("Erreur lors de l'ajout de l'absence")
    }
  }, [newAbsence, artisanId, queryClient])

  const handleDeleteAbsence = useCallback(async (id: string) => {
    try {
      await artisansApi.deleteAbsence(id)
      queryClient.invalidateQueries({ queryKey: ["artisan", artisanId] })
      toast.success("Absence supprimée")
    } catch (error) {
      toast.error("Erreur lors de la suppression de l'absence")
    }
  }, [artisanId, queryClient])

  const metierOptions = useMemo(() => {
    const base = (referenceData?.metiers ?? []).map((metier) => ({
      id: metier.id,
      label: metier.label ?? metier.code ?? metier.id,
      color: metier.color ?? null,
    }))

    const extraFromArtisan = (() => {
      if (Array.isArray(artisan?.artisan_metiers)) {
        return artisan.artisan_metiers
          .map((item) => {
            const id = item.metier_id || item.metiers?.id || item.metiers?.code || item.metiers?.label
            const label = item.metiers?.label || item.metiers?.code || item.metier_id
            const color = (item.metiers as { id: string; code: string | null; label: string | null; color?: string | null } | undefined)?.color ?? null
            if (!id) return null
            return { id, label: label ?? id, color }
          })
          .filter((value): value is { id: string; label: string; color: string | null } => Boolean(value))
      }
      if (Array.isArray(artisan?.metiers)) {
        return artisan.metiers
          .filter((value): value is string => Boolean(value))
          .map((value) => ({ id: value, label: value, color: null }))
      }
      return [] as Array<{ id: string; label: string; color: string | null }>
    })()

    const merged = [...base]
    extraFromArtisan.forEach((item) => {
      if (!merged.some((existing) => existing.id === item.id)) {
        merged.push(item)
      }
    })
    return merged
  }, [artisan, referenceData])

  const isSaving = updateArtisan.isPending

  // State pour la protection des modifications non sauvegardées
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)
  const shouldCloseAfterSave = useRef(false)

  // Détection des modifications non sauvegardées - utiliser isDirty comme dans NewArtisanModalContent
  // avec la condition isFormInitialized pour éviter les faux positifs au chargement
  const hasUnsavedChanges = isFormInitialized && isDirty && !isSaving && !isLoading && artisan !== undefined

  // Notifier le parent des changements d'état pour la gestion du clic sur backdrop
  useEffect(() => {
    onUnsavedChangesStateChange?.(hasUnsavedChanges, isSaving)
  }, [hasUnsavedChanges, isSaving, onUnsavedChangesStateChange])

  // Exposer la fonction pour afficher le dialog au parent
  useEffect(() => {
    const showDialog = () => {
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
    }
    onRegisterShowDialog?.(showDialog)
  }, [onClose, onRegisterShowDialog])

  // Notifier le parent de l'ouverture du dialog
  useEffect(() => {
    onUnsavedDialogOpenChange?.(showUnsavedDialog)
  }, [showUnsavedDialog, onUnsavedDialogOpenChange])

  // Fonction pour confirmer la fermeture après l'alerte
  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingCloseAction.current) {
      pendingCloseAction.current()
      pendingCloseAction.current = null
    }
  }, [])

  // Fonction pour annuler la fermeture
  const handleCancelClose = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingCloseAction.current = null
  }, [])

  // Fonction pour enregistrer et fermer
  const handleSaveAndClose = useCallback(() => {
    setShowUnsavedDialog(false)
    shouldCloseAfterSave.current = true
    // Soumettre le formulaire
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
    pendingCloseAction.current = null
  }, [])

  // Fonction pour gérer l'annulation avec vérification des modifications
  const handleCancel = useCallback(() => {
    // Si des modifications non sauvegardées existent et qu'on n'est pas en train de soumettre
    if (hasUnsavedChanges && !isSaving) {
      // Stocker l'action de fermeture pour l'exécuter après confirmation
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
      return
    }

    // Pas de modifications ou soumission en cours : fermer directement
    onClose()
  }, [hasUnsavedChanges, isSaving, onClose])

  // Intercepter la touche Échap pour appliquer la même logique que handleCancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showUnsavedDialog || isStatusReasonModalOpen || showHistoryPanel) {
          // Laisser UnsavedChangesDialog ou StatusReasonModal gérer Escape
          return
        }
        event.preventDefault()
        event.stopPropagation()
        handleCancel()
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [handleCancel, showUnsavedDialog, isStatusReasonModalOpen, showHistoryPanel])

  // Raccourci clavier Cmd/Ctrl+Enter pour enregistrer
  const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting: isSaving })

  // Rendu du contrôle métiers (style NewArtisanModalContent)
  const renderMetiersControl = () => (
    <Controller
      name="metiers"
      control={control}
      render={({ field }) => {
        const selected = field.value ?? []
        const toggleMetier = (id: string) => {
          const next = new Set(selected)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          field.onChange(Array.from(next))
        }

        const selectedLabels = metierOptions.filter((option) => selected.includes(option.id))

        return (
          <div className="space-y-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-between h-8 text-sm bg-background border-border/80 hover:bg-muted/50">
                  <span className="truncate text-foreground">
                    {selected.length > 0
                      ? `${selected.length} métier${selected.length > 1 ? "s" : ""}`
                      : "Sélectionner"}
                  </span>
                  <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-48 overflow-y-auto bg-popover border-border p-1">
                {metierOptions.length ? (
                  metierOptions.map((option) => {
                    const isSelected = selected.includes(option.id)
                    const bgColor = option.color || "#6b7280"
                    const textColor = getReadableTextColor(bgColor)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors mb-0.5",
                          isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-80"
                        )}
                        onClick={() => toggleMetier(option.id)}
                      >
                        <span
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold min-w-[80px]"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                          }}
                        >
                          {option.label}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="text-sm text-muted-foreground px-2 py-1.5">
                    Aucun métier
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedLabels.map((option) => {
                  const bgColor = option.color || "#6b7280"
                  const textColor = getReadableTextColor(bgColor)
                  return (
                    <Badge
                      key={option.id}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 h-auto border-0 font-semibold"
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                      }}
                    >
                      {option.label}
                      <button
                        type="button"
                        className="ml-1 focus:outline-none opacity-70 hover:opacity-100"
                        style={{ color: textColor }}
                        onClick={() => toggleMetier(option.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )
      }}
    />
  )

  return (
    <TooltipProvider>
      <div className={cn("modal-config-surface", surfaceVariantClass, surfaceModeClass)}>
        {/* Header */}
        <header className="modal-config-columns-header relative bg-[#8DA5CE] dark:bg-transparent">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={handleCancel}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
            </Tooltip>

            {onCycleMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button"
                    onClick={onCycleMode}
                    aria-label="Changer le mode d'affichage"
                  >
                    <ModeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Ajuster l&apos;affichage ({mode})
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="modal-config-columns-icon-placeholder" />
            )}

            {/* Bouton toggle Statistiques / Informations */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "modal-config-columns-icon-button",
                    showStats && "bg-primary/20 text-primary"
                  )}
                  onClick={() => setShowStats(!showStats)}
                  aria-label={showStats ? "Afficher les informations" : "Afficher les statistiques"}
                >
                  {showStats ? <Info className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">
                {showStats ? "Informations" : "Statistiques"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={() => setShowHistoryPanel(true)}
                  aria-label="Voir l'historique"
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Historique des actions</TooltipContent>
            </Tooltip>
            <PresenceAvatars viewers={viewers} />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
            <Avatar
              photoProfilMetadata={photoProfilMetadata}
              initials={avatarInitials}
              name={displayName}
              size={48}
              priority={true}
              className="pointer-events-auto"
            />
            <div className="flex flex-col items-center">
              <div className="modal-config-columns-title">
                {displayName}
                {activeIndex !== undefined && totalCount !== undefined && totalCount > 1 ? (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({(activeIndex ?? 0) + 1} / {totalCount})
                  </span>
                ) : null}
              </div>
              {companyName ? (
                <span className="text-xs text-muted-foreground">{companyName}</span>
              ) : null}
            </div>
          </div>
          {artisan && (
            <div className="flex items-center gap-2">
              {artisan.created_at && (
                <span className="text-xs text-muted-foreground mr-2">
                  Créé le {formatDate(artisan.created_at)}
                </span>
              )}
              {(() => {
                const status = referenceData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                if (!status) return null
                const pillStyles = status.color ? computeBadgeStyle(status.color) : undefined

                return (
                  <Badge
                    className="text-xs font-semibold px-2.5 py-0.5 whitespace-nowrap"
                    style={pillStyles}
                  >
                    {status.label}
                  </Badge>
                )
              })()}
            </div>
          )}
        </header>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <fieldset
            disabled={!canWriteArtisans || isReadOnly}
            className={cn("flex flex-col flex-1 min-h-0", (!canWriteArtisans || isReadOnly) && "opacity-70")}
          >
            {isReadOnly && activeEditor && (
              <ReadOnlyBanner editor={activeEditor} entityLabel="cet artisan" />
            )}
            <div className="modal-config-columns-body flex-1 min-h-0 h-full overflow-hidden bg-[#C6CEDC] dark:bg-transparent">
              {!canWriteArtisans ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Cet artisan est en lecture seule. Permission requise : write_artisans.
                  </div>
                </div>
              ) : (isLoading || !isFormInitialized) ? (
                <div className="grid gap-4 md:grid-cols-2 px-4 py-3 md:px-6">
                  <div className="h-64 rounded-lg bg-muted animate-pulse" />
                  <div className="h-64 rounded-lg bg-muted animate-pulse" />
                </div>
              ) : error ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {(error as Error).message}
                  </div>
                </div>
              ) : !artisan ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
                    Artisan introuvable ou inaccessible.
                  </div>
                </div>
              ) : showStats ? (
                /* ========== VUE STATISTIQUES ========== */
                <div
                  className="h-full px-4 py-3 md:px-6"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gridTemplateRows: 'repeat(7, 1fr)',
                    gap: '12px',
                  }}
                >
                  {/* DIV1: Finances (col 1-3, row 1-7) */}
                  <div
                    className="overflow-hidden"
                    style={{
                      gridColumn: 'span 3 / span 3',
                      gridRow: 'span 7 / span 7',
                    }}
                  >
                    <ArtisanFinancesSection interventions={artisanInterventions} artisanId={artisanId} />
                  </div>

                  {/* DIV2: Interventions (col 4-8, row 1-7) */}
                  <div
                    className="overflow-hidden"
                    style={{
                      gridColumn: 'span 5 / span 5',
                      gridColumnStart: 4,
                      gridRow: 'span 7 / span 7',
                    }}
                  >
                    <ArtisanInterventionsTable artisanId={artisanId} enableInternalScroll />
                  </div>
                </div>
              ) : (
                /* ========== VUE INFORMATIONS (par défaut) ========== */
                <div className="flex gap-4 h-full px-4 py-3 md:px-6">
                  {/* ===== COLONNE GAUCHE - Scroll indépendant ===== */}
                  <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal">
                    <div className="space-y-4 pb-4">
                      {/* Informations de l'artisan */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4" />
                              Informations de l&apos;artisan
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase text-muted-foreground">Dossier</span>
                              {dossierBadge}
                              {isDirty && (
                                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 text-[10px]">
                                  Non enregistré
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="prenom" className={labelClass}>Prénom</Label>
                              <Input id="prenom" placeholder="Prénom" className={inputClass} {...register("prenom")} />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="nom" className={labelClass}>Nom</Label>
                              <Input id="nom" placeholder="Nom" className={inputClass} {...register("nom")} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="raison_sociale" className={labelClass}>Raison sociale</Label>
                            <Input id="raison_sociale" placeholder="Nom de l'entreprise" className={inputClass} {...register("raison_sociale")} />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="telephone" className={labelClass}>Téléphone</Label>
                              <Input id="telephone" placeholder="06 00 00 00 00" className={inputClass} {...register("telephone")} />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="telephone2" className={labelClass}>Tél. secondaire</Label>
                              <Input id="telephone2" placeholder="Optionnel" className={inputClass} {...register("telephone2")} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="email" className={labelClass}>Email</Label>
                            <Input id="email" type="email" placeholder="contact@email.com" className={inputClass} {...register("email")} />
                          </div>

                          <div className="space-y-1">
                            <Label className={labelClass}>Métiers</Label>
                            {renderMetiersControl()}
                          </div>

                          {/* Adresse du siège social avec géocodage */}
                          <div className="space-y-1">
                            <Label className={labelClass}>Adresse du siège social</Label>
                            <div className="relative">
                              <Input
                                placeholder="Rechercher une adresse..."
                                value={addressQuery}
                                className={inputClass}
                                onChange={(e) => {
                                  setAddressQuery(e.target.value)
                                  setValue("adresse_siege_social", e.target.value)
                                  setValue("intervention_latitude", null)
                                  setValue("intervention_longitude", null)
                                  setShowSuggestions(true)
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => {
                                  suggestionBlurTimeoutRef.current = window.setTimeout(() => {
                                    setShowSuggestions(false)
                                  }, 150)
                                }}
                              />
                              {isSuggesting && (
                                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              )}
                              {showSuggestions && addressSuggestions.length > 0 && (
                                <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-popover shadow-xl">
                                  <ul className="divide-y divide-border/50 text-xs">
                                    {addressSuggestions.map((suggestion) => (
                                      <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                                        <button
                                          type="button"
                                          className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors text-foreground"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => handleSuggestionSelect(suggestion)}
                                        >
                                          <span className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span className="truncate">{suggestion.label}</span>
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                              <Input
                                id="code_postal_siege_social"
                                placeholder="Code postal"
                                className={inputClass}
                                {...register("code_postal_siege_social")}
                              />
                              <Input
                                id="ville_siege_social"
                                placeholder="Ville"
                                className={inputClass}
                                {...register("ville_siege_social")}
                              />
                            </div>
                            {watchedLat && watchedLng && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 mt-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">GPS:</span>
                                <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                                  {watchedLat.toFixed(5)}, {watchedLng.toFixed(5)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Attribution */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <UserCheck className="h-4 w-4" />
                            Attribution
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                          <div className="grid grid-cols-2 gap-2 items-end">
                            {/* Sélecteur de gestionnaire avec badge */}
                            <div className="space-y-1">
                              <Label className={labelClass}>Attribué à</Label>
                              <Controller
                                name="gestionnaire_id"
                                control={control}
                                render={({ field }) => {
                                  const assignedUser = referenceData?.users?.find(u => u.id === field.value)
                                  return (
                                    <div className="flex items-center gap-2">
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="flex items-center justify-center h-7 w-7 cursor-pointer group rounded-full"
                                          >
                                            <GestionnaireBadge
                                              firstname={assignedUser?.firstname}
                                              lastname={assignedUser?.lastname}
                                              color={assignedUser?.color}
                                              avatarUrl={assignedUser?.avatar_url}
                                              size="sm"
                                              className="transition-transform group-hover:scale-110 h-7 w-7"
                                            />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="start">
                                          <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Attribuer à</p>
                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                              {/* Option non assigné */}
                                              <button
                                                type="button"
                                                className={cn(
                                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                                                  !field.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                                )}
                                                onClick={() => field.onChange("")}
                                              >
                                                <GestionnaireBadge
                                                  firstname="?"
                                                  lastname=""
                                                  color="#9ca3af"
                                                  size="sm"
                                                  showBorder={false}
                                                />
                                                <span className="text-xs truncate flex-1">Non assigné</span>
                                              </button>
                                              {referenceData?.users?.map((user) => {
                                                const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
                                                const isSelected = user.id === field.value
                                                return (
                                                  <button
                                                    key={user.id}
                                                    type="button"
                                                    className={cn(
                                                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                                                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                                    )}
                                                    onClick={() => field.onChange(user.id)}
                                                  >
                                                    <GestionnaireBadge
                                                      firstname={user.firstname}
                                                      lastname={user.lastname}
                                                      color={user.color}
                                                      avatarUrl={user.avatar_url}
                                                      size="sm"
                                                      showBorder={false}
                                                    />
                                                    <span className="text-xs truncate flex-1">{displayName}</span>
                                                  </button>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      {/* Afficher le nom de l'utilisateur assigné */}
                                      {assignedUser && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs px-2 py-0.5 h-auto flex items-center gap-1"
                                          style={{
                                            backgroundColor: assignedUser.color ? `${assignedUser.color}20` : undefined,
                                            borderColor: assignedUser.color || undefined,
                                            color: assignedUser.color || undefined,
                                          }}
                                        >
                                          {[assignedUser.firstname, assignedUser.lastname].filter(Boolean).join(" ").trim() || assignedUser.username}
                                          <button
                                            type="button"
                                            className="ml-0.5 hover:text-destructive focus:outline-none"
                                            onClick={() => field.onChange("")}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      )}
                                    </div>
                                  )
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className={labelClass}>Statut</Label>
                              {(() => {
                                const currentStatusId = watch("statut_id")
                                const currentStatus = referenceData?.artisanStatuses?.find(
                                  (s) => s.id === currentStatusId
                                )
                                return (
                                  <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 h-8 text-sm">
                                    {currentStatus ? (
                                      <>
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: currentStatus.color ?? '#6B7280' }}
                                        />
                                        <span className="truncate">{currentStatus.label}</span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">Non défini</span>
                                    )}
                                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                      (Auto)
                                    </span>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* ===== COLONNE DROITE - Scroll indépendant ===== */}
                  <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal">
                    <div className="space-y-4 pb-4">
                      {/* Paramètres de l'entreprise */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4" />
                            Paramètres de l&apos;entreprise
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className={labelClass}>Statut juridique</Label>
                              <Controller
                                name="statut_juridique"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                      // Ne déclencher onChange que si la valeur a vraiment changé
                                      if (value !== field.value) {
                                        field.onChange(value)
                                      }
                                    }}
                                  >
                                    <SelectTrigger className={inputClass}>
                                      <SelectValue placeholder="Sélectionner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUT_JURIDIQUE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="numero_associe" className={labelClass}>N° associé</Label>
                              <Input
                                id="numero_associe"
                                placeholder="Code interne"
                                className={`${inputClass} bg-muted/50 font-medium`}
                                {...register("numero_associe")}
                              />
                            </div>
                          </div>

                          <div className="space-y-1 overflow-hidden">
                            <Label htmlFor="siret" className={labelClass}>SIRET</Label>
                            <Controller
                              name="siret"
                              control={control}
                              rules={{
                                validate: (value) => {
                                  const siret = value?.trim() || ""
                                  if (siret.length === 0) return true
                                  if (siret.length === 14 && /^\d+$/.test(siret)) return true
                                  return "14 chiffres requis"
                                },
                              }}
                              render={({ field, fieldState }) => {
                                const siretValue = field.value?.replace(/\s/g, "") || ""
                                const siretValidation = validateSiret(siretValue)
                                const isSiretValid = siretValidation.isValid && siretValue.length === 14

                                return (
                                  <div className="space-y-1 w-full overflow-hidden">
                                    <div className="flex items-center gap-1 w-full overflow-hidden">
                                      <div className="flex-1 min-w-0 overflow-hidden">
                                        <InputOTP
                                          maxLength={14}
                                          pattern={REGEXP_ONLY_DIGITS}
                                          value={field.value}
                                          onChange={(value) => field.onChange(value.replace(/\s/g, ""))}
                                          onPaste={(e) => {
                                            e.preventDefault()
                                            const pastedText = e.clipboardData.getData('text/plain')
                                            const cleaned = pastedText.replace(/\s/g, "").slice(0, 14)
                                            field.onChange(cleaned)
                                          }}
                                          containerClassName="flex flex-nowrap items-center w-full"
                                          className="gap-0 w-full"
                                          pushPasswordManagerStrategy="none"
                                        >
                                          <InputOTPGroup className="gap-0 flex-1 min-w-0">
                                            <InputOTPSlot index={0} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={1} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={2} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                          </InputOTPGroup>
                                          <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                                          <InputOTPGroup className="gap-0 flex-1 min-w-0">
                                            <InputOTPSlot index={3} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={4} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={5} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                          </InputOTPGroup>
                                          <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                                          <InputOTPGroup className="gap-0 flex-1 min-w-0">
                                            <InputOTPSlot index={6} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={7} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={8} className="!w-[calc(100%/3)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                          </InputOTPGroup>
                                          <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                                          <InputOTPGroup className="gap-0 flex-[1.67] min-w-0">
                                            <InputOTPSlot index={9} className="!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={10} className="!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={11} className="!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={12} className="!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                            <InputOTPSlot index={13} className="!w-[calc(100%/5)] !max-w-[22px] h-6 text-[10px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0" />
                                          </InputOTPGroup>
                                        </InputOTP>
                                      </div>
                                      {siretValue.length > 0 && (
                                        isSiretValid ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        ) : siretValue.length === 14 ? (
                                          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                        ) : null
                                      )}
                                    </div>
                                    {fieldState.error && (
                                      <p className="text-xs text-destructive">{fieldState.error.message}</p>
                                    )}
                                  </div>
                                )
                              }}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className={labelClass}>Zone d&apos;intervention</Label>
                            <Controller
                              name="zone_intervention"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value || ""}
                                  onValueChange={(value) => {
                                    // Ne déclencher onChange que si la valeur a vraiment changé
                                    if (value !== field.value) {
                                      field.onChange(value)
                                    }
                                  }}
                                >
                                  <SelectTrigger className={inputClass}>
                                    <SelectValue placeholder="Sélectionner..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ZONE_INTERVENTION_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                        </CardContent>
                      </Card>

                      {/* IBAN */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <Landmark className="h-4 w-4" />
                            IBAN
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0 overflow-hidden">
                          <Controller
                            name="iban"
                            control={control}
                            rules={{
                              validate: (value) => {
                                const raw = value?.trim() || ""
                                if (raw.length === 0) return true
                                const iban = raw.replace(/\s/g, "").toUpperCase()
                                if (iban.length !== IBAN_LENGTH) return "27 caractères requis"
                                if (!/^[A-Z0-9]+$/.test(iban)) return "Caractères invalides"
                                return true
                              },
                            }}
                            render={({ field, fieldState }) => {
                              const ibanValue = field.value?.replace(/\s/g, "").toUpperCase() || ""
                              const isIbanComplete = ibanValue.length === IBAN_LENGTH
                              const isIbanValid = isIbanComplete && /^[A-Z0-9]+$/.test(ibanValue)

                              return (
                                <div className="space-y-1 w-full overflow-hidden">
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <InputOTP
                                        maxLength={IBAN_LENGTH}
                                        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                                        inputMode="text"
                                        value={field.value}
                                        onChange={(value) => field.onChange(value.replace(/\s/g, "").toUpperCase())}
                                        onPaste={(e) => {
                                          e.preventDefault()
                                          const pastedText = e.clipboardData.getData('text/plain')
                                          const cleaned = pastedText.replace(/\s/g, "").toUpperCase().slice(0, IBAN_LENGTH)
                                          field.onChange(cleaned)
                                        }}
                                        containerClassName="flex flex-nowrap items-center w-full"
                                        className="gap-0 w-full"
                                        pushPasswordManagerStrategy="none"
                                      >
                                        {IBAN_GROUPS.map((size, groupIndex) => {
                                          const startIndex = IBAN_GROUPS.slice(0, groupIndex).reduce(
                                            (sum, groupSize) => sum + groupSize,
                                            0
                                          )
                                          return (
                                            <React.Fragment key={`iban-group-${groupIndex}`}>
                                              <InputOTPGroup className="gap-0 flex-1 min-w-0">
                                                {Array.from({ length: size }).map((_, slotIndex) => (
                                                  <InputOTPSlot
                                                    key={`iban-slot-${startIndex + slotIndex}`}
                                                    index={startIndex + slotIndex}
                                                    className="!w-[calc(100%/4)] !max-w-[18px] h-6 text-[9px] bg-background border border-[#C6CEDC] text-foreground font-mono p-0"
                                                  />
                                                ))}
                                              </InputOTPGroup>
                                              {groupIndex < IBAN_GROUPS.length - 1 && (
                                                <span className="text-muted-foreground text-[8px] shrink-0 px-px">·</span>
                                              )}
                                            </React.Fragment>
                                          )
                                        })}
                                      </InputOTP>
                                    </div>
                                    {ibanValue.length > 0 && (
                                      isIbanValid ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                      ) : isIbanComplete ? (
                                        <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                      ) : null
                                    )}
                                  </div>
                                  {fieldState.error && (
                                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                                  )}
                                </div>
                              )
                            }}
                          />
                        </CardContent>
                      </Card>

                      {/* Gestion des absences (collapsible) */}
                      <Collapsible open={isAbsencesOpen} onOpenChange={setIsAbsencesOpen}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4" />
                                Gestion des absences
                                {isAbsencesOpen ? (
                                  <ChevronDown className="ml-auto h-4 w-4" />
                                ) : (
                                  <ChevronRight className="ml-auto h-4 w-4" />
                                )}
                                {absences.length > 0 && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {absences.length}
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0 space-y-3">
                              {/* Formulaire d'ajout d'absence */}
                              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className={labelClass}>Date de début</Label>
                                    <Input
                                      type="date"
                                      className={inputClass}
                                      value={newAbsence.start_date}
                                      onChange={(e) => setNewAbsence(prev => ({ ...prev, start_date: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className={labelClass}>Date de fin</Label>
                                    <Input
                                      type="date"
                                      className={inputClass}
                                      value={newAbsence.end_date}
                                      onChange={(e) => setNewAbsence(prev => ({ ...prev, end_date: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className={labelClass}>Motif (optionnel)</Label>
                                  <Input
                                    placeholder="Ex: Congés, Maladie..."
                                    className={inputClass}
                                    value={newAbsence.reason}
                                    onChange={(e) => setNewAbsence(prev => ({ ...prev, reason: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={handleAddAbsence}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Ajouter une absence
                                </Button>
                              </div>

                              {/* Liste des absences */}
                              {absences.length > 0 && (
                                <div className="space-y-1.5">
                                  {absences.map((absence) => (
                                    <div
                                      key={absence.id}
                                      className="flex items-center justify-between p-2 rounded border bg-background border-border text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span>
                                          Du {formatDate(absence.startDate)} au {formatDate(absence.endDate)}
                                        </span>
                                        {absence.reason && (
                                          <Badge variant="outline" className="text-[10px]">
                                            {absence.reason}
                                          </Badge>
                                        )}
                                        {absence.isConfirmed ? (
                                          <Badge variant="secondary" className="text-[10px]">
                                            Confirmée
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px]">
                                            Proposée
                                          </Badge>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteAbsence(absence.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {absences.length === 0 && (
                                <p className="text-xs italic text-muted-foreground text-center py-2">
                                  Aucune absence enregistrée
                                </p>
                              )}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      {/* Documents de l'entreprise (collapsible) */}
                      <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                <Upload className="h-4 w-4" />
                                Documents de l&apos;entreprise
                                {isDocumentsOpen ? (
                                  <ChevronDown className="ml-auto h-4 w-4" />
                                ) : (
                                  <ChevronRight className="ml-auto h-4 w-4" />
                                )}
                                {attachmentCount > 0 && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {attachmentCount}
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0">
                              <DocumentManager
                                entityType="artisan"
                                entityId={artisan?.id ?? artisanId}
                                kinds={ARTISAN_DOCUMENT_KINDS}
                                currentUser={currentUser ?? undefined}
                                onChange={handleDocumentsChange}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      {/* Commentaires (collapsible) */}
                      <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                <MessageSquare className="h-4 w-4" />
                                Commentaires
                                {isCommentsOpen ? (
                                  <ChevronDown className="ml-auto h-4 w-4" />
                                ) : (
                                  <ChevronRight className="ml-auto h-4 w-4" />
                                )}
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0">
                              <CommentSection
                                entityType="artisan"
                                entityId={artisanId}
                                currentUserId={currentUser?.id ?? undefined}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          {/* Footer */}
          <footer className="modal-config-columns-footer flex items-center justify-between gap-2 px-4 py-3 md:px-6 bg-[#8DA5CE] dark:bg-transparent">
            <div>
              {artisan && canWriteArtisans && !isReadOnly && (
                getArtisanStatusCode(artisan.statut_id ?? null) === "ARCHIVE" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
                    disabled
                  >
                    Archivé
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
                    onClick={handleArchiveClick}
                    disabled={isSaving || isLoading}
                  >
                    Archiver
                  </Button>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                {isReadOnly ? "Fermer" : "Annuler"}
              </Button>
              {!isReadOnly && (
                <Button type="submit" size="sm" disabled={isSaving || isLoading || !canWriteArtisans}>
                  {isSaving ? "Enregistrement..." : (
                    <>
                      Enregistrer
                      <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
                        {shortcutHint}
                      </kbd>
                    </>
                  )}
                </Button>
              )}
            </div>
          </footer>
        </form>
        <StatusReasonModal
          open={isStatusReasonModalOpen}
          type={pendingArchive ? "archive" : (pendingReason?.type ?? "archive")}
          onCancel={pendingArchive ? handleArchiveCancel : handleReasonCancel}
          onConfirm={(reason) => {
            void handleReasonConfirm(reason)
          }}
          isSubmitting={isSaving}
        />
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onCancel={handleCancelClose}
          onConfirm={handleConfirmClose}
          onSaveAndConfirm={handleSaveAndClose}
        />
        <ArtisanHistoryPanel
          artisanId={artisanId}
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
        />
      </div >
    </TooltipProvider >
  )
}

export default ArtisanModalContent
