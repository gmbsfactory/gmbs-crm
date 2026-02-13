"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"
import { usePermissions } from "@/hooks/usePermissions"

type Props = {
  mode: ModalDisplayMode
  onClose: () => void
  waitForExit: () => Promise<void>
  onCycleMode?: () => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
  onUnsavedChangesStateChange?: (hasChanges: boolean, isSubmitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onPopoverOpenChange?: (isOpen: boolean) => void
}

export function NewInterventionModalContent({
  mode,
  onClose,
  waitForExit,
  onCycleMode,
  onUnsavedDialogOpenChange,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
  onPopoverOpenChange,
}: Props) {
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
  const shouldCloseAfterSaveRef = useRef(false)
  const { can } = usePermissions()
  const canWriteInterventions = can("write_interventions")

  // Notifier le parent de l'ouverture du dialog
  useEffect(() => {
    onUnsavedDialogOpenChange?.(showUnsavedDialog)
  }, [showUnsavedDialog, onUnsavedDialogOpenChange])

  // Notifier le parent des changements d'état pour la gestion du clic sur backdrop et Échap
  useEffect(() => {
    onUnsavedChangesStateChange?.(hasUnsavedChanges, isSubmitting)
  }, [hasUnsavedChanges, isSubmitting, onUnsavedChangesStateChange])

  // Exposer la fonction pour afficher le dialog au parent
  useEffect(() => {
    const showDialog = () => {
      pendingCloseAction.current = () => {
        if (duplicateFromId) {
          modal.open(duplicateFromId, { content: "intervention" })
        } else {
          onClose()
        }
      }
      setShowUnsavedDialog(true)
    }
    onRegisterShowDialog?.(showDialog)
  }, [onClose, onRegisterShowDialog, duplicateFromId, modal])

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

  // Fonction pour enregistrer et fermer
  const handleSaveAndConfirm = useCallback(() => {
    shouldCloseAfterSaveRef.current = true

    // Soumettre le formulaire
    if (formRef.current) {
      // Vérifier la validation avant de soumettre
      const form = formRef.current
      if (!form.checkValidity()) {
        // Si la validation échoue, fermer le dialog après un court délai
        // pour éviter les effets visuels indésirables (zoom, popups)
        // Le délai permet au formulaire de se stabiliser avant la fermeture
        setTimeout(() => {
          setShowUnsavedDialog(false)
        }, 150)
        form.reportValidity()
        shouldCloseAfterSaveRef.current = false
        return
      }

      // Si la validation passe, fermer le dialog immédiatement et soumettre
      setShowUnsavedDialog(false)
      form.requestSubmit()
    }
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
    async (data: { id: string } | null) => {
      // Si on devait fermer après sauvegarde, s'assurer que le dialog est fermé
      if (shouldCloseAfterSaveRef.current) {
        setShowUnsavedDialog(false)
        shouldCloseAfterSaveRef.current = false
      }

      // Fermer le modal immédiatement (nouveau flow: fermeture avant appel API)
      onClose()

      // Invalider le cache seulement si on a des données réelles
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: interventionKeys.invalidateLists(),
          refetchType: 'active',
        })
        queryClient.invalidateQueries({
          queryKey: interventionKeys.invalidateLightLists(),
          refetchType: 'active',
        })

        await waitForExit()
        queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists(), refetchType: 'inactive' })
        queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists(), refetchType: 'inactive' })
      }
    },
    [queryClient, onClose, waitForExit],
  )

  const ModeIcon = ModeIcons[mode]
  const bodyPadding = mode === "fullpage" ? "px-4 py-4" : "px-4 py-3"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`

  const formRef = useRef<HTMLFormElement>(null)

  // Raccourci clavier Cmd/Ctrl+Enter pour enregistrer
  const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting })

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
            {canWriteInterventions ? (
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
                onPopoverOpenChange={onPopoverOpenChange}
              />
            ) : (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Vous n&apos;avez pas la permission de créer une intervention.
              </div>
            )}
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
              disabled={isSubmitting || !canWriteInterventions}
              className="legacy-form-button bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? "Création..." : (
                <>
                  Créer l&apos;intervention
                  <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-accent-foreground/30 bg-accent-foreground/10 px-1.5 font-mono text-[10px] font-medium text-accent-foreground/70">
                    {shortcutHint}
                  </kbd>
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onCancel={handleCancelClose}
        onConfirm={handleConfirmClose}
        onSaveAndConfirm={handleSaveAndConfirm}
      />
    </TooltipProvider>
  )
}

export default NewInterventionModalContent
