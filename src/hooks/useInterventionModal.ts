"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import useModal from "./useModal"
import { useModalState } from "./useModalState"
import type { ModalOpenOptions } from "@/types/modal"

export type InterventionModalOpenOptions = Pick<ModalOpenOptions, "layoutId" | "modeOverride" | "orderedIds" | "index" | "origin" | "metadata">

export function useInterventionModal() {
  const modal = useModal()
  const router = useRouter()
  const setSourceLayoutId = useModalState((state) => state.setSourceLayoutId)
  const setOverrideMode = useModalState((state) => state.setOverrideMode)
  const metadata = useModalState((state) => state.metadata)
  const context = useModalState((state) => state.context)

  const open = useCallback(
    (id: string, options?: InterventionModalOpenOptions) => {
      modal.open(id, {
        layoutId: options?.layoutId,
        modeOverride: options?.modeOverride,
        orderedIds: options?.orderedIds,
        index: options?.index,
        origin: options?.origin,
        metadata: options?.metadata,
        content: "intervention",
      })
    },
    [modal],
  )

  const close = useCallback(() => {
    // Guard: only close if actually open and is an intervention-related modal
    if (!modal.isOpen || (modal.content !== "intervention" && modal.content !== "new-intervention")) return

    // Vérifier si c'est un modal new-intervention qui vient d'une duplication (devis supp)
    // AVANT de fermer car modal.close() va réinitialiser le state
    const duplicateFromId = modal.content === "new-intervention" && typeof context?.duplicateFrom === "string"
      ? context.duplicateFrom
      : null

    // Capturer le callback de retour à l'origine AVANT de fermer
    // car modal.close() va réinitialiser le state
    const onReturnToOrigin = typeof metadata?.onReturnToOrigin === "function"
      ? metadata.onReturnToOrigin as () => void
      : null

    // Si c'est un devis supp, retourner à l'intervention initiale
    if (duplicateFromId) {
      // Fermer d'abord le modal actuel, puis rouvrir l'intervention initiale après un court délai
      modal.close()
      setTimeout(() => {
        modal.open(duplicateFromId, { content: "intervention" })
      }, 100)
      return
    }

    // Fermer le modal d'intervention
    modal.close()

    // Si un callback de retour à l'origine existe, l'appeler après fermeture
    if (onReturnToOrigin) {
      setTimeout(() => {
        onReturnToOrigin()
      }, 100)
    }
  }, [context, metadata, modal])

  const openAtIndex = useCallback(
    (ids: string[], index: number, options?: Omit<InterventionModalOpenOptions, "orderedIds" | "index">) => {
      if (!ids.length) return
      const targetIndex = Math.max(0, Math.min(index, ids.length - 1))
      const targetId = ids[targetIndex]
      open(targetId, {
        ...options,
        orderedIds: ids,
        index: targetIndex,
        origin: options?.origin,
      })
    },
    [open],
  )

  const goToNext = useCallback(() => {
    if (modal.content !== "intervention") return false
    if (modal.activeIndex === -1 || !modal.orderedIds.length || modal.activeIndex >= modal.orderedIds.length - 1) return false

    const nextIndex = modal.activeIndex + 1
    const nextId = modal.orderedIds[nextIndex]
    const origin = typeof metadata?.origin === "string" ? metadata.origin : undefined
    open(nextId, {
      orderedIds: modal.orderedIds,
      index: nextIndex,
      layoutId: null,
      origin,
    })
    return true
  }, [metadata, modal.activeIndex, modal.content, modal.orderedIds, open])

  const goToPrevious = useCallback(() => {
    if (modal.content !== "intervention") return false
    if (modal.activeIndex <= 0 || !modal.orderedIds.length) return false

    const prevIndex = modal.activeIndex - 1
    const prevId = modal.orderedIds[prevIndex]
    const origin = typeof metadata?.origin === "string" ? metadata.origin : undefined
    open(prevId, {
      orderedIds: modal.orderedIds,
      index: prevIndex,
      layoutId: null,
      origin,
    })
    return true
  }, [metadata, modal.activeIndex, modal.content, modal.orderedIds, open])

  const openFullPage = useCallback(() => {
    if (modal.content !== "intervention") return
    if (!modal.activeId) return
    router.push(`/interventions/${modal.activeId}`)
  }, [modal.activeId, modal.content, router])

  useEffect(() => {
    return () => {
      setSourceLayoutId(null)
      setOverrideMode(null)
    }
  }, [setOverrideMode, setSourceLayoutId])

  useEffect(() => {
    if (!modal.isOpen) return

    // Don't handle events if not an intervention-related modal
    if (modal.content !== "intervention" && modal.content !== "new-intervention") return

    // NOTE: La gestion de la touche Échap est désormais centralisée dans GenericModal.tsx
    // pour éviter les doubles fermetures/réouvertures (effet "flash")
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle navigation shortcuts for regular intervention modals (not new-intervention)
      if (modal.content === "intervention") {
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "k") {
          event.preventDefault()
          goToPrevious()
          return
        }

        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "j") {
          event.preventDefault()
          goToNext()
        }
      }
    }

    const handlePopState = () => {
      close()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [close, goToNext, goToPrevious, modal.content, modal.isOpen, openFullPage])

  return {
    isOpen: modal.isOpen,
    activeId: modal.activeId,
    activeIndex: modal.activeIndex,
    totalCount: modal.orderedIds.length,
    orderedIds: modal.orderedIds,
    sourceLayoutId: modal.sourceLayoutId,
    overrideMode: modal.overrideMode,
    content: modal.content,
    open,
    close,
    openAtIndex,
    goToNext,
    goToPrevious,
    canGoNext:
      modal.content === "intervention" &&
      modal.activeIndex > -1 &&
      modal.activeIndex < modal.orderedIds.length - 1,
    canGoPrevious: modal.content === "intervention" && modal.activeIndex > 0,
    openFullPage,
  }
}

export default useInterventionModal
