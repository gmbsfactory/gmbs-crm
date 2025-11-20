"use client"

import { useState, useMemo, useCallback } from "react"
import { TrendingUp, CheckCircle2, Percent, DollarSign } from "lucide-react"
import { KPICard } from "@/components/admin-dashboard/KPICard"
import { FilterBar } from "@/components/admin-dashboard/FilterBar"
import { ManagerPerformanceTable } from "@/components/admin-dashboard/ManagerPerformanceTable"
import { GestionnairePerformanceTable } from "@/components/admin-dashboard/GestionnairePerformanceTable"
import { StatusChart } from "@/components/admin-dashboard/StatusChart"
import { MetierPieChart } from "@/components/admin-dashboard/MetierPieChart"
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats"
import { AdminGuard } from "@/components/admin-dashboard/AdminGuard"
import type { PeriodType } from "@/lib/api/v2"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<"jour" | "semaine" | "mois" | "annee">("mois")
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [agenceId, setAgenceId] = useState<string | null>(null)
  const [gestionnaireId, setGestionnaireId] = useState<string | null>(null)
  const [metierId, setMetierId] = useState<string | null>(null)

  // Convertir la période en PeriodType pour l'API
  const periodType: PeriodType = useMemo(() => {
    switch (period) {
      case "jour":
        return "day"
      case "semaine":
        return "week"
      case "mois":
        return "month"
      case "annee":
        return "year"
      default:
        return "month"
    }
  }, [period])

  // Gérer le changement de dates depuis FilterBar
  const handleDateChange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Récupérer les données du dashboard
  const { data: dashboardStats, isLoading, error } = useAdminDashboardStats({
    periodType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    agenceId: agenceId === "all" ? null : agenceId,
    gestionnaireId: gestionnaireId === "all" ? null : gestionnaireId,
    metierId: metierId === "all" ? null : metierId,
  })

  // Formater les nombres pour l'affichage (memoized pour éviter les recréations)
  const formatNumber = useCallback((num: number) => {
    return new Intl.NumberFormat("fr-FR").format(num)
  }, [])

  // Formater les pourcentages (memoized pour éviter les recréations)
  const formatPercent = useCallback((num: number) => {
    return `${num.toFixed(1)}%`
  }, [])

  // Formater la monnaie (memoized pour éviter les recréations)
  const formatCurrency = useCallback((num: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }, [])

  return (
    <AdminGuard>
      {error ? (
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-red-600 dark:text-red-400">
              <p className="text-lg font-semibold mb-2">Erreur lors du chargement des données</p>
              <p className="text-sm">{error instanceof Error ? error.message : "Une erreur est survenue"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Dashboard de Pilotage d&apos;Interventions
              </h1>
              <p className="text-muted-foreground">
                Vue d&apos;ensemble des performances et statistiques
              </p>
            </div>

            {/* Filters */}
            <FilterBar 
              onPeriodChange={(p) => setPeriod(p)}
              onDateChange={handleDateChange}
              onAgenceChange={(value) => setAgenceId(value === "all" ? null : value)}
              onGestionnaireChange={(value) => setGestionnaireId(value === "all" ? null : value)}
              onMetierChange={(value) => setMetierId(value === "all" ? null : value)}
            />

            {/* KPIs */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : dashboardStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <KPICard
                  title="Interventions reçues"
                  value={formatNumber(dashboardStats.mainStats.nbInterventionsDemandees)}
                  icon={TrendingUp}
                />
                <KPICard
                  title="Interventions terminées"
                  value={formatNumber(dashboardStats.mainStats.nbInterventionsTerminees)}
                  icon={CheckCircle2}
                />
                <KPICard
                  title="Taux de transformation"
                  value={formatPercent(dashboardStats.mainStats.tauxTransformation)}
                  icon={Percent}
                />
                <KPICard
                  title="Chiffre d'affaires"
                  value={formatCurrency(dashboardStats.mainStats.chiffreAffaires)}
                  icon={DollarSign}
                />
                <KPICard
                  title="Taux de marge"
                  value={formatPercent(dashboardStats.mainStats.tauxMarge)}
                  icon={DollarSign}
                />
              </div>
            ) : null}

            {/* Charts Row - Statistiques Par Statut et Répartition Par Métier */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <StatusChart data={dashboardStats?.statusStats} isLoading={isLoading} />
              <MetierPieChart data={dashboardStats?.metierStats} isLoading={isLoading} />
            </div>

            {/* Gestionnaire Performance Table - En dessous des graphiques */}
            <div className="mb-6">
              <GestionnairePerformanceTable 
                data={dashboardStats?.gestionnaireStats} 
                isLoading={isLoading} 
              />
            </div>

            {/* Agency Stats Table - En dessous des statistiques par gestionnaire */}
            <div className="mb-6">
              <ManagerPerformanceTable data={dashboardStats?.agencyStats} isLoading={isLoading} />
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  )
}

