"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export interface PresenceSettings {
  idleAfterMinutes: number
  offlineAfterMinutes: number
  updatedAt: string | null
  updatedBy: string | null
}

export const DEFAULT_PRESENCE_SETTINGS: PresenceSettings = {
  idleAfterMinutes: 5,
  offlineAfterMinutes: 60,
  updatedAt: null,
  updatedBy: null,
}

export const presenceSettingsQueryKey = ["presence-settings"] as const

function coerceSettings(payload: Partial<PresenceSettings> | null | undefined): PresenceSettings {
  return {
    idleAfterMinutes: Number(payload?.idleAfterMinutes ?? DEFAULT_PRESENCE_SETTINGS.idleAfterMinutes),
    offlineAfterMinutes: Number(payload?.offlineAfterMinutes ?? DEFAULT_PRESENCE_SETTINGS.offlineAfterMinutes),
    updatedAt: payload?.updatedAt ?? null,
    updatedBy: payload?.updatedBy ?? null,
  }
}

export function usePresenceSettings() {
  const { data: currentUser } = useCurrentUser()

  return useQuery({
    queryKey: presenceSettingsQueryKey,
    queryFn: async (): Promise<PresenceSettings> => {
      const response = await fetch("/api/monitoring/presence-settings", {
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        if (response.status === 401) return DEFAULT_PRESENCE_SETTINGS
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Impossible de charger les réglages de présence")
      }

      return coerceSettings(await response.json())
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(currentUser?.id),
  })
}

export function useUpdatePresenceSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Pick<PresenceSettings, "idleAfterMinutes" | "offlineAfterMinutes">) => {
      const response = await fetch("/api/monitoring/presence-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Impossible d'enregistrer les réglages de présence")
      }

      return coerceSettings(payload)
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(presenceSettingsQueryKey, settings)
      queryClient.invalidateQueries({ queryKey: presenceSettingsQueryKey })
    },
  })
}
