"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useUpdatesJournal } from "@/hooks/useUpdatesJournal"
import { useAcknowledgeUpdates } from "@/hooks/useAcknowledgeUpdates"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { getSeverityConfig } from "@/features/settings/_components/updates/severity-config"
import type { AppUpdateWithViewStatus } from "@/types/app-updates"
import type { AppUpdateSeverity } from "@/types/app-updates"
import { cn } from "@/lib/utils"
import { ChevronRight, X, ScrollText } from "lucide-react"

/* ── Dot accent couleur par severity ── */
const severityDot: Record<AppUpdateSeverity, string> = {
  info: "bg-blue-500",
  important: "bg-amber-500",
  breaking: "bg-red-500",
  feature: "bg-emerald-500",
  fix: "bg-violet-500",
}

/* ── Entrée individuelle ── */
function JournalEntry({
  update,
  isExpanded,
  onToggle,
}: {
  update: AppUpdateWithViewStatus
  isExpanded: boolean
  onToggle: () => void
}) {
  const severity = getSeverityConfig(update.severity as AppUpdateSeverity)
  const SeverityIcon = severity.icon
  const date = update.published_at
    ? new Date(update.published_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      })
    : ""

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-0 top-[18px] h-2.5 w-2.5 rounded-full ring-2 ring-background",
          severityDot[update.severity as AppUpdateSeverity] || severityDot.info,
          !update.is_acknowledged && "ring-primary/30"
        )}
      />

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full text-left rounded-lg px-3 py-2.5 transition-colors group",
          isExpanded
            ? "bg-muted/60"
            : "hover:bg-muted/40"
        )}
      >
        {/* Ligne 1 : version + date + badge nouveau */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono font-medium text-muted-foreground">
            v{update.version}
          </span>
          <span className="text-[11px] text-muted-foreground/70">{date}</span>
          {!update.is_acknowledged && (
            <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
              Nouveau
            </span>
          )}
        </div>

        {/* Ligne 2 : icône severity + titre + chevron */}
        <div className="flex items-center gap-2">
          <SeverityIcon className={cn("h-3.5 w-3.5 shrink-0", severity.color.split(" ").find(c => c.startsWith("text-")))} />
          <span className="text-sm font-medium text-foreground truncate flex-1 leading-tight">
            {update.title}
          </span>
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </div>
      </button>

      {/* Contenu expand */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-[13px] prose-headings:text-sm prose-headings:font-semibold prose-ul:my-1 prose-p:my-1.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Composant principal ── */
interface UpdatesJournalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UpdatesJournal({ isOpen, onClose }: UpdatesJournalProps) {
  const { data: journal, isLoading } = useUpdatesJournal()
  const { data: currentUser } = useCurrentUser()
  const acknowledgeMutation = useAcknowledgeUpdates()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)

  const acknowledgedInSessionRef = React.useRef(new Set<string>())

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Fermeture Escape
  React.useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  const handleToggle = React.useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id))

    if (!currentUser?.id) return
    const update = journal?.find(u => u.id === id)
    if (
      update &&
      !update.is_acknowledged &&
      !acknowledgedInSessionRef.current.has(id)
    ) {
      acknowledgedInSessionRef.current.add(id)
      acknowledgeMutation.mutate({
        userId: currentUser.id,
        updateIds: [id],
      })
    }
  }, [journal, currentUser?.id, acknowledgeMutation])

  const unseenCount = React.useMemo(
    () => journal?.filter(u => !u.is_acknowledged).length ?? 0,
    [journal]
  )

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="journal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/30"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            key="journal-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[71] h-full w-full max-w-[420px] bg-background border-l shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Journal des mises à jour"
          >
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                    <ScrollText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground leading-tight">
                      Journal des mises à jour
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {unseenCount > 0
                        ? `${unseenCount} non lue${unseenCount > 1 ? "s" : ""}`
                        : "Tout est à jour"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -mt-0.5"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Liste avec timeline */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  <span className="text-xs text-muted-foreground">Chargement…</span>
                </div>
              ) : !journal || journal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <ScrollText className="h-8 w-8 opacity-30" />
                  <span className="text-sm">Aucune mise à jour</span>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[4.5px] top-3 bottom-3 w-px bg-border" />

                  <div className="space-y-1">
                    {journal.map(update => (
                      <JournalEntry
                        key={update.id}
                        update={update}
                        isExpanded={expandedId === update.id}
                        onToggle={() => handleToggle(update.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
