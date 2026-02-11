"use client"

import { useState, useMemo, useCallback } from "react"
import { FilterBar, FilterPeriodType } from "@/components/admin-dashboard/FilterBar"
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats"
import { AdminGuard } from "@/components/admin-dashboard/AdminGuard"
import { DashboardKPIs } from "./_components/DashboardKPIs"
import { DashboardCharts } from "./_components/DashboardCharts"
import { DashboardDistribution } from "./_components/DashboardDistribution"
import { DashboardModals } from "./_components/DashboardModals"
import { accordionStyles } from "./_components/accordion-styles"
import type { ChartType, ChartMetric } from "./_components/types"

export default function AdminDashboardPage() {
  // Filter state
  const [period, setPeriod] = useState<FilterPeriodType>("mois")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [agenceIds, setAgenceIds] = useState<string[]>([])
  const [gestionnaireIds, setGestionnaireIds] = useState<string[]>([])
  const [metierIds, setMetierIds] = useState<string[]>([])

  // Chart state
  const [chartType, setChartType] = useState<ChartType>("gestionnaire")
  const [chartMetric, setChartMetric] = useState<ChartMetric>("volume")

  // Modal state
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false)
  const [isInterventionsModalOpen, setIsInterventionsModalOpen] = useState(false)
  const [isTransformationModalOpen, setIsTransformationModalOpen] = useState(false)
  const [isCycleTimeModalOpen, setIsCycleTimeModalOpen] = useState(false)
  const [isMarginModalOpen, setIsMarginModalOpen] = useState(false)

  // Convert FilterBar period to API period type
  const apiPeriodType = useMemo(() => {
    switch (period) {
      case "semaine":
        return "week" as const
      case "mois":
        return "month" as const
      case "annee":
        return "year" as const
      case "custom":
        return "month" as const
      default:
        return "month" as const
    }
  }, [period])

  // Filter change handlers
  const handleDateChange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  const handleAgencesChange = useCallback((agences: string[]) => {
    setAgenceIds(agences)
  }, [])

  const handleGestionnairesChange = useCallback((gestionnaires: string[]) => {
    setGestionnaireIds(gestionnaires)
  }, [])

  const handleMetiersChange = useCallback((metiers: string[]) => {
    setMetierIds(metiers)
  }, [])

  // Fetch dashboard data
  const { data: dashboardStats, isLoading, error } = useAdminDashboardStats({
    periodType: apiPeriodType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    agenceIds: agenceIds.length > 0 ? agenceIds : undefined,
    gestionnaireIds: gestionnaireIds.length > 0 ? gestionnaireIds : undefined,
    metierIds: metierIds.length > 0 ? metierIds : undefined,
  })

  // Shared modal filter props
  const modalFilterProps = useMemo(
    () => ({
      periodType: apiPeriodType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      agenceIds: agenceIds.length > 0 ? agenceIds : undefined,
      gestionnaireIds: gestionnaireIds.length > 0 ? gestionnaireIds : undefined,
      metierIds: metierIds.length > 0 ? metierIds : undefined,
    }),
    [apiPeriodType, startDate, endDate, agenceIds, gestionnaireIds, metierIds]
  )

  if (error) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-background p-8 flex items-center justify-center">
          <div className="text-center text-destructive">
            <p className="text-lg font-semibold mb-2">Erreur lors du chargement des données</p>
            <p className="text-sm">
              {error instanceof Error ? error.message : "Une erreur est survenue"}
            </p>
          </div>
        </div>
      </AdminGuard>
    )
  }

  return (
    <AdminGuard>
      <style dangerouslySetInnerHTML={{ __html: accordionStyles }} />
      <div className="min-h-screen bg-background/50">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Filter Bar */}
          <div className="w-full bg-card rounded-lg border-l-4 border-primary shadow-sm p-4">
            <FilterBar
              onPeriodChange={setPeriod}
              onDateChange={handleDateChange}
              onAgencesChange={handleAgencesChange}
              onGestionnairesChange={handleGestionnairesChange}
              onMetiersChange={handleMetiersChange}
            />
          </div>

          {/* Active filters warning */}
          {(agenceIds.length > 0 || gestionnaireIds.length > 0 || metierIds.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Filtres actifs:</strong>
              {agenceIds.length > 0 && ` Agences: ${agenceIds.length} sélectionnée(s)`}
              {gestionnaireIds.length > 0 &&
                ` Gestionnaires: ${gestionnaireIds.length} sélectionné(s)`}
              {metierIds.length > 0 && ` Métiers: ${metierIds.length} sélectionné(s)`}
            </div>
          )}

          {/* KPI Cards */}
          <DashboardKPIs
            dashboardStats={dashboardStats}
            isLoading={isLoading}
            onOpenInterventionsModal={() => setIsInterventionsModalOpen(true)}
            onOpenTransformationModal={() => setIsTransformationModalOpen(true)}
            onOpenCycleTimeModal={() => setIsCycleTimeModalOpen(true)}
            onOpenRevenueModal={() => setIsRevenueModalOpen(true)}
            onOpenMarginModal={() => setIsMarginModalOpen(true)}
          />

          {/* Funnel + Stacked Bar Charts */}
          <DashboardCharts
            dashboardStats={dashboardStats}
            isLoading={isLoading}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Distribution Chart + Accordion Tables */}
          <DashboardDistribution
            dashboardStats={dashboardStats}
            isLoading={isLoading}
            chartType={chartType}
            chartMetric={chartMetric}
            onChartTypeChange={setChartType}
            onChartMetricChange={setChartMetric}
          />
        </div>

        {/* History Modals */}
        <DashboardModals
          {...modalFilterProps}
          isRevenueModalOpen={isRevenueModalOpen}
          onRevenueModalChange={setIsRevenueModalOpen}
          isInterventionsModalOpen={isInterventionsModalOpen}
          onInterventionsModalChange={setIsInterventionsModalOpen}
          isTransformationModalOpen={isTransformationModalOpen}
          onTransformationModalChange={setIsTransformationModalOpen}
          isCycleTimeModalOpen={isCycleTimeModalOpen}
          onCycleTimeModalChange={setIsCycleTimeModalOpen}
          isMarginModalOpen={isMarginModalOpen}
          onMarginModalChange={setIsMarginModalOpen}
        />
      </div>
    </AdminGuard>
  )
}
