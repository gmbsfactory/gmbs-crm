"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Eye, EyeOff, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppUpdateSeverity } from "@/types/app-updates"
import { ALL_SEVERITIES, getSeverityConfig } from "./severity-config"
import { suggestNextVersion } from "./version-utils"
import { AudienceSelector } from "./AudienceSelector"

export interface UpdateFormData {
  version: string
  title: string
  content: string
  severity: AppUpdateSeverity
  audience: string[]
  target_user_ids: string[]
}

interface UpdateFormProps {
  initial: UpdateFormData
  latestVersion?: string | null
  onSubmit: (data: UpdateFormData) => void
  onSaveDraft: (data: UpdateFormData) => void
  onCancel: () => void
  onPreview?: (data: UpdateFormData) => void
  isSubmitting: boolean
  submitLabel?: string
}

const EMPTY_FORM: UpdateFormData = {
  version: "",
  title: "",
  content: "",
  severity: "info",
  audience: ["all"],
  target_user_ids: [],
}

export { EMPTY_FORM }

export function UpdateForm({
  initial,
  latestVersion,
  onSubmit,
  onSaveDraft,
  onCancel,
  onPreview,
  isSubmitting,
  submitLabel = "Publier",
}: UpdateFormProps) {
  const [form, setForm] = useState<UpdateFormData>(initial)
  const [showPreview, setShowPreview] = useState(false)

  const set = <K extends keyof UpdateFormData>(key: K, value: UpdateFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const suggested = suggestNextVersion(latestVersion)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Version */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Version</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={form.version}
            onChange={e => set("version", e.target.value)}
            placeholder="1.00"
            required
            className="w-28 rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {form.version !== suggested && (
            <button
              type="button"
              onClick={() => set("version", suggested)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Lightbulb className="h-3 w-3" />
              {suggested}
            </button>
          )}
        </div>
      </div>

      {/* Titre */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set("title", e.target.value)}
          placeholder="Titre de la mise à jour"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Severite */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Sévérité</label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SEVERITIES.map(sev => {
            const cfg = getSeverityConfig(sev)
            const Icon = cfg.icon
            const isActive = form.severity === sev
            return (
              <button
                key={sev}
                type="button"
                onClick={() => set("severity", sev)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? cn(cfg.color, "ring-1 ring-current/20")
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu Markdown */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Contenu (Markdown)</label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPreview ? "Éditeur" : "Aperçu"}
          </button>
        </div>
        {showPreview ? (
          <div className="rounded-md border bg-background px-4 py-3 min-h-[200px] prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content || "*Aucun contenu*"}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={form.content}
            onChange={e => set("content", e.target.value)}
            placeholder={"## Titre\n\n- Point 1\n- Point 2\n- **Point important**"}
            rows={8}
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        )}
      </div>

      {/* Audience */}
      <AudienceSelector
        audience={form.audience}
        targetUserIds={form.target_user_ids}
        onChange={(audience, targetUserIds) => {
          set("audience", audience)
          setForm(prev => ({ ...prev, target_user_ids: targetUserIds }))
        }}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(form)}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Aperçu modal
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSaveDraft(form)}
            disabled={isSubmitting || !form.version || !form.title || !form.content}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Brouillon
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !form.version || !form.title || !form.content}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Enregistrement..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
