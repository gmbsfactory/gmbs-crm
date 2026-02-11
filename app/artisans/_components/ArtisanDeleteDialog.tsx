"use client"

import React from "react"
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
import type { Contact } from "@/types/artisan-page"

interface ArtisanDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  onConfirm: () => void
  onCancel: () => void
}

export function ArtisanDeleteDialog({
  open,
  onOpenChange,
  contact,
  onConfirm,
  onCancel,
}: ArtisanDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onEscapeKeyDown={onCancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est destructive. Êtes-vous sûr de vouloir supprimer l&apos;artisan
            &quot;{contact?.name}&quot; ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
