import { useCallback, useEffect, useMemo, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { artisansApi } from "@/lib/api"
import { commentsApi } from "@/lib/api/commentsApi"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import type { PendingAbsence } from "@/components/ui/artisan-modal/_components/PendingAbsencesSection"
import type { DeletedArtisanInfo } from "@/components/ui/artisan-modal/_components/DeletedArtisanDialog"
import {
  type ArtisanFormValues,
  buildCreatePayload,
  buildDefaultFormValues,
} from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type CurrentUserRef = { id?: string | null } | null

type ReferenceDataForCreate = {
  artisanStatuses?: Array<{ id: string; code?: string | null }> | null
} | null | undefined

type UseArtisanCreateArgs = {
  form: UseFormReturn<ArtisanFormValues>
  referenceData: ReferenceDataForCreate
  currentUser: CurrentUserRef
  onClose: () => void
}

type DeletedArtisanDialogState = {
  isOpen: boolean
  artisan: DeletedArtisanInfo | null
  deletedAt: string | null
  pendingFormValues: ArtisanFormValues | null
}

const INITIAL_DELETED_DIALOG: DeletedArtisanDialogState = {
  isOpen: false,
  artisan: null,
  deletedAt: null,
  pendingFormValues: null,
}

/**
 * Create-only side effects for the artisan creation modal:
 * pending absences, deleted-artisan dialog flow (detect / restore / overwrite),
 * default POTENTIEL status, auto-assignment to current user, and numero_associe generation.
 *
 * Why: keeps NewArtisanModalContent focused on layout while this hook owns
 * the multi-step "submit then maybe disambiguate" flow.
 */
export function useArtisanCreate({
  form,
  referenceData,
  currentUser,
  onClose,
}: UseArtisanCreateArgs) {
  const { setValue, getValues, reset } = form
  const queryClient = useQueryClient()

  const [pendingAbsences, setPendingAbsences] = useState<PendingAbsence[]>([])
  const [generatedNumeroAssocie, setGeneratedNumeroAssocie] = useState<string>("")
  const [isRestoringOrDeleting, setIsRestoringOrDeleting] = useState(false)
  const [deletedArtisanDialog, setDeletedArtisanDialog] =
    useState<DeletedArtisanDialogState>(INITIAL_DELETED_DIALOG)

  const defaultCandidatStatusId = useMemo(() => {
    return (
      referenceData?.artisanStatuses?.find(
        (status) => status.code?.toUpperCase() === "POTENTIEL",
      )?.id || ""
    )
  }, [referenceData])

  const availableStatusesForModification = useMemo<
    Array<{ id: string; code: string; label: string; color: string }>
  >(() => {
    if (!referenceData?.artisanStatuses) return []
    const allowedCodes = ["CANDIDAT", "ONE_SHOT"]
    const order = ["CANDIDAT", "ONE_SHOT"]
    return referenceData.artisanStatuses
      .filter((status) => allowedCodes.includes(status.code?.toUpperCase() || ""))
      .sort((a, b) => {
        const aIndex = order.indexOf(a.code?.toUpperCase() || "")
        const bIndex = order.indexOf(b.code?.toUpperCase() || "")
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
      }) as Array<{ id: string; code: string; label: string; color: string }>
  }, [referenceData])

  // Default to POTENTIEL once reference data resolves.
  useEffect(() => {
    if (defaultCandidatStatusId) {
      setValue("statut_id", defaultCandidatStatusId)
    }
  }, [defaultCandidatStatusId, setValue])

  // Auto-assign the creating user as gestionnaire if none chosen yet.
  useEffect(() => {
    if (currentUser?.id) {
      const currentGestionnaireId = getValues("gestionnaire_id")
      if (!currentGestionnaireId) {
        setValue("gestionnaire_id", currentUser.id, { shouldDirty: false })
      }
    }
  }, [currentUser?.id, setValue, getValues])

  // Generate the next sequential numero_associe by counting existing artisans.
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

  const createArtisan = useMutation({
    mutationFn: (payload: ReturnType<typeof buildCreatePayload>) =>
      artisansApi.create(payload),
  })

  const handleAddAbsence = useCallback((absence: PendingAbsence) => {
    setPendingAbsences((prev) => [...prev, absence])
  }, [])

  const handleRemovePendingAbsence = useCallback((id: string) => {
    setPendingAbsences((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const persistAbsencesAndComment = useCallback(
    async (
      artisanId: string,
      absencesToCreate: PendingAbsence[],
      commentaireInitial: string,
      onCommentFailureToast?: () => void,
    ) => {
      if (absencesToCreate.length > 0) {
        for (const absence of absencesToCreate) {
          try {
            await artisansApi.createAbsence(artisanId, {
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

      const trimmed = commentaireInitial.trim()
      if (trimmed.length > 0) {
        try {
          await commentsApi.create({
            entity_id: artisanId,
            entity_type: "artisan",
            content: trimmed,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id ?? undefined,
          })
        } catch (commentError) {
          console.error("Impossible d'ajouter le commentaire initial:", commentError)
          onCommentFailureToast?.()
        }
      }
    },
    [currentUser?.id],
  )

  const refetchListsAfterMutation = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: artisanKeys.invalidateLists(),
      refetchType: "active",
    })
    await queryClient.refetchQueries({
      queryKey: artisanKeys.invalidateLists(),
      type: "active",
    })
  }, [queryClient])

  const performCreateArtisan = useCallback(
    async (values: ArtisanFormValues) => {
      const payload = buildCreatePayload(values)
      try {
        const created = await createArtisan.mutateAsync(payload)
        if (created.id) {
          await persistAbsencesAndComment(
            created.id,
            pendingAbsences,
            values.commentaire_initial,
            () =>
              toast.error(
                "L'artisan a été créé mais le commentaire n'a pas pu être enregistré.",
              ),
          )
        }

        await refetchListsAfterMutation()

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
        onClose()
      } catch (error: any) {
        // Edge case: Edge Function returned a soft-deleted artisan match (409).
        const errorMessage = error?.message || ""
        try {
          let errorData: any = null
          if (errorMessage.includes("DELETED_ARTISAN_EXISTS")) {
            const jsonMatch = errorMessage.match(/\{[\s\S]*\}/)
            if (jsonMatch) errorData = JSON.parse(jsonMatch[0])
          } else if (error?.response) {
            errorData = await error.response.json?.()
          }

          if (errorData?.error === "DELETED_ARTISAN_EXISTS" && errorData?.artisan) {
            setDeletedArtisanDialog({
              isOpen: true,
              artisan: errorData.artisan,
              deletedAt: errorData.deleted_at || null,
              pendingFormValues: values,
            })
            return
          }
        } catch (parseError) {
          console.warn("Erreur lors du parsing de l'erreur:", parseError)
        }
        throw error
      }
    },
    [
      createArtisan,
      onClose,
      pendingAbsences,
      persistAbsencesAndComment,
      refetchListsAfterMutation,
      reset,
    ],
  )

  const handleRestoreArtisan = useCallback(async () => {
    if (!deletedArtisanDialog.artisan) return
    setIsRestoringOrDeleting(true)
    try {
      const restored = await artisansApi.restore(deletedArtisanDialog.artisan.id)
      await queryClient.invalidateQueries({
        queryKey: artisanKeys.invalidateLists(),
        refetchType: "all",
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
      setDeletedArtisanDialog(INITIAL_DELETED_DIALOG)
      reset(buildDefaultFormValues())
      setPendingAbsences([])
      onClose()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de restaurer l'artisan."
      toast.error("Échec de la restauration", { description: message })
    } finally {
      setIsRestoringOrDeleting(false)
    }
  }, [deletedArtisanDialog.artisan, onClose, queryClient, reset])

  const handleOverwriteAndCreate = useCallback(async () => {
    if (!deletedArtisanDialog.artisan || !deletedArtisanDialog.pendingFormValues) return
    setIsRestoringOrDeleting(true)
    try {
      const payload = buildCreatePayload(deletedArtisanDialog.pendingFormValues)
      const restored = await artisansApi.restore(deletedArtisanDialog.artisan.id, payload)

      if (restored.id) {
        await persistAbsencesAndComment(
          restored.id,
          pendingAbsences,
          deletedArtisanDialog.pendingFormValues.commentaire_initial,
        )
      }

      await refetchListsAfterMutation()

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
      setDeletedArtisanDialog(INITIAL_DELETED_DIALOG)
      reset(buildDefaultFormValues())
      setPendingAbsences([])
      onClose()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de mettre à jour l'artisan."
      toast.error("Échec de l'opération", { description: message })
    } finally {
      setIsRestoringOrDeleting(false)
    }
  }, [
    deletedArtisanDialog.artisan,
    deletedArtisanDialog.pendingFormValues,
    onClose,
    pendingAbsences,
    persistAbsencesAndComment,
    refetchListsAfterMutation,
    reset,
  ])

  const handleCloseDeletedDialog = useCallback(() => {
    setDeletedArtisanDialog(INITIAL_DELETED_DIALOG)
  }, [])

  const onSubmit = useCallback(
    async (values: ArtisanFormValues) => {
      try {
        // Pre-flight: surface the deleted-artisan dialog before the API rejects.
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
            console.warn(
              "Erreur lors de la vérification des artisans supprimés:",
              checkError,
            )
          }
        }

        await performCreateArtisan(values)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de sauvegarder l'artisan."
        toast.error("Échec de la sauvegarde", { description: message })
      }
    },
    [performCreateArtisan],
  )

  return {
    onSubmit,
    isSubmitting: createArtisan.isPending,
    pendingAbsences,
    handleAddAbsence,
    handleRemovePendingAbsence,
    generatedNumeroAssocie,
    deletedArtisanDialog,
    handleRestoreArtisan,
    handleOverwriteAndCreate,
    handleCloseDeletedDialog,
    isRestoringOrDeleting,
    defaultCandidatStatusId,
    availableStatusesForModification,
  }
}
