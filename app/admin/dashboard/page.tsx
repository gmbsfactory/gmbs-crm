"use client"

import { useState, useMemo, useCallback } from "react"
import { TrendingUp, DollarSign, Activity, Clock, Users, Building2, Percent } from "lucide-react"
import { KPICard } from "@/components/admin-dashboard/KPICard"
import { FilterBar, FilterPeriodType } from "@/components/admin-dashboard/FilterBar"
import { FunnelChart } from "@/components/admin-dashboard/FunnelChart"
import { HorizontalBarChart } from "@/components/admin-dashboard/HorizontalBarChart"
import { VirtualizedDataTable } from "@/components/admin-dashboard/VirtualizedDataTable"
import { MarginBar } from "@/components/admin-dashboard/MarginBar"
import { RevenueHistoryModal } from "@/components/admin-dashboard/RevenueHistoryModal"
import { InterventionsHistoryModal } from "@/components/admin-dashboard/InterventionsHistoryModal"
import { TransformationRateHistoryModal } from "@/components/admin-dashboard/TransformationRateHistoryModal"
import { CycleTimeHistoryModal } from "@/components/admin-dashboard/CycleTimeHistoryModal"
import { MarginHistoryModal } from "@/components/admin-dashboard/MarginHistoryModal"
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats"
import { AdminGuard } from "@/components/admin-dashboard/AdminGuard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<FilterPeriodType>("mois")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [agenceId, setAgenceId] = useState<string | null>(null)
  const [gestionnaireId, setGestionnaireId] = useState<string | null>(null)
  const [metierId, setMetierId] = useState<string | null>(null)
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false)
  const [isInterventionsModalOpen, setIsInterventionsModalOpen] = useState(false)
  const [isTransformationModalOpen, setIsTransformationModalOpen] = useState(false)
  const [isCycleTimeModalOpen, setIsCycleTimeModalOpen] = useState(false)
  const [isMarginModalOpen, setIsMarginModalOpen] = useState(false)

  // Convertir la période en PeriodType pour l'API
  const apiPeriodType = useMemo(() => {
    // The API expects specific string values. 
    // If PeriodType matches API expectations, we can pass it directly.
    // Assuming PeriodType in FilterBar matches API requirements or we map it here.
    // FilterBar uses "semaine" | "mois" | "annee" | "custom"
    // API expects "day" | "week" | "month" | "year"
    switch (period) {
      case "semaine": return "week" as const
      case "mois": return "month" as const
      case "annee": return "year" as const
      case "custom": return "month" as const // Fallback to month for custom
      default: return "month" as const
    }
  }, [period])

  // Gérer le changement de dates depuis FilterBar
  const handleDateChange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Gérer les changements de filtres (FilterBar retourne maintenant des strings uniques)
  const handleAgenceChange = useCallback((agence: string) => {
    setAgenceId(agence === "all" ? null : agence)
  }, [])

  const handleGestionnaireChange = useCallback((gestionnaire: string) => {
    setGestionnaireId(gestionnaire === "all" ? null : gestionnaire)
  }, [])

  const handleMetierChange = useCallback((metier: string) => {
    setMetierId(metier === "all" ? null : metier)
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
    {
      header: "Agence",
      accessorKey: "agencyLabel",
      size: 200,
      minSize: 200,
      maxSize: 200,
    },
    {
      header: "Interventions",
      accessorKey: "nbTotalInterventions",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }: any) => formatNumber(row.original.nbTotalInterventions)
    },
    {
      header: "CA",
      accessorKey: "ca",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }: any) => formatCurrency(row.original.ca)
    },
    {
      header: "Marge",
      accessorKey: "marge",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }: any) => formatCurrency(row.original.marge)
    },
    {
      header: "Taux Marge",
      accessorKey: "tauxMarge",
      size: 150,
      minSize: 150,
      maxSize: 150,
      cell: ({ row }: any) => <MarginBar value={row.original.tauxMarge} target={30} />
    },
  ], [formatNumber, formatCurrency])

  const managerColumns = useMemo(() => [
    {
      header: "Gestionnaire",
      accessorKey: "gestionnaireLabel",
      size: 200,
      minSize: 200,
      maxSize: 200,
    },
    {
      header: "Prises",
      accessorKey: "nbInterventionsPrises",
      size: 100,
      minSize: 100,
      maxSize: 100,
      cell: ({ row }: any) => formatNumber(row.original.nbInterventionsPrises)
    },
    {
      header: "Terminées",
      accessorKey: "nbInterventionsTerminees",
      size: 100,
      minSize: 100,
      maxSize: 100,
      cell: ({ row }: any) => formatNumber(row.original.nbInterventionsTerminees)
    },
    {
      header: "CA",
      accessorKey: "ca",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }: any) => formatCurrency(row.original.ca)
    },
    {
      header: "Marge",
      accessorKey: "marge",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }: any) => formatCurrency(row.original.marge)
    },
    {
      header: "Taux Marge",
      accessorKey: "tauxMarge",
      size: 150,
      minSize: 150,
      maxSize: 150,
      cell: ({ row }: any) => <MarginBar value={row.original.tauxMarge} target={30} />
    },
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

          {/* Afficher un avertissement si des filtres sont actifs */}
          {(agenceId || gestionnaireId || metierId) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Filtres actifs:</strong>
              {agenceId && ` Agence: ${agenceId}`}
              {gestionnaireId && ` Gestionnaire: ${gestionnaireId}`}
              {metierId && ` Métier: ${metierId}`}
            </div>
          )}

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
                    value: Math.round(Math.abs(dashboardStats?.mainStats.deltaInterventions || 0) * 10) / 10,
                    isPositive: (dashboardStats?.mainStats.deltaInterventions || 0) >= 0,
                    label: "vs période préc."
                  }}
                  sparklineData={dashboardStats?.sparklines.map(s => ({ date: s.date, value: s.countDemandees }))}
                  description={`${formatNumber(dashboardStats?.mainStats.nbInterventionsTerminees || 0)} terminées`}
                  onClick={() => setIsInterventionsModalOpen(true)}
                />
                <KPICard
                  title="Taux Transformation"
                  value={`${(dashboardStats?.mainStats.tauxTransformation || 0).toFixed(1)}%`}
                  icon={Percent}
                  description="Demandées / Terminées"
                  className="border-l-purple-500"
                  onClick={() => setIsTransformationModalOpen(true)}
                />
                <KPICard
                  title="Cycle Moyen"
                  value={`${dashboardStats?.mainStats.avgCycleTime || 0}j`}
                  icon={Clock}
                  description="Délai moyen de traitement"
                  className="border-l-amber-500"
                  onClick={() => setIsCycleTimeModalOpen(true)}
                />
                <KPICard
                  title="Chiffre d'Affaires"
                  value={formatCurrency(dashboardStats?.mainStats.chiffreAffaires || 0)}
                  icon={DollarSign}
                  trend={{
                    value: Math.round(Math.abs(dashboardStats?.mainStats.deltaChiffreAffaires || 0) * 10) / 10,
                    isPositive: (dashboardStats?.mainStats.deltaChiffreAffaires || 0) >= 0,
                    label: "vs période préc."
                  }}
                  sparklineData={dashboardStats?.sparklines.map(s => ({ date: s.date, value: s.countTerminees }))}
                  className="border-l-blue-500"
                  onClick={() => setIsRevenueModalOpen(true)}
                />
                <KPICard
                  title="Marge Globale"
                  value={formatCurrency(dashboardStats?.mainStats.marge || 0)}
                  icon={TrendingUp}
                  trend={{
                    value: Math.round(Math.abs(dashboardStats?.mainStats.deltaMarge || 0) * 10) / 10,
                    isPositive: (dashboardStats?.mainStats.deltaMarge || 0) >= 0,
                    label: "vs période préc."
                  }}
                  description={`Taux de marge: ${dashboardStats?.mainStats.tauxMarge || 0}%`}
                  className="border-l-emerald-500"
                  onClick={() => setIsMarginModalOpen(true)}
                />
              </>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
              <FunnelChart
                data={(() => {
                  // Configuration des étapes du funnel (ordre strict)
                  const FUNNEL_STEPS = [
                    { code: 'DEMANDE', label: 'Demandé', fill: '#60a5fa' },
                    { code: 'DEVIS_ENVOYE', label: 'Devis Envoyé', fill: '#3b82f6' },
                    { code: 'ACCEPTE', label: 'Accepté', fill: '#2563eb' },
                    { code: 'INTER_EN_COURS', label: 'En Cours', fill: '#1d4ed8' },
                    { code: 'INTER_TERMINEE', label: 'Terminé', fill: '#10b981' },
                  ]

                  return FUNNEL_STEPS.map(step => {
                    const stat = dashboardStats?.statusBreakdown.find(s => s.statusCode === step.code)
                    return {
                      name: step.label,
                      value: stat?.count || 0,
                      fill: step.fill,
                      // cycleTime n'est pas disponible par statut pour le moment
                    }
                  })
                })()}
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
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-muted/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  Performance Agences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : dashboardStats?.agencyStats && dashboardStats.agencyStats.length > 0 ? (
                  <VirtualizedDataTable
                    data={dashboardStats.agencyStats}
                    columns={agencyColumns}
                    height={300}
                    noCard
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-muted/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Performance Gestionnaires
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : dashboardStats?.gestionnaireStats && dashboardStats.gestionnaireStats.length > 0 ? (
                  <VirtualizedDataTable
                    data={dashboardStats.gestionnaireStats}
                    columns={managerColumns}
                    height={300}
                    noCard
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modals d'historique */}
        <RevenueHistoryModal
          open={isRevenueModalOpen}
          onOpenChange={setIsRevenueModalOpen}
          periodType={apiPeriodType}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
          agenceId={agenceId || undefined}
          gestionnaireId={gestionnaireId || undefined}
          metierId={metierId || undefined}
        />
        <InterventionsHistoryModal
          open={isInterventionsModalOpen}
          onOpenChange={setIsInterventionsModalOpen}
          periodType={apiPeriodType}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
          agenceId={agenceId || undefined}
          gestionnaireId={gestionnaireId || undefined}
          metierId={metierId || undefined}
        />
        <TransformationRateHistoryModal
          open={isTransformationModalOpen}
          onOpenChange={setIsTransformationModalOpen}
          periodType={apiPeriodType}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
          agenceId={agenceId || undefined}
          gestionnaireId={gestionnaireId || undefined}
          metierId={metierId || undefined}
        />
        <CycleTimeHistoryModal
          open={isCycleTimeModalOpen}
          onOpenChange={setIsCycleTimeModalOpen}
          periodType={apiPeriodType}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
          agenceId={agenceId || undefined}
          gestionnaireId={gestionnaireId || undefined}
          metierId={metierId || undefined}
        />
        <MarginHistoryModal
          open={isMarginModalOpen}
          onOpenChange={setIsMarginModalOpen}
          periodType={apiPeriodType}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
          agenceId={agenceId || undefined}
          gestionnaireId={gestionnaireId || undefined}
          metierId={metierId || undefined}
        />
      </div>
    </AdminGuard>
  )
}
