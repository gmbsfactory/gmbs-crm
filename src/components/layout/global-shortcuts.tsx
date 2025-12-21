"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

const ROUTE_CYCLE = [
  "/dashboard",
  "/interventions",
  "/artisans",
  "/settings",
]

export default function GlobalShortcuts() {
  // Navigation Tab globale désactivée - la navigation Tab est maintenant gérée localement
  // dans les composants ViewTabs et ArtisanViewTabs pour naviguer entre les vues pastillées
  return null
}
