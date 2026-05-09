import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getReasonTypeForTransition,
  type StatusReasonType,
} from "@/lib/comments/statusReason"
import type { ArtisanFormValues, ArtisanWithRelations } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type ArtisanStatus = { id: string; code: string | null }

type SubmitArtisanUpdate = (
  values: ArtisanFormValues,
  reasonPayload?: { type: StatusReasonType; comment: string },
) => Promise<void>

type Params = {
  artisanId: string
  artisan: ArtisanWithRelations | null | undefined
  artisanStatuses: ArtisanStatus[] | undefined
  getValues: () => ArtisanFormValues
  submitArtisanUpdate: SubmitArtisanUpdate
  onModalOpenChange?: (isOpen: boolean) => void
}

export function useArtisanStatusTransition({
  artisanId,
  artisan,
  artisanStatuses,
  getValues,
  submitArtisanUpdate,
  onModalOpenChange,
}: Params) {
  const [pendingReason, setPendingReason] = useState<
    { type: StatusReasonType; values: ArtisanFormValues } | null
  >(null)
  const [pendingArchive, setPendingArchive] = useState<boolean>(false)
  const isStatusReasonModalOpen = pendingReason !== null || pendingArchive

  // Reset pending state when the artisan changes
  useEffect(() => {
    setPendingReason(null)
    setPendingArchive(false)
  }, [artisanId])

  // Notify parent of open/close
  useEffect(() => {
    onModalOpenChange?.(isStatusReasonModalOpen)
  }, [isStatusReasonModalOpen, onModalOpenChange])

  const getArtisanStatusCode = useCallback(
    (statusId?: string | null) => {
      if (!statusId || !artisanStatuses) {
        return null
      }
      return artisanStatuses.find((status) => status.id === statusId)?.code ?? null
    },
    [artisanStatuses],
  )

  const previousArtisanStatusCode = useMemo(
    () => getArtisanStatusCode(artisan?.statut_id ?? null),
    [artisan?.statut_id, getArtisanStatusCode],
  )

  const onSubmit = useCallback(
    async (values: ArtisanFormValues) => {
      const nextStatusCode = getArtisanStatusCode(values.statut_id)
      const reasonType = getReasonTypeForTransition(previousArtisanStatusCode, nextStatusCode)

      if (reasonType) {
        setPendingReason({ type: reasonType, values })
        return
      }

      await submitArtisanUpdate(values)
    },
    [getArtisanStatusCode, previousArtisanStatusCode, submitArtisanUpdate],
  )

  const handleReasonCancel = useCallback(() => {
    setPendingReason(null)
  }, [])

  const handleReasonConfirm = useCallback(
    async (comment: string) => {
      if (pendingArchive) {
        const archiveStatusId = artisanStatuses?.find((status) => status.code === "ARCHIVE")?.id
        if (!archiveStatusId) {
          toast.error("Erreur", { description: "Impossible de trouver le statut ARCHIVE" })
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

      if (!pendingReason) return
      const { type, values } = pendingReason
      setPendingReason(null)
      await submitArtisanUpdate(values, { type, comment })
    },
    [pendingArchive, pendingReason, artisanStatuses, getValues, submitArtisanUpdate],
  )

  const handleArchiveClick = useCallback(() => {
    if (!artisan) return
    const currentStatusCode = getArtisanStatusCode(artisan.statut_id ?? null)
    if (currentStatusCode === "ARCHIVE") return
    setPendingArchive(true)
  }, [artisan, getArtisanStatusCode])

  const handleArchiveCancel = useCallback(() => {
    setPendingArchive(false)
  }, [])

  return {
    pendingReason,
    pendingArchive,
    isStatusReasonModalOpen,
    getArtisanStatusCode,
    onSubmit,
    handleReasonCancel,
    handleReasonConfirm,
    handleArchiveClick,
    handleArchiveCancel,
  }
}
