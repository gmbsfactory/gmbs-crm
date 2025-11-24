"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import {
  Calendar,
  ChevronRight,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { REGEXP_ONLY_DIGITS } from "input-otp"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"

type ArtisanWithRelations = Artisan & {
  artisan_metiers?: Array<{
    metier_id: string
    is_primary?: boolean | null
    metiers?: { id: string; code: string | null; label: string | null } | null
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
}: Props) {
  const bodyPadding = mode === "fullpage" ? "px-8 py-6 md:px-12" : "px-5 py-4 md:px-8"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const { data: referenceData } = useReferenceData()
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
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

  // Écouter les mises à jour d'interventions pour rafraîchir les données de l'artisan
  // car le statut de l'artisan peut changer quand une intervention est terminée
  // Note: Les mises à jour d'interventions sont maintenant gérées automatiquement par TanStack Query
  // via useInterventionsMutations qui invalide les queries appropriées
  // Si cette page utilise TanStack Query pour les interventions de l'artisan, elle sera automatiquement mise à jour

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

  const metierOptions = useMemo(() => {
    const base = (referenceData?.metiers ?? []).map((metier) => ({
      id: metier.id,
      label: metier.label ?? metier.code ?? metier.id,
    }))

    const extraFromArtisan = (() => {
      if (Array.isArray(artisan?.artisan_metiers)) {
        return artisan.artisan_metiers
          .map((item) => {
            const id = item.metier_id || item.metiers?.id || item.metiers?.code || item.metiers?.label
            const label = item.metiers?.label || item.metiers?.code || item.metier_id
            if (!id) return null
            return { id, label: label ?? id }
          })
          .filter((value): value is { id: string; label: string } => Boolean(value))
      }
      if (Array.isArray(artisan?.metiers)) {
        return artisan.metiers
          .filter((value): value is string => Boolean(value))
          .map((value) => ({ id: value, label: value }))
      }
      return [] as Array<{ id: string; label: string }>
    })()

    const merged = [...base]
    extraFromArtisan.forEach((item) => {
      if (!merged.some((existing) => existing.id === item.id)) {
        merged.push(item)
      }
    })
    return merged
  }, [artisan, referenceData])

  // Filtrer les statuts disponibles selon les règles métier
  // Seuls les statuts CANDIDAT peuvent être changés vers POTENTIEL ou ONE_SHOT
  const statusOptions = useMemo(() => {
    const allStatuses = referenceData?.artisanStatuses ?? []
    const currentStatusCode = getArtisanStatusCode(artisan?.statut_id ?? null)

    // Si l'artisan est CANDIDAT, permettre uniquement POTENTIEL et ONE_SHOT
    if (currentStatusCode === 'CANDIDAT') {
      return allStatuses
        .filter((status) => {
          const code = status.code?.toUpperCase()
          return code === 'POTENTIEL' || code === 'ONE_SHOT' || code === 'CANDIDAT'
        })
        .map((status) => ({
          id: status.id,
          label: status.label ?? status.code ?? status.id,
        }))
    }

    // Pour tous les autres statuts, ne pas permettre de changement via le dropdown
    // Le statut sera géré automatiquement par les règles métier
    return []
  }, [referenceData, artisan?.statut_id, getArtisanStatusCode])

  const gestionnaireOptions = useMemo(
    () =>
      (referenceData?.users ?? []).map((user) => {
        const name = [user.firstname, user.lastname].filter(Boolean).join(" ").trim()
        return {
          id: user.id,
          label: name || user.username || user.id,
        }
      }),
    [referenceData],
  )

  const isSaving = updateArtisan.isPending
  const isWideMode = mode === "fullpage" || mode === "centerpage"

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-5">
          <div className="h-7 w-60 rounded bg-muted animate-pulse" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )
    }

    if (!artisan) {
      return (
        <div className="rounded border border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
          Artisan introuvable ou inaccessible.
        </div>
      )
    }

    const statusesContentClass = isWideMode ? "grid gap-4 md:grid-cols-2" : "space-y-4"

    return (
      <div className="space-y-6">
        <div className={isWideMode ? "grid gap-6 md:grid-cols-2" : "space-y-6"}>
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Informations de l&apos;artisan</CardTitle>
                {companyName ? (
                  <p className="text-sm text-muted-foreground">{companyName}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground">Statut du dossier</span>
                {dossierBadge}
                {isDirty ? (
                  <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                    Modifications non enregistrées
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="raison_sociale">Raison Sociale</Label>
                  <Input id="raison_sociale" placeholder="Raison sociale" {...register("raison_sociale")} />
                </div>
                <div className="space-y-2">
                  <Label>Prénom Nom Artisan</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input id="prenom" placeholder="Prénom" {...register("prenom")} />
                    <Input id="nom" placeholder="Nom" {...register("nom")} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" placeholder="06 12 34 56 78" {...register("telephone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone2">Téléphone 2</Label>
                  <Input id="telephone2" placeholder="Optionnel" {...register("telephone2")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="artisan@example.com" {...register("email")} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="statut_juridique">Statut Juridique</Label>
                  <Input id="statut_juridique" placeholder="Ex. SAS, SARL..." {...register("statut_juridique")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_associe">Numéro associé</Label>
                  <Input id="numero_associe" placeholder="Code interne" {...register("numero_associe")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret">Siret</Label>
                <Controller
                  name="siret"
                  control={control}
                  rules={{
                    validate: (value) => {
                      const siret = value?.trim() || ""
                      if (siret.length === 0) return true // Vide est valide
                      if (siret.length === 14 && /^\d+$/.test(siret)) return true // 14 chiffres est valide
                      return "Le SIRET doit être soit vide, soit contenir exactement 14 chiffres"
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <div className="space-y-1">
                      <InputOTP
                        maxLength={14}
                        pattern={REGEXP_ONLY_DIGITS}
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={6} />
                          <InputOTPSlot index={7} />
                          <InputOTPSlot index={8} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={9} />
                          <InputOTPSlot index={10} />
                          <InputOTPSlot index={11} />
                          <InputOTPSlot index={12} />
                          <InputOTPSlot index={13} />
                        </InputOTPGroup>
                      </InputOTP>
                      {fieldState.error && (
                        <p className="text-sm text-destructive">{fieldState.error.message}</p>
                      )}
                    </div>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paramètres de l&apos;entreprise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Métiers</Label>
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
                      <div className="space-y-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between">
                              <span>
                                {selected.length > 0
                                  ? `${selected.length} métier${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
                                  : "Sélectionner des métiers"}
                              </span>
                              <ChevronRight className="ml-2 h-4 w-4 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-64 max-h-64 overflow-y-auto">
                            {metierOptions.length ? (
                              metierOptions.map((option) => (
                                <DropdownMenuCheckboxItem
                                  key={option.id}
                                  checked={selected.includes(option.id)}
                                  onCheckedChange={() => toggleMetier(option.id)}
                                >
                                  {option.label}
                                </DropdownMenuCheckboxItem>
                              ))
                            ) : (
                              <DropdownMenuCheckboxItem disabled checked={false}>
                                Aucun métier disponible
                              </DropdownMenuCheckboxItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {selectedLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedLabels.map((option) => (
                              <Badge
                                key={option.id}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {option.label}
                                <button
                                  type="button"
                                  className="focus:outline-none"
                                  onClick={() => toggleMetier(option.id)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zone_intervention">Zone d&apos;intervention (km)</Label>
                <Input
                  id="zone_intervention"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Rayon"
                  {...register("zone_intervention")}
                />
              </div>

              <div className="space-y-2">
                <Label>Adresse d&apos;intervention</Label>
                <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                  <Input id="adresse_intervention" placeholder="Adresse" {...register("adresse_intervention")} />
                  <Input id="code_postal_intervention" placeholder="Code postal" {...register("code_postal_intervention")} />
                  <Input id="ville_intervention" placeholder="Ville" {...register("ville_intervention")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adresse du siège social</Label>
                <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                  <Input id="adresse_siege_social" placeholder="Adresse" {...register("adresse_siege_social")} />
                  <Input id="code_postal_siege_social" placeholder="Code postal" {...register("code_postal_siege_social")} />
                  <Input id="ville_siege_social" placeholder="Ville" {...register("ville_siege_social")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gestion des absences</CardTitle>
            </CardHeader>
            <CardContent>
              {absences.length ? (
                <div className="space-y-3 text-sm">
                  {absences.map((absence) => (
                    <div
                      key={absence.id}
                      className="rounded-md border border-muted/60 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(absence.startDate)} → {formatDate(absence.endDate)}
                        </span>
                        {absence.isConfirmed ? (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            Confirmée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            Proposée
                          </Badge>
                        )}
                      </div>
                      {absence.reason ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Motif : {absence.reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune absence enregistrée pour cet artisan.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentSection entityType="artisan" entityId={artisanId} currentUserId={currentUser?.id ?? undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suivi & Statuts</CardTitle>
            </CardHeader>
            <CardContent className={statusesContentClass}>
              <div className="space-y-2">
                <Label>Attribué à</Label>
                <Controller
                  name="gestionnaire_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un gestionnaire" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non assigné</SelectItem>
                        {gestionnaireOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Statut Artisan - Affichage uniquement, modification limitée aux règles métier */}
              <div className="space-y-2">
                <Label>Statut Artisan</Label>
                <Controller
                  name="statut_id"
                  control={control}
                  render={({ field }) => {
                    const currentStatusCode = getArtisanStatusCode(artisan?.statut_id ?? null)
                    const canChangeStatus = currentStatusCode === 'CANDIDAT' && statusOptions.length > 0

                    if (!canChangeStatus) {
                      // Afficher le statut actuel en lecture seule
                      const currentStatus = referenceData?.artisanStatuses?.find(
                        (s) => s.id === artisan?.statut_id
                      )
                      return (
                        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                          {currentStatus ? (
                            <>
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: currentStatus.color ?? '#6B7280' }}
                              />
                              <span>{currentStatus.label}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Non défini</span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            (Géré automatiquement)
                          </span>
                        </div>
                      )
                    }

                    // Permettre le changement uniquement pour CANDIDAT -> POTENTIEL/ONE_SHOT
                    return (
                      <Select
                        value={field.value || undefined}
                        onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Finances liées à l'artisan */}
        <ArtisanFinancesSection interventions={artisanInterventions} artisanId={artisanId} />

        {/* Interventions de l'artisan */}
        <ArtisanInterventionsTable artisanId={artisanId} />

        {/* Documents en pleine largeur en bas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4" />
              Documents de l&apos;entreprise
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {attachmentCount} document{attachmentCount > 1 ? "s" : ""}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <DocumentManager
              entityType="artisan"
              entityId={artisan?.id ?? artisanId}
              kinds={ARTISAN_DOCUMENT_KINDS}
              currentUser={currentUser ?? undefined}
              onChange={handleDocumentsChange}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={`modal-config-surface ${surfaceVariantClass ?? ""} ${surfaceModeClass}`}>
        <header className="modal-config-columns-header relative">
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
                  Archivé
                </Button>
              )
            ) : null}
          </div>
        </header>
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <div className="modal-config-columns-body overflow-y-auto">
            <div className={cn(bodyPadding, "space-y-6")}>
              {renderContent()}
            </div>
          </div>
          <footer className="modal-config-columns-footer flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving || isLoading}>
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
