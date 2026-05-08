import React, { type RefObject } from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ReminderMentionInput } from "@/components/interventions/ReminderMentionInput"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

type DialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

/** Internal: AlertDialog content wrapper that renders into a non-dismissable portal overlay. */
const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogPrimitive.Overlay
        className="fixed inset-0 z-[55] bg-black/20"
        onClick={(e) => {
          // Don't dismiss the modal on overlay click — only buttons or Escape.
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      <AlertDialogPrimitive.Content ref={ref} className={className} {...props} />
    </AlertDialogPortal>
  ),
)
DialogContent.displayName = "ReminderNoteDialogContent"

export type ReminderNoteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentRef: RefObject<HTMLDivElement | null>
  coords: { top: number; left: number }
  /** True when the dialog is editing an already-existing reminder (changes title only). */
  isExistingReminder: boolean
  noteValue: string
  onNoteValueChange: (value: string, mentions: string[]) => void
  dueDateValue: Date | null
  onDueDateChange: (date: Date | null) => void
  isSaveDisabled: boolean
  onSave: () => void
}

export function ReminderNoteDialog({
  open,
  onOpenChange,
  contentRef,
  coords,
  isExistingReminder,
  noteValue,
  onNoteValueChange,
  dueDateValue,
  onDueDateChange,
  isSaveDisabled,
  onSave,
}: ReminderNoteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "note-reminder-dialog fixed z-[60] w-[min(448px,calc(100vw-32px))] max-w-md rounded-lg border border-border bg-popover p-6 shadow-xl focus:outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        )}
        style={{ top: coords.top, left: coords.left }}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>
            {isExistingReminder ? "Modifier le rappel" : "Créer un rappel"}
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
              onChange={onNoteValueChange}
              placeholder="Exemple: @prenom.nom relancer le client..."
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Date d&apos;échéance (optionnel)</span>
            <DatePicker
              date={dueDateValue}
              onDateChange={onDueDateChange}
              placeholder="Sélectionner une date..."
              popoverContainer={contentRef.current}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSaveDisabled}
          >
            Enregistrer
          </AlertDialogAction>
        </AlertDialogFooter>
      </DialogContent>
    </AlertDialog>
  )
}
