"use client"

import {
  AlertDialog,
  AlertDialogAction,
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
}

/**
 * Dialog d'alerte pour confirmer la fermeture du modal sans sauvegarder
 */
export function UnsavedChangesDialog({
  open,
  onCancel,
  onConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>
            Vous allez quitter le modal, sans enregistrer vos modifications. Êtes-vous sûr ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Non</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Oui</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
