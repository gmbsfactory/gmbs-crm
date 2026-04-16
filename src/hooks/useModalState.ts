"use client"

import { create } from "zustand"
import type { ModalDisplayMode } from "@/types/modal-display"
import type { ModalContent, ModalContextData } from "@/types/modal"

type ModalState = {
  isOpen: boolean
  activeId: string | null
  activeIndex: number
  orderedIds: string[]
  sourceLayoutId: string | null
  overrideMode: ModalDisplayMode | null
  content: ModalContent | null
  context: ModalContextData | null
  metadata: Record<string, unknown> | null
  closingGuardId: string | null
  pendingModalId: string | null
  setIsOpen: (value: boolean) => void
  setActiveId: (id: string | null) => void
  setActiveIndex: (index: number) => void
  setOrderedIds: (ids: string[]) => void
  setSourceLayoutId: (id: string | null) => void
  setOverrideMode: (mode: ModalDisplayMode | null) => void
  setContent: (content: ModalContent | null) => void
  setContext: (context: ModalContextData | null) => void
  setMetadata: (metadata: Record<string, unknown> | null) => void
  setClosingGuardId: (id: string | null) => void
  setPendingModalId: (id: string | null) => void
  reset: () => void
}

const initialState: Omit<
  ModalState,
  "setIsOpen" | "setActiveId" | "setActiveIndex" | "setOrderedIds" | "setSourceLayoutId" | "setOverrideMode" | "setContent" | "setContext" | "setMetadata" | "setClosingGuardId" | "setPendingModalId" | "reset"
> = {
  isOpen: false,
  activeId: null,
  activeIndex: -1,
  orderedIds: [],
  sourceLayoutId: null,
  overrideMode: null,
  content: null,
  context: null,
  metadata: null,
  closingGuardId: null,
  pendingModalId: null,
}

export const useModalState = create<ModalState>((set) => ({
  ...initialState,
  setIsOpen: (value) => set({ isOpen: value }),
  setActiveId: (id) => set({ activeId: id }),
  setActiveIndex: (index) => set({ activeIndex: index }),
  setOrderedIds: (ids) => set({ orderedIds: ids }),
  setSourceLayoutId: (id) => set({ sourceLayoutId: id }),
  setOverrideMode: (mode) => set({ overrideMode: mode }),
  setContent: (content) => set({ content }),
  setContext: (context) => set({ context }),
  setMetadata: (metadata) => set({ metadata }),
  setClosingGuardId: (id) => set({ closingGuardId: id }),
  setPendingModalId: (id) => set({ pendingModalId: id }),
  reset: () =>
    set((state) => ({
      ...initialState,
      // Préserver les guards de transition : ils sont posés AVANT reset() dans close()
      // pour empêcher l'URL-sync effect de réouvrir le modal pendant que router.replace
      // est en cours. Les écraser ici provoque un glitch close→reopen→close.
      closingGuardId: state.closingGuardId,
      pendingModalId: state.pendingModalId,
    })),
}))
