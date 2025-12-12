"use client"

import React, { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModeIcons } from "@/components/ui/mode-selector"
import { NewInterventionForm } from "@/components/interventions/NewInterventionForm"
import { useModalState } from "@/hooks/useModalState"
import type { ModalDisplayMode } from "@/types/modal-display"
import { interventionKeys } from "@/lib/react-query/queryKeys"

type Props = {
  mode: ModalDisplayMode
  onClose: () => void
  onCycleMode?: () => void
}

export function NewInterventionModalContent({ mode, onClose, onCycleMode }: Props) {
  const queryClient = useQueryClient()
  const context = useModalState((state) => state.context)
  const defaultValues = context?.defaultValues as any
  
  // State pour les infos du header dynamique
  const [clientName, setClientName] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  
  const handleSuccess = useCallback(
    async (data: { id: string }) => {
      if (!data?.id) return
      
      // Invalider toutes les listes d'interventions pour recharger avec la nouvelle intervention
      await queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      await queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists() })
      
      // Fermer le modal
      onClose()
    },
    [queryClient, onClose],
  )

  const ModeIcon = ModeIcons[mode]
  const bodyPadding = mode === "fullpage" ? "px-4 py-4" : "px-4 py-3"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`

  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
                onClick={onClose}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
          </Tooltip>
        </header>
        
        <div className="modal-config-columns-body overflow-y-auto">
          <div className={bodyPadding}>
            <NewInterventionForm
              mode={mode}
              onSuccess={handleSuccess}
              onCancel={onClose}
              formRef={formRef}
              onSubmittingChange={setIsSubmitting}
              defaultValues={defaultValues}
              onClientNameChange={setClientName}
              onAgencyNameChange={setAgencyName}
              onClientPhoneChange={setClientPhone}
            />
          </div>
        </div>
        
        <footer className="modal-config-columns-footer flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="legacy-form-button"
            >
              Annuler
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
    </TooltipProvider>
  )
}

export default NewInterventionModalContent
