"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePagePresence } from "@/hooks/usePagePresence"
import type { CrmPresenceState, PagePresenceUser } from "@/types/presence"

interface PagePresenceContextValue {
  viewers: PagePresenceUser[]
  allUsers: PagePresenceUser[]
  updateActiveIntervention: (interventionId: string | null, label?: string | null) => void
  updateActiveArtisan: (artisanId: string | null, label?: string | null) => void
}

const PagePresenceContext = createContext<PagePresenceContextValue | undefined>(undefined)

interface PagePresenceProviderProps {
  pageName: string | null
  isIdle?: boolean
  presenceState?: CrmPresenceState
  lastActiveAt?: string | null
  idleSinceAt?: string | null
  children: ReactNode
}

export function PagePresenceProvider({
  pageName,
  isIdle = false,
  presenceState = isIdle ? "idle" : "active",
  lastActiveAt = null,
  idleSinceAt = null,
  children,
}: PagePresenceProviderProps) {
  const { viewers, allUsers, updateActiveIntervention, updateActiveArtisan } = usePagePresence(
    pageName,
    isIdle,
    presenceState,
    lastActiveAt,
    idleSinceAt,
  )
  return (
    <PagePresenceContext.Provider value={{ viewers, allUsers, updateActiveIntervention, updateActiveArtisan }}>
      {children}
    </PagePresenceContext.Provider>
  )
}

export function usePagePresenceContext() {
  return useContext(PagePresenceContext) // Peut retourner undefined si hors Provider
}
