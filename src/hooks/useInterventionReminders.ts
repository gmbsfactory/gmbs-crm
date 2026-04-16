"use client"

import { useRemindersQuery } from "@/hooks/useRemindersQuery"

/**
 * Hook pour gérer les reminders d'interventions
 * Utilise TanStack Query pour le fetching, caching et les mutations
 */
export function useInterventionReminders() {
  return useRemindersQuery()
}
