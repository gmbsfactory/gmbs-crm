"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  CheckCircle2,
  MapPin,
  User,
  Building2,
  Upload,
  MessageSquare,
  UserCheck,
} from "lucide-react"
import { useGeocodeSearch, type GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ModeIcons } from "@/components/ui/mode-selector"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { toast } from "sonner"
import { useSiretVerification } from "@/hooks/useSiretVerification"
import { normalizeIban } from "@/lib/iban-validation"
import { SiretField } from "./_components/SiretField"
import { IbanField } from "./_components/IbanField"
import { PendingAbsencesSection, type PendingAbsence } from "./_components/PendingAbsencesSection"
import { DeletedArtisanDialog, type DeletedArtisanInfo } from "./_components/DeletedArtisanDialog"
import { artisansApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { cn } from "@/lib/utils"
import type { ModalDisplayMode } from "@/types/modal-display"
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"

// ===== HELPERS =====

import { getReadableTextColor } from "@/utils/color"

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

const ARTISAN_DOCUMENT_KINDS = [
  { kind: "kbis", label: "Extrait Kbis" },
  { kind: "assurance", label: "Attestation d'assurance" },
  { kind: "cni_recto_verso", label: "CNI recto/verso" },
  { kind: "iban", label: "IBAN" },
  { kind: "decharge_partenariat", label: "Décharge partenariat" },
  { kind: "photo_profil", label: "Photo de profil" },
  { kind: "autre", label: "Autre document" },
]

// ===== TYPES =====

type ArtisanFormValues = {
  prenom: string
  nom: string
  raison_sociale: string
  telephone: string
  telephone2: string
  email: string
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
  commentaire_initial: string
}

// ===== HELPERS =====

const buildDefaultFormValues = (): ArtisanFormValues => ({
  prenom: "",
  nom: "",
  raison_sociale: "",
  telephone: "",
  telephone2: "",
  email: "",
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
  commentaire_initial: "",
})

const buildCreatePayload = (values: ArtisanFormValues) => {
  // S'assurer que les métiers et zones sont toujours des tableaux (même vides)
  // pour que l'API les mette à jour correctement
  const metiers = (values.metiers ?? []).filter(Boolean)
  const zones = values.zone_intervention ? [values.zone_intervention] : []

  return {
    prenom: values.prenom || undefined,
    nom: values.nom || undefined,
    raison_sociale: values.raison_sociale || undefined,
    telephone: values.telephone || undefined,
    telephone2: values.telephone2 || undefined,
    email: values.email || undefined,
    adresse_siege_social: values.adresse_siege_social || undefined,
    code_postal_siege_social: values.code_postal_siege_social || undefined,
    ville_siege_social: values.ville_siege_social || undefined,
    statut_juridique: values.statut_juridique || undefined,
    siret: values.siret || undefined,
    iban: normalizeIban(values.iban),
    metiers, // Toujours inclus, même si vide (pour permettre la suppression)
    zones, // Toujours inclus, même si vide (pour permettre la suppression)
    gestionnaire_id: values.gestionnaire_id || undefined,
    statut_id: values.statut_id || undefined,
    numero_associe: values.numero_associe || undefined,
    intervention_latitude: values.intervention_latitude ?? undefined,
    intervention_longitude: values.intervention_longitude ?? undefined,
  }
}

// ===== COMPOSANT PRINCIPAL =====

type Props = {
  mode: ModalDisplayMode
  onClose: () => void
  onCycleMode?: () => void
  onUnsavedChangesStateChange?: (hasChanges: boolean, submitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
}

export function NewArtisanModalContent({ mode, onClose, onCycleMode, onUnsavedChangesStateChange, onRegisterShowDialog, onUnsavedDialogOpenChange }: Props) {
  const ModeIcon = ModeIcons[mode]
  const { data: referenceData, loading: referenceLoading } = useReferenceDataQuery()
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const { can } = usePermissions()
  const canWriteArtisans = can("write_artisans")

  // États pour les sections collapsibles
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Hook géocodage pour l'adresse du siège social
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isSuggesting,
    clearSuggestions,
  } = useGeocodeSearch({ minQueryLength: 3, debounceMs: 300 })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [generatedNumeroAssocie, setGeneratedNumeroAssocie] = useState<string>("")

  // Gestion des absences (création uniquement — les absences réelles sont créées après l'enregistrement)
  const [pendingAbsences, setPendingAbsences] = useState<PendingAbsence[]>([])
  const [isRestoringOrDeleting, setIsRestoringOrDeleting] = useState(false)

  // État pour le dialogue de confirmation d'artisan supprimé
  const [deletedArtisanDialog, setDeletedArtisanDialog] = useState<{
    isOpen: boolean
    artisan: DeletedArtisanInfo | null
    deletedAt: string | null
    pendingFormValues: ArtisanFormValues | null
  }>({
    isOpen: false,
    artisan: null,
    deletedAt: null,
    pendingFormValues: null,
  })
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
      avatarUrl: currentUserData.avatar_url ?? null,
    }
  }, [currentUserData])

  // Cleanup du timeout
  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  // Trouver le statut POTENTIEL par défaut (nouveau workflow)
  const defaultCandidatStatusId = useMemo(() => {
    return referenceData?.artisanStatuses?.find(
      (status) => status.code?.toUpperCase() === 'POTENTIEL'
    )?.id || "";
  }, [referenceData]);

  const { control, register, handleSubmit, reset, setValue, watch, getValues, formState: { errors, isDirty, dirtyFields, isSubmitted } } = useForm<ArtisanFormValues>({
    defaultValues: buildDefaultFormValues(),
  })

  // Mettre à jour le statut par défaut en mode création
  useEffect(() => {
    if (defaultCandidatStatusId) {
      setValue("statut_id", defaultCandidatStatusId)
    }
  }, [defaultCandidatStatusId, setValue])

  // Statuts disponibles en création : CANDIDAT ou ONE_SHOT
  const availableStatusesForModification = useMemo((): Array<{ id: string; code: string; label: string; color: string }> => {
    if (!referenceData?.artisanStatuses) return []

    const allowedCodes = ['CANDIDAT', 'ONE_SHOT']
    return referenceData.artisanStatuses
      .filter((status) => allowedCodes.includes(status.code?.toUpperCase() || ''))
      .sort((a, b) => {
        const order = ['CANDIDAT', 'ONE_SHOT']
        const aIndex = order.indexOf(a.code?.toUpperCase() || '')
        const bIndex = order.indexOf(b.code?.toUpperCase() || '')
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
      })
  }, [referenceData])

  // Attribuer automatiquement l'artisan au gestionnaire qui le crée
  useEffect(() => {
    if (currentUser?.id) {
      const currentGestionnaireId = getValues("gestionnaire_id")
      if (!currentGestionnaireId) {
        setValue("gestionnaire_id", currentUser.id, { shouldDirty: false })
      }
    }
  }, [currentUser?.id, setValue, getValues])

  // Récupérer le nombre d'artisans pour générer le numéro associé
  useEffect(() => {
    const fetchArtisanCount = async () => {
      try {
        const count = await artisansApi.getTotalCount()
        const nextNumber = String(count + 1)
        setGeneratedNumeroAssocie(nextNumber)
        setValue("numero_associe", nextNumber)
      } catch (error) {
        console.error("Erreur lors de la récupération du nombre d'artisans:", error)
        setGeneratedNumeroAssocie("")
      }
    }
    fetchArtisanCount()
  }, [setValue])

  const { verifySiret, isLoading: isVerifyingSiret, isUnavailable } = useSiretVerification()

  const createArtisan = useMutation({
    mutationFn: (payload: ReturnType<typeof buildCreatePayload>) => artisansApi.create(payload),
  })


  const metierOptions = useMemo(
    () => (referenceData?.metiers ?? []).map((metier) => ({
      id: metier.id,
      label: metier.label ?? metier.code ?? metier.id,
      color: metier.color ?? null,
    })),
    [referenceData],
  )

  const gestionnaireOptions = useMemo(
    () => (referenceData?.users ?? []).map((user) => {
      const name = [user.firstname, user.lastname].filter(Boolean).join(" ").trim()
      return {
        id: user.id,
        label: name || user.username || user.id,
      }
    }),
    [referenceData],
  )

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

  const watchedLat = watch("intervention_latitude")
  const watchedLng = watch("intervention_longitude")

  const handleAddAbsence = useCallback((absence: PendingAbsence) => {
    setPendingAbsences(prev => [...prev, absence])
  }, [])

  const handleRemovePendingAbsence = useCallback((id: string) => {
    setPendingAbsences(prev => prev.filter(a => a.id !== id))
  }, [])

  // Fonction interne pour créer l'artisan (appelée après vérification des doublons)
  const performCreateArtisan = async (values: ArtisanFormValues) => {
    const payload = buildCreatePayload(values)

    try {
      const created = await createArtisan.mutateAsync(payload)

      // Créer les absences
      if (pendingAbsences.length > 0 && created.id) {
        for (const absence of pendingAbsences) {
          try {
            await artisansApi.createAbsence(created.id, {
              start_date: absence.start_date,
              end_date: absence.end_date,
              reason: absence.reason || undefined,
              is_confirmed: false,
            })
          } catch (absenceError) {
            console.error("Erreur lors de la création de l'absence:", absenceError)
          }
        }
      }

      // Ajouter le commentaire initial si renseigné
      const trimmedComment = values.commentaire_initial.trim()
      if (trimmedComment.length > 0 && created.id) {
        try {
          await commentsApi.create({
            entity_id: created.id,
            entity_type: "artisan",
            content: trimmedComment,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id,
          })
        } catch (commentError) {
          console.error("Impossible d'ajouter le commentaire initial:", commentError)
          toast.error("L'artisan a été créé mais le commentaire n'a pas pu être enregistré.")
        }
      }

      // Invalider et forcer le refetch immédiat de toutes les listes d'artisans
      await queryClient.invalidateQueries({
        queryKey: artisanKeys.invalidateLists(),
        refetchType: 'active' // Force le refetch des queries actives
      })

      // Forcer un refetch immédiat pour contourner le staleTime
      await queryClient.refetchQueries({
        queryKey: artisanKeys.invalidateLists(),
        type: 'active'
      })

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("artisan-updated", {
            detail: { id: created.id, data: created, optimistic: true, type: "create" },
          }),
        )
      }

      toast.success("Artisan créé", {
        description: "La fiche artisan a été enregistrée.",
      })
      reset(buildDefaultFormValues())
      setPendingAbsences([])

      // Fermer le modal après sauvegarde réussie (refetch déjà await plus haut)
      shouldCloseAfterSave.current = false
      onClose()
    } catch (error: any) {
      // Vérifier si c'est une erreur de doublon avec artisan supprimé (code 409)
      const errorMessage = error?.message || ""

      // Essayer de parser le message d'erreur JSON
      try {
        // L'erreur peut contenir le JSON directement ou dans le message
        let errorData = null
        if (errorMessage.includes("DELETED_ARTISAN_EXISTS")) {
          // Extraire le JSON de l'erreur
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            errorData = JSON.parse(jsonMatch[0])
          }
        } else if (error?.response) {
          // Si c'est une erreur fetch avec response
          errorData = await error.response.json?.()
        }

        if (errorData?.error === "DELETED_ARTISAN_EXISTS" && errorData?.artisan) {
          // Artisan supprimé trouvé - afficher le dialogue
          setDeletedArtisanDialog({
            isOpen: true,
            artisan: errorData.artisan,
            deletedAt: errorData.deleted_at || null,
            pendingFormValues: values,
          })
          return
        }
      } catch (parseError) {
        // Erreur de parsing, continuer avec l'erreur originale
        console.warn("Erreur lors du parsing de l'erreur:", parseError)
      }

      // Relancer l'erreur pour la gestion normale
      throw error
    }
  }

  // Restaurer l'artisan supprimé (uniquement réactiver is_active = true, sans modifier les données)
  const handleRestoreArtisan = async () => {
    if (!deletedArtisanDialog.artisan) return

    setIsRestoringOrDeleting(true)
    try {
      // Restaurer uniquement (is_active = true) sans modifier les autres données
      const restored = await artisansApi.restore(deletedArtisanDialog.artisan.id)

      await queryClient.invalidateQueries({
        queryKey: artisanKeys.invalidateLists(),
        refetchType: 'all'
      })

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("artisan-updated", {
            detail: { id: restored.id, data: restored, optimistic: true, type: "restore" },
          }),
        )
      }

      toast.success("Artisan restauré", {
        description: "L'artisan a été réactivé avec ses données d'origine.",
      })

      setDeletedArtisanDialog({ isOpen: false, artisan: null, deletedAt: null, pendingFormValues: null })
      reset(buildDefaultFormValues())
      setPendingAbsences([])

      // Fermer le modal après sauvegarde réussie
      shouldCloseAfterSave.current = false
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de restaurer l'artisan."
      toast.error("Échec de la restauration", {
        description: message,
      })
    } finally {
      setIsRestoringOrDeleting(false)
    }
  }

  // Écraser les données de l'artisan supprimé avec les nouvelles données du formulaire
  const handleOverwriteAndCreate = async () => {
    if (!deletedArtisanDialog.artisan || !deletedArtisanDialog.pendingFormValues) return

    setIsRestoringOrDeleting(true)
    try {
      // Restaurer l'artisan avec les nouvelles données (écrase les anciennes)
      const payload = buildCreatePayload(deletedArtisanDialog.pendingFormValues)
      const restored = await artisansApi.restore(deletedArtisanDialog.artisan.id, payload)

      // Créer les absences
      if (pendingAbsences.length > 0 && restored.id) {
        for (const absence of pendingAbsences) {
          try {
            await artisansApi.createAbsence(restored.id, {
              start_date: absence.start_date,
              end_date: absence.end_date,
              reason: absence.reason || undefined,
              is_confirmed: false,
            })
          } catch (absenceError) {
            console.error("Erreur lors de la création de l'absence:", absenceError)
          }
        }
      }

      // Ajouter le commentaire initial si renseigné
      const trimmedComment = deletedArtisanDialog.pendingFormValues.commentaire_initial.trim()
      if (trimmedComment.length > 0 && restored.id) {
        try {
          await commentsApi.create({
            entity_id: restored.id,
            entity_type: "artisan",
            content: trimmedComment,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id,
          })
        } catch (commentError) {
          console.error("Impossible d'ajouter le commentaire initial:", commentError)
        }
      }

      await queryClient.invalidateQueries({
        queryKey: artisanKeys.invalidateLists(),
        refetchType: 'active'
      })

      // Forcer un refetch immédiat pour contourner le staleTime
      await queryClient.refetchQueries({
        queryKey: artisanKeys.invalidateLists(),
        type: 'active'
      })

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("artisan-updated", {
            detail: { id: restored.id, data: restored, optimistic: true, type: "overwrite" },
          }),
        )
      }

      toast.success("Artisan mis à jour", {
        description: "L'artisan a été réactivé avec les nouvelles informations.",
      })

      setDeletedArtisanDialog({ isOpen: false, artisan: null, deletedAt: null, pendingFormValues: null })
      reset(buildDefaultFormValues())
      setPendingAbsences([])
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de mettre à jour l'artisan."
      toast.error("Échec de l'opération", {
        description: message,
      })
    } finally {
      setIsRestoringOrDeleting(false)
    }
  }

  // Fermer le dialogue sans action
  const handleCloseDeletedDialog = () => {
    setDeletedArtisanDialog({ isOpen: false, artisan: null, deletedAt: null, pendingFormValues: null })
  }

  const onSubmit = async (values: ArtisanFormValues) => {
    try {
      // Vérifier d'abord si un artisan supprimé existe
      if (values.email || values.siret) {
        try {
          const checkResult = await artisansApi.checkDeletedArtisan({
            email: values.email || undefined,
            siret: values.siret || undefined,
          })

          if (checkResult.found && checkResult.artisan) {
            setDeletedArtisanDialog({
              isOpen: true,
              artisan: checkResult.artisan,
              deletedAt: checkResult.deleted_at || null,
              pendingFormValues: values,
            })
            return
          }
        } catch (checkError) {
          console.warn("Erreur lors de la vérification des artisans supprimés:", checkError)
        }
      }

      // Créer l'artisan - l'Edge Function gère les doublons
      await performCreateArtisan(values)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de sauvegarder l'artisan."
      toast.error("Échec de la sauvegarde", { description: message })
    }
  }

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
  }

  const isSubmitting = createArtisan.isPending
  const isLoading = referenceLoading && !referenceData

  // State pour la protection des modifications non sauvegardées
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)
  const shouldCloseAfterSave = useRef(false)

  const hasUnsavedChanges = isDirty && !isSubmitting && !isLoading

  // Notifier le parent des changements d'état pour la gestion du clic sur backdrop
  useEffect(() => {
    onUnsavedChangesStateChange?.(hasUnsavedChanges, isSubmitting)
  }, [hasUnsavedChanges, isSubmitting, onUnsavedChangesStateChange])

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
    if (hasUnsavedChanges && !isSubmitting) {
      // Stocker l'action de fermeture pour l'exécuter après confirmation
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
      return
    }

    // Pas de modifications ou soumission en cours : fermer directement
    onClose()
  }, [hasUnsavedChanges, isSubmitting, onClose])

  // Intercepter la touche Échap pour appliquer la même logique que handleCancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showUnsavedDialog) {
          // Laisser UnsavedChangesDialog gérer Escape
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
  }, [handleCancel, showUnsavedDialog])

  // Raccourci clavier Cmd/Ctrl+Enter pour enregistrer
  const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting })
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`

  const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
  const labelClass = "text-xs font-medium text-foreground/80"


  // Rendu du contrôle métiers
  const renderMetiersControl = (isRequired = false) => {
    const selectedMetiers = watch("metiers") || []
    const isFieldEmpty = isRequired && selectedMetiers.length === 0 && isSubmitted

    return (
      <Controller
        name="metiers"
        control={control}
        rules={{ required: isRequired }}
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
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-between h-8 text-sm bg-background border-border/80 hover:bg-muted/50",
                        isFieldEmpty && "border-orange-400 focus-visible:ring-orange-400"
                      )}
                    >
                      <span className="truncate text-foreground">
                        {selected.length > 0
                          ? `${selected.length} métier${selected.length > 1 ? "s" : ""}`
                          : "Sélectionner"}
                      </span>
                      <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto bg-popover border-border p-1">
                    {metierOptions.length ? (
                      metierOptions.map((option) => {
                        const isSelected = selected.includes(option.id)
                        const bgColor = option.color || "#6b7280"
                        const textColor = getReadableTextColor(bgColor)
                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors mb-0.5 cursor-pointer",
                              isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:bg-accent/50"
                            )}
                            onClick={() => toggleMetier(option.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                toggleMetier(option.id)
                              }
                            }}
                            tabIndex={0}
                            role="menuitemcheckbox"
                            aria-checked={isSelected}
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
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-sm text-muted-foreground px-2 py-1.5">
                        Aucun métier
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {isFieldEmpty && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                )}
              </div>

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
  }

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

          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="modal-config-columns-title flex items-center gap-2">
                Créer un artisan
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" />
        </header>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <div className="modal-config-columns-body flex-1 min-h-0 bg-[#C6CEDC] dark:bg-transparent">
            {!canWriteArtisans ? (
              <div className="px-4 py-3 md:px-6">
                <div className="rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  Vous n&apos;avez pas la permission de créer ou modifier un artisan.
                </div>
              </div>
            ) : isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 px-4 py-3 md:px-6">
                <div className="h-64 rounded-lg bg-muted animate-pulse" />
                <div className="h-64 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : (
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
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="prenom" className={labelClass}>Prénom *</Label>
                            <div className="relative">
                              <Input
                                id="prenom"
                                placeholder="Prénom"
                                className={cn(inputClass, isSubmitted && !watch("prenom")?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
                                {...register("prenom", { required: true })}
                              />
                              {isSubmitted && !watch("prenom")?.trim() && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="nom" className={labelClass}>Nom *</Label>
                            <div className="relative">
                              <Input
                                id="nom"
                                placeholder="Nom"
                                className={cn(inputClass, isSubmitted && !watch("nom")?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
                                {...register("nom", { required: true })}
                              />
                              {isSubmitted && !watch("nom")?.trim() && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="raison_sociale" className={labelClass}>Raison sociale *</Label>
                          <div className="relative">
                            <Input
                              id="raison_sociale"
                              placeholder="Nom de l'entreprise"
                              className={cn(inputClass, isSubmitted && !watch("raison_sociale")?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
                              {...register("raison_sociale", { required: true })}
                            />
                            {isSubmitted && !watch("raison_sociale")?.trim() && (
                              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="telephone" className={labelClass}>Téléphone *</Label>
                            <div className="relative">
                              <Input
                                id="telephone"
                                placeholder="06 00 00 00 00"
                                className={cn(inputClass, isSubmitted && !watch("telephone")?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
                                {...register("telephone", { required: true })}
                              />
                              {isSubmitted && !watch("telephone")?.trim() && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="telephone2" className={labelClass}>Tél. secondaire</Label>
                            <Input id="telephone2" placeholder="Optionnel" className={inputClass} {...register("telephone2")} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="email" className={labelClass}>Email *</Label>
                          <div className="relative">
                            <Input
                              id="email"
                              type="email"
                              placeholder="contact@email.com"
                              className={cn(inputClass, isSubmitted && !watch("email")?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
                              {...register("email", { required: true })}
                            />
                            {isSubmitted && !watch("email")?.trim() && (
                              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                            )}
                          </div>
                        </div>

                        {/* Métiers (déplacé ici) */}
                        <div className="space-y-1">
                          <Label className={labelClass}>Métiers *</Label>
                          {renderMetiersControl(true)}
                        </div>

                        {/* Adresse du siège social avec géocodage */}
                        <div className="space-y-1">
                          <Label className={labelClass}>Adresse du siège social *</Label>
                          <div className="relative">
                            <div className="relative">
                              <Input
                                placeholder="Rechercher une adresse..."
                                value={addressQuery}
                                className={cn(inputClass, isSubmitted && !addressQuery?.trim() && "border-orange-400 focus-visible:ring-orange-400")}
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
                              {isSubmitted && !addressQuery?.trim() && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
                              )}
                            </div>
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
                                          className="flex items-center justify-center h-8 w-8 cursor-pointer group rounded-full"
                                        >
                                          <GestionnaireBadge
                                            firstname={assignedUser?.firstname}
                                            lastname={assignedUser?.lastname}
                                            color={assignedUser?.color}
                                            avatarUrl={assignedUser?.avatar_url}
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

                              // Mode lecture seule : affichage statique
                              if (!canWriteArtisans) {
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
                                  </div>
                                );
                              }

                              // Select pour choisir le statut
                              return (
                                <Controller
                                  name="statut_id"
                                  control={control}
                                  render={({ field }) => {
                                    const selectedStatusId = field.value || defaultCandidatStatusId;
                                    const selectedStatus = availableStatusesForModification.find(
                                      (s) => s.id === selectedStatusId
                                    ) || referenceData?.artisanStatuses?.find(
                                      (s) => s.id === selectedStatusId
                                    );

                                    return (
                                      <Select
                                        value={selectedStatusId || ""}
                                        onValueChange={field.onChange}
                                      >
                                        <SelectTrigger className={inputClass}>
                                          <SelectValue placeholder="Sélectionner un statut...">
                                            {selectedStatus ? (
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                                  style={{ backgroundColor: selectedStatus.color ?? '#6B7280' }}
                                                />
                                                <span>{selectedStatus.label}</span>
                                              </div>
                                            ) : null}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableStatusesForModification.map((status) => (
                                            <SelectItem key={status.id} value={status.id}>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                                  style={{ backgroundColor: status.color ?? '#6B7280' }}
                                                />
                                                <span>{status.label}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    );
                                  }}
                                />
                              );
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
                              placeholder={generatedNumeroAssocie ? "" : "Chargement..."}
                              className={`${inputClass} bg-muted/50 font-medium`}
                              value={generatedNumeroAssocie}
                              readOnly
                              {...register("numero_associe")}
                            />
                          </div>
                        </div>

                        <SiretField control={control} />

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

                    <IbanField control={control} />

                    <PendingAbsencesSection
                      absences={pendingAbsences}
                      onAdd={handleAddAbsence}
                      onRemove={handleRemovePendingAbsence}
                    />

                    {/* DIV 4: Documents de l'entreprise (collapsible) */}
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
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-center py-6 space-y-2">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                              <p className="text-xs italic text-muted-foreground">
                                Les documents pourront être ajoutés après la création de l&apos;artisan
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                (KBIS, Attestation d&apos;assurance, CNI, IBAN, Décharge partenariat, Photo de profil)
                              </p>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* DIV 5: Commentaires (collapsible) */}
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
                            <div className="space-y-1">
                              <Label className={labelClass}>Commentaire initial</Label>
                              <Textarea
                                placeholder="Commentaire sur l'artisan..."
                                className="text-sm resize-none min-h-[80px]"
                                {...register("commentaire_initial")}
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Ce commentaire sera enregistré lors de la sauvegarde
                              </p>
                            </div>
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
            <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmitClick}
              disabled={isSubmitting || !canWriteArtisans}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  Créer l&apos;artisan
                  <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
                    {shortcutHint}
                  </kbd>
                </>
              )}
            </Button>
          </footer>
        </form>

        <DeletedArtisanDialog
          isOpen={deletedArtisanDialog.isOpen}
          artisan={deletedArtisanDialog.artisan}
          deletedAt={deletedArtisanDialog.deletedAt}
          isSubmitting={isRestoringOrDeleting}
          onClose={handleCloseDeletedDialog}
          onRestore={handleRestoreArtisan}
          onOverwrite={handleOverwriteAndCreate}
        />

        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onCancel={handleCancelClose}
          onConfirm={handleConfirmClose}
          onSaveAndConfirm={handleSaveAndClose}
        />
      </div>
    </TooltipProvider>
  )
}

export default NewArtisanModalContent
