"use client"

import { useCallback } from "react"
import { TrendingUp, DollarSign, Activity, Clock, Percent } from "lucide-react"
import { KPICard } from "@/components/admin-dashboard/KPICard"
import { Skeleton } from "@/components/ui/skeleton"
import type { AdminDashboardStats } from "./types"

interface DashboardKPIsProps {
  dashboardStats: AdminDashboardStats | undefined
  isLoading: boolean
  onOpenInterventionsModal: () => void
  onOpenTransformationModal: () => void
  onOpenCycleTimeModal: () => void
  onOpenRevenueModal: () => void
  onOpenMarginModal: () => void
}

export function DashboardKPIs({
  dashboardStats,
  isLoading,
  onOpenInterventionsModal,
  onOpenTransformationModal,
  onOpenCycleTimeModal,
  onOpenRevenueModal,
  onOpenMarginModal,
}: DashboardKPIsProps) {
  const formatNumber = useCallback(
    (num: number) => new Intl.NumberFormat("fr-FR").format(num),
    []
  )

  const formatCurrency = useCallback(
    (num: number) =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num),
    []
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KPICard
        title="Interventions"
        value={formatNumber(dashboardStats?.mainStats.nbInterventionsDemandees || 0)}
        icon={Activity}
        trend={{
          value: Math.round(Math.abs(dashboardStats?.mainStats.deltaInterventions || 0) * 10) / 10,
          isPositive: (dashboardStats?.mainStats.deltaInterventions || 0) >= 0,
          label: "vs période préc.",
        }}
        sparklineData={dashboardStats?.sparklines.map((s) => ({
          date: s.date,
          value: s.countDemandees,
        }))}
        description={`${formatNumber(dashboardStats?.mainStats.nbInterventionsTerminees || 0)} terminées`}
        onClick={onOpenInterventionsModal}
      />
      <KPICard
        title="Taux Transformation"
        value={`${(dashboardStats?.mainStats.tauxTransformation || 0).toFixed(1)}%`}
        icon={Percent}
        description="Demandées / Terminées"
        className="border-l-purple-500"
        onClick={onOpenTransformationModal}
      />
      <KPICard
        title="Cycle Moyen"
        value={`${dashboardStats?.mainStats.avgCycleTime || 0}j`}
        icon={Clock}
        description="Délai moyen de traitement"
        className="border-l-amber-500"
        onClick={onOpenCycleTimeModal}
      />
      <KPICard
        title="Chiffre d'Affaires"
        value={formatCurrency(dashboardStats?.mainStats.chiffreAffaires || 0)}
        icon={DollarSign}
        trend={{
          value:
            Math.round(Math.abs(dashboardStats?.mainStats.deltaChiffreAffaires || 0) * 10) / 10,
          isPositive: (dashboardStats?.mainStats.deltaChiffreAffaires || 0) >= 0,
          label: "vs période préc.",
        }}
        sparklineData={dashboardStats?.sparklines.map((s) => ({
          date: s.date,
          value: s.ca_jour || 0,
        }))}
        className="border-l-blue-500"
        onClick={onOpenRevenueModal}
        showCurrencyInSparkline={true}
      />
      <KPICard
        title="Marge Globale"
        value={formatCurrency(dashboardStats?.mainStats.marge || 0)}
        icon={TrendingUp}
        trend={{
          value: Math.round(Math.abs(dashboardStats?.mainStats.deltaMarge || 0) * 10) / 10,
          isPositive: (dashboardStats?.mainStats.deltaMarge || 0) >= 0,
          label: "vs période préc.",
        }}
        sparklineData={dashboardStats?.sparklines.map((s) => ({
          date: s.date,
          value: s.marge_jour || 0,
        }))}
        description={`Taux de marge: ${dashboardStats?.mainStats.tauxMarge || 0}%`}
        className="border-l-emerald-500"
        onClick={onOpenMarginModal}
        showCurrencyInSparkline={true}
      />
    </div>
  )
}
