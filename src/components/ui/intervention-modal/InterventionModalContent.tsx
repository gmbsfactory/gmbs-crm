"use client"

import React, { useCallback, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, X } from "lucide-react"
import { InterventionEditForm } from "@/components/interventions/InterventionEditForm"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ModalDisplayMode } from "@/types/modal-display"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModeIcons } from "@/components/ui/mode-selector"
import { interventionsApi } from "@/lib/api/v2"
import type { Intervention } from "@/lib/api/v2/common/types"
import { useInterventionReminders } from "@/hooks/useInterventionReminders"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { ReminderMentionInput } from "@/components/interventions/ReminderMentionInput"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

type NoteDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

const NoteDialogContent = React.forwardRef<HTMLDivElement, NoteDialogContentProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/20 pointer-events-none" />
      <AlertDialogPrimitive.Content ref={ref} className={className} {...props} />
    </AlertDialogPortal>
  ),
)

NoteDialogContent.displayName = "NoteDialogContent"

type Props = {
  interventionId: string
  mode: ModalDisplayMode
  onClose: () => void
  onNext?: () => void
  onPrevious?: () => void
  canNext?: boolean
  canPrevious?: boolean
  onCycleMode?: () => void
  activeIndex?: number
  totalCount?: number
}

export function InterventionModalContent({
  interventionId,
  mode,
  onClose,
  onNext,
  onPrevious,
  canNext,
  canPrevious,
  onCycleMode,
  activeIndex,
  totalCount,
}: Props) {
  const bodyPadding = mode === "fullpage" ? "px-8 py-6 md:px-12" : "px-5 py-4 md:px-8"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  // Reminder states
  const {
    reminders,
    saveReminder,
    toggleReminder,
    getReminderNote,
    getReminderDueDate,
    getReminderMentions,
    removeReminder,
  } = useInterventionReminders()
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteValue, setNoteValue] = useState("")
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [noteDialogCoords, setNoteDialogCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const noteDialogContentRef = useRef<HTMLDivElement | null>(null)
  const isReminderSaveDisabled = noteValue.trim().length === 0 && !dueDateValue

  // Récupérer les données de l'intervention
  const {
    data: intervention,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['intervention', interventionId],
    queryFn: () => interventionsApi.getById(interventionId),
    enabled: Boolean(interventionId),
  })

  const handleSuccess = useCallback(
    async (data: any) => {
      // 1. Mise à jour optimiste immédiate dans React Query pour le détail
      queryClient.setQueryData(['intervention', interventionId], data)

      // 2. Mise à jour optimiste dans toutes les listes qui contiennent cette intervention
      queryClient.setQueriesData(
        { queryKey: ['interventions'] },
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention: any) =>
            intervention.id === interventionId ? { ...intervention, ...data } : intervention
          )
          return { ...oldData, data: updatedData }
        }
      )

      // 3. Fermer le modal pour démarrer l'animation
      onClose()

      // 4. Attendre un court délai pour l'animation (300ms suffit)
      await new Promise(resolve => setTimeout(resolve, 300))

      // 5. Invalider les caches React Query en arrière-plan pour recharger les données à jour
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['intervention', interventionId] }),
        queryClient.invalidateQueries({ queryKey: ['interventions'] }),
      ])

      console.log("✅ Intervention mise à jour avec succès", data)
    },
    [queryClient, interventionId, onClose],
  )

  const handleSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
  }

  const handleReminderToggle = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      void toggleReminder(interventionId, intervention?.id_inter || undefined)
    },
    [intervention?.id_inter, interventionId, toggleReminder],
  )

  const handleReminderContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const existingNote = getReminderNote(interventionId) ?? ""
      const existingDueDate = getReminderDueDate(interventionId)
      const existingMentions = getReminderMentions(interventionId)
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const DIALOG_WIDTH = 448
      const DIALOG_HEIGHT = 360
      const GAP = 8

      let left = rect.left - DIALOG_WIDTH - GAP
      if (left < 16) {
        left = rect.right + GAP
      }

      let top = rect.top
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
      if (top + DIALOG_HEIGHT > viewportHeight - 16) {
        top = Math.max(16, viewportHeight - DIALOG_HEIGHT - 16)
      }

      setNoteValue(existingNote)
      setDueDateValue(existingDueDate ? new Date(existingDueDate) : null)
      setMentionIds(existingMentions)
      setNoteDialogCoords({ top, left })
      setShowNoteDialog(true)
    },
    [getReminderDueDate, getReminderMentions, getReminderNote, interventionId],
  )

  const handleNoteSave = useCallback(async () => {
    const cleaned = noteValue.trim()
    const dueDateIso = dueDateValue ? dueDateValue.toISOString() : null
    const hasContent = cleaned.length > 0 || dueDateIso

    if (hasContent) {
      await saveReminder({
        interventionId,
        idInter: intervention?.id_inter || undefined,
        note: cleaned.length > 0 ? cleaned : null,
        dueDate: dueDateIso,
        mentionedUserIds: mentionIds,
      })
    } else {
      await removeReminder(interventionId)
    }

    setShowNoteDialog(false)
    setNoteValue("")
    setDueDateValue(null)
    setMentionIds([])
  }, [dueDateValue, intervention?.id_inter, interventionId, mentionIds, noteValue, removeReminder, saveReminder])

  const handleNoteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowNoteDialog(false)
      setNoteValue("")
      setDueDateValue(null)
      setMentionIds([])
    } else {
      setShowNoteDialog(true)
    }
  }, [])

  return (
    <TooltipProvider>
      <div className={`modal-config-surface ${surfaceVariantClass} ${surfaceModeClass}`}>
        <header className="modal-config-columns-header relative">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={onClose}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "modal-config-columns-icon-button",
                    reminders.has(interventionId) && "text-red-500 hover:text-red-600"
                  )}
                  onClick={handleReminderToggle}
                  onContextMenu={handleReminderContextMenu}
                  aria-label={reminders.has(interventionId) ? "Retirer le rappel" : "Ajouter un rappel"}
                >
                  <Bell className={cn("h-4 w-4", reminders.has(interventionId) && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">
                {reminders.has(interventionId) ? "Retirer le rappel" : "Ajouter un rappel"} (Clic droit pour détails)
              </TooltipContent>
            </Tooltip>
            {onCycleMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button"
                    onClick={onCycleMode}
                    aria-label="Changer le mode d'affichage"
                  >
                    <ModeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Ajuster l&apos;affichage ({mode})
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="modal-config-columns-icon-placeholder" />
            )}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="modal-config-columns-title">
              Modifier l&apos;intervention
              {activeIndex !== undefined && totalCount !== undefined && totalCount > 1 && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({activeIndex + 1} / {totalCount})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {intervention?.updated_at && (
              <span className="text-xs text-muted-foreground">
                Mis à jour le {new Date(intervention.updated_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
        </header>

        <div className="modal-config-columns-body overflow-y-auto">
          <div className={bodyPadding}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-6 w-48 rounded bg-muted animate-pulse" />
                <div className="h-4 w-72 rounded bg-muted animate-pulse" />
                <div className="space-y-3">
                  <div className="h-10 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ) : error ? (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {(error as Error).message}
              </div>
            ) : intervention ? (
              <InterventionEditForm
                intervention={intervention}
                mode={mode}
                onSuccess={handleSuccess}
                onCancel={onClose}
                formRef={formRef}
                onSubmittingChange={setIsSubmitting}
              />
            ) : (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Intervention introuvable
              </div>
            )}
          </div>
        </div>

        <footer className="modal-config-columns-footer flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="legacy-form-button"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !intervention}
              className="legacy-form-button bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </footer>
      </div>

      <AlertDialog open={showNoteDialog} onOpenChange={handleNoteDialogOpenChange}>
        <NoteDialogContent
          ref={noteDialogContentRef}
          className={cn(
            "note-reminder-dialog fixed z-[110] w-[min(448px,calc(100vw-32px))] max-w-md rounded-lg border border-border bg-popover p-6 shadow-xl focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
          style={{
            top: noteDialogCoords.top,
            left: noteDialogCoords.left,
          }}
          onEscapeKeyDown={() => handleNoteDialogOpenChange(false)}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>
              {reminders.has(interventionId) ? "Modifier le rappel" : "Créer un rappel"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ajoutez une note et/ou définissez une date d&apos;échéance. Utilisez @ pour notifier un gestionnaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Note (optionnel)</span>
              <ReminderMentionInput
                value={noteValue}
                onChange={(value, mentions) => {
                  setNoteValue(value)
                  setMentionIds(mentions)
                }}
                placeholder="Exemple: @prenom.nom relancer le client..."
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Date d&apos;échéance (optionnel)</span>
              <DatePicker
                date={dueDateValue}
                onDateChange={setDueDateValue}
                placeholder="Sélectionner une date..."
                popoverContainer={noteDialogContentRef.current}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                handleNoteDialogOpenChange(false)
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleNoteSave()
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isReminderSaveDisabled}
            >
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </NoteDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
