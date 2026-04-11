"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useShallow } from "zustand/react/shallow"
import { useModalState } from "./useModalState"
import type { ModalContent, ModalOpenOptions } from "@/types/modal"

const VALID_CONTENT: ModalContent[] = ["intervention", "chat", "artisan", "new-intervention", "new-artisan", "edit-artisan"]

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

  const { isOpen, activeId, activeIndex, orderedIds, sourceLayoutId, overrideMode, content, context, metadata } =
    useModalState(useShallow((state) => ({
      isOpen: state.isOpen,
      activeId: state.activeId,
      activeIndex: state.activeIndex,
      orderedIds: state.orderedIds,
      sourceLayoutId: state.sourceLayoutId,
      overrideMode: state.overrideMode,
      content: state.content,
      context: state.context,
      metadata: state.metadata,
    })))

  const { setIsOpen, setActiveId, setActiveIndex, setOrderedIds, setSourceLayoutId, setOverrideMode, setContent, setContext, setMetadata, reset } =
    useModalState(useShallow((state) => ({
      setIsOpen: state.setIsOpen,
      setActiveId: state.setActiveId,
      setActiveIndex: state.setActiveIndex,
      setOrderedIds: state.setOrderedIds,
      setSourceLayoutId: state.setSourceLayoutId,
      setOverrideMode: state.setOverrideMode,
      setContent: state.setContent,
      setContext: state.setContext,
      setMetadata: state.setMetadata,
      reset: state.reset,
    })))

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
      // Fusionner les metadata passées avec l'origin
      const metadataToSet = {
        ...(options?.metadata ?? {}),
        ...(options?.origin ? { origin: options.origin } : {}),
      }
      setMetadata(Object.keys(metadataToSet).length > 0 ? metadataToSet : null)
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
    // Si c'est le cas, ne rien faire pour éviter la fermeture/réouverture
    const isAlreadyOpen = isOpen && activeId === modalId && content === nextContent

    // Si le modal est déjà ouvert correctement, ne rien faire
    // Même si pendingModalId est défini, on évite la fermeture/réouverture
    if (isAlreadyOpen) {
      // Réinitialiser pendingModalId pour éviter les problèmes futurs
      if (pendingModalId === modalId) {
        pendingModalId = null
      }
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

    // Forcer le mode fullpage uniquement si le modal est ouvert depuis un nouvel onglet ou un chargement direct
    // On détecte cela en vérifiant si c'est un chargement initial de la page (pas une navigation SPA)
    const isInitialPageLoad = typeof window !== "undefined" &&
      typeof performance !== "undefined" &&
      performance.getEntriesByType('navigation').length > 0 &&
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type === 'navigate'

    // Réinitialiser le ref si on change de modal
    if (fullpageSetForCurrentModalRef.current !== modalId) {
      fullpageSetForCurrentModalRef.current = null
    }

    // Forcer le mode fullpage UNIQUEMENT pour les chargements initiaux de page avec un modal dans l'URL
    // (nouvel onglet ou navigation directe), PAS pour les ouvertures programmatiques normales
    if (isInitialPageLoad && modalId && nextContent === "intervention" && fullpageSetForCurrentModalRef.current !== modalId) {
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

  // Supprimer cet effet car il force aussi le fullpage de manière incorrecte
  // Le mode fullpage doit être forcé uniquement lors du chargement initial de la page
  // useEffect(() => {
  //   if (typeof window === "undefined") return
  //   if (!isOpen) return
  //   
  //   const modalId = searchParams?.get(MODAL_PARAM)
  //   if (!modalId) return
  //   
  //   // Vérifier que le modal actif correspond à celui dans l'URL
  //   if (activeId !== modalId) return
  //   
  //   // Vérifier que c'est bien une intervention
  //   const rawContent = searchParams?.get(CONTENT_PARAM) ?? searchParams?.get(LEGACY_CONTENT_PARAM)
  //   const nextContent: ModalContent = isValidContent(rawContent) ? rawContent : "intervention"
  //   if (nextContent !== "intervention" || content !== "intervention") return
  //   
  //   // Si le modal vient d'être ouvert depuis l'URL (pas de pendingModalId) 
  //   // et qu'on n'a pas encore défini le mode fullpage pour ce modal, le définir maintenant
  //   if (!pendingModalId && fullpageSetForCurrentModalRef.current !== modalId) {
  //     setOverrideMode("fullpage")
  //     fullpageSetForCurrentModalRef.current = modalId
  //   }
  // }, [isOpen, activeId, content, searchParams, setOverrideMode])

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