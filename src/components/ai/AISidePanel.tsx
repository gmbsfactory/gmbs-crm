"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AIMarkdownContent } from "./AIMarkdownContent"
import { AIActionButton } from "./AIActionButton"
import { AIStatusFileUpload } from "./AIStatusFileUpload"
import type { AIActionState, AIActionType, AISuggestedAction } from "@/lib/ai/types"
import { ACTION_LABELS } from "@/lib/ai/prompts"
import { cn } from "@/lib/utils"

interface AISidePanelProps {
  state: AIActionState
  onClose: () => void
  onExecuteAction: (action: AISuggestedAction) => void
  onAction?: (action: AIActionType) => void
  interventionId?: string
}

/** Statuts qui necessitent un document avant transition */
const STATUS_DOCUMENT_MAP: Record<string, { kind: string; label: string }> = {
  'DEVIS_ENVOYE': { kind: 'devis', label: 'Deposer le devis' },
  'INTER_TERMINEE': { kind: 'facturesGMBS', label: 'Deposer la facture GMBS' },
}

function groupByPriority(actions: AISuggestedAction[]) {
  const high = actions.filter(a => a.priority === 'high')
  const medium = actions.filter(a => a.priority === 'medium')
  const low = actions.filter(a => a.priority === 'low')
  return { high, medium, low }
}

/**
 * Panneau lateral IA affiche a gauche du modal intervention (halfpage).
 * Sur ecrans < 1280px, rendu en Sheet (drawer) depuis le bas.
 */
export function AISidePanel({ state, onClose, onExecuteAction, onAction, interventionId }: AISidePanelProps) {
  const { isOpen, isLoading, result, error, currentAction, context } = state
  const [isWideScreen, setIsWideScreen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsWideScreen(window.innerWidth >= 1280)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!result?.result?.content) return
    try {
      await navigator.clipboard.writeText(result.result.content)
    } catch {
      // Fallback silencieux
    }
  }, [result])

  const suggestedActions = useMemo(
    () => result?.result?.suggested_actions ?? [],
    [result],
  )

  const grouped = useMemo(() => groupByPriority(suggestedActions), [suggestedActions])
  const actionLabel = currentAction ? ACTION_LABELS[currentAction] : 'Prochaines etapes'

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header — style modal-config-columns-header */}
      <div className="modal-config-columns-header">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <h2 className="modal-config-columns-title truncate">AI Assistant — {actionLabel}</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">Analyse en cours...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 my-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* AI text content */}
          {result?.result?.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <AIMarkdownContent content={result.result.content} />
            </div>
          )}

          {/* Suggested actions */}
          {suggestedActions.length > 0 && (
            <TooltipProvider>
              <div className="mt-6 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions recommandees
                </h3>

                {grouped.high.length > 0 && (
                  <div className="space-y-1.5">
                    {grouped.high.map(action => (
                      <React.Fragment key={action.id}>
                        <AIActionButton action={action} onExecute={onExecuteAction} />
                        {interventionId && action.payload.type === 'change_status' && STATUS_DOCUMENT_MAP[action.payload.target_status_code] && (
                          <AIStatusFileUpload
                            interventionId={interventionId}
                            documentKind={STATUS_DOCUMENT_MAP[action.payload.target_status_code].kind}
                            documentLabel={STATUS_DOCUMENT_MAP[action.payload.target_status_code].label}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {grouped.medium.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground mt-3">Autres actions</p>
                    {grouped.medium.map(action => (
                      <React.Fragment key={action.id}>
                        <AIActionButton action={action} onExecute={onExecuteAction} />
                        {interventionId && action.payload.type === 'change_status' && STATUS_DOCUMENT_MAP[action.payload.target_status_code] && (
                          <AIStatusFileUpload
                            interventionId={interventionId}
                            documentKind={STATUS_DOCUMENT_MAP[action.payload.target_status_code].kind}
                            documentLabel={STATUS_DOCUMENT_MAP[action.payload.target_status_code].label}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {grouped.low.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground mt-3">Complementaire</p>
                    {grouped.low.map(action => (
                      <React.Fragment key={action.id}>
                        <AIActionButton action={action} onExecute={onExecuteAction} />
                        {interventionId && action.payload.type === 'change_status' && STATUS_DOCUMENT_MAP[action.payload.target_status_code] && (
                          <AIStatusFileUpload
                            interventionId={interventionId}
                            documentKind={STATUS_DOCUMENT_MAP[action.payload.target_status_code].kind}
                            documentLabel={STATUS_DOCUMENT_MAP[action.payload.target_status_code].label}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {result?.result?.content && (
        <div className="flex items-center justify-between border-t px-5 py-3 bg-muted/30">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {result.cached && (
              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                cache
              </span>
            )}
            {result.confidence && (
              <span>Confiance : {Math.round(result.confidence * 100)}%</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {context?.availableActions
              .filter(a => a !== currentAction)
              .slice(0, 2)
              .map(action => (
                <button
                  key={action}
                  onClick={() => onAction?.(action)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            <button
              onClick={handleCopy}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              Copier
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // Wide screen: fixed side panel collé à gauche du halfpage (65%)
  if (isWideScreen) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed top-0 right-[65%] z-[69] h-full",
              "w-[35%] p-4",
            )}
          >
            <div className="shadcn-sheet-content flex flex-col h-full overflow-hidden">
              {panelContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Narrow screen: Sheet (drawer) from bottom
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>AI Assistant — {actionLabel}</SheetTitle>
        </SheetHeader>
        {panelContent}
      </SheetContent>
    </Sheet>
  )
}
