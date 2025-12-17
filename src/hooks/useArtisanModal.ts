"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import useModal from "./useModal"
import { useModalState } from "./useModalState"
import type { ModalOpenOptions } from "@/types/modal"

export type ArtisanModalOpenOptions = Pick<ModalOpenOptions, "layoutId" | "modeOverride" | "orderedIds" | "index" | "origin"> & {
  defaultView?: "informations" | "statistics"
}

export function useArtisanModal() {
  const modal = useModal()
  const router = useRouter()

  const setSourceLayoutId = useModalState((state) => state.setSourceLayoutId)
  const setOverrideMode = useModalState((state) => state.setOverrideMode)
  const metadata = useModalState((state) => state.metadata)

  const open = useCallback(
    (id: string, options?: ArtisanModalOpenOptions) => {
      modal.open(id, {
        layoutId: options?.layoutId,
        modeOverride: options?.modeOverride,
        orderedIds: options?.orderedIds,
        index: options?.index,
        origin: options?.origin,
        content: "artisan",
        metadata: options?.defaultView ? { defaultView: options.defaultView } : undefined,
      })
    },
    [modal],
  )

  const close = useCallback(() => {
    // Guard: only close if actually open and is an artisan-related modal
    if (!modal.isOpen || (modal.content !== "artisan" && modal.content !== "new-artisan" && modal.content !== "edit-artisan")) return

    // Vérifier si le modal d'artisan vient d'un modal d'intervention AVANT de fermer
    // car modal.close() va réinitialiser le state
    const sourceLayoutId = modal.sourceLayoutId
    const origin = typeof metadata?.origin === "string" ? metadata.origin : null
    const isFromIntervention = origin?.startsWith("intervention:") || Boolean(sourceLayoutId)
    const interventionId = isFromIntervention 
      ? (origin?.replace("intervention:", "") ?? sourceLayoutId)
      : null

    // Fermer le modal d'artisan
    modal.close()

    // Si le modal venait d'une intervention, rouvrir le modal d'intervention
    // Utiliser directement modal.open() pour éviter la dépendance circulaire
    if (isFromIntervention && interventionId) {
      // Petit délai pour laisser le modal d'artisan se fermer proprement
      setTimeout(() => {
        modal.open(interventionId, {
          content: "intervention",
        })
      }, 100)
    }
  }, [metadata, modal])

  const openAtIndex = useCallback(
    (ids: string[], index: number, options?: Omit<ArtisanModalOpenOptions, "orderedIds" | "index">) => {
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

  const openNew = useCallback(() => {
    modal.open("new-artisan", {
      content: "new-artisan",
      layoutId: null,
      modeOverride: undefined,
      orderedIds: [],
      index: -1,
    })
  }, [modal])

  const openEdit = useCallback(
    (id: string, options?: ArtisanModalOpenOptions) => {
      modal.open(id, {
        layoutId: options?.layoutId,
        modeOverride: options?.modeOverride,
        orderedIds: options?.orderedIds,
        index: options?.index,
        origin: options?.origin,
        content: "edit-artisan",
      })
    },
    [modal],
  )

  const goToNext = useCallback(() => {
    if (modal.content !== "artisan") return false
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
    if (modal.content !== "artisan") return false
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
    if (modal.content !== "artisan") return
    if (!modal.activeId) return
    router.push(`/artisans/${modal.activeId}`)
  }, [modal.activeId, modal.content, router])

  useEffect(() => {
    return () => {
      setSourceLayoutId(null)
      setOverrideMode(null)
    }
  }, [setOverrideMode, setSourceLayoutId])

  useEffect(() => {
    if (!modal.isOpen) return
    if (modal.content !== "artisan" && modal.content !== "new-artisan" && modal.content !== "edit-artisan") return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
        return
      }

      if (modal.content === "artisan") {
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
    openNew,
    openEdit,
    close,
    openAtIndex,
    goToNext,
    goToPrevious,
    canGoNext:
      modal.content === "artisan" &&
      modal.activeIndex > -1 &&
      modal.activeIndex < modal.orderedIds.length - 1,
    canGoPrevious: modal.content === "artisan" && modal.activeIndex > 0,
    openFullPage,
  }
}

export default useArtisanModal
