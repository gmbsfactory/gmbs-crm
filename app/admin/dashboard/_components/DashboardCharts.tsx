"use client"

import { FunnelChart } from "@/components/admin-dashboard/FunnelChart"
import { StackedBarChart } from "@/components/admin-dashboard/StackedBarChart"
import type { AdminDashboardStats } from "./types"

/** Funnel step configuration */
const FUNNEL_STEPS = [
  { code: "DEMANDE", label: "Demandé", fill: "#60a5fa" },
  { code: "DEVIS_ENVOYE", label: "Devis Envoyé", fill: "#3b82f6" },
  { code: "ACCEPTE", label: "Accepté", fill: "#2563eb" },
  { code: "INTER_EN_COURS", label: "En Cours", fill: "#1d4ed8" },
  { code: "INTER_TERMINEE", label: "Terminé", fill: "#10b981" },
] as const

interface DashboardChartsProps {
  dashboardStats: AdminDashboardStats | undefined
  isLoading: boolean
  startDate: string | null
  endDate: string | null
}

export function DashboardCharts({
  dashboardStats,
  isLoading,
  startDate,
  endDate,
}: DashboardChartsProps) {
  const funnelData = FUNNEL_STEPS.map((step) => {
    const stat = dashboardStats?.conversionFunnel?.find(
      (s) => s.statusCode === step.code
    )
    return {
      name: step.label,
      value: stat?.count || 0,
      fill: step.fill,
    }
  })

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      {/* Entonnoir de Conversion */}
      <div className="col-span-1">
        <FunnelChart
          data={funnelData}
          title="Entonnoir de Conversion"
          description="Conversions des interventions"
        />
      </div>

      {/* Stacked Bar Chart : Evolution volumetrie par statut */}
      <div className="col-span-1">
        <StackedBarChart
          data={dashboardStats?.volumeByStatus}
          isLoading={isLoading}
          periodStart={startDate || undefined}
          periodEnd={endDate || undefined}
          title="Évolution de la Volumétrie"
          description="Répartition quotidienne des interventions par statut"
        />
      </div>
    </div>
  )
}
