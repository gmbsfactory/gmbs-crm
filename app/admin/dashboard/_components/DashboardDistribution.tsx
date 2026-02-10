"use client"

import { useMemo, useCallback } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { Users, Building2, Wrench } from "lucide-react"
import GlassRadioSelector from "@/components/admin-dashboard/GlassRadioSelector"
import { VirtualizedDataTable } from "@/components/admin-dashboard/VirtualizedDataTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { createAgencyColumns, createManagerColumns, createMetierColumns } from "./dashboard-columns"
import type { AdminDashboardStats, ChartType, ChartMetric, ChartDataPoint } from "./types"

// Color palettes per metric (12 colors each)
const COLOR_PALETTES: Record<ChartMetric, string[]> = {
  volume: [
    "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe",
    "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065",
    "#9333ea", "#a855f7",
  ],
  ca: [
    "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7",
    "#d97706", "#b45309", "#92400e", "#78350f", "#451a03",
    "#fb923c", "#fdba74",
  ],
  marge: [
    "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5",
    "#059669", "#047857", "#065f46", "#064e3b", "#022c22",
    "#16a34a", "#4ade80",
  ],
}

interface DashboardDistributionProps {
  dashboardStats: AdminDashboardStats | undefined
  isLoading: boolean
  chartType: ChartType
  chartMetric: ChartMetric
  onChartTypeChange: (type: ChartType) => void
  onChartMetricChange: (metric: ChartMetric) => void
}

