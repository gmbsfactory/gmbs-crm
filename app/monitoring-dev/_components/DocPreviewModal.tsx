"use client"

import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { documentsApi } from "@/lib/api"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import { Skeleton } from "@/components/ui/skeleton"
import type { ActivityEntityType } from "@/types/monitoring"

export interface DocPreviewTarget {
  /** URL directe du document (issue de la ligne d'audit DOCUMENT_ADD : new_values.url). */
  url?: string | null
  mimeType?: string | null
  filename: string | null
  entityLabel: string | null
  /** Repli : si pas d'URL directe, on récupère les pièces du dossier. */
  entityType: ActivityEntityType
  entityId: string
}

/**
 * Aperçu d'une pièce jointe — réutilise le visualiseur `DocumentPreview` de la
 * section Documents du modal d'intervention (image / PDF / fichier), affiché en
 * grand et centré. Pas de « copier le lien » / « exporter » (juste l'aperçu).
 *
 * Cible le document directement par son URL quand elle est connue (cas normal,
 * issue de l'audit) ; sinon repli sur la récupération des pièces du dossier.
 */
export function DocPreviewModal({ target, onClose }: { target: DocPreviewTarget | null; onClose: () => void }) {
  const needsFetch = !!target && !target.url
  const { data, isLoading } = useQuery({
    queryKey: ["dev-doc-preview", target?.entityType, target?.entityId],
    queryFn: async () => {
      if (!target) return []
      const res =
        target.entityType === "intervention"
          ? await documentsApi.getByIntervention(target.entityId)
          : await documentsApi.getByArtisan(target.entityId)
      return (res?.data ?? []) as Array<{ url: string; filename: string | null; mime_type: string | null }>
    },
    enabled: needsFetch,
    staleTime: 60_000,
  })

  if (!target) return null

  // Document à afficher : URL directe en priorité, sinon match dans les pièces du dossier.
  const doc = target.url
    ? { url: target.url, mime_type: target.mimeType ?? null, filename: target.filename }
    : (() => {
        const docs = data ?? []
        const matched = target.filename ? docs.find((d) => d.filename === target.filename) : undefined
        return matched ?? docs.find((d) => (d.mime_type ?? "").startsWith("image/")) ?? docs[0] ?? null
      })()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-6" onClick={onClose}>
      <div
        className="flex max-h-[90%] w-[760px] max-w-[95%] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
            {doc?.filename ?? target.filename ?? "Document"}
          </span>
          {target.entityLabel && (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{target.entityLabel}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-muted/20 p-3">
          {needsFetch && isLoading ? (
            <Skeleton className="h-80 w-full rounded-lg" />
          ) : doc ? (
            <DocumentPreview url={doc.url} mimeType={doc.mime_type} filename={doc.filename ?? undefined} className="max-h-[80vh] w-full" />
          ) : (
            <p className="py-12 text-center text-sm italic text-muted-foreground">
              Aucune pièce jointe trouvée pour ce dossier.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
