"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { GenericModal } from "@/components/ui/modal"
import { useModalDisplay } from "@/contexts/ModalDisplayContext"
import { useModalState } from "@/hooks/useModalState"
import type { ModalContent } from "@/types/modal"
import type { ModalDisplayMode } from "@/types/modal-display"
import { ArtisanModalContent } from "./ArtisanModalContent"
import { NewArtisanModalContent } from "./NewArtisanModalContent"

const MODE_SEQUENCE: ModalDisplayMode[] = ["halfpage", "centerpage", "fullpage"]

type Props = {
  artisanId: string | null
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

export function ArtisanModal({
  artisanId,
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
  const metadata = useModalState((state) => state.metadata)
  
  // Récupérer la vue par défaut depuis les metadata
  const defaultView = metadata?.defaultView as "informations" | "statistics" | undefined

  // États pour gérer les modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showUnsavedDialogRef = useRef<(() => void) | null>(null)
  const [isStatusReasonModalOpen, setIsStatusReasonModalOpen] = useState(false)
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false)

  // Callbacks pour recevoir les informations de ArtisanModalContent
  const handleUnsavedChangesStateChange = useCallback((hasChanges: boolean, submitting: boolean) => {
    setHasUnsavedChanges(hasChanges)
    setIsSubmitting(submitting)
  }, [])

  const handleRegisterShowDialog = useCallback((showDialog: () => void) => {
    showUnsavedDialogRef.current = showDialog
  }, [])

  useEffect(() => {
    return () => {
      setSourceLayoutId(null)
      setOverrideMode(null)
    }
  }, [setOverrideMode, setSourceLayoutId])

  useEffect(() => {
    if (!isOpen) {
      setIsStatusReasonModalOpen(false)
      setIsUnsavedDialogOpen(false)
    }
  }, [isOpen])

  const cycleMode = useCallback(() => {
    const currentIndex = MODE_SEQUENCE.indexOf(effectiveMode)
    const nextMode = MODE_SEQUENCE[(currentIndex + 1) % MODE_SEQUENCE.length]
    setOverrideMode(null)
    setPreferredMode(nextMode)
  }, [effectiveMode, setOverrideMode, setPreferredMode])

  const currentContent: ModalContent = content ?? "artisan"

  const renderedContent = (() => {
    if (currentContent === "new-artisan") {
      return (
        <NewArtisanModalContent
          mode={effectiveMode}
          onClose={onClose}
          onCycleMode={cycleMode}
          onUnsavedChangesStateChange={handleUnsavedChangesStateChange}
          onRegisterShowDialog={handleRegisterShowDialog}
          onStatusReasonModalOpenChange={setIsStatusReasonModalOpen}
          onUnsavedDialogOpenChange={setIsUnsavedDialogOpen}
        />
      )
    }

    if (currentContent === "edit-artisan") {
      if (!artisanId) {
        return null
      }
      return (
        <NewArtisanModalContent
          mode={effectiveMode}
          onClose={onClose}
          onCycleMode={cycleMode}
          artisanId={artisanId}
          onUnsavedChangesStateChange={handleUnsavedChangesStateChange}
          onRegisterShowDialog={handleRegisterShowDialog}
          onStatusReasonModalOpenChange={setIsStatusReasonModalOpen}
          onUnsavedDialogOpenChange={setIsUnsavedDialogOpen}
        />
      )
    }

    if (currentContent !== "artisan") {
      return null
    }

    if (!artisanId) {
      return null
    }

    return (
      <ArtisanModalContent
        key={artisanId}
        artisanId={artisanId}
        mode={effectiveMode}
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
        canNext={canNext}
        canPrevious={canPrevious}
        onCycleMode={cycleMode}
        activeIndex={activeIndex}
        totalCount={totalCount}
        defaultView={defaultView}
        onUnsavedChangesStateChange={handleUnsavedChangesStateChange}
        onRegisterShowDialog={handleRegisterShowDialog}
        onStatusReasonModalOpenChange={setIsStatusReasonModalOpen}
        onUnsavedDialogOpenChange={setIsUnsavedDialogOpen}
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
      hasUnsavedChanges={hasUnsavedChanges}
      isSubmitting={isSubmitting}
      onShowUnsavedDialog={() => showUnsavedDialogRef.current?.()}
      pauseFocusTrap={isStatusReasonModalOpen || isUnsavedDialogOpen}
    >
      {renderedContent}
    </GenericModal>
  )
}

export default ArtisanModal
