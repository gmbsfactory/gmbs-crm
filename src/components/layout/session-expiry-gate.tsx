"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SessionExpiredScreen } from "@/components/layout/session-expired-screen"
import { useDailySessionGuard } from "@/hooks/useDailySessionGuard"
import { useSessionExpiry } from "@/stores/sessionExpiry"
import { isPublicPath } from "@/lib/auth/session-expiry"

/**
 * Substitue un écran de reconnexion à l'interface dès que la session n'est plus
 * exploitable, au lieu de laisser tourner un chargement indéfini.
 *
 * Deux sources alimentent cet état :
 * - `useDailySessionGuard` — le jour a changé, l'onglet doit repasser par le
 *   portail (il redirige de lui-même ; l'écran ne sert que de filet le temps de
 *   la navigation) ;
 * - le `QueryCache` global — une requête a échoué faute de session accessible
 *   (cf. `ReactQueryProvider`).
 */
export function SessionExpiryGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reason = useSessionExpiry((state) => state.reason)

  useDailySessionGuard()

  // Les pages publiques n'ont pas de session à surveiller — la page de login en
  // particulier, qui est justement la destination.
  if (isPublicPath(pathname)) {
    return <>{children}</>
  }

  if (reason) {
    return <SessionExpiredScreen reason={reason} />
  }

  return <>{children}</>
}
