"use client"

import { useRef } from "react"
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
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Gestion du focus initial : retirer le focus du modal parent
  const handleOpenAutoFocus = (e: Event) => {
    e.preventDefault()
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && activeElement !== document.body) {
      activeElement.blur()
    }
    setTimeout(() => {
      cancelRef.current?.focus()
    }, 0)
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent 
        onOpenAutoFocus={handleOpenAutoFocus}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>
            Vous êtes sur le point de quitter le modal avec des modifications non enregistrées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel ref={cancelRef} onClick={onCancel}>
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
