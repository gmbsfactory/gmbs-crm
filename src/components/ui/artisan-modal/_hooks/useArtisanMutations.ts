import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { artisansApi } from "@/lib/api"
import { commentsApi } from "@/lib/api/commentsApi"
import { artisanKeys, commentKeys } from "@/lib/react-query/queryKeys"
import type { StatusReasonType } from "@/lib/comments/statusReason"
import {
  buildUpdatePayload,
  type ArtisanFormValues,
} from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type ReasonPayload = { type: StatusReasonType; comment: string }

type SubmitOptions = {
  reasonPayload?: ReasonPayload
  onSuccess?: (updated: unknown) => void
}

export function useArtisanMutations(
  artisanId: string,
  currentUserId: string | undefined,
) {
  const queryClient = useQueryClient()

  const updateArtisan = useMutation({
    mutationFn: (payload: ReturnType<typeof buildUpdatePayload>) =>
      artisansApi.update(artisanId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })
      void queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
    },
  })

  const submitArtisanUpdate = useCallback(
    async (values: ArtisanFormValues, options?: SubmitOptions) => {
      const payload = buildUpdatePayload(values)
      try {
        const updated = await updateArtisan.mutateAsync(payload)

        if (options?.reasonPayload) {
          try {
            await commentsApi.create({
              entity_id: artisanId,
              entity_type: "artisan",
              content: options.reasonPayload.comment,
              comment_type: "internal",
              is_internal: true,
              author_id: currentUserId ?? undefined,
              reason_type: options.reasonPayload.type,
            })
            await queryClient.invalidateQueries({
              queryKey: commentKeys.invalidateByEntity("artisan", artisanId),
            })
          } catch (commentError) {
            console.error(
              "[ArtisanModalContent] Impossible d'ajouter le commentaire obligatoire",
              commentError,
            )
            throw new Error(
              "Le commentaire obligatoire n'a pas pu être enregistré. Merci de réessayer.",
            )
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

        options?.onSuccess?.(updated)
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Une erreur est survenue."
        toast.error("Échec de l'enregistrement", { description: message })
      }
    },
    [artisanId, currentUserId, queryClient, updateArtisan],
  )

  const invalidateArtisanDetail = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })
    // Rafraichit aussi les listes : l'avatar (photo de profil) y est affiche,
    // il doit se mettre a jour des l'import du document, sans recharger la page.
    void queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
  }, [artisanId, queryClient])

  return { updateArtisan, submitArtisanUpdate, invalidateArtisanDetail }
}
