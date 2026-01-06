"use client"

import { Suspense } from "react"
import { useShallow } from "zustand/react/shallow"
import { InterventionModal } from "@/components/ui/intervention-modal"
import { ArtisanModal } from "@/components/ui/artisan-modal"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useModalState } from "@/hooks/useModalState"

const useModalSummary = () =>
  useModalState(
    useShallow((state) => ({
      isOpen: state.isOpen,
      activeId: state.activeId,
      content: state.content,
    })),
  )

export function GlobalModalHost() {
  const { isOpen, activeId, content } = useModalSummary()
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const shouldRenderIntervention =
    isOpen &&
    ((content === "intervention" && Boolean(activeId)) || content === "new-intervention")
  const shouldRenderArtisan =
    isOpen &&
    ((content === "artisan" && Boolean(activeId)) || 
     content === "new-artisan")

  return (
    <Suspense fallback={null}>
      {shouldRenderIntervention ? (
        <InterventionModal
          interventionId={interventionModal.content === "intervention" ? interventionModal.activeId : null}
          isOpen={interventionModal.isOpen}
          onClose={interventionModal.close}
          onNext={interventionModal.goToNext}
          onPrevious={interventionModal.goToPrevious}
          canNext={interventionModal.canGoNext}
          canPrevious={interventionModal.canGoPrevious}
          activeIndex={interventionModal.activeIndex}
          totalCount={interventionModal.totalCount}
          content={interventionModal.content}
        />
      ) : null}
      {shouldRenderArtisan ? (
        <ArtisanModal
          artisanId={artisanModal.content === "artisan" ? artisanModal.activeId : null}
          isOpen={artisanModal.isOpen}
          onClose={artisanModal.close}
          onNext={artisanModal.goToNext}
          onPrevious={artisanModal.goToPrevious}
          canNext={artisanModal.canGoNext}
          canPrevious={artisanModal.canGoPrevious}
          activeIndex={artisanModal.activeIndex}
          totalCount={artisanModal.totalCount}
          content={artisanModal.content}
        />
      ) : null}
    </Suspense>
  )
}

export default GlobalModalHost
