"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import InterventionForm from "@/components/interventions/InterventionForm"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function NewInterventionPage() {
  const router = useRouter()

  const handleClose = useCallback(() => {
    router.push("/interventions")
  }, [router])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  return (
    <TooltipProvider>
      <div className="modal-overlay z-50 flex items-center justify-center p-4" onClick={handleClose}>
        <div 
          className="modal-config-surface modal-config-surface-full h-[90vh] w-[90vw] max-w-6xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-config-columns-header">
            <div className="flex items-center gap-3">
              <span className="modal-config-columns-icon-placeholder" />
            </div>
            <div className="modal-config-columns-title">Créer une intervention</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={handleClose}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
            </Tooltip>
          </header>
          
          <div className="modal-config-columns-body px-8 py-6 md:px-12">
            <InterventionForm
              mode="create"
              onSuccess={(data: any) => {
                router.push(`/interventions/${data.id}`)
              }}
            />
          </div>
          
          <footer className="modal-config-columns-footer">
            <div className="text-xs text-muted-foreground">
              TODO: ajouter la prévisualisation du devis Invoice2go et un résumé des coûts une fois l&apos;API disponible.
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  )
}
