"use client"

import { useMemo } from "react"
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertCircle, CheckCircle2, Loader2, Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEmailLogs, type EmailLog } from "@/hooks/useEmailLogs"

interface EmailHistoryPanelProps {
  interventionId: string
  isOpen: boolean
  onClose: () => void
}

function formatSentAt(dateStr: string): { full: string; relative: string } {
  const date = parseISO(dateStr)
  if (!isValid(date)) return { full: dateStr, relative: dateStr }
  return {
    full: format(date, "dd/MM/yyyy HH:mm", { locale: fr }),
    relative: formatDistanceToNow(date, { addSuffix: true, locale: fr }),
  }
}

function getSenderDisplayName(log: EmailLog): string {
  const parts = [log.sender_firstname, log.sender_lastname].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : "Utilisateur inconnu"
}

function EmailLogEntry({ log }: { log: EmailLog }) {
  const isSent = log.status === "sent"
  const { full, relative } = formatSentAt(log.sent_at)

  return (
    <div className="flex gap-3 py-3 px-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isSent ? (
          <div className="rounded-full bg-green-100 p-1.5 dark:bg-green-900/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          </div>
        ) : (
          <div className="rounded-full bg-red-100 p-1.5 dark:bg-red-900/30">
            <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Top row: type badge + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-medium uppercase"
          >
            {log.email_type === "devis" ? "Devis" : "Intervention"}
          </Badge>
          <Badge
            variant={isSent ? "default" : "destructive"}
            className="text-[10px] px-1.5 py-0 h-4 font-medium"
          >
            {isSent ? "Envoyé" : "Échoué"}
          </Badge>
        </div>

        {/* Recipient */}
        <p className="text-sm text-foreground truncate" title={log.recipient_email}>
          {log.recipient_email}
        </p>

        {/* Subject */}
        <p className="text-xs text-muted-foreground truncate" title={log.subject}>
          {log.subject}
        </p>

        {/* Date + sender */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{relative}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{full}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-muted-foreground/50">·</span>
          <span className="truncate">{getSenderDisplayName(log)}</span>
        </div>

        {/* Error message if failed */}
        {!isSent && log.error_message && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-red-600 dark:text-red-400 truncate cursor-default">
                  {log.error_message}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {log.error_message}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

export function EmailHistoryPanel({ interventionId, isOpen, onClose }: EmailHistoryPanelProps) {
  const { data: logs, isLoading, error } = useEmailLogs(interventionId, { enabled: isOpen })

  const sortedLogs = useMemo(() => logs ?? [], [logs])

  const sentCount = useMemo(() => sortedLogs.filter((l) => l.status === "sent").length, [sortedLogs])
  const failedCount = useMemo(() => sortedLogs.filter((l) => l.status === "failed").length, [sortedLogs])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName="!z-[110]"
        className="!z-[120] flex h-full w-[400px] max-w-[94vw] flex-col p-0 sm:w-[440px] sm:max-w-[480px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold">Historique des emails</SheetTitle>
              <p className="text-xs text-muted-foreground">
                {sortedLogs.length > 0
                  ? `${sortedLogs.length} email${sortedLogs.length > 1 ? "s" : ""}`
                  : "Aucun email envoyé"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats bar */}
        {sortedLogs.length > 0 && (
          <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
            {sentCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {sentCount} envoyé{sentCount > 1 ? "s" : ""}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-600" />
                {failedCount} échoué{failedCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : error ? (
              <div className="mx-4 my-6 rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {(error as Error).message}
              </div>
            ) : sortedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="rounded-full bg-muted p-3">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Aucun email</p>
                <p className="text-xs text-muted-foreground">
                  Les emails envoyés depuis cette intervention apparaîtront ici
                </p>
              </div>
            ) : (
              sortedLogs.map((log) => <EmailLogEntry key={log.id} log={log} />)
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
