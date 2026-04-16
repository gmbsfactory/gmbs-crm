"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { updatesApi } from "@/lib/api"
import { updateKeys } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useUpdateViewsRealtime } from "@/hooks/useUpdateViewsRealtime"
import type { AppUpdate, AppUpdateWithAcknowledgments } from "@/types/app-updates"
import type { Gestionnaire } from "@/hooks/useGestionnaires"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  FileText,
  ChevronDown,
  Megaphone,
} from "lucide-react"

import { getSeverityConfig } from "./_components/updates/severity-config"
import { suggestNextVersion } from "./_components/updates/version-utils"
import { UpdateForm, EMPTY_FORM } from "./_components/updates/UpdateForm"
import type { UpdateFormData } from "./_components/updates/UpdateForm"
import { UpdatesPreviewDialog } from "./_components/updates/UpdatesPreviewDialog"
import { AcknowledgmentBadges } from "./_components/updates/AcknowledgmentBadges"
import { AcknowledgmentDetail } from "./_components/updates/AcknowledgmentDetail"

// ===== ROW COMPONENT =====

function UpdateRow({
  update,
  gestionnaires,
  gestionnairesMap,
  onEdit,
  onDelete,
  onPublish,
}: {
  update: AppUpdateWithAcknowledgments
  gestionnaires: Gestionnaire[]
  gestionnairesMap: Map<string, Gestionnaire>
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const severity = getSeverityConfig(update.severity)
  const SeverityIcon = severity.icon
  const isDraft = update.status === "draft"
  const date = update.published_at
    ? new Date(update.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : update.created_at
    ? new Date(update.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : ""

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground font-mono shrink-0">
          v{update.version}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium shrink-0", severity.color)}>
          <SeverityIcon className="h-3 w-3" />
          {severity.label}
        </span>
        {isDraft ? (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
            Brouillon
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-xs font-medium shrink-0">
            Publié
          </span>
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1">{update.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{date}</span>

        {/* Acknowledgment badges (collapsed view) */}
        {!isDraft && update.views.length > 0 && (
          <AcknowledgmentBadges
            views={update.views}
            gestionnairesMap={gestionnairesMap}
          />
        )}

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t">
          {/* Markdown content */}
          <div className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
          </div>

          {/* Acknowledgment detail */}
          {!isDraft && (
            <div className="px-4 py-3 border-t bg-muted/20">
              <AcknowledgmentDetail
                views={update.views}
                gestionnaires={gestionnaires}
                gestionnairesMap={gestionnairesMap}
                audience={update.audience}
                targetUserIds={update.target_user_ids}
              />
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-2 border-t flex items-center gap-1 justify-end">
            {isDraft && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPublish() }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Publier
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== MAIN COMPONENT =====

export function UpdatesManager() {
  const { data: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()
  const { data: gestionnaires } = useGestionnaires()

  // Realtime subscription for views
  useUpdateViewsRealtime()

  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [editingUpdate, setEditingUpdate] = useState<AppUpdate | null>(null)
  const [previewData, setPreviewData] = useState<UpdateFormData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // O(1) lookup map for gestionnaires
  const gestionnairesMap = useMemo(() => {
    const map = new Map<string, Gestionnaire>()
    for (const g of gestionnaires || []) {
      map.set(g.id, g)
    }
    return map
  }, [gestionnaires])

  // Fetch all updates with views (admin query)
  const { data: updates, isLoading } = useQuery({
    queryKey: updateKeys.adminWithViews(),
    queryFn: () => updatesApi.getAllWithViews(),
    enabled: Boolean(currentUser?.id),
  })

  // Latest version for suggestion
  const latestVersion = useMemo(() => {
    if (!updates || updates.length === 0) return null
    return updates[0].version
  }, [updates])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: updateKeys.admin() })
    queryClient.invalidateQueries({ queryKey: updateKeys.all })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof updatesApi.create>[0]) => updatesApi.create(input),
    onSuccess: () => {
      invalidate()
      setMode("list")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<AppUpdate, "id" | "created_at">>) =>
      updatesApi.update(id, data),
    onSuccess: () => {
      invalidate()
      setMode("list")
      setEditingUpdate(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => updatesApi.remove(id),
    onSuccess: invalidate,
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => updatesApi.publish(id),
    onSuccess: invalidate,
  })

  const handleCreate = useCallback((data: UpdateFormData, status: "draft" | "published") => {
    createMutation.mutate({
      ...data,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_by: currentUser?.id || null,
    })
  }, [createMutation, currentUser?.id])

  const handleEdit = useCallback((data: UpdateFormData, status: "draft" | "published") => {
    if (!editingUpdate) return
    updateMutation.mutate({
      id: editingUpdate.id,
      ...data,
      status,
      published_at: status === "published" && !editingUpdate.published_at
        ? new Date().toISOString()
        : editingUpdate.published_at,
    })
  }, [editingUpdate, updateMutation])

  const handleDelete = useCallback((update: AppUpdate) => {
    if (!confirm(`Supprimer la mise à jour "${update.title}" ?`)) return
    deleteMutation.mutate(update.id)
  }, [deleteMutation])

  const handlePreview = useCallback((data: UpdateFormData) => {
    setPreviewData(data)
    setPreviewOpen(true)
  }, [])

  // Mode creation
  if (mode === "create") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Nouvelle mise à jour</h2>
            <p className="text-sm text-muted-foreground">Rédigez et publiez une note de version.</p>
          </div>
        </div>
        <UpdateForm
          initial={{ ...EMPTY_FORM, version: suggestNextVersion(latestVersion) }}
          latestVersion={latestVersion}
          onSubmit={(data) => handleCreate(data, "published")}
          onSaveDraft={(data) => handleCreate(data, "draft")}
          onCancel={() => setMode("list")}
          onPreview={handlePreview}
          isSubmitting={createMutation.isPending}
        />
        <UpdatesPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          formData={previewData}
        />
      </div>
    )
  }

  // Mode edition
  if (mode === "edit" && editingUpdate) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Pencil className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Modifier la mise à jour</h2>
            <p className="text-sm text-muted-foreground">v{editingUpdate.version} — {editingUpdate.title}</p>
          </div>
        </div>
        <UpdateForm
          initial={{
            version: editingUpdate.version,
            title: editingUpdate.title,
            content: editingUpdate.content,
            severity: editingUpdate.severity,
            audience: editingUpdate.audience,
            target_user_ids: editingUpdate.target_user_ids,
          }}
          latestVersion={latestVersion}
          onSubmit={(data) => handleEdit(data, "published")}
          onSaveDraft={(data) => handleEdit(data, "draft")}
          onCancel={() => { setMode("list"); setEditingUpdate(null) }}
          onPreview={handlePreview}
          isSubmitting={updateMutation.isPending}
          submitLabel={editingUpdate.status === "draft" ? "Publier" : "Mettre à jour"}
        />
        <UpdatesPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          formData={previewData}
        />
      </div>
    )
  }

  // Mode liste
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Mises à jour de l&apos;application</h2>
            <p className="text-sm text-muted-foreground">
              Gérez les notes de mise à jour affichées aux utilisateurs.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMode("create")}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : !updates || updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune mise à jour pour le moment.</p>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Créer la première mise à jour
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {updates.map(update => (
            <UpdateRow
              key={update.id}
              update={update}
              gestionnaires={gestionnaires || []}
              gestionnairesMap={gestionnairesMap}
              onEdit={() => { setEditingUpdate(update); setMode("edit") }}
              onDelete={() => handleDelete(update)}
              onPublish={() => publishMutation.mutate(update.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
