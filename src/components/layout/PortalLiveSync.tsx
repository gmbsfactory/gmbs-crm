"use client"

import { usePortalLiveSync } from "@/hooks/usePortalLiveSync"

/**
 * Monte une fois pour toute l'application le canal temps reel du portail
 * artisans (photos, rapports, pieces). Ne rend rien.
 *
 * Place a cote de <UpdatesModal /> dans app/layout.tsx, c'est-a-dire dans le
 * chrome des pages authentifiees : les pages publiques (/login, /portail) ne
 * le montent pas.
 */
export default function PortalLiveSync() {
  usePortalLiveSync()
  return null
}
