"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useUnseenUpdates } from "@/hooks/useUnseenUpdates"
import { useAcknowledgeUpdates } from "@/hooks/useAcknowledgeUpdates"
import { useUpdatesRealtime } from "@/hooks/useUpdatesRealtime"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import type { AppUpdateWithViewStatus } from "@/types/app-updates"
import { cn } from "@/lib/utils"

const severityBadge: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  important: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  breaking: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  feature: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  fix: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
}

export function UpdateEntry({ update }: { update: AppUpdateWithViewStatus }) {
  return (
    <div className="pb-6 last:pb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          v{update.version}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
            severityBadge[update.severity] || severityBadge.info
          )}
        >
          {update.severity}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{update.title}</h3>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
      </div>
    </div>
  )
}

const PUBLIC_PATHS = ["/login", "/landingpage", "/set-password", "/auth/callback"]

export default function UpdatesModal() {
  const pathname = usePathname()
  const isPublicPage = PUBLIC_PATHS.some(p => pathname?.startsWith(p))

  // Realtime subscription — invalide unseen + journal pour la pastille/badge
  useUpdatesRealtime()

  const { data: currentUser } = useCurrentUser({ enabled: !isPublicPage })
  const { data: unseenUpdates, isLoading } = useUnseenUpdates()
  const acknowledgeMutation = useAcknowledgeUpdates()

  // --- Modal uniquement au login (snapshot initial) ---
  const sessionCheckedRef = React.useRef(false)
  const [showModal, setShowModal] = React.useState(false)
  const [loginUpdates, setLoginUpdates] = React.useState<AppUpdateWithViewStatus[] | null>(null)

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Capturer les unseen updates au premier chargement (login/reconnexion)
  // Les updates arrivant via realtime en cours de session ne déclenchent PAS le modal
  React.useEffect(() => {
    if (sessionCheckedRef.current) return
    if (isLoading || !unseenUpdates) return

    sessionCheckedRef.current = true
    if (unseenUpdates.length > 0) {
      setLoginUpdates(unseenUpdates)
      setShowModal(true)
    }
  }, [isLoading, unseenUpdates])

  // Vérifier si le contenu ne dépasse pas (bouton immédiatement actif)
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight) {
      setHasScrolledToBottom(true)
    }
  }, [loginUpdates])

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setHasScrolledToBottom(true)
    }
  }, [])

  const handleAcknowledge = React.useCallback(() => {
    if (!currentUser?.id || !loginUpdates?.length) return
    acknowledgeMutation.mutate(
      {
        userId: currentUser.id,
        updateIds: loginUpdates.map(u => u.id),
      },
      {
        onSuccess: () => setShowModal(false),
      }
    )
  }, [currentUser?.id, loginUpdates, acknowledgeMutation])

  // Ne rien rendre sur les pages publiques, ou si le modal ne doit pas s'afficher
  if (isPublicPage || !mounted || !showModal || !loginUpdates || !currentUser) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-foreground">
            Mises à jour de l&apos;application
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Veuillez prendre connaissance des dernières modifications apportées au CRM.
          </p>
        </div>

        {/* Contenu scrollable */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
        >
          {loginUpdates.map((update, idx) => (
            <React.Fragment key={update.id}>
              <UpdateEntry update={update} />
              {idx < loginUpdates.length - 1 && (
                <hr className="my-4 border-border" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!hasScrolledToBottom || acknowledgeMutation.isPending}
            onClick={handleAcknowledge}
            className={cn(
              "w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              hasScrolledToBottom
                ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {acknowledgeMutation.isPending
              ? "Enregistrement..."
              : "J'ai pris connaissance des modifications"}
          </button>
          {!hasScrolledToBottom && (
            <p className="text-xs text-muted-foreground">
              Veuillez défiler jusqu&apos;en bas pour activer le bouton.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
