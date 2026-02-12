"use client"

import { create } from "zustand"

export interface AIViewContext {
  activeViewId: string | undefined
  activeViewTitle: string | undefined
  activeViewLayout: string | undefined
  appliedFilters: Array<{ property: string; operator: string; value: unknown }>
}

interface AIContextStore {
  viewContext: AIViewContext | null
  setViewContext: (ctx: AIViewContext | null) => void
  clearViewContext: () => void
}

export const useAIContextStore = create<AIContextStore>((set) => ({
  viewContext: null,
  setViewContext: (viewContext) => set({ viewContext }),
  clearViewContext: () => set({ viewContext: null }),
}))
