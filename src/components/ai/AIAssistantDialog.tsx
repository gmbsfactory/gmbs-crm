"use client"

import React, { useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ACTION_LABELS } from "@/lib/ai/prompts"
import type { AIActionState, AIActionType } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

interface AIAssistantDialogProps {
  state: AIActionState
  onClose: () => void
  onAction?: (action: AIActionType) => void
}

/**
 * Dialog leger affichant le resultat d'une action IA contextuelle.
 * Apparait au centre de l'ecran avec le resultat formate en markdown.
 */
export function AIAssistantDialog({ state, onClose, onAction }: AIAssistantDialogProps) {
  const { isOpen, isLoading, result, error, currentAction, context } = state

  const handleCopy = useCallback(async () => {
    if (!result?.result?.content) return
    try {
      await navigator.clipboard.writeText(result.result.content)
    } catch {
      // Fallback: select text
    }
  }, [result])

  const actionLabel = currentAction ? ACTION_LABELS[currentAction] : 'Assistant IA'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col z-[100]",
          "bg-background border border-border shadow-lg rounded-lg p-0"
        )}
        overlayClassName="z-[99]"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-lg" role="img" aria-label="AI">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-foreground opacity-70"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg>
            </span>
            AI Assistant — {actionLabel}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {context?.page ? `Page : ${context.page.replace(/_/g, ' ')}` : ''}
            {context?.entityId ? ` | ${context.entityType} : ${context.entityId.slice(0, 8)}...` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">Analyse en cours...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 my-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {result?.result?.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none py-2">
              <AIMarkdownContent content={result.result.content} />
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        {result?.result?.content && (
          <div className="flex items-center justify-between border-t px-6 py-3 bg-muted/30">
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
              {/* Available actions as small buttons */}
              {context?.availableActions
                .filter((a) => a !== currentAction)
                .slice(0, 3)
                .map((action) => (
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
      </DialogContent>
    </Dialog>
  )
}

/**
 * Composant de rendu markdown simplifie pour les reponses IA.
 * Utilise un parsing leger sans dependance externe supplementaire.
 */
function AIMarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactElement[] = []
  let listItems: string[] = []
  let orderedListItems: string[] = []
  let listKey = 0

  const flushUnorderedList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc pl-4 space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{item}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const flushOrderedList = () => {
    if (orderedListItems.length > 0) {
      elements.push(
        <ol key={`ol-${listKey++}`} className="list-decimal pl-4 space-y-1 my-2">
          {orderedListItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{item}</li>
          ))}
        </ol>
      )
      orderedListItems = []
    }
  }

  for (const line of lines) {
    // H2
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      flushUnorderedList()
      flushOrderedList()
      elements.push(
        <h3 key={`h-${listKey++}`} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">
          {h2Match[1]}
        </h3>
      )
      continue
    }

    // H3
    const h3Match = line.match(/^###\s+(.+)/)
    if (h3Match) {
      flushUnorderedList()
      flushOrderedList()
      elements.push(
        <h4 key={`h3-${listKey++}`} className="text-sm font-medium mt-3 mb-1 text-foreground">
          {h3Match[1]}
        </h4>
      )
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      flushOrderedList()
      listItems.push(ulMatch[1])
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      flushUnorderedList()
      orderedListItems.push(olMatch[1])
      continue
    }

    // Bold text inline
    const trimmed = line.trim()
    if (trimmed === '') {
      flushUnorderedList()
      flushOrderedList()
      continue
    }

    // Regular paragraph
    flushUnorderedList()
    flushOrderedList()
    elements.push(
      <p key={`p-${listKey++}`} className="text-sm leading-relaxed my-1">
        {formatInlineMarkdown(trimmed)}
      </p>
    )
  }

  flushUnorderedList()
  flushOrderedList()

  return <>{elements}</>
}

/**
 * Format inline markdown: **bold**, *italic*, `code`
 */
function formatInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Code
    const codeMatch = remaining.match(/`(.+?)`/)

    const match = [boldMatch, codeMatch]
      .filter(Boolean)
      .sort((a, b) => (a!.index ?? 0) - (b!.index ?? 0))[0]

    if (!match || match.index === undefined) {
      parts.push(remaining)
      break
    }

    // Text before match
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index))
    }

    if (match === boldMatch) {
      parts.push(<strong key={key++}>{match[1]}</strong>)
    } else if (match === codeMatch) {
      parts.push(
        <code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs">{match[1]}</code>
      )
    }

    remaining = remaining.slice(match.index + match[0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}
