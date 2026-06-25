"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useActivityTracker } from "@/hooks/useActivityTracker"
import { useIdleDetector } from "@/hooks/useIdleDetector"
import { DEFAULT_PRESENCE_SETTINGS, usePresenceSettings } from "@/hooks/usePresenceSettings"

/** Modal contents (param `mc`) qui correspondent à une intervention ouverte. */
const INTERVENTION_CONTENTS = new Set([null, "intervention"])

/**
 * Invisible component that tracks page visit sessions in the database.
 * Must be placed inside the authenticated layout to have access to useCurrentUser.
 *
 * - Detects the current page from the URL pathname.
 * - Detects the intervention actually open (modal via `?i=<id>&mc=intervention`)
 *   so the time is attributed to the real intervention, not just the list page.
 * - Pauses tracking when the user is idle (and credits only real active time).
 */
export function ActivityTrackerGate() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageName = pathname?.split("/").filter(Boolean)[0] || "dashboard"
  const { data: presenceSettings = DEFAULT_PRESENCE_SETTINGS } = usePresenceSettings()
  const { isIdle, getLastActiveAt } = useIdleDetector(presenceSettings.idleAfterMinutes * 60_000)

  // Intervention réellement ouverte : modal `?i=<id>` avec un contenu intervention.
  const modalId = searchParams?.get("i") ?? null
  const modalContent = searchParams?.get("mc") ?? null
  const interventionId = modalId && INTERVENTION_CONTENTS.has(modalContent) ? modalId : null

  useActivityTracker(pageName, isIdle, getLastActiveAt, interventionId)
  return null
}
