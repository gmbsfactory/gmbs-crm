"use client"

import { useEffect, useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { StatusReasonType } from "@/lib/comments/statusReason"

interface StatusReasonModalProps {
  open: boolean
  type: StatusReasonType
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSubmitting?: boolean
}

const MODAL_COPY: Record<StatusReasonType, {
  title: string
  description: string
  label: string
  placeholder: string
  badge: string
}> = {
  archive: {
    title: "Motif d'archivage requis",
    description: "Merci d'expliquer pourquoi ce dossier est archivé. L'information sera visible dans l'historique.",
    label: "Motif d'archivage",
    placeholder: "Ex: Intervention clôturée, artisan inactif, doublon...",
    badge: "archivage",
  },
  done: {
    title: "Retour obligatoire",
    description: "Partagez brièvement comment s'est déroulée l'intervention afin d'en garder une trace.",
    label: "Comment s'est déroulée l'intervention ?",
    placeholder: "Ex: Intervention terminée sans réserve, SAV prévu, client satisfait...",
    badge: "terminé",
  },
}

export function StatusReasonModal({ open, type, onConfirm, onCancel, isSubmitting }: StatusReasonModalProps) {
  const [reason, setReason] = useState("")
  const wasOpenRef = useRef(false)
  const cleanupTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setReason("")
      // Laisser Radix gérer le démontage ; éviter toute manipulation manuelle du DOM
      if (wasOpenRef.current) {
        const timeoutId = window.setTimeout(() => {
          // Sécurité : réactiver le body si un style est resté coincé
          if (document.body.style.pointerEvents === 'none') {
            document.body.style.pointerEvents = ''
          }
          if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = ''
          }
        }, 150)
        cleanupTimeoutRef.current = timeoutId
        return () => {
          if (cleanupTimeoutRef.current !== null) {
            clearTimeout(cleanupTimeoutRef.current)
            cleanupTimeoutRef.current = null
          }
        }
      }
    } else {
      wasOpenRef.current = true
    }
  }, [open])

  const trimmedReason = reason.trim()
  const copy = MODAL_COPY[type]

  const handleConfirm = () => {
    if (!trimmedReason || isSubmitting) {
      return
    }
    onConfirm(trimmedReason)
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={(nextOpen) => {
        // Ne pas permettre la fermeture pendant la soumission
        if (isSubmitting) {
          return
        }
        if (!nextOpen) {
          onCancel()
        }
      }}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-md !z-[1300]" 
        overlayClassName="!z-[1200]"
        onInteractOutside={(e) => {
          // Empêcher la fermeture en cliquant à l'extérieur pendant la soumission
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          // Empêcher la fermeture avec Escape pendant la soumission
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>{copy.label}</span>
            <Badge variant={type === "archive" ? "secondary" : "default"} className="uppercase tracking-wide text-[11px]">
              {copy.badge}
            </Badge>
          </div>
          <Textarea
            autoFocus
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.placeholder}
            disabled={isSubmitting}
            required
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!trimmedReason || isSubmitting}>
            Valider le commentaire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
