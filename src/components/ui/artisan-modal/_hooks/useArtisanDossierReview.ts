"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { documentsApi } from "@/lib/api"
import { artisanKeys, documentKeys } from "@/lib/react-query/queryKeys"
import type { AttachmentRecord } from "@/components/documents/types"
import { REQUIRED_DOCUMENT_KINDS } from "@/lib/artisans/dossierStatus"
import type { ReviewDecision } from "@/lib/artisans/document-review"

/**
 * Pièces du dossier d'un artisan, avec leur état de vérification.
 *
 * La clé de cache est **`documentKeys.byEntity('artisan', id)`** : c'est
 * exactement celle qu'invalide `usePortalLiveSync` à l'arrivée d'une pièce
 * déposée depuis le téléphone. Une clé à nous obligerait le gestionnaire à
 * recharger la page, ce que le critère de recette du lot interdit.
 */

/** Pièces vérifiables : les 5 requises + « autre ». La photo de profil n'en est pas une. */
export const DOSSIER_REVIEWABLE_KINDS: string[] = [...REQUIRED_DOCUMENT_KINDS, "autre"]

export interface DossierArtisanState {
  statutDossier: string | null
  piecesAVerifier: number
  dossierValidatedAt: string | null
}

interface ReviewPayload {
  decision: ReviewDecision
  comment?: string | null
  validUntil?: string | null
}

export function useArtisanDossierReview(artisanId: string, enabled: boolean = true) {
  const queryClient = useQueryClient()
  const [enCours, setEnCours] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: documentKeys.byEntity("artisan", artisanId),
    enabled: Boolean(artisanId) && enabled,
    queryFn: async () => {
      const response = await documentsApi.getAll({
        entity_type: "artisan",
        entity_id: artisanId,
        limit: 500,
      })
      return (response.data ?? []) as unknown as AttachmentRecord[]
    },
  })

  const pieces = useMemo(() => {
    const toutes = data ?? []
    return toutes
      .filter((piece) => DOSSIER_REVIEWABLE_KINDS.includes((piece.kind ?? "").toLowerCase().trim()))
      .sort((a, b) => {
        // Les pièces à vérifier remontent : c'est la file de travail.
        const aPending = a.review_status === "pending" ? 0 : 1
        const bPending = b.review_status === "pending" ? 0 : 1
        if (aPending !== bPending) return aPending - bPending
        return (b.created_at ?? "").localeCompare(a.created_at ?? "")
      })
  }, [data])

  const nbAVerifier = useMemo(
    () => pieces.filter((piece) => piece.review_status === "pending").length,
    [pieces],
  )

  /** Les 5 pièces requises sont-elles toutes validées ? (condition de « Valider le dossier ») */
  const dossierValidable = useMemo(() => {
    const validees = new Set(
      (data ?? [])
        .filter((piece) => piece.review_status !== "pending" && piece.review_status !== "rejected")
        .map((piece) => (piece.kind ?? "").toLowerCase().trim()),
    )
    return REQUIRED_DOCUMENT_KINDS.every((kind) => validees.has(kind))
  }, [data])

  /** Invalide tout ce que la décision fait bouger : liste, fiche, pièces. */
  const invalider = useCallback(() => {
    void refetch()
    queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId) })
    queryClient.invalidateQueries({ queryKey: artisanKeys.lists() })
  }, [refetch, queryClient, artisanId])

  const reviewPiece = useCallback(
    async (attachmentId: string, payload: ReviewPayload): Promise<DossierArtisanState | null> => {
      setEnCours(attachmentId)
      try {
        const response = await fetch(
          `/api/artisans/${artisanId}/documents/${attachmentId}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision: payload.decision,
              comment: payload.comment ?? null,
              valid_until: payload.validUntil ?? null,
            }),
          },
        )
        const json = (await response.json().catch(() => null)) as
          | { artisan?: { statut_dossier: string | null; pieces_a_verifier: number; dossier_validated_at: string | null }; error?: string }
          | null

        if (!response.ok) {
          toast.error(json?.error ?? "La vérification de la pièce a échoué")
          return null
        }

        toast.success(payload.decision === "approved" ? "Pièce validée" : "Pièce refusée")
        invalider()
        return json?.artisan
          ? {
              statutDossier: json.artisan.statut_dossier,
              piecesAVerifier: json.artisan.pieces_a_verifier,
              dossierValidatedAt: json.artisan.dossier_validated_at,
            }
          : null
      } catch (err) {
        console.error("[useArtisanDossierReview] Revue échouée :", err)
        toast.error("La vérification de la pièce a échoué")
        return null
      } finally {
        setEnCours(null)
      }
    },
    [artisanId, invalider],
  )

  const validerDossier = useCallback(async (): Promise<boolean> => {
    setEnCours("__dossier__")
    try {
      const response = await fetch(`/api/artisans/${artisanId}/dossier/validate`, { method: "POST" })
      const json = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        toast.error(json?.error ?? "La validation du dossier a échoué")
        return false
      }
      toast.success("Dossier validé")
      invalider()
      return true
    } catch (err) {
      console.error("[useArtisanDossierReview] Validation du dossier échouée :", err)
      toast.error("La validation du dossier a échoué")
      return false
    } finally {
      setEnCours(null)
    }
  }, [artisanId, invalider])

  return {
    pieces,
    nbAVerifier,
    dossierValidable,
    isLoading,
    error,
    enCours,
    reviewPiece,
    validerDossier,
  }
}
