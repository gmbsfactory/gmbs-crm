"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePagePresence } from "@/hooks/usePagePresence"
import type { PagePresenceUser } from "@/types/presence"

interface PagePresenceContextValue {
  viewers: PagePresenceUser[]
  allUsers: PagePresenceUser[]
  updateActiveIntervention: (interventionId: string | null) => void
  updateActiveArtisan: (artisanId: string | null) => void
}

const PagePresenceContext = createContext<PagePresenceContextValue | undefined>(undefined)

export function PagePresenceProvider({ pageName, children }: { pageName: string | null; children: ReactNode }) {
  const { viewers, allUsers, updateActiveIntervention, updateActiveArtisan } = usePagePresence(pageName)
  return (
    <PagePresenceContext.Provider value={{ viewers, allUsers, updateActiveIntervention, updateActiveArtisan }}>
      {children}
    </PagePresenceContext.Provider>
  )
}

export function usePagePresenceContext() {
  return useContext(PagePresenceContext) // Peut retourner undefined si hors Provider
}
