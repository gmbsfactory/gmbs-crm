"use client"

import { useRef } from "react"
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

type DuplicateIntervention = {
  id: string
  name: string
  address: string
  agencyId?: string | null
  agencyLabel?: string | null
  managerName?: string | null
  createdAt?: string | null
}

type Props = {
  duplicates: DuplicateIntervention[]
  onConfirm: () => void
  onCancel: () => void
}

export function DuplicateInterventionDialog({ duplicates, onConfirm, onCancel }: Props) {
  const isOpen = duplicates.length > 0
  // Ref pour tracker si l'utilisateur a cliqué sur Confirmer
  const hasConfirmedRef = useRef(false)

  if (!isOpen) {
    // Réinitialiser le ref quand la popup se ferme
    hasConfirmedRef.current = false
    return null
  }

  // Prendre le premier doublon pour le message
  const duplicate = duplicates[0]
  const address = duplicate.address || "cette adresse"
  const agency = duplicate.agencyLabel || "cette agence"
  const manager = duplicate.managerName || "un gestionnaire inconnu"

  // Formater la date de création en français
  const createdDate = duplicate.createdAt
    ? new Date(duplicate.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null

  const handleConfirm = () => {
    hasConfirmedRef.current = true
    onConfirm()
  }

  const handleOpenChange = (open: boolean) => {
    // Ne pas appeler onCancel si l'utilisateur a cliqué sur Confirmer
    // Cela évite que onCancel() soit appelé après onConfirm() quand
    // AlertDialogAction ferme automatiquement la dialog
    if (!open && !hasConfirmedRef.current) {
      onCancel()
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Intervention similaire détectée</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription className="space-y-2">
            <p>
              Une intervention à l&apos;adresse <strong>{address}</strong> avec l&apos;agence{" "}
              <strong>{agency}</strong> existe déjà et est gérée par{" "}
              <strong>{manager}</strong>
              {createdDate && (
                <>
                  {" "}(créée le <strong>{createdDate}</strong>)
                </>
              )}
              .
            </p>
            <p>Voulez-vous quand même créer cette intervention ?</p>
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirmer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
