"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  buildLoginUrl,
  isDailySessionExpired,
  isPublicPath,
} from "@/lib/auth/session-expiry"

/** Fréquence de vérification pendant qu'un onglet reste ouvert et visible. */
const CHECK_INTERVAL_MS = 60 * 1000

/**
 * Redirige vers le portail de reconnexion dès que la session quotidienne est
 * périmée, sans attendre qu'une navigation déclenche le contrôle serveur.
 *
 * Le CRM impose une reconnexion par jour (cf. `middleware.ts`), mais ce contrôle
 * ne s'applique qu'aux requêtes vers l'app. Un onglet laissé ouvert la nuit
 * repart donc le matin avec un jeton périmé : les requêtes Supabase, elles,
 * partent directement vers la base et échouent après le timeout du lock auth
 * (10 s), sans que l'utilisateur comprenne pourquoi.
 *
 * Le garde couvre les trois façons dont un onglet peut se retrouver dans cet
 * état : réveil après une nuit (`visibilitychange`), retour sur la fenêtre
 * (`focus`), et bascule de la date pendant que l'écran est resté affiché
 * (vérification périodique — la date pivote à 00 h UTC, soit 2 h du matin à
 * Paris en été).
 */
export function useDailySessionGuard(): void {
  const pathname = usePathname()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isPublicPath(pathname)) return

    const redirectToLogin = () => {
      if (hasRedirected.current) return
      if (!isDailySessionExpired(document.cookie)) return

      hasRedirected.current = true
      // Navigation complète plutôt qu'un router.push : on veut repasser par le
      // middleware et repartir d'une page vierge, sans les requêtes en vol.
      window.location.assign(buildLoginUrl(window.location.pathname, window.location.search))
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") redirectToLogin()
    }

    redirectToLogin()

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", redirectToLogin)
    const interval = setInterval(redirectToLogin, CHECK_INTERVAL_MS)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", redirectToLogin)
      clearInterval(interval)
    }
  }, [pathname])
}
