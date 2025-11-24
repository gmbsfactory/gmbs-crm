"use client"

import { useState } from "react"
import { flushSync } from "react-dom"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { artisansApi } from "@/lib/api/v2"

export function useArtisanContextMenu(artisanId: string) {
  const queryClient = useQueryClient()
  // const { toast } = useToast() // Removed legacy toast
  const { open: openArtisanModal } = useArtisanModal()
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)

  // Vérifier si l'artisan est déjà archivé
  const { data: artisan } = useQuery({
    queryKey: artisanKeys.detail(artisanId),
    queryFn: () => artisansApi.getById(artisanId),
    enabled: !!artisanId,
  })

  // Vérifier si l'artisan est archivé (is_active === false ou statut ARCHIVE)
  const isArchived = artisan ? (artisan.is_active === false) : false

  // Mutation pour archiver un artisan
  const archiveMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`/api/artisans/${artisanId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'archivage")
      }
      return await response.json()
    },
    onSuccess: () => {
      // Utiliser flushSync pour forcer la fermeture synchrone du modal avant l'invalidation
      // Cela évite le freeze causé par le re-render massif pendant la fermeture
      flushSync(() => {
        setIsArchiveModalOpen(false)
      })

      // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
      // avant d'invalider les queries et de déclencher un re-render massif
      requestAnimationFrame(() => {
        // Invalider toutes les listes d'artisans
        queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
        queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })

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

  const handleEdit = () => {
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
    onEdit: handleEdit,
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

