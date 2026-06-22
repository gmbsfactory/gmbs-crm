"use client"

import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { documentsApi } from "@/lib/api"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import { Skeleton } from "@/components/ui/skeleton"
import type { ActivityEntityType } from "@/types/monitoring"

export interface DocPreviewTarget {
  entityType: ActivityEntityType
  entityId: string
  entityLabel: string | null
  filename: string | null
}

/**
 * Aperçu réel d'une pièce jointe : récupère les documents du dossier
 * (intervention/artisan) via documentsApi et réutilise le visualiseur
 * `DocumentPreview` du modal d'intervention. Aucune maquette.
 */
export function DocPreviewModal({ target, onClose }: { target: DocPreviewTarget | null; onClose: () => void }) {
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
    enabled: !!target,
    staleTime: 60_000,
  })

  if (!target) return null

  const docs = data ?? []
  const matched = target.filename ? docs.find((d) => d.filename === target.filename) : undefined
  const doc = matched ?? docs.find((d) => (d.mime_type ?? "").startsWith("image/")) ?? docs[0] ?? null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-8" onClick={onClose}>
      <div
        className="flex max-h-[88%] w-[600px] max-w-[94%] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
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
        <div className="flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-muted/20 p-3">
          {isLoading ? (
            <Skeleton className="h-72 w-full rounded-lg" />
          ) : doc ? (
            <DocumentPreview url={doc.url} mimeType={doc.mime_type} filename={doc.filename ?? undefined} className="max-h-[70vh] w-full" />
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
