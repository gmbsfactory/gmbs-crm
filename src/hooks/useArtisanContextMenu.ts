"use client"

import { useState } from "react"
import { flushSync } from "react-dom"
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
      // Utiliser flushSync pour forcer la fermeture synchrone du modal avant l'invalidation
      // Cela évite le freeze causé par le re-render massif pendant la fermeture
      flushSync(() => {
        setIsArchiveModalOpen(false)
      })

      // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
      // avant d'invalider les queries et de déclencher un re-render massif
      requestAnimationFrame(() => {
        // Invalider toutes les listes d'artisans + le détail + l'historique des commentaires
        queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
        queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })
        queryClient.invalidateQueries({
          queryKey: commentKeys.invalidateByEntity("artisan", artisanId),
        })

        // Afficher le toast après un petit délai pour éviter les conflits
        setTimeout(() => {
          toast.success("Artisan archivé avec succès", {
            description: new Date().toLocaleString(),
          })
        }, 50)
      })
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
