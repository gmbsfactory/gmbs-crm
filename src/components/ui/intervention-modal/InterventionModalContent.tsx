"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, X, MessageSquare, Copy, MessageCircle, Trash2, Plus, Info } from "lucide-react"
import { InterventionEditForm } from "@/components/interventions/InterventionEditForm"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"
import { InterventionHistoryPanel } from "@/components/interventions/history/InterventionHistoryPanel"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ModalDisplayMode } from "@/types/modal-display"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { ModeIcons } from "@/components/ui/mode-selector"
import { interventionsApi } from "@/lib/api/v2"
import type { Intervention } from "@/lib/api/v2/common/types"
import { useInterventionReminders } from "@/hooks/useInterventionReminders"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { ReminderMentionInput } from "@/components/interventions/ReminderMentionInput"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

import { toast } from "sonner"
import { useInterventionContextMenu } from "@/hooks/useInterventionContextMenu"
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"
import { usePermissions } from "@/hooks/usePermissions"

type NoteDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

const NoteDialogContent = React.forwardRef<HTMLDivElement, NoteDialogContentProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/20 pointer-events-none" />
      <AlertDialogPrimitive.Content ref={ref} className={className} {...props} />
    </AlertDialogPortal>
  ),
)

NoteDialogContent.displayName = "NoteDialogContent"

// Modal SMS sans overlay sombre (déjà dans un modal)
const SmsDialogContent = React.forwardRef<HTMLDivElement, NoteDialogContentProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogPrimitive.Content 
        ref={ref} 
        className={cn(
          "fixed left-[50%] top-[50%] z-[201] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
          className
        )} 
        {...props} 
      />
    </AlertDialogPortal>
  ),
)

SmsDialogContent.displayName = "SmsDialogContent"

type Props = {
  interventionId: string
  mode: ModalDisplayMode
  onClose: () => void
  // Attendre la fin réelle de l'animation de fermeture (AnimatePresence)
  waitForExit: () => Promise<void>
  onNext?: () => void
  onPrevious?: () => void
  canNext?: boolean
  canPrevious?: boolean
  onCycleMode?: () => void
  activeIndex?: number
  totalCount?: number
  // Callback pour exposer l'état des modifications non sauvegardées au parent
  onUnsavedChangesStateChange?: (hasChanges: boolean, isSubmitting: boolean) => void
  // Callback pour exposer la fonction d'affichage du dialog au parent
  onRegisterShowDialog?: (showDialog: () => void) => void
}

