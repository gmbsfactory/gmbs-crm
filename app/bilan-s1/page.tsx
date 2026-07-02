"use client"

import { ShieldAlert } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { Skeleton } from "@/components/ui/skeleton"
import { useBilanS1Metrics } from "./_lib/useBilanS1Metrics"
import { FALLBACK_METRICS } from "@/lib/bilan-s1/fallback"
import { ScreenAdoption } from "./_components/ScreenAdoption"
import { ScreenSupport } from "./_components/ScreenSupport"
import { ScreenRapport } from "./_components/ScreenRapport"
import "./bilan-s1.css"

/**
 * Bilan S1 — dashboard de la réunion bilan (ven 03/07), réservé aux devs.
 * 3 écrans (adoption live / signalements & réactivité / rapport final),
 * mêmes contenus que le dashboard standalone reunion-bilan-s1/, rafraîchis
 * toutes les 60 s via /api/bilan-s1/metrics.
 */
export default function BilanS1Page() {
  const { hasRole, isLoading: isLoadingPerms } = usePermissions()
  const isDev = hasRole("dev")
  const { data, isError } = useBilanS1Metrics(!isLoadingPerms && isDev)

  if (isLoadingPerms) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="flex-1 rounded-lg" />
      </div>
    )
  }
  if (!isDev) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 opacity-40" />
        <p className="text-sm">Page réservée aux développeurs.</p>
      </div>
    )
  }

  // Repli hors ligne : la page reste présentable même si la route échoue.
  const metrics = data ?? FALLBACK_METRICS
  const offline = isError || !data

  return (
    <div className="bilan-s1">
      <ScreenAdoption m={metrics} offline={offline} />
      <ScreenSupport m={metrics} />
      <ScreenRapport m={metrics} />
    </div>
  )
}
