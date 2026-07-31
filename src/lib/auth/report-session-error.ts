"use client"

import { isDailySessionExpired, isSessionUnavailableError } from "@/lib/auth/session-expiry"
import { useSessionExpiry } from "@/stores/sessionExpiry"

/**
 * Bascule l'application sur l'écran de reconnexion quand une erreur traduit une
 * session inexploitable. Sans effet sur les autres erreurs.
 *
 * Sans cela, l'échec reste invisible : la requête ne revient jamais et l'écran
 * charge indéfiniment. C'est ce qui se produisait sur un onglet laissé ouvert
 * toute la nuit, dont le refresh de token au réveil monopolise le lock auth
 * au-delà des 10 s que les autres requêtes acceptent d'attendre.
 *
 * @returns `true` si l'erreur a été reconnue comme une expiration de session.
 */
export function reportSessionError(error: unknown): boolean {
  if (typeof window === "undefined") return false
  if (!isSessionUnavailableError(error)) return false

  // Le cookie tranche entre les deux causes : jour révolu (reconnexion requise)
  // ou session simplement inaccessible sur le moment (rechargement suffisant).
  const reason = isDailySessionExpired(document.cookie) ? "daily-expired" : "session-unavailable"
  useSessionExpiry.getState().raise(reason)
  return true
}