export function InterventionModalContent({
  interventionId,
  mode,
  onClose,
  waitForExit,
  onNext,
  onPrevious,
  canNext,
  canPrevious,
  onCycleMode,
  activeIndex,
  totalCount,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
}: Props) {
  const bodyPadding = mode === "fullpage" ? "px-8 py-6 md:px-12" : "px-5 py-4 md:px-8"
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const formRef = useRef<HTMLFormElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canWriteInterventions = can("write_interventions")
  const canDeleteInterventions = can("delete_interventions")

  // Raccourci clavier Cmd/Ctrl+Enter pour enregistrer
  const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting })

  // State pour la protection des modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)

  // Notifier le parent des changements d'état pour la gestion du clic sur backdrop
  useEffect(() => {
    onUnsavedChangesStateChange?.(hasUnsavedChanges, isSubmitting)
  }, [hasUnsavedChanges, isSubmitting, onUnsavedChangesStateChange])

  // Exposer la fonction pour afficher le dialog au parent
  useEffect(() => {
    const showDialog = () => {
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
    }
    onRegisterShowDialog?.(showDialog)
  }, [onClose, onRegisterShowDialog])

  // Reminder states
  const {
    reminders,
    saveReminder,
    toggleReminder,
    getReminderNote,
    getReminderDueDate,
    getReminderMentions,
    removeReminder,
  } = useInterventionReminders()
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteValue, setNoteValue] = useState("")
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [noteDialogCoords, setNoteDialogCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const noteDialogContentRef = useRef<HTMLDivElement | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const isReminderSaveDisabled = noteValue.trim().length === 0 && !dueDateValue

  // SMS Modal states
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [clientName, setClientName] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)

  const generateSmsText = useCallback((cName: string, aName: string) => {
    return `Bonjour Madame / Monsieur ${cName},
Nous avons reçu une demande d'intervention de la part de votre agence ${aName}.
Merci de nous rappeler dès que possible sur ce numéro.
Bonne journée,
GMBS`
  }, [])

  const handleOpenSmsModal = useCallback(() => {
    setSmsText(generateSmsText(clientName, agencyName || "[Nom de l'agence]"))
    setShowSmsModal(true)
  }, [clientName, agencyName, generateSmsText])

  const handleCopySms = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(smsText)
      toast.success("Message copié dans le presse-papiers")
    } catch (error) {
      console.error('Erreur lors de la copie:', error)
      toast.error("Erreur lors de la copie du message")
    }
  }, [smsText])

  const handleOpenWhatsApp = useCallback(() => {
    if (!clientPhone) return

    // Nettoyer le numéro de téléphone (supprimer espaces, tirets, points, etc.)
    const cleanPhone = clientPhone.replace(/[\s\-\.\(\)]/g, '')

    // Ajouter l'indicatif si nécessaire (format international)
    // Si le numéro commence par 0, le remplacer par +33 pour la France
    const formattedPhone = cleanPhone.startsWith('0')
      ? `+33${cleanPhone.slice(1)}`
      : cleanPhone.startsWith('+')
        ? cleanPhone
        : `+33${cleanPhone}`

    // Encoder le message pour l'URL
    const encodedMessage = encodeURIComponent(smsText)

    // Détecter si on est sur mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    
    // Ouvrir WhatsApp avec le numéro et le message
    if (isMobile) {
      // Sur mobile : utiliser le protocole whatsapp:// pour ouvrir directement l'app
      const whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMessage}`
      window.location.href = whatsappUrl
    } else {
      // Sur desktop : ouvrir dans une nouvelle fenêtre centrée et de taille confortable
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`
      // Taille de la fenêtre (30% plus grande que standard)
      const popupWidth = 780
      const popupHeight = 910
      // Centrer la fenêtre sur l'écran
      const left = Math.round((window.screen.width - popupWidth) / 2)
      const top = Math.round((window.screen.height - popupHeight) / 2)
      window.open(
        whatsappUrl, 
        '_blank', 
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )
    }
  }, [clientPhone, smsText])

  // Récupérer les données de l'intervention
  const {
    data: intervention,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: interventionKeys.detail(interventionId),
    queryFn: () => interventionsApi.getById(interventionId),
    enabled: Boolean(interventionId),
  })

  // Hook pour la suppression et duplication d'intervention
  const { deleteIntervention, duplicateDevisSupp, isLoading: contextMenuLoading } = useInterventionContextMenu(
    interventionId,
    "default",
    intervention?.id_inter || undefined
  )

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
  const handleSaveAndClose = useCallback(() => {
    setShowUnsavedDialog(false)
    // Soumettre le formulaire
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
    // La fermeture sera gérée automatiquement par handleSuccess après la sauvegarde
    pendingCloseAction.current = null
  }, [])

  // Fonction pour gérer l'annulation avec vérification des modifications
  const handleCancel = useCallback(() => {
    // Si des modifications non sauvegardées existent et qu'on n'est pas en train de soumettre
    if (hasUnsavedChanges && !isSubmitting) {
      // Stocker l'action de fermeture pour l'exécuter après confirmation
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
      return
    }

    // Pas de modifications ou soumission en cours : fermer directement
    onClose()
  }, [hasUnsavedChanges, isSubmitting, onClose])


  // Intercepter la touche Échap pour appliquer la même logique que handleCancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        handleCancel()
      }
    }

    document.addEventListener("keydown", handleKeyDown, true) // Utiliser capture phase
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [handleCancel])

  // Focus trap - empêcher le focus de sortir du modal lors de la navigation Tab
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const modalElement = modalRef.current
      if (!modalElement) return

      // Vérifier si le focus est actuellement dans le modal
      if (!modalElement.contains(document.activeElement)) return

      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      )

      const focusableArray = Array.from(focusableElements).filter(
        (el) => {
          // Filtrer les éléments invisibles ou masqués
          const style = window.getComputedStyle(el)
          return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null
        }
      )

      if (focusableArray.length === 0) return

      const firstElement = focusableArray[0]
      const lastElement = focusableArray[focusableArray.length - 1]
      const activeElement = document.activeElement as HTMLElement

      // Debug logs
      console.log("🔍 Focus Trap Debug:")
      console.log("  - Élément actif:", activeElement)
      console.log("  - Premier élément:", firstElement)
      console.log("  - Dernier élément:", lastElement)
      console.log("  - Total éléments focusables:", focusableArray.length)
      console.log("  - Shift?", event.shiftKey)

      if (event.shiftKey) {
        // Shift + Tab : navigation arrière
        if (activeElement === firstElement) {
          console.log("  ✅ TRAP: Premier élément -> Dernier")
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab : navigation avant
        if (activeElement === lastElement) {
          console.log("  ✅ TRAP: Dernier élément -> Premier")
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    // Utiliser capture phase pour intercepter AVANT que le focus ne change
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [])

  const handleSuccess = useCallback(
    async (data: any) => {
      // 1. Mise à jour optimiste immédiate dans React Query pour le détail
      queryClient.setQueryData(interventionKeys.detail(interventionId), data)

      // 2. Mise à jour optimiste dans toutes les listes qui contiennent cette intervention
      // Cibler explicitement les listes complètes et light (évite d'invalider les détails/summaries)
      const updateListCache = (oldData: any) => {
        if (!oldData?.data || !Array.isArray(oldData.data)) {
          return oldData
        }
        const updatedData = oldData.data.map((intervention: any) =>
          intervention.id === interventionId ? { ...intervention, ...data } : intervention
        )
        return { ...oldData, data: updatedData }
      }
      queryClient.setQueriesData({ queryKey: interventionKeys.lists() }, updateListCache)
      queryClient.setQueriesData({ queryKey: interventionKeys.lightLists() }, updateListCache)

      // 3. Invalider IMMÉDIATEMENT les queries actives pour forcer le refetch et le re-render (sans toucher aux inactives)
      // Utiliser refetchType: 'active' pour ne refetch que les queries actuellement montées
      // Cela garantit que l'UI se met à jour instantanément sans attendre waitForExit()
      queryClient.invalidateQueries({ 
        queryKey: interventionKeys.detail(interventionId),
        refetchType: 'active' // Forcer le refetch immédiat des queries actives
      })
      queryClient.invalidateQueries({ 
        queryKey: interventionKeys.invalidateLists(),
        refetchType: 'active' // Forcer le refetch immédiat des queries actives
      })
      queryClient.invalidateQueries({ 
        queryKey: interventionKeys.invalidateLightLists(),
        refetchType: 'active' // Forcer le refetch immédiat des queries actives
      })

      console.log("✅ Intervention mise à jour avec succès", data)

      // 4. Fermer le modal pour démarrer l'animation
      // L'invalidation a déjà été faite ci-dessus, donc l'UI se mettra à jour immédiatement
      onClose()

      // 5. Attendre la fin de l'animation et invalider à nouveau en arrière-plan pour garantir la cohérence
      // Cette invalidation supplémentaire cible uniquement les queries inactives pour limiter les double-refetch
      await waitForExit()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId), refetchType: 'inactive' })
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists(), refetchType: 'inactive' })
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists(), refetchType: 'inactive' })
    },
    [queryClient, interventionId, onClose, waitForExit],
  )

  const handleSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
  }

  const handleReminderToggle = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      void toggleReminder(interventionId, intervention?.id_inter || undefined)
    },
    [intervention?.id_inter, interventionId, toggleReminder],
  )

  const handleReminderContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const existingNote = getReminderNote(interventionId) ?? ""
      const existingDueDate = getReminderDueDate(interventionId)
      const existingMentions = getReminderMentions(interventionId)
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const DIALOG_WIDTH = 448
      const DIALOG_HEIGHT = 360
      const GAP = 8

      let left = rect.left - DIALOG_WIDTH - GAP
      if (left < 16) {
        left = rect.right + GAP
      }

      let top = rect.top
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
      if (top + DIALOG_HEIGHT > viewportHeight - 16) {
        top = Math.max(16, viewportHeight - DIALOG_HEIGHT - 16)
      }

      setNoteValue(existingNote)
      setDueDateValue(existingDueDate ? new Date(existingDueDate) : null)
      setMentionIds(existingMentions)
      setNoteDialogCoords({ top, left })
      setShowNoteDialog(true)
    },
    [getReminderDueDate, getReminderMentions, getReminderNote, interventionId],
  )

  const handleNoteSave = useCallback(async () => {
    const cleaned = noteValue.trim()
    const dueDateIso = dueDateValue ? dueDateValue.toISOString() : null
    const hasContent = cleaned.length > 0 || dueDateIso

    if (hasContent) {
      await saveReminder({
        interventionId,
        idInter: intervention?.id_inter || undefined,
        note: cleaned.length > 0 ? cleaned : null,
        dueDate: dueDateIso,
        mentionedUserIds: mentionIds,
      })
    } else {
      await removeReminder(interventionId)
    }

    setShowNoteDialog(false)
    setNoteValue("")
    setDueDateValue(null)
    setMentionIds([])
  }, [dueDateValue, intervention?.id_inter, interventionId, mentionIds, noteValue, removeReminder, saveReminder])

  const handleNoteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowNoteDialog(false)
      setNoteValue("")
      setDueDateValue(null)
      setMentionIds([])
    } else {
      setShowNoteDialog(true)
    }
  }, [])

  // Handler pour la suppression
  const handleDelete = useCallback(() => {
    // Ouvrir le dialogue au lieu d'utiliser window.confirm
    setShowDeleteDialog(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    deleteIntervention()
    setShowDeleteDialog(false)
    // Fermer le modal avec la même logique que le bouton de fermeture
    onClose()
  }, [deleteIntervention, onClose])

  return (
    <TooltipProvider>
      <div ref={modalRef} className={`modal-config-surface ${surfaceVariantClass} ${surfaceModeClass}`}>
        <header className="modal-config-columns-header relative">
          <div className="flex items-center gap-3">
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
              <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "modal-config-columns-icon-button",
                    reminders.has(interventionId) && "text-red-500 hover:text-red-600"
                  )}
                  onClick={handleReminderToggle}
                  onContextMenu={handleReminderContextMenu}
                  aria-label={reminders.has(interventionId) ? "Retirer le rappel" : "Ajouter un rappel"}
                >
                  <Bell className={cn("h-4 w-4", reminders.has(interventionId) && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">
                {reminders.has(interventionId) ? "Retirer le rappel" : "Ajouter un rappel"} (Clic droit pour détails)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={() => setShowHistoryPanel(true)}
                  aria-label="Voir l'historique"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Historique des actions</TooltipContent>
            </Tooltip>
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
            {canDeleteInterventions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button hover:bg-red-500/10"
                    onClick={handleDelete}
                    disabled={contextMenuLoading.delete || !intervention}
                    aria-label="Supprimer l'intervention"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Supprimer l&apos;intervention
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="modal-config-columns-title">
              Modifier l&apos;intervention
              {activeIndex !== undefined && totalCount !== undefined && totalCount > 1 && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({activeIndex + 1} / {totalCount})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canWriteInterventions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => duplicateDevisSupp()}
                    disabled={!intervention || contextMenuLoading.duplicate}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Devis supp
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Créer un devis supplémentaire à partir de cette intervention
                </TooltipContent>
              </Tooltip>
            )}
            {intervention?.updated_at && (
              <span className="text-xs text-muted-foreground">
                Mis à jour le {new Date(intervention.updated_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
        </header>

        <div className="modal-config-columns-body overflow-hidden flex flex-col">
          <div className={`${bodyPadding} flex-1 min-h-0 flex flex-col`}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-6 w-48 rounded bg-muted animate-pulse" />
                <div className="h-4 w-72 rounded bg-muted animate-pulse" />
                <div className="space-y-3">
                  <div className="h-10 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ) : error ? (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {(error as Error).message}
              </div>
            ) : intervention ? (
              <InterventionEditForm
                intervention={intervention}
                mode={mode}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                formRef={formRef}
                onSubmittingChange={setIsSubmitting}
                onClientNameChange={setClientName}
                onAgencyNameChange={setAgencyName}
                onClientPhoneChange={setClientPhone}
                onOpenSmsModal={handleOpenSmsModal}
                onHasUnsavedChanges={setHasUnsavedChanges}
              />
            ) : (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Intervention introuvable
              </div>
            )}
          </div>
        </div>

        <footer className="modal-config-columns-footer flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={handleOpenSmsModal}
                  disabled={!intervention || !clientName || isSubmitting}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!clientName ? "Nom du client manquant" : "Générer un message SMS"}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="legacy-form-button"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !intervention}
              className="legacy-form-button bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? "Enregistrement..." : (
                <>
                  Enregistrer les modifications
                  <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-accent-foreground/30 bg-accent-foreground/10 px-1.5 font-mono text-[10px] font-medium text-accent-foreground/70">
                    {shortcutHint}
                  </kbd>
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>

      <InterventionHistoryPanel
        interventionId={interventionId}
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
      />

      <AlertDialog open={showSmsModal} onOpenChange={setShowSmsModal}>
        <SmsDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Message SMS</AlertDialogTitle>
            <AlertDialogDescription>
              Message prérempli pour le client. Vous pouvez le modifier avant de le copier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              className="min-h-[200px] resize-none"
              placeholder="Le message sera prérempli automatiquement..."
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleCopySms}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copier le message
              </Button>
              {clientPhone && clientPhone.trim() !== "" && (
                <Button
                  onClick={handleOpenWhatsApp}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  Envoyer sur WhatsApp
                </Button>
              )}
            </div>
            {clientPhone && clientPhone.trim() !== "" && (
              <p className="text-xs text-muted-foreground">
                Numéro de téléphone : {clientPhone}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </SmsDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoteDialog} onOpenChange={handleNoteDialogOpenChange}>
        <NoteDialogContent
          ref={noteDialogContentRef}
          className={cn(
            "note-reminder-dialog fixed z-[110] w-[min(448px,calc(100vw-32px))] max-w-md rounded-lg border border-border bg-popover p-6 shadow-xl focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
          style={{
            top: noteDialogCoords.top,
            left: noteDialogCoords.left,
          }}
          onEscapeKeyDown={() => handleNoteDialogOpenChange(false)}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>
              {reminders.has(interventionId) ? "Modifier le rappel" : "Créer un rappel"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ajoutez une note et/ou définissez une date d&apos;échéance. Utilisez @ pour notifier un gestionnaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Note (optionnel)</span>
              <ReminderMentionInput
                value={noteValue}
                onChange={(value, mentions) => {
                  setNoteValue(value)
                  setMentionIds(mentions)
                }}
                placeholder="Exemple: @prenom.nom relancer le client..."
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Date d&apos;échéance (optionnel)</span>
              <DatePicker
                date={dueDateValue}
                onDateChange={setDueDateValue}
                placeholder="Sélectionner une date..."
                popoverContainer={noteDialogContentRef.current}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                handleNoteDialogOpenChange(false)
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleNoteSave()
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isReminderSaveDisabled}
            >
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </NoteDialogContent>
      </AlertDialog>

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[120]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est destructive. Êtes-vous sûr de vouloir supprimer l&apos;intervention ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onCancel={handleCancelClose}
        onConfirm={handleConfirmClose}
        onSaveAndConfirm={handleSaveAndClose}
      />
    </TooltipProvider>
  )
}
