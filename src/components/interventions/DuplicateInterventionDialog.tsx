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

type DuplicateIntervention = {
  id: string
  name: string
  address: string
  agencyId?: string | null
  agencyLabel?: string | null
  managerName?: string | null
}

type Props = {
  duplicates: DuplicateIntervention[]
  onConfirm: () => void
  onCancel: () => void
}

export function DuplicateInterventionDialog({ duplicates, onConfirm, onCancel }: Props) {
  const isOpen = duplicates.length > 0

  if (!isOpen) return null

  // Prendre le premier doublon pour le message
  const duplicate = duplicates[0]
  const address = duplicate.address || "cette adresse"
  const agency = duplicate.agencyLabel || "cette agence"
  const manager = duplicate.managerName || "un gestionnaire inconnu"

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Intervention similaire détectée</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Une intervention à l&apos;adresse <strong>{address}</strong> avec l&apos;agence{" "}
              <strong>{agency}</strong> existe déjà et est gérée par{" "}
              <strong>{manager}</strong>.
            </p>
            <p>Voulez-vous quand même créer cette intervention ?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
