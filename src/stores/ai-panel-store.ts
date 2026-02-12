"use client"

import { create } from "zustand"

interface AIPanelStore {
  isPanelOpen: boolean
  panelInterventionId: string | null
  openPanel: (interventionId: string) => void
  closePanel: () => void
}

export const useAIPanelStore = create<AIPanelStore>((set) => ({
  isPanelOpen: false,
  panelInterventionId: null,
  openPanel: (interventionId) => set({ isPanelOpen: true, panelInterventionId: interventionId }),
  closePanel: () => set({ isPanelOpen: false, panelInterventionId: null }),
}))
