"use client"

import { AlertTriangle, Loader2, Pencil, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type DeletedArtisanInfo = {
  id: string
  prenom: string | null
  nom: string | null
  email: string | null
  siret: string | null
  raison_sociale: string | null
}

type Props = {
  isOpen: boolean
  artisan: DeletedArtisanInfo | null
  deletedAt: string | null
  isSubmitting: boolean
  onClose: () => void
  onRestore: () => void
  onOverwrite: () => void
}

export function DeletedArtisanDialog({
  isOpen,
  artisan,
  deletedAt,
  isSubmitting,
  onClose,
  onRestore,
  onOverwrite,
}: Props) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md z-[200]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Artisan déjà existant
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Un artisan avec ces informations a déjà été supprimé
                {deletedAt && (
                  <span className="font-medium">
                    {" "}le {new Date(deletedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                )}
                .
              </p>

              {artisan && (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                  <p className="font-medium text-foreground">
                    {[artisan.prenom, artisan.nom].filter(Boolean).join(' ') || 'Sans nom'}
                  </p>
                  {artisan.raison_sociale && (
                    <p className="text-muted-foreground">{artisan.raison_sociale}</p>
                  )}
                  {artisan.email && (
                    <p className="text-xs text-muted-foreground">📧 {artisan.email}</p>
                  )}
                  {artisan.siret && (
                    <p className="text-xs text-muted-foreground">🏢 SIRET: {artisan.siret}</p>
                  )}
                </div>
              )}

              <p className="text-sm font-medium mt-2">Que souhaitez-vous faire ?</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-2">
                <li>• <strong>Restaurer</strong> : réactive l&apos;artisan avec ses données d&apos;origine</li>
                <li>• <strong>Écraser</strong> : réactive et remplace par les nouvelles données saisies</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="sm:order-1"
          >
            Annuler
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onRestore}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white sm:order-2"
          >
            {isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Restaurer
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onOverwrite}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white sm:order-3"
          >
            {isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
            )}
            Écraser avec nouvelles données
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
