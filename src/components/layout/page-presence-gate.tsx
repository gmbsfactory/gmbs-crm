"use client"

import { usePathname } from "next/navigation"
import { useMemo, type ReactNode } from "react"
import { PagePresenceProvider } from "@/contexts/PagePresenceContext"

/** Pages where page-level presence tracking is enabled */
const PRESENCE_PAGES = new Set(["interventions", "artisans", "comptabilite", "dashboard"])

/**
 * Wraps children with PagePresenceProvider when on a presence-enabled page.
 * Must be placed above both TopbarGate and page content in the layout tree
 * so the context is accessible from both the topbar and the page components.
 */
export function PagePresenceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const pageName = useMemo(() => {
    if (!pathname) return null
    const seg = pathname.split("/").filter(Boolean)[0] || "dashboard"
    return PRESENCE_PAGES.has(seg) ? seg : null
  }, [pathname])

  if (pageName) {
    return (
      <PagePresenceProvider pageName={pageName}>
        {children}
      </PagePresenceProvider>
    )
  }

  return <>{children}</>
}
