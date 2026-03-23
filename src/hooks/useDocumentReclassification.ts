"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { documentsApi } from "@/lib/api/v2/documentsApi"
import { documentKeys } from "@/lib/react-query/queryKeys"
import { toast } from "sonner"

export interface DocumentToReclassify {
  id: string
  name: string
  kind: string
  mimeType?: string
  createdAt?: string
}

type DocumentEntityType = "intervention" | "artisan"

interface UseDocumentReclassificationProps {
  entityType: DocumentEntityType
  entityId: string
  enabled?: boolean
}

/**
 * Hook pour gérer la reclassification des documents
 * Filtre les documents `a_classe` et permet de changer leur kind
 */
export function useDocumentReclassification({
  entityType,
  entityId,
  enabled = true,
}: UseDocumentReclassificationProps) {
  const queryClient = useQueryClient()

  // Récupérer tous les documents de l'entité
  const { data: allDocuments = [], isLoading } = useQuery({
    queryKey: documentKeys.byEntity(entityType, entityId),
    queryFn: async () => {
      const response = await documentsApi.getAll({
        entity_type: entityType,
        entity_id: entityId,
      })
      return response?.data || []
    },
    enabled,
  })

  // Filtrer les documents à classer (kind === 'a_classe')
  const documentsToReclassify = allDocuments.filter(
    (doc: any) => doc.kind === "a_classe"
  )

  // Mutation pour reclassifier un document
  const reclassifyMutation = useMutation({
    mutationFn: async ({
      documentId,
      newKind,
    }: {
      documentId: string
      newKind: string
    }) => {
      return await documentsApi.update(documentId, { kind: newKind }, entityType)
    },
    onSuccess: (_, variables) => {
      // Invalider les queries pour cette entité
      queryClient.invalidateQueries({
        queryKey: documentKeys.byEntity(entityType, entityId),
      })

      toast.success(`Document reclassifié en "${variables.newKind}"`)
    },
    onError: (error: any) => {
      const message =
        error?.message ||
        "Erreur lors de la reclassification du document"
      toast.error(message)
    },
  })

  // Mutation pour reclassifier plusieurs documents en masse
  const batchReclassifyMutation = useMutation({
    mutationFn: async (
      updates: Array<{ documentId: string; newKind: string }>
    ) => {
      const results = await Promise.all(
        updates.map(({ documentId, newKind }) =>
          documentsApi.update(documentId, { kind: newKind }, entityType)
        )
      )
      return results
    },
    onSuccess: (_, updates) => {
      // Invalider les queries pour cette entité
      queryClient.invalidateQueries({
        queryKey: documentKeys.byEntity(entityType, entityId),
      })

      toast.success(
        `${updates.length} document(s) reclassifié(s) avec succès`
      )
    },
    onError: (error: any) => {
      const message =
        error?.message ||
        "Erreur lors de la reclassification en masse"
      toast.error(message)
    },
  })

  return {
    // Data
    allDocuments,
    documentsToReclassify,
    isLoading,

    // Mutations
    reclassify: reclassifyMutation.mutate,
    reclassifyAsync: reclassifyMutation.mutateAsync,
    batchReclassify: batchReclassifyMutation.mutate,
    batchReclassifyAsync: batchReclassifyMutation.mutateAsync,

    // Status
    isReclassifying: reclassifyMutation.isPending,
    isBatchReclassifying: batchReclassifyMutation.isPending,
    reclassifyError: reclassifyMutation.error,
    batchReclassifyError: batchReclassifyMutation.error,
  }
}
