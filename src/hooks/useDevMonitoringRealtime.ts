"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"

/**
 * Temps réel du Monitoring DEV.
 *
 * S'abonne aux INSERT des journaux d'audit (intervention_audit_log, artisan_audit_log)
 * — exposés au Realtime par la migration 99059 — et invalide les requêtes du
 * monitoring-dev pour rafraîchir le flux d'actions et les statistiques en direct.
 *
 * - Un seul canal dédié `monitoring-dev-audit`, monté uniquement sur la page (donc
 *   pour les dev), indépendant de `crm-sync`.
 * - Invalidations DÉBOUNCÉES : une rafale d'événements d'audit (un UPDATE multi-champs
 *   déclenche plusieurs lignes) ne provoque qu'un seul refetch.
 * - Filet de sécurité au réveil : sur retour d'onglet visible, on invalide une fois pour
 *   rattraper les événements éventuellement manqués pendant une coupure socket silencieuse.
 */

/** Préfixes de clés TanStack Query à rafraîchir quand un événement d'audit arrive. */
const DEV_QUERY_KEYS = [
  "global-activity-feed",
  "team-weekly-stats",
  "team-connections",
  "top-entities",
  "activity-heatmap",
  "team-daily-overview",
  "user-daily-activity",
] as const

/** Fenêtre de regroupement des invalidations (un burst d'audit = 1 refetch). */
const INVALIDATE_DEBOUNCE_MS = 800

export function useDevMonitoringRealtime(enabled = true): void {
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const invalidateNow = () => {
      for (const key of DEV_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" })
      }
    }

    const scheduleInvalidate = () => {
      if (debounceRef.current) return // un refetch est déjà programmé pour ce burst
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        invalidateNow()
      }, INVALIDATE_DEBOUNCE_MS)
    }

    const channel = supabase
      .channel("monitoring-dev-audit")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intervention_audit_log" },
        scheduleInvalidate,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "artisan_audit_log" },
        scheduleInvalidate,
      )
      .subscribe()

    // Filet de sécurité : au retour au premier plan, rattraper d'éventuels événements
    // manqués si la socket avait été coupée silencieusement en arrière-plan.
    const handleVisible = () => {
      if (!document.hidden) invalidateNow()
    }
    document.addEventListener("visibilitychange", handleVisible)

    return () => {
      document.removeEventListener("visibilitychange", handleVisible)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])
}
