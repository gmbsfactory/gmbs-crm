"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useModalState } from "./useModalState"
import type { ModalContent, ModalOpenOptions } from "@/types/modal"

const VALID_CONTENT: ModalContent[] = ["intervention", "chat", "artisan", "new-intervention", "new-artisan"]

const MODAL_PARAM = "i"
const CONTENT_PARAM = "mc"
const LEGACY_MODAL_PARAM = "modal"
const LEGACY_CONTENT_PARAM = "modalContent"

let closingGuardId: string | null = null
let pendingModalId: string | null = null

const isValidContent = (value: string | null): value is ModalContent => {
  if (!value) return false
  return (VALID_CONTENT as string[]).includes(value)
}

const buildUrl = (params: URLSearchParams) => {
  const query = params.toString()
  return query ? `${window.location.pathname}?${query}` : window.location.pathname
}

export function useModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fullpageSetForCurrentModalRef = useRef<string | null>(null)
  
  const isOpen = useModalState((state) => state.isOpen)
  const activeId = useModalState((state) => state.activeId)
  const activeIndex = useModalState((state) => state.activeIndex)
  const orderedIds = useModalState((state) => state.orderedIds)
  const sourceLayoutId = useModalState((state) => state.sourceLayoutId)
  const overrideMode = useModalState((state) => state.overrideMode)
  const content = useModalState((state) => state.content)
  const context = useModalState((state) => state.context)
  const metadata = useModalState((state) => state.metadata)

  const setIsOpen = useModalState((state) => state.setIsOpen)
  const setActiveId = useModalState((state) => state.setActiveId)
  const setActiveIndex = useModalState((state) => state.setActiveIndex)
  const setOrderedIds = useModalState((state) => state.setOrderedIds)
  const setSourceLayoutId = useModalState((state) => state.setSourceLayoutId)
  const setOverrideMode = useModalState((state) => state.setOverrideMode)
  const setContent = useModalState((state) => state.setContent)
  const setContext = useModalState((state) => state.setContext)
  const setMetadata = useModalState((state) => state.setMetadata)
  const reset = useModalState((state) => state.reset)

  const open = useCallback(
    (id: string, options?: ModalOpenOptions) => {
      closingGuardId = null
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      const modalContent: ModalContent = options?.content && isValidContent(options.content) ? options.content : "intervention"

      params.delete(LEGACY_MODAL_PARAM)
      params.delete(LEGACY_CONTENT_PARAM)
      params.set(MODAL_PARAM, id)
      if (modalContent !== "intervention") {
        params.set(CONTENT_PARAM, modalContent)
      } else {
        params.delete(CONTENT_PARAM)
      }

      let nextIndex = -1
      const hasOrderedIds = Array.isArray(options?.orderedIds) && options.orderedIds.length > 0
      if (hasOrderedIds) {
        const ids = options!.orderedIds!
        nextIndex = options?.index ?? Math.max(0, ids.indexOf(id))
        setOrderedIds(ids)
      } else {
        setOrderedIds([])
        if (typeof options?.index === "number") {
          nextIndex = options.index
        }
      }

      setActiveIndex(nextIndex)
      setActiveId(id)
      setSourceLayoutId(options?.layoutId ?? null)
      setOverrideMode(options?.modeOverride ?? null)
      setContent(modalContent)
      setContext(options?.context ?? null)
      setMetadata(options?.origin ? { origin: options.origin } : null)
      setIsOpen(true)
      pendingModalId = id

      if (typeof window !== "undefined") {
        const url = buildUrl(params)
        router.push(url, { scroll: false })
      }
    },
    [
      router,
      searchParams,
      setActiveId,
      setActiveIndex,
      setContent,
      setContext,
      setIsOpen,
      setMetadata,
      setOrderedIds,
      setOverrideMode,
      setSourceLayoutId,
    ],
  )

  const close = useCallback(() => {
    // Guard: only close if actually open
    if (!isOpen) return

    const closingId =
      searchParams?.get(MODAL_PARAM) ??
      searchParams?.get(LEGACY_MODAL_PARAM) ??
      activeId ??
      null
    closingGuardId = closingId
    pendingModalId = null
    fullpageSetForCurrentModalRef.current = null

    reset()
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete(MODAL_PARAM)
    params.delete(CONTENT_PARAM)
    params.delete(LEGACY_MODAL_PARAM)
    params.delete(LEGACY_CONTENT_PARAM)

    if (typeof window !== "undefined") {
      const url = buildUrl(params)
      router.replace(url, { scroll: false })
    }
  }, [activeId, isOpen, reset, router, searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return

    const modalId = searchParams?.get(MODAL_PARAM)
    const legacyModalId = searchParams?.get(LEGACY_MODAL_PARAM)
    const needsMigration = !modalId && Boolean(legacyModalId)

    if (needsMigration && legacyModalId) {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set(MODAL_PARAM, legacyModalId)
      params.delete(LEGACY_MODAL_PARAM)

      const legacyContent = params.get(LEGACY_CONTENT_PARAM)
      if (legacyContent) {
        params.set(CONTENT_PARAM, legacyContent)
        params.delete(LEGACY_CONTENT_PARAM)
      }

      router.replace(buildUrl(params), { scroll: false })
      return
    }

    const rawContent = searchParams?.get(CONTENT_PARAM) ?? searchParams?.get(LEGACY_CONTENT_PARAM)

    if (!modalId) {
      if (closingGuardId) {
        closingGuardId = null
      }
      if (!pendingModalId && isOpen) {
        reset()
      }
      return
    }

    const nextContent: ModalContent = isValidContent(rawContent) ? rawContent : "intervention"
    
    // Vérifier si le modal est déjà ouvert avec le bon ID et le bon contenu
    // Si c'est le cas et qu'il n'y a pas de pendingModalId, ne rien faire pour éviter la double ouverture
    const isAlreadyOpen = isOpen && activeId === modalId && content === nextContent
    
    // Si le modal est déjà ouvert correctement et qu'il n'y a pas d'ouverture en cours, ne rien faire
    if (isAlreadyOpen && !pendingModalId) {
      return
    }

    if (pendingModalId && modalId !== pendingModalId) {
      return
    }

    if (closingGuardId && closingGuardId === modalId) {
      return
    }

    if (closingGuardId) {
      closingGuardId = null
    }

    if (pendingModalId) {
      pendingModalId = null
    }
    
    // Forcer le mode fullpage si le modal est ouvert depuis l'URL (nouvelle page ou nouvel onglet)
    // Dans un nouvel onglet, activeId sera null et isOpen sera false au premier rendu
    // On détecte l'ouverture depuis l'URL si :
    // - Le modalId est présent dans l'URL
    // - Ce n'est pas une ouverture programmatique (pas de pendingModalId)
    // - Le modal n'est pas déjà ouvert avec cet ID OU le modal n'est pas ouvert du tout
    const isNewModalOpen = activeId !== modalId || !isOpen
    const isOpeningFromUrl = modalId && !pendingModalId && isNewModalOpen
    
    // Réinitialiser le ref si on change de modal
    if (fullpageSetForCurrentModalRef.current !== modalId) {
      fullpageSetForCurrentModalRef.current = null
    }
    
    // Forcer le mode fullpage pour les ouvertures depuis l'URL (nouvel onglet ou navigation directe)
    // On vérifie si on n'a pas déjà défini le mode fullpage pour ce modal
    if (isOpeningFromUrl && nextContent === "intervention" && fullpageSetForCurrentModalRef.current !== modalId) {
      // Toujours forcer le mode fullpage pour les ouvertures depuis l'URL, même si overrideMode est déjà défini
      // car dans un nouvel onglet, overrideMode sera null au premier rendu
      setOverrideMode("fullpage")
      fullpageSetForCurrentModalRef.current = modalId
    }
    
    if (activeId !== modalId) {
      setActiveId(modalId)
    }
    if (content !== nextContent) {
      setContent(nextContent)
    }
    if (!isOpen) {
      setIsOpen(true)
    }
  }, [
    activeId,
    content,
    isOpen,
    overrideMode,
    reset,
    router,
    searchParams,
    setActiveId,
    setContent,
    setIsOpen,
    setOverrideMode,
  ])

  // Effet séparé pour forcer le mode fullpage lors de l'ouverture depuis l'URL dans un nouvel onglet
  // Cet effet s'exécute après que le modal soit ouvert pour s'assurer que le mode est bien défini
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isOpen) return
    
    const modalId = searchParams?.get(MODAL_PARAM)
    if (!modalId) return
    
    // Vérifier que le modal actif correspond à celui dans l'URL
    if (activeId !== modalId) return
    
    // Vérifier que c'est bien une intervention
    const rawContent = searchParams?.get(CONTENT_PARAM) ?? searchParams?.get(LEGACY_CONTENT_PARAM)
    const nextContent: ModalContent = isValidContent(rawContent) ? rawContent : "intervention"
    if (nextContent !== "intervention" || content !== "intervention") return
    
    // Si le modal vient d'être ouvert depuis l'URL (pas de pendingModalId) 
    // et qu'on n'a pas encore défini le mode fullpage pour ce modal, le définir maintenant
    if (!pendingModalId && fullpageSetForCurrentModalRef.current !== modalId) {
      setOverrideMode("fullpage")
      fullpageSetForCurrentModalRef.current = modalId
    }
  }, [isOpen, activeId, content, searchParams, setOverrideMode])

  return {
    isOpen,
    activeId,
    activeIndex,
    orderedIds,
    sourceLayoutId,
    overrideMode,
    content,
    context,
    metadata,
    open,
    close,
  }
}

export default useModal
