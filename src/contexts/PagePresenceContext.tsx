"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePagePresence } from "@/hooks/usePagePresence"
import type { PagePresenceUser } from "@/types/presence"

interface PagePresenceContextValue {
  viewers: PagePresenceUser[]
  updateActiveIntervention: (interventionId: string | null) => void
}

const PagePresenceContext = createContext<PagePresenceContextValue | undefined>(undefined)

export function PagePresenceProvider({ pageName, children }: { pageName: string; children: ReactNode }) {
  const { viewers, updateActiveIntervention } = usePagePresence(pageName)
  return (
    <PagePresenceContext.Provider value={{ viewers, updateActiveIntervention }}>
      {children}
    </PagePresenceContext.Provider>
  )
}

export function usePagePresenceContext() {
  return useContext(PagePresenceContext) // Peut retourner undefined si hors Provider
}
