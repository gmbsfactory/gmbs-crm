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
 * grand dans un popover ancré sur l'œil. Pas de « copier le lien » / « exporter ».
 *
 * Cible le document directement par son URL quand elle est connue (cas normal,
 * issue de l'audit) ; sinon repli sur la récupération des pièces du dossier.
 */
export function DocPreviewContent({ target, onClose }: { target: DocPreviewTarget; onClose?: () => void }) {
  const needsFetch = !target.url
  const { data, isLoading } = useQuery({
    queryKey: ["dev-doc-preview", target?.entityType, target?.entityId],
    queryFn: async () => {
      const res =
        target.entityType === "intervention"
          ? await documentsApi.getByIntervention(target.entityId)
          : await documentsApi.getByArtisan(target.entityId)
      return (res?.data ?? []) as Array<{ url: string; filename: string | null; mime_type: string | null }>
    },
    enabled: needsFetch,
    staleTime: 60_000,
  })

  // Document à afficher : URL directe en priorité, sinon match dans les pièces du dossier.
  const doc = target.url
    ? { url: target.url, mime_type: target.mimeType ?? null, filename: target.filename }
    : (() => {
        const docs = data ?? []
        const matched = target.filename ? docs.find((d) => d.filename === target.filename) : undefined
        return matched ?? docs.find((d) => (d.mime_type ?? "").startsWith("image/")) ?? docs[0] ?? null
      })()

  return (
    <div
      className="relative flex h-[560px] w-[680px] max-h-[78vh] max-w-[min(86vw,680px)] flex-col overflow-hidden rounded border bg-background"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="flex shrink-0 items-start gap-2 px-3 pt-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-xs font-semibold">{doc?.filename ?? target.filename ?? "Document"}</h4>
          {target.entityLabel && <p className="truncate font-mono text-[10px] text-muted-foreground">{target.entityLabel}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 pb-2 pt-1">
        {needsFetch && isLoading ? (
          <Skeleton className="h-full w-full rounded border" />
        ) : doc ? (
          <DocumentPreview
            url={doc.url}
            mimeType={doc.mime_type}
            filename={doc.filename ?? undefined}
            className="flex h-full w-full items-stretch justify-center overflow-hidden rounded border bg-muted/40"
          />
        ) : (
          <p className="py-12 text-center text-sm italic text-muted-foreground">
            Aucune pièce jointe trouvée pour ce dossier.
          </p>
        )}
      </div>
    </div>
  )
}
