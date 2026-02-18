"use client"

import { usePathname } from "next/navigation"
import { useMemo, type ReactNode } from "react"
import { PagePresenceProvider } from "@/contexts/PagePresenceContext"
import { useIdleDetector } from "@/hooks/useIdleDetector"
import { IdleScreensaver } from "@/components/layout/IdleScreensaver"

/** Pages where page-level presence tracking is enabled */
const PRESENCE_PAGES = new Set(["interventions", "artisans", "comptabilite", "dashboard"])

/**
 * Wraps children with PagePresenceProvider using a single global Presence channel.
 * The provider is ALWAYS mounted so the WebSocket channel stays alive across navigations.
 * pageName is null for non-presence pages (the hook tracks but shows empty viewers).
 *
 * Also runs idle detection and displays the DVD bouncing screensaver when idle.
 *
 * Must be placed above both TopbarGate and page content in the layout tree
 * so the context is accessible from both the topbar and the page components.
 */
export function PagePresenceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isIdle = useIdleDetector()

  const pageName = useMemo(() => {
    if (!pathname) return null
    const seg = pathname.split("/").filter(Boolean)[0] || "dashboard"
    return PRESENCE_PAGES.has(seg) ? seg : null
  }, [pathname])

  return (
    <PagePresenceProvider pageName={pageName} isIdle={isIdle}>
      <IdleScreensaver isIdle={isIdle} />
      {children}
    </PagePresenceProvider>
  )
}
