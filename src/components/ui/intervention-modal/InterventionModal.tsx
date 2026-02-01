"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { GenericModal } from "@/components/ui/modal"
import { useModalDisplay } from "@/contexts/ModalDisplayContext"
import { useModalState } from "@/hooks/useModalState"
import type { ModalContent } from "@/types/modal"
import type { ModalDisplayMode } from "@/types/modal-display"
import { InterventionModalContent } from "./InterventionModalContent"
import { NewInterventionModalContent } from "./NewInterventionModalContent"

const MODE_SEQUENCE: ModalDisplayMode[] = ["halfpage", "centerpage", "fullpage"]

type Props = {
  interventionId: string | null
  isOpen: boolean
  onClose: () => void
  onNext?: () => void
  onPrevious?: () => void
  canNext?: boolean
  canPrevious?: boolean
  activeIndex?: number
  totalCount?: number
  content?: ModalContent | null
}

export function InterventionModal({
  interventionId,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  canNext,
  canPrevious,
  activeIndex,
  totalCount,
  content,
}: Props) {
  const { effectiveMode, setPreferredMode } = useModalDisplay()
  const setSourceLayoutId = useModalState((state) => state.setSourceLayoutId)
  const setOverrideMode = useModalState((state) => state.setOverrideMode)
  const sourceLayoutId = useModalState((state) => state.sourceLayoutId)
  // Waiters résolus par AnimatePresence.onExitComplete pour garantir que le DOM du modal est démonté
  const exitWaitersRef = useRef<Array<() => void>>([])

  // États pour gérer les modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showUnsavedDialogRef = useRef<(() => void) | null>(null)
  const [isArtisanSearchOpen, setIsArtisanSearchOpen] = useState(false)
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isStatusReasonModalOpen, setIsStatusReasonModalOpen] = useState(false)
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Callbacks pour recevoir les informations de InterventionModalContent
  const handleUnsavedChangesStateChange = useCallback((hasChanges: boolean, submitting: boolean) => {
    setHasUnsavedChanges(hasChanges)
    setIsSubmitting(submitting)
  }, [])

  const handleRegisterShowDialog = useCallback((showDialog: () => void) => {
    showUnsavedDialogRef.current = showDialog
  }, [])

  const waitForExit = useCallback(() => {
    return new Promise<void>((resolve) => {
      exitWaitersRef.current.push(resolve)
    })
  }, [])

  const handleExitComplete = useCallback(() => {
    const waiters = exitWaitersRef.current
    exitWaitersRef.current = []
    waiters.forEach((fn) => {
      try {
        fn()
      } catch {
        // ignorer
      }
    })
  }, [])

  // Fallback : si le modal est démonté sans animation (ex: shouldRenderIntervention=false),
  // on résout quand même les promesses en attente pour ne pas bloquer les invalidations.
  useEffect(() => {
    if (!isOpen && exitWaitersRef.current.length) {
      const waiters = exitWaitersRef.current
      exitWaitersRef.current = []
      waiters.forEach((fn) => {
        try {
          fn()
        } catch {
          // ignorer
        }
      })
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      setSourceLayoutId(null)
      setOverrideMode(null)
    }
  }, [setOverrideMode, setSourceLayoutId])

  useEffect(() => {
    if (!isOpen) {
      setIsArtisanSearchOpen(false)
      setIsSmsModalOpen(false)
      setIsEmailModalOpen(false)
      setIsStatusReasonModalOpen(false)
      setIsUnsavedDialogOpen(false)
      setIsDeleteDialogOpen(false)
    }
  }, [isOpen])

  const cycleMode = useCallback(() => {
    const currentIndex = MODE_SEQUENCE.indexOf(effectiveMode)
    const nextMode = MODE_SEQUENCE[(currentIndex + 1) % MODE_SEQUENCE.length]
    setOverrideMode(null)
    setPreferredMode(nextMode)
  }, [effectiveMode, setOverrideMode, setPreferredMode])

  const currentContent: ModalContent = content ?? "intervention"

  const renderedContent = (() => {
    if (currentContent === "new-intervention") {
      return (
        <NewInterventionModalContent
          mode={effectiveMode}
          onClose={onClose}
          onCycleMode={cycleMode}
          onUnsavedDialogOpenChange={setIsUnsavedDialogOpen}
          onUnsavedChangesStateChange={handleUnsavedChangesStateChange}
          onRegisterShowDialog={handleRegisterShowDialog}
          onPopoverOpenChange={setIsPopoverOpen}
        />
      )
    }

    if (currentContent !== "intervention") {
      return null
    }

    if (!interventionId) {
      return null
    }

    return (
      <InterventionModalContent
        key={interventionId}
        interventionId={interventionId}
        mode={effectiveMode}
        onClose={onClose}
        waitForExit={waitForExit}
        onNext={onNext}
        onPrevious={onPrevious}
        canNext={canNext}
        canPrevious={canPrevious}
        onCycleMode={cycleMode}
        activeIndex={activeIndex}
        totalCount={totalCount}
        onUnsavedChangesStateChange={handleUnsavedChangesStateChange}
        onRegisterShowDialog={handleRegisterShowDialog}
        onArtisanSearchOpenChange={setIsArtisanSearchOpen}
        onSmsModalOpenChange={setIsSmsModalOpen}
        onEmailModalOpenChange={setIsEmailModalOpen}
        onStatusReasonModalOpenChange={setIsStatusReasonModalOpen}
        onPopoverOpenChange={setIsPopoverOpen}
        onUnsavedDialogOpenChange={setIsUnsavedDialogOpen}
        onDeleteDialogOpenChange={setIsDeleteDialogOpen}
      />
    )
  })()

  if (!renderedContent) {
    return null
  }

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      mode={effectiveMode}
      layoutId={sourceLayoutId ?? undefined}
      onExitComplete={handleExitComplete}
      hasUnsavedChanges={hasUnsavedChanges}
      isSubmitting={isSubmitting}
      onShowUnsavedDialog={() => showUnsavedDialogRef.current?.()}
      pauseFocusTrap={
        isSmsModalOpen ||
        isEmailModalOpen ||
        isStatusReasonModalOpen ||
        isUnsavedDialogOpen ||
        isPopoverOpen ||
        isDeleteDialogOpen
      }
    >
      {renderedContent}
    </GenericModal>
  )
}

export default InterventionModal
