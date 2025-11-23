"use client"

import { useState, useMemo, useCallback } from "react"
import { TrendingUp, DollarSign, Activity, Clock, Users, Building2, Percent } from "lucide-react"
import { KPICard } from "@/components/admin-dashboard/KPICard"
import { FilterBar, PeriodType } from "@/components/admin-dashboard/FilterBar"
import { FunnelChart } from "@/components/admin-dashboard/FunnelChart"
import { HorizontalBarChart } from "@/components/admin-dashboard/HorizontalBarChart"
import { VirtualizedDataTable } from "@/components/admin-dashboard/VirtualizedDataTable"
import { MarginBar } from "@/components/admin-dashboard/MarginBar"
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats"
import { AdminGuard } from "@/components/admin-dashboard/AdminGuard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>("mois")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [agenceId, setAgenceId] = useState<string | null>(null)
  const [gestionnaireId, setGestionnaireId] = useState<string | null>(null)
  const [metierId, setMetierId] = useState<string | null>(null)

  // Convertir la période en PeriodType pour l'API
  const apiPeriodType = useMemo(() => {
    // The API expects specific string values. 
    // If PeriodType matches API expectations, we can pass it directly.
    // Assuming PeriodType in FilterBar matches API requirements or we map it here.
    // Based on previous code, FilterBar uses "jour" | "semaine" | "mois" | "annee"
    // And API expects "day" | "week" | "month" | "year"
    switch (period) {
      case "jour": return "day"
      case "semaine": return "week"
      case "mois": return "month"
      case "trimestre": return "quarter" // API might not support quarter yet, fallback to month or handle
      case "annee": return "year"
      default: return "month"
    }
  }, [period])

  // Gérer le changement de dates depuis FilterBar
  const handleDateChange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Gérer les changements de filtres (FilterBar retourne des tableaux pour le multi-select)
  const handleAgenceChange = useCallback((agences: string[]) => {
    setAgenceId(agences.length > 0 ? agences[0] : null)
  }, [])

  const handleGestionnaireChange = useCallback((gestionnaires: string[]) => {
    setGestionnaireId(gestionnaires.length > 0 ? gestionnaires[0] : null)
  }, [])

  const handleMetierChange = useCallback((metiers: string[]) => {
    setMetierId(metiers.length > 0 ? metiers[0] : null)
  }, [])

  // Récupérer les données du dashboard
  const { data: dashboardStats, isLoading, error } = useAdminDashboardStats({
    periodType: apiPeriodType as any, // Cast to avoid type mismatch if API types differ slightly
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    agenceId: agenceId === "all" ? null : agenceId,
    gestionnaireId: gestionnaireId === "all" ? null : gestionnaireId,
    metierId: metierId === "all" ? null : metierId,
  })

  // Formater les nombres pour l'affichage
  const formatNumber = useCallback((num: number) => new Intl.NumberFormat("fr-FR").format(num), [])
  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num), [])

  // Colonnes pour les tableaux
  const agencyColumns = useMemo(() => [
    { header: "Agence", accessorKey: "agencyLabel", width: 200 },
    { header: "Interventions", accessorKey: "nbTotalInterventions", width: 120, cell: (item: any) => formatNumber(item.nbTotalInterventions) },
    { header: "CA", accessorKey: "ca", width: 120, cell: (item: any) => formatCurrency(item.ca) },
    { header: "Marge", accessorKey: "marge", width: 120, cell: (item: any) => formatCurrency(item.marge) },
    { header: "Taux Marge", accessorKey: "tauxMarge", width: 150, cell: (item: any) => <MarginBar value={item.tauxMarge} target={30} /> },
  ], [formatNumber, formatCurrency])

  const managerColumns = useMemo(() => [
    { header: "Gestionnaire", accessorKey: "gestionnaireLabel", width: 200 },
    { header: "Prises", accessorKey: "nbInterventionsPrises", width: 100, cell: (item: any) => formatNumber(item.nbInterventionsPrises) },
    { header: "Terminées", accessorKey: "nbInterventionsTerminees", width: 100, cell: (item: any) => formatNumber(item.nbInterventionsTerminees) },
    { header: "CA", accessorKey: "ca", width: 120, cell: (item: any) => formatCurrency(item.ca) },
    { header: "Marge", accessorKey: "marge", width: 120, cell: (item: any) => formatCurrency(item.marge) },
    { header: "Taux Marge", accessorKey: "tauxMarge", width: 150, cell: (item: any) => <MarginBar value={item.tauxMarge} target={30} /> },
  ], [formatNumber, formatCurrency])

  if (error) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-background p-8 flex items-center justify-center">
          <div className="text-center text-destructive">
            <p className="text-lg font-semibold mb-2">Erreur lors du chargement des données</p>
            <p className="text-sm">{error instanceof Error ? error.message : "Une erreur est survenue"}</p>
          </div>
        </div>
      </AdminGuard>
    )
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background/50">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Filter Bar - Full Width with colored border */}
          <div className="w-full bg-card rounded-lg border-l-4 border-primary shadow-sm p-4">
            <FilterBar
              onPeriodChange={setPeriod}
              onDateChange={handleDateChange}
              onAgenceChange={handleAgenceChange}
              onGestionnaireChange={handleGestionnaireChange}
              onMetierChange={handleMetierChange}
            />
          </div>

          {/* KPI Cards Row - 5 Columns */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-[140px] rounded-xl" />)
            ) : (
              <>
                <KPICard
                  title="Interventions"
                  value={formatNumber(dashboardStats?.mainStats.nbInterventionsDemandees || 0)}
                  icon={Activity}
                  trend={{
                    value: Math.abs(dashboardStats?.mainStats.deltaInterventions || 0),
                    isPositive: (dashboardStats?.mainStats.deltaInterventions || 0) >= 0,
                    label: "vs période préc."
                  }}
                  sparklineData={dashboardStats?.sparklines.map(s => ({ date: s.date, value: s.countDemandees }))}
                  description={`${formatNumber(dashboardStats?.mainStats.nbInterventionsTerminees || 0)} terminées`}
                />
                <KPICard
                  title="Chiffre d'Affaires"
                  value={formatCurrency(dashboardStats?.mainStats.chiffreAffaires || 0)}
                  icon={DollarSign}
                  trend={{
                    value: Math.abs(dashboardStats?.mainStats.deltaChiffreAffaires || 0),
                    isPositive: (dashboardStats?.mainStats.deltaChiffreAffaires || 0) >= 0,
                    label: "vs période préc."
                  }}
                  sparklineData={dashboardStats?.sparklines.map(s => ({ date: s.date, value: s.countTerminees }))}
                  className="border-l-blue-500"
                />
                <KPICard
                  title="Marge Globale"
                  value={formatCurrency(dashboardStats?.mainStats.marge || 0)}
                  icon={TrendingUp}
                  trend={{
                    value: 0,
                    isPositive: true,
                    label: "vs période préc."
                  }}
                  description={`Taux de marge: ${dashboardStats?.mainStats.tauxMarge || 0}%`}
                  className="border-l-emerald-500"
                />
                <KPICard
                  title="Cycle Moyen"
                  value={`${dashboardStats?.mainStats.avgCycleTime || 0}j`}
                  icon={Clock}
                  description="Délai moyen de traitement"
                  className="border-l-amber-500"
                />
                <KPICard
                  title="Taux Transformation"
                  value={`${dashboardStats?.mainStats.tauxTransformation || 0}%`}
                  icon={Percent}
                  description="Terminées / Demandées"
                  className="border-l-purple-500"
                />
              </>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
              <FunnelChart
                data={dashboardStats?.statusBreakdown.map(s => ({
                  name: s.statusLabel,
                  value: s.count,
                  fill: s.statusCode === 'INTER_TERMINEE' ? '#10b981' : '#3b82f6',
                  cycleTime: s.avgCycleTime
                })) || []}
                title="Entonnoir de Conversion"
                description="Suivi des interventions par étape"
              />
            </div>
            <div className="col-span-3">
              <HorizontalBarChart
                data={dashboardStats?.metierBreakdown.map(m => ({
                  name: m.metierLabel,
                  value: m.count
                })) || []}
                title="Répartition par Métier"
                description="Top métiers par volume"
              />
            </div>
          </div>

          {/* Tables Row - Stacked */}
          <div className="grid gap-4 grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Performance Agences
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <VirtualizedDataTable
                    data={dashboardStats?.agencyStats || []}
                    columns={agencyColumns}
                    height={300}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Performance Gestionnaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <VirtualizedDataTable
                    data={dashboardStats?.gestionnaireStats || []}
                    columns={managerColumns}
                    height={300}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}
