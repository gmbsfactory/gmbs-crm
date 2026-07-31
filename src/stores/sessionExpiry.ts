"use client"

import { create } from "zustand"
import type { SessionExpiryReason } from "@/lib/auth/session-expiry"

/**
 * Nombre d'échecs requis avant de masquer l'interface sur un motif incertain.
 *
 * Quand la session est réellement morte, tout échoue d'un bloc — le référentiel
 * lance six requêtes en parallèle, le seuil tombe immédiatement. À l'inverse,
 * une requête de fond isolée qui bute sur un lock saturé ne doit pas faire
 * disparaître l'écran d'un utilisateur en train de travailler.
 */
const UNAVAILABLE_THRESHOLD = 2

/** Au-delà de ce délai, deux échecs ne racontent plus le même incident. */
const UNAVAILABLE_WINDOW_MS = 30 * 1000

interface SessionExpiryState {
  /** Motif d'expiration retenu, ou `null` tant que la session est exploitable. */
  reason: SessionExpiryReason | null
  /**
   * Signale une session inexploitable.
   *
   * `daily-expired` bascule sans attendre : le cookie fait foi, la reconnexion
   * est certaine. `session-unavailable` n'est qu'un symptôme, et attend d'être
   * confirmé par un second échec rapproché.
   *
   * Le premier motif retenu gagne : une rafale de requêtes en échec ne doit pas
   * faire osciller l'écran affiché.
   */
  raise: (reason: SessionExpiryReason, now?: number) => void
  /** Réinitialise l'état (reconnexion réussie, ou rechargement manuel). */
  clear: () => void
}

interface UnavailableTracker {
  count: number
  firstAt: number
}

let tracker: UnavailableTracker | null = null

/**
 * État global « la session n'est plus exploitable ».
 *
 * Alimenté depuis deux endroits :
 * - le `QueryCache` global, quand une requête échoue sur une erreur de session
 *   (cf. `ReactQueryProvider`) ;
 * - le garde de réveil d'onglet, quand le jour a changé (cf. `useDailySessionGuard`).
 *
 * Consommé par `SessionExpiryGate`, qui substitue un écran de reconnexion à
 * l'interface plutôt que de laisser tourner un chargement sans fin.
 *
 * Zustand plutôt qu'un Context : l'état est levé depuis des callbacks hors arbre
 * React (le `QueryCache`), qui n'ont pas accès aux providers.
 */
export const useSessionExpiry = create<SessionExpiryState>((set, get) => ({
  reason: null,
  raise: (reason, now = Date.now()) => {
    if (get().reason) return

    if (reason === "daily-expired") {
      tracker = null
      set({ reason })
      return
    }

    if (!tracker || now - tracker.firstAt > UNAVAILABLE_WINDOW_MS) {
      tracker = { count: 1, firstAt: now }
    } else {
      tracker.count += 1
    }

    if (tracker.count >= UNAVAILABLE_THRESHOLD) {
      tracker = null
      set({ reason })
    }
  },
  clear: () => {
    tracker = null
    set({ reason: null })
  },
}))
