"use client"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  FileText,
  ExternalLink,
  ArrowRight,
  CheckCircle,
  Copy,
  UserCheck,
  Trash2,
} from "lucide-react"
import { useInterventionContextMenu } from "@/hooks/useInterventionContextMenu"
import type { InterventionView } from "@/types/intervention-view"
import type { ContextMenuViewType } from "@/types/context-menu"

interface InterventionContextMenuContentProps {
  intervention: InterventionView
  viewType?: ContextMenuViewType
  onOpen?: () => void
  onOpenInNewTab?: () => void
}

export function InterventionContextMenuContent({
  intervention,
  viewType = "default",
  onOpen,
  onOpenInNewTab,
}: InterventionContextMenuContentProps) {
  const {
    duplicateDevisSupp,
    assignToMe,
    transitionToDevisEnvoye,
    transitionToAccepte,
    deleteIntervention,
    isLoading,
  } = useInterventionContextMenu(intervention.id, viewType, intervention.id_inter || undefined)

  const statusValue = intervention.statusValue || intervention.statut
  const idInter = intervention.id_inter

  // Conditions d'affichage pour les transitions
  const canTransitionToDevisEnvoye =
    statusValue === "DEMANDE" && idInter && idInter.trim() !== ""
  const canTransitionToAccepte = statusValue === "DEVIS_ENVOYE"
  const showAssignToMe = viewType === "market"

  const handleOpen = () => {
    onOpen?.()
  }

  const handleOpenInNewTab = () => {
    onOpenInNewTab?.()
  }

  const handleDelete = () => {
    const confirmed = window.confirm(
      "Cette action est destructive. Êtes-vous sûr de vouloir supprimer l'intervention ?"
    )
    if (confirmed) {
      deleteIntervention()
    }
  }

  return (
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
      {(canTransitionToDevisEnvoye ||
        canTransitionToAccepte ||
        showAssignToMe) && <ContextMenuSeparator />}

      {/* Transition vers "Devis envoyé" */}
      {canTransitionToDevisEnvoye && (
        <ContextMenuItem
          onSelect={() => transitionToDevisEnvoye()}
          disabled={isLoading.transitionDevisEnvoye}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Passer à Devis envoyé
        </ContextMenuItem>
      )}

      {/* Transition vers "Accepté" */}
      {canTransitionToAccepte && (
        <ContextMenuItem
          onSelect={() => transitionToAccepte()}
          disabled={isLoading.transitionAccepte}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Passer à Accepté
        </ContextMenuItem>
      )}

      {/* Assignation "Je gère" (uniquement pour vue Market) */}
      {showAssignToMe && (
        <ContextMenuItem
          onSelect={() => assignToMe()}
          disabled={isLoading.assign}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Je gère
        </ContextMenuItem>
      )}

      {/* Séparateur avant la duplication */}
      <ContextMenuSeparator />

      {/* Duplication "Devis supp" */}
      <ContextMenuItem
        onSelect={() => {
          console.log("[InterventionContextMenu] Clic sur 'Devis supp' pour intervention:", intervention.id)
          duplicateDevisSupp()
        }}
        disabled={isLoading.duplicate}
      >
        <Copy className="mr-2 h-4 w-4" />
        Devis supp
      </ContextMenuItem>

      {/* Séparateur avant la suppression */}
      <ContextMenuSeparator />

      {/* Suppression */}
      <ContextMenuItem
        onSelect={handleDelete}
        disabled={isLoading.delete}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Supprimer
      </ContextMenuItem>
    </ContextMenuContent>
  )
}



