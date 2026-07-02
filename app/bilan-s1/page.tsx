"use client"

import { ShieldAlert } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { useBilanS1Visibility } from "@/hooks/useBilanS1Visibility"
import { Skeleton } from "@/components/ui/skeleton"
import { useBilanS1Metrics } from "./_lib/useBilanS1Metrics"
import { FALLBACK_METRICS } from "@/lib/bilan-s1/fallback"
import { ScreenAdoption } from "./_components/ScreenAdoption"
import { ScreenSupport } from "./_components/ScreenSupport"
import { ScreenRapport } from "./_components/ScreenRapport"
import "./bilan-s1.css"

/**
 * Bilan S1 — dashboard de la réunion bilan (ven 03/07).
 * Accès : devs, plus les rôles/utilisateurs ouverts via le panneau
 * « Visibilité » de la topbar (éventuellement temporaire — table
 * page_visibility). 3 écrans rafraîchis toutes les 60 s.
 */
export default function BilanS1Page() {
  const { hasRole, isLoading: isLoadingPerms } = usePermissions()
  const { data: visibility, isLoading: isLoadingVisibility } = useBilanS1Visibility()
  const isDev = hasRole("dev") || visibility?.isDev === true
  const canView = isDev || visibility?.canView === true
  const { data, isError } = useBilanS1Metrics(canView)

  if (isLoadingPerms || (isLoadingVisibility && !isDev)) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="flex-1 rounded-lg" />
      </div>
    )
  }
  if (!canView) {
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
