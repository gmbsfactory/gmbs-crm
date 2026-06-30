"use client"

import { useState } from "react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { artisanKeys, commentKeys } from "@/lib/react-query/queryKeys"
import { artisansApi } from "@/lib/api"
import { archiveArtisan } from "@/lib/artisans/archiveArtisan"

export function useArtisanContextMenu(artisanId: string) {
  const queryClient = useQueryClient()
  const { open: openArtisanModal } = useArtisanModal()
  const { data: currentUser } = useCurrentUser()
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)

  // Vérifier si l'artisan est déjà archivé
  const { data: artisan } = useQuery({
    queryKey: artisanKeys.detail(artisanId),
    queryFn: () => artisansApi.getById(artisanId),
    enabled: !!artisanId,
  })

  // Vérifier si l'artisan est archivé : on se base sur le statut ARCHIVE, pas sur
  // is_active. L'archivage laisse désormais is_active=true (archive ≠ soft-delete),
  // donc is_active===false ne reflète plus l'état "archivé".
  const statusCode = (artisan as { status?: { code?: string } } | undefined)?.status?.code
  const isArchived = statusCode === "ARCHIVE"

  // Mutation pour archiver un artisan.
  // L'archivage se fait CÔTÉ CLIENT, à l'identique du modal d'édition : les appels
  // portent le JWT de l'utilisateur. (Auparavant ce hook passait par la route
  // serveur /api/artisans/[id]/archive, qui perdait l'identité utilisateur côté
  // serveur → 401 sur la création du commentaire.) Voir archiveArtisan().
  const archiveMutation = useMutation({
    mutationFn: (reason: string) =>
      archiveArtisan({ artisanId, reason, authorId: currentUser?.id }),
    onSuccess: () => {
      // Fermer d'abord le modal de motif, puis notifier.
      setIsArchiveModalOpen(false)
      toast.success("Artisan archivé avec succès", {
        description: new Date().toLocaleString(),
      })

      // Différer les invalidations : on laisse le Dialog (StatusReasonModal) se
      // fermer et se démonter proprement AVANT que l'invalidation des listes ne
      // retire éventuellement cette ligne du tableau (et avec elle ce menu + le
      // modal). Invalider trop tôt démonte le Dialog en plein vol et laisse le
      // verrou `pointer-events:none` de Radix sur <body> → page gelée. Le filet
      // au démontage de StatusReasonModal couvre le cas résiduel.
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
        queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })
        queryClient.invalidateQueries({
          queryKey: commentKeys.invalidateByEntity("artisan", artisanId),
        })
      }, 250)
    },
    onError: (error: Error) => {
      toast.error("Erreur d'archivage", {
        description: error.message || "Une erreur est survenue lors de l'archivage.",
      })
    },
  })

  const handleOpen = () => {
    openArtisanModal(artisanId)
  }

  const handleArchive = () => {
    setIsArchiveModalOpen(true)
  }

  const handleArchiveConfirm = (reason: string) => {
    archiveMutation.mutate(reason)
  }

  const handleArchiveCancel = () => {
    setIsArchiveModalOpen(false)
  }

  return {
    onOpen: handleOpen,
    onArchive: handleArchive,
    isArchived,
    archiveModal: {
      isOpen: isArchiveModalOpen,
      onConfirm: handleArchiveConfirm,
      onCancel: handleArchiveCancel,
      isSubmitting: archiveMutation.isPending,
    },
  }
}
