"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type UnsavedChangesDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  onSaveAndConfirm: () => void
}

/**
 * Dialog d'alerte pour confirmer la fermeture du modal sans sauvegarder
 */
export function UnsavedChangesDialog({
  open,
  onCancel,
  onConfirm,
  onSaveAndConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>
            Vous êtes sur le point de quitter le modal avec des modifications non enregistrées.
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onSaveAndConfirm}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Enregistrer & Quitter
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Quitter sans enregistrer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
