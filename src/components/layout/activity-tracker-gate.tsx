"use client"

import { usePathname } from "next/navigation"
import { useActivityTracker } from "@/hooks/useActivityTracker"

/**
 * Invisible component that tracks page visit sessions in the database.
 * Must be placed inside the authenticated layout to have access to useCurrentUser.
 * Detects the current page from the URL pathname and passes it to useActivityTracker.
 */
export function ActivityTrackerGate() {
  const pathname = usePathname()
  const pageName = pathname?.split("/").filter(Boolean)[0] || "dashboard"
  useActivityTracker(pageName)
  return null
}
