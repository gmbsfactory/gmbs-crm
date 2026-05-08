import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react"
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"

type UseArtisanFormArgs = {
  formRef: RefObject<HTMLFormElement | null>
  isSubmitting: boolean
  hasUnsavedChanges: boolean
  onClose: () => void
  onUnsavedChangesStateChange?: (hasChanges: boolean, submitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
  // Escape is suppressed when any of these flags are true (another modal/panel is on top).
  isEscapeSuppressed?: boolean
  shouldCloseAfterSave?: MutableRefObject<boolean>
}

/**
 * Shared form-plumbing for both artisan modals: unsaved-changes dialog,
 * Escape interception, parent notifications, and submit shortcut.
 *
 * Why: previously duplicated ~80 LOC across NewArtisanModalContent and
 * ArtisanModalContent; keeping a single source of truth avoids drift
 * between create and edit flows.
 */
export function useArtisanForm({
  formRef,
  isSubmitting,
  hasUnsavedChanges,
  onClose,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
  onUnsavedDialogOpenChange,
  isEscapeSuppressed = false,
  shouldCloseAfterSave: shouldCloseAfterSaveProp,
}: UseArtisanFormArgs) {
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)
  const internalRef = useRef(false)
  const shouldCloseAfterSave = shouldCloseAfterSaveProp ?? internalRef

  useEffect(() => {
    onUnsavedChangesStateChange?.(hasUnsavedChanges, isSubmitting)
  }, [hasUnsavedChanges, isSubmitting, onUnsavedChangesStateChange])

  useEffect(() => {
    const showDialog = () => {
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
    }
    onRegisterShowDialog?.(showDialog)
  }, [onClose, onRegisterShowDialog])

  useEffect(() => {
    onUnsavedDialogOpenChange?.(showUnsavedDialog)
  }, [showUnsavedDialog, onUnsavedDialogOpenChange])

  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingCloseAction.current) {
      pendingCloseAction.current()
      pendingCloseAction.current = null
    }
  }, [])

  const handleCancelClose = useCallback(() => {
    setShowUnsavedDialog(false)
    pendingCloseAction.current = null
  }, [])

  const handleSaveAndClose = useCallback(() => {
    setShowUnsavedDialog(false)
    shouldCloseAfterSave.current = true
    if (formRef.current) {
      formRef.current.requestSubmit()
    }
    pendingCloseAction.current = null
  }, [formRef, shouldCloseAfterSave])

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges && !isSubmitting) {
      pendingCloseAction.current = onClose
      setShowUnsavedDialog(true)
      return
    }
    onClose()
  }, [hasUnsavedChanges, isSubmitting, onClose])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (showUnsavedDialog || isEscapeSuppressed) return
      event.preventDefault()
      event.stopPropagation()
      handleCancel()
    }
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [handleCancel, showUnsavedDialog, isEscapeSuppressed])

  const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting })

  return {
    showUnsavedDialog,
    handleCancel,
    handleConfirmClose,
    handleCancelClose,
    handleSaveAndClose,
    shortcutHint,
    shouldCloseAfterSave,
  }
}