export function DashboardDistribution({
  dashboardStats,
  isLoading,
  chartType,
  chartMetric,
  onChartTypeChange,
  onChartMetricChange,
}: DashboardDistributionProps) {
  // Formatters
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

  // Chart title / description
  const chartTitle = useMemo(() => {
    switch (chartType) {
      case "metier":
        return "Répartition par Métier"
      case "agences":
        return "Répartition par Agence"
      case "gestionnaire":
        return "Répartition par Gestionnaire"
      default:
        return "Répartition"
    }
  }, [chartType])

  const chartDescription = useMemo(() => {
    const metricLabel = chartMetric === "volume" ? "volume" : chartMetric === "ca" ? "CA" : "marge"
    switch (chartType) {
      case "metier":
        return `Top métiers par ${metricLabel}`
      case "agences":
        return `Top agences par ${metricLabel}`
      case "gestionnaire":
        return `Top gestionnaires par ${metricLabel}`
      default:
        return `${metricLabel} par catégorie`
    }
  }, [chartType, chartMetric])

  // Build chart data from stats
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!dashboardStats) return []

    switch (chartType) {
      case "metier":
        return dashboardStats.metierBreakdown.map((m) => ({
          name: m.metierLabel,
          value:
            chartMetric === "volume"
              ? m.count || m.nbInterventionsPrises
              : chartMetric === "ca"
              ? m.ca
              : m.marge,
        }))
      case "agences":
        return dashboardStats.agencyStats.map((a) => ({
          name: a.agencyLabel,
          value:
            chartMetric === "volume"
              ? a.nbTotalInterventions
              : chartMetric === "ca"
              ? a.ca
              : a.marge,
        }))
      case "gestionnaire":
        return dashboardStats.gestionnaireStats.map((g) => ({
          name: g.gestionnaireLabel,
          value:
            chartMetric === "volume"
              ? g.nbInterventionsPrises
              : chartMetric === "ca"
              ? g.ca
              : g.marge,
        }))
      default:
        return []
    }
  }, [dashboardStats, chartType, chartMetric])

  const sortedChartData = useMemo(
    () => [...chartData].sort((a, b) => b.value - a.value).slice(0, 12),
    [chartData]
  )

  const dynamicBarSize = useMemo(() => {
    const itemCount = sortedChartData.length
    if (itemCount === 0) return 20
    const availableHeight = 340 - 35 - 40
    const spacing = 8
    const optimalSize = Math.floor((availableHeight - itemCount * spacing) / itemCount)
    return Math.max(15, Math.min(35, optimalSize))
  }, [sortedChartData])

  // Sorted table data
  const sortedAgencyStats = useMemo(() => {
    if (!dashboardStats?.agencyStats) return []
    const stats = [...dashboardStats.agencyStats]
    switch (chartMetric) {
      case "volume":
        return stats.sort((a, b) => b.nbTotalInterventions - a.nbTotalInterventions)
      case "ca":
        return stats.sort((a, b) => b.ca - a.ca)
      case "marge":
        return stats.sort((a, b) => b.marge - a.marge)
      default:
        return stats
    }
  }, [dashboardStats?.agencyStats, chartMetric])

  const sortedGestionnaireStats = useMemo(() => {
    if (!dashboardStats?.gestionnaireStats) return []
    const stats = [...dashboardStats.gestionnaireStats]
    switch (chartMetric) {
      case "volume":
        return stats.sort((a, b) => b.nbInterventionsPrises - a.nbInterventionsPrises)
      case "ca":
        return stats.sort((a, b) => b.ca - a.ca)
      case "marge":
        return stats.sort((a, b) => b.marge - a.marge)
      default:
        return stats
    }
  }, [dashboardStats?.gestionnaireStats, chartMetric])

  const sortedMetierStats = useMemo(() => {
    if (!dashboardStats?.metierStats) return []
    const stats = [...dashboardStats.metierStats]
    switch (chartMetric) {
      case "volume":
        return stats.sort((a, b) => b.nbInterventionsPrises - a.nbInterventionsPrises)
      case "ca":
        return stats.sort((a, b) => b.ca - a.ca)
      case "marge":
        return stats.sort((a, b) => b.marge - a.marge)
      default:
        return stats
    }
  }, [dashboardStats?.metierStats, chartMetric])

  // Column definitions
  const agencyColumns = useMemo(
    () => createAgencyColumns(formatNumber, formatCurrency, chartMetric, onChartMetricChange),
    [formatNumber, formatCurrency, chartMetric, onChartMetricChange]
  )

  const managerColumns = useMemo(
    () => createManagerColumns(formatNumber, formatCurrency, chartMetric, onChartMetricChange),
    [formatNumber, formatCurrency, chartMetric, onChartMetricChange]
  )

  const metierColumns = useMemo(
    () => createMetierColumns(formatNumber, formatCurrency, chartMetric, onChartMetricChange),
    [formatNumber, formatCurrency, chartMetric, onChartMetricChange]
  )

  const colors = COLOR_PALETTES[chartMetric]

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      {/* Bar chart */}
      <div className="col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{chartTitle}</CardTitle>
                <CardDescription className="mt-1">{chartDescription}</CardDescription>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-2">
                <GlassRadioSelector
                  value={chartType}
                  onChange={(value) => onChartTypeChange(value as ChartType)}
                  options={[
                    { id: "gestionnaire", label: "Gest." },
                    { id: "agences", label: "Agences" },
                    { id: "metier", label: "Métier" },
                  ]}
                  name="chart-type"
                />
                <GlassRadioSelector
                  value={chartMetric}
                  onChange={(value) => onChartMetricChange(value as ChartMetric)}
                  options={[
                    { id: "volume", label: "Volume" },
                    { id: "ca", label: "CA" },
                    { id: "marge", label: "Marge" },
                  ]}
                  name="metric"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2 flex-1 min-h-0">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 0, bottom: 35 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickCount={3}
                      domain={[0, "auto"]}
                      tickFormatter={(value: number) => {
                        if (chartMetric === "volume") {
                          return value.toLocaleString("fr-FR")
                        }
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M\u20AC`
                        if (value >= 1000) return `${Math.round(value / 1000)}k\u20AC`
                        return `${Math.round(value)}\u20AC`
                      }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={90}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as ChartDataPoint
                          const value = payload[0].value as number
                          const formattedValue =
                            chartMetric === "volume"
                              ? `${formatNumber(value)} interventions`
                              : formatCurrency(value)
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-bold mb-1">{data.name}</span>
                                <span className="text-sm">{formattedValue}</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={dynamicBarSize}>
                      {sortedChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accordion tables */}
      <div className="col-span-1">
        <div className="space-y-0">
          <Accordion
            type="single"
            collapsible={false}
            value={
              chartType === "metier"
                ? "metiers"
                : chartType === "agences"
                ? "agences"
                : "gestionnaires"
            }
            onValueChange={(value) => {
              if (value === "metiers") onChartTypeChange("metier")
              else if (value === "agences") onChartTypeChange("agences")
              else if (value === "gestionnaires") onChartTypeChange("gestionnaire")
            }}
            className="w-full"
          >
            <AccordionItem
              value="gestionnaires"
              className="accordion-item-dynamic border-0 bg-card shadow-sm transition-all duration-300 data-[state=open]:mb-4 data-[state=open]:shadow-md data-[state=closed]:mb-0 overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5" style={{ color: "#10b981" }} />
                  Performance Gestionnaires
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : sortedGestionnaireStats && sortedGestionnaireStats.length > 0 ? (
                  <VirtualizedDataTable
                    data={sortedGestionnaireStats}
                    columns={managerColumns}
                    height={300}
                    noCard
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users
                        className="h-12 w-12 mx-auto mb-2 opacity-50"
                        style={{ color: "#10b981" }}
                      />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="agences"
              className="accordion-item-dynamic border-0 bg-card shadow-sm transition-all duration-300 data-[state=open]:mb-4 data-[state=open]:shadow-md data-[state=closed]:mb-0 overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Building2 className="h-5 w-5" style={{ color: "#3b82f6" }} />
                  Performance Agences
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : sortedAgencyStats && sortedAgencyStats.length > 0 ? (
                  <VirtualizedDataTable
                    data={sortedAgencyStats}
                    columns={agencyColumns}
                    height={300}
                    noCard
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Building2
                        className="h-12 w-12 mx-auto mb-2 opacity-50"
                        style={{ color: "#3b82f6" }}
                      />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="metiers"
              className="accordion-item-dynamic border-0 bg-card shadow-sm transition-all duration-300 data-[state=open]:mb-4 data-[state=open]:shadow-md data-[state=closed]:mb-0 overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Wrench className="h-5 w-5" style={{ color: "#f59e0b" }} />
                  Performance Métiers
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : sortedMetierStats && sortedMetierStats.length > 0 ? (
                  <VirtualizedDataTable
                    data={sortedMetierStats}
                    columns={metierColumns}
                    height={300}
                    noCard
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Wrench
                        className="h-12 w-12 mx-auto mb-2 opacity-50"
                        style={{ color: "#f59e0b" }}
                      />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  )
}
