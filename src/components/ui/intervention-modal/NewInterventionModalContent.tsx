"use client"

import React, { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModeIcons } from "@/components/ui/mode-selector"
import { NewInterventionForm } from "@/components/interventions/NewInterventionForm"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"
import { useModalState } from "@/hooks/useModalState"
import { useModal } from "@/hooks/useModal"
import type { ModalDisplayMode } from "@/types/modal-display"
import { interventionKeys } from "@/lib/react-query/queryKeys"

type Props = {
  mode: ModalDisplayMode
  onClose: () => void
  onCycleMode?: () => void
}

export function NewInterventionModalContent({ mode, onClose, onCycleMode }: Props) {
  const queryClient = useQueryClient()
  const modal = useModal()
  const context = useModalState((state) => state.context)
  const defaultValues = context?.defaultValues as any
  const duplicateFromId = context?.duplicateFrom as string | undefined

  // State pour les infos du header dynamique
  const [clientName, setClientName] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [clientPhone, setClientPhone] = useState("")

  // State pour la protection des modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fonction pour confirmer la fermeture après l'alerte
  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingCloseAction.current) {
      pendingCloseAction.current()
      pendingCloseAction.current = null
    }
  }, [])

  // Fonction pour annuler la fermeture
  const handleCancelClose = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingCloseAction.current = null
  }, [])

  // Fonction pour annuler/fermer le modal - retourne à l'intervention initiale si c'est un devis supp
  const handleCancel = useCallback(() => {
    // Si des modifications non sauvegardées existent et qu'on n'est pas en train de soumettre
    if (hasUnsavedChanges && !isSubmitting) {
      // Stocker l'action de fermeture pour l'exécuter après confirmation
      pendingCloseAction.current = () => {
        if (duplicateFromId) {
          modal.open(duplicateFromId, { content: "intervention" })
        } else {
          onClose()
        }
      }
      setShowUnsavedDialog(true)
      return
    }

    // Pas de modifications ou soumission en cours : fermer directement
    if (duplicateFromId) {
      modal.open(duplicateFromId, { content: "intervention" })
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, isSubmitting, duplicateFromId, modal, onClose])

  const handleSuccess = useCallback(
    async (data: { id: string }) => {
      if (!data?.id) return
      
      // Invalider toutes les listes d'interventions pour recharger avec la nouvelle intervention
      await queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      await queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists() })
      
      // Fermer le modal (pas de retour à l'intervention initiale lors de la création réussie)
      onClose()
    },
    [queryClient, onClose],
  )

  const ModeIcon = ModeIcons[mode]
  const bodyPadding = mode === "fullpage" ? "px-4 py-4" : "px-4 py-3"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`

  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
  }
  
  // Construire le titre dynamique
  const buildTitle = () => {
    const parts: string[] = []
    if (context?.duplicateFrom) {
      parts.push("Nouveau devis")
    } else {
      parts.push("Nouvelle intervention")
    }
    if (clientName) {
      parts.push(`— ${clientName}`)
    }
    if (agencyName) {
      parts.push(`(${agencyName})`)
    }
    return parts.join(" ")
  }
  
  // Construire le sous-titre avec le téléphone
  const buildSubtitle = () => {
    if (clientPhone) {
      return `📞 ${clientPhone}`
    }
    return null
  }

  return (
    <TooltipProvider>
      <div className={`modal-config-surface ${surfaceVariantClass} ${surfaceModeClass}`}>
        <header className="modal-config-columns-header">
          <div className="flex items-center gap-3">
            {onCycleMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button"
                    onClick={onCycleMode}
                    aria-label="Changer le mode d'affichage"
                  >
                    <ModeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Ajuster l&apos;affichage ({mode})
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="modal-config-columns-icon-placeholder" />
            )}
          </div>
          <div className="flex flex-col items-center">
            <div className="modal-config-columns-title">
              {buildTitle()}
            </div>
            {buildSubtitle() && (
              <div className="text-xs text-muted-foreground">
                {buildSubtitle()}
              </div>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="modal-config-columns-icon-button"
                onClick={handleCancel}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="modal-config-columns-tooltip">
              {duplicateFromId ? "Retour à l'intervention (Esc)" : "Fermer (Esc)"}
            </TooltipContent>
          </Tooltip>
        </header>
        
        <div className="modal-config-columns-body overflow-y-auto">
          <div className={bodyPadding}>
            <NewInterventionForm
              mode={mode}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              formRef={formRef}
              onSubmittingChange={setIsSubmitting}
              defaultValues={defaultValues}
              onClientNameChange={setClientName}
              onAgencyNameChange={setAgencyName}
              onClientPhoneChange={setClientPhone}
              onHasUnsavedChanges={setHasUnsavedChanges}
            />
          </div>
        </div>
        
        <footer className="modal-config-columns-footer flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel} 
              disabled={isSubmitting}
              className="legacy-form-button"
            >
              {duplicateFromId ? "Retour" : "Annuler"}
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="legacy-form-button bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? "Création..." : "Créer l'intervention"}
            </Button>
          </div>
        </footer>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onCancel={handleCancelClose}
        onConfirm={handleConfirmClose}
      />
    </TooltipProvider>
  )
}

export default NewInterventionModalContent
