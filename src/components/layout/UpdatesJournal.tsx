"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { GenericModal } from "@/components/ui/modal"
import { useUpdatesJournal } from "@/hooks/useUpdatesJournal"
import type { AppUpdateWithViewStatus } from "@/types/app-updates"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"

const severityBadge: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  important: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  breaking: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  feature: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  fix: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
}

function JournalEntry({
  update,
  isExpanded,
  onToggle,
}: {
  update: AppUpdateWithViewStatus
  isExpanded: boolean
  onToggle: () => void
}) {
  const date = update.published_at
    ? new Date(update.published_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
          v{update.version}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">{date}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0",
            severityBadge[update.severity] || severityBadge.info
          )}
        >
          {update.severity}
        </span>
        {!update.is_acknowledged && (
          <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shrink-0">
            Nouveau
          </span>
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {update.title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

interface UpdatesJournalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UpdatesJournal({ isOpen, onClose }: UpdatesJournalProps) {
  const { data: journal, isLoading } = useUpdatesJournal()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const handleToggle = React.useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }, [])

  return (
    <GenericModal isOpen={isOpen} onClose={onClose} mode="centerpage">
      <div className="w-full max-w-2xl mx-auto max-h-[80vh] flex flex-col bg-background rounded-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Journal des mises à jour
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Historique complet des modifications de l&apos;application.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : !journal || journal.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Aucune mise à jour pour le moment.
            </div>
          ) : (
            journal.map(update => (
              <JournalEntry
                key={update.id}
                update={update}
                isExpanded={expandedId === update.id}
                onToggle={() => handleToggle(update.id)}
              />
            ))
          )}
        </div>
      </div>
    </GenericModal>
  )
}
