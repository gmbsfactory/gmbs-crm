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
  Info,
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
import { DocumentManager } from "@/components/documents/DocumentManager"
import { ModeIcons } from "@/components/ui/mode-selector"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { Avatar } from "@/components/artisans/Avatar"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ArtisanFinancesSection } from "./ArtisanFinancesSection"
import { ArtisanInterventionsTable } from "./ArtisanInterventionsTable"
import { useReferenceData } from "@/hooks/useReferenceData"
import { interventionsApi } from "@/lib/api/v2"
import { toast } from "sonner"
import { artisansApi } from "@/lib/api/v2"
import type { Artisan } from "@/lib/api/v2/common/types"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import { supabase } from "@/lib/supabase-client"
import { getReasonTypeForTransition, type StatusReasonType } from "@/lib/comments/statusReason"
import { cn } from "@/lib/utils"
import type { ModalDisplayMode } from "@/types/modal-display"
import { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { validateSiret } from "@/lib/siret-validation"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"

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
  const zoneValue = (() => {
    // Format 1: artisan_zones avec relations
    if (Array.isArray(artisanAny.artisan_zones) && artisanAny.artisan_zones.length > 0) {
      const first = artisanAny.artisan_zones[0]
      if (first.zone_id) return String(first.zone_id)
      if (first.zones?.code) return String(first.zones.code)
      if (first.zones?.label) return String(first.zones.label)
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
    iban: artisanAny.iban ?? "",
    metiers: metierIds,
    zone_intervention: zoneValue,
    gestionnaire_id: artisanAny.gestionnaire_id ?? "",
    statut_id: artisanAny.statut_id ?? "",
    numero_associe: artisanAny.numero_associe ?? "",
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
}: Props) {
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const { data: referenceData } = useReferenceData()
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)

  // États pour les sections collapsibles
  const [isAbsencesOpen, setIsAbsencesOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Toggle entre vue Informations et vue Statistiques
  // Initialiser avec la vue par défaut si spécifiée
  const [showStats, setShowStats] = useState(defaultView === "statistics")

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
    formState: { isDirty, errors },
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
    },
  })

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

  const [currentUser, setCurrentUser] = useState<{
    id: string
    displayName: string
    code: string | null
    color: string | null
  } | null>(null)
  const [pendingReason, setPendingReason] = useState<{ type: StatusReasonType; values: ArtisanFormValues } | null>(null)
  const [pendingArchive, setPendingArchive] = useState<boolean>(false)
  const isStatusReasonModalOpen = pendingReason !== null || pendingArchive

  useEffect(() => {
    setPendingReason(null)
    setPendingArchive(false)
  }, [artisanId])

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
          throw new Error("Unable to load current user")
        }
        const payload = await response.json()
        if (!isMounted) return
        const user = payload?.user
        if (!user) return

        const first = user.firstname ?? user.prenom ?? ""
        const last = user.lastname ?? user.nom ?? ""
        const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
        const displayName = displayNameCandidate || user.username || user.email || "Vous"

        setCurrentUser({
          id: user.id,
          displayName,
          code: user.code_gestionnaire ?? null,
          color: user.color ?? null,
        })
      } catch (loadError) {
        console.warn("[ArtisanModalContent] Impossible de charger l'utilisateur courant", loadError)
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (artisan) {
      console.log("[ArtisanModalContent] Artisan data received:", artisan)
      const formValues = mapArtisanToForm(artisan)
      console.log("[ArtisanModalContent] Mapped form values:", formValues)
      reset(formValues)
    }
  }, [artisan, reset])

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
      void queryClient.invalidateQueries({ queryKey: ["artisans"] })
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
    const slug = dossierStatus.toLowerCase().replace(/\s+/g, "_")
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
                  onClick={onClose}
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
          <div className="flex items-center gap-2">
            {artisan ? (
              getArtisanStatusCode(artisan.statut_id ?? null) === "ARCHIVE" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
                  disabled
                >
                  Archivé
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
                  onClick={handleArchiveClick}
                  disabled={isSaving || isLoading}
                >
                  Archiver
                </Button>
              )
            ) : null}
          </div>
        </header>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <div className="modal-config-columns-body flex-1 min-h-0 bg-[#C6CEDC] dark:bg-transparent">
            {isLoading ? (
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

                        {/* Adresse du siège social */}
                        <div className="space-y-1">
                          <Label className={labelClass}>Adresse du siège social</Label>
                          <Input
                            id="adresse_siege_social"
                            placeholder="Adresse"
                            className={inputClass}
                            {...register("adresse_siege_social")}
                          />
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
                                          className="flex items-center justify-center h-8 w-8 cursor-pointer group rounded-full"
                                        >
                                          <GestionnaireBadge
                                            firstname={assignedUser?.firstname}
                                            lastname={assignedUser?.lastname}
                                            color={assignedUser?.color}
                                            size="sm"
                                            className="transition-transform group-hover:scale-110 h-8 w-8"
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
                                <Select value={field.value || ""} onValueChange={field.onChange}>
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
                                        onChange={(value) => field.onChange(value)}
                                        containerClassName="flex flex-nowrap items-center w-full"
                                        className="gap-0 w-full"
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

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className={labelClass}>Métiers</Label>
                            {renderMetiersControl()}
                          </div>
                          <div className="space-y-1">
                            <Label className={labelClass}>Zone d&apos;intervention</Label>
                            <Controller
                              name="zone_intervention"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value || ""} onValueChange={field.onChange}>
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
                                      onChange={(value) => field.onChange(value.toUpperCase())}
                                      containerClassName="flex flex-nowrap items-center w-full"
                                      className="gap-0 w-full"
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

          {/* Footer */}
          <footer className="modal-config-columns-footer flex items-center justify-end gap-2 px-4 py-3 md:px-6 bg-[#8DA5CE] dark:bg-transparent">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSaving || isLoading}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
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
      </div>
    </TooltipProvider>
  )
}

export default ArtisanModalContent
