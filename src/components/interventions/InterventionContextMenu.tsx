"use client"

import { useState, useCallback } from "react"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  FileText,
  ExternalLink,
  CheckCircle,
  Copy,
  UserCheck,
  Trash2,
} from "lucide-react"
import { useInterventionContextMenu, type AssignToMeAnimationCallback } from "@/hooks/useInterventionContextMenu"
import type { InterventionView } from "@/types/intervention-view"
import type { ContextMenuViewType } from "@/types/context-menu"
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
import { usePermissions } from "@/hooks/usePermissions"
import { useGenieEffectContext } from "@/contexts/GenieEffectContext"

interface InterventionContextMenuContentProps {
  intervention: InterventionView
  viewType?: ContextMenuViewType
  onOpen?: () => void
  onOpenInNewTab?: () => void
  /** Référence vers l'élément de la ligne (pour l'animation genie) */
  rowElement?: HTMLElement | null
}

export function InterventionContextMenuContent({
  intervention,
  viewType = "default",
  onOpen,
  onOpenInNewTab,
  rowElement,
}: InterventionContextMenuContentProps) {
  const { triggerAnimation } = useGenieEffectContext()
  
  // Fonction pour trouver l'élément de la ligne dans le DOM
  const findRowElement = useCallback(() => {
    // Essayer d'abord avec la prop rowElement
    if (rowElement) return rowElement
    
    // Sinon, chercher dans le DOM via data-intervention-id
    const selector = `tr[data-intervention-id="${intervention.id}"]`
    const element = document.querySelector(selector)
    return element as HTMLElement | null
  }, [intervention.id, rowElement])
  
  // Callback pour déclencher l'animation avant l'assignation
  const handleAssignWithAnimation = useCallback<AssignToMeAnimationCallback>(
    (interventionId, onAnimationComplete) => {
      const element = findRowElement()
      if (element && viewType === "market") {
        // Déclencher l'animation vers "mes-demandes"
        triggerAnimation(interventionId, element, "mes-demandes", onAnimationComplete)
      } else {
        // Pas de ligne disponible, exécuter directement
        onAnimationComplete()
      }
    },
    [findRowElement, viewType, triggerAnimation]
  )
  
  const {
    duplicateDevisSupp,
    assignToMe,
    transitionToAccepte,
    deleteIntervention,
    isLoading,
  } = useInterventionContextMenu(
    intervention.id,
    viewType,
    intervention.id_inter || undefined,
    viewType === "market" ? handleAssignWithAnimation : undefined
  )
  const { can } = usePermissions()

  const statusValue = intervention.statusValue || intervention.statut

  // État pour le dialogue de confirmation de suppression
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Conditions d'affichage pour les transitions
  const canTransitionToAccepte = statusValue === "DEVIS_ENVOYE"
  const showAssignToMe = viewType === "market"
  const canWriteInterventions = can("write_interventions")
  const canDeleteInterventions = can("delete_interventions")

  const handleOpen = () => {
    onOpen?.()
  }

  const handleOpenInNewTab = () => {
    onOpenInNewTab?.()
  }

  const handleDelete = () => {
    // Le ContextMenu se ferme automatiquement via onSelect
    // On attend que la fermeture soit complète avant d'ouvrir l'AlertDialog
    setTimeout(() => {
      setShowDeleteDialog(true)
    }, 100)
  }

  const handleConfirmDelete = () => {
    deleteIntervention()
    setShowDeleteDialog(false)
  }

  const handleCancelDelete = () => {
    setShowDeleteDialog(false)
  }

  return (
    <>
      <ContextMenuContent className="w-56">
        {/* Actions de base */}
        <ContextMenuItem onSelect={handleOpen} disabled={isLoading.duplicate || isLoading.assign}>
          <FileText className="mr-2 h-4 w-4" />
          Ouvrir
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleOpenInNewTab} disabled={isLoading.duplicate || isLoading.assign}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Ouvrir dans un nouvel onglet
        </ContextMenuItem>

        {/* Séparateur avant les actions conditionnelles */}
        {(canWriteInterventions && (canTransitionToAccepte ||
          showAssignToMe)) && <ContextMenuSeparator />}

        {/* Transition vers "Accepté" */}
        {canWriteInterventions && canTransitionToAccepte && (
          <ContextMenuItem
            onSelect={() => transitionToAccepte()}
            disabled={isLoading.transitionAccepte}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Passer à Accepté
          </ContextMenuItem>
        )}

        {/* Assignation "Je gère" (uniquement pour vue Market) */}
        {canWriteInterventions && showAssignToMe && (
          <ContextMenuItem
            onSelect={() => assignToMe()}
            disabled={isLoading.assign}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Je gère
          </ContextMenuItem>
        )}

        {/* Séparateur avant la duplication */}
        {canWriteInterventions && <ContextMenuSeparator />}

        {/* Duplication "Devis supp" */}
        {canWriteInterventions && (
          <ContextMenuItem
            onSelect={() => {
              duplicateDevisSupp()
            }}
            disabled={isLoading.duplicate}
          >
            <Copy className="mr-2 h-4 w-4" />
            Devis supp
          </ContextMenuItem>
        )}

        {/* Séparateur avant la suppression */}
        {canDeleteInterventions && <ContextMenuSeparator />}

        {/* Suppression */}
        {canDeleteInterventions && (
          <ContextMenuItem
            onSelect={handleDelete}
            disabled={isLoading.delete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </ContextMenuItem>
        )}
      </ContextMenuContent>

      {/* Dialogue de confirmation de suppression */}
      {canDeleteInterventions && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent onEscapeKeyDown={handleCancelDelete}>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est destructive. Êtes-vous sûr de vouloir supprimer l&apos;intervention ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

