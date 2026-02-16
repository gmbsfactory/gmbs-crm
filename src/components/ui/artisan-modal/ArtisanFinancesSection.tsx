"use client"

import React, { useMemo } from "react"
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import type { Intervention } from "@/lib/api/v2/common/types"

type ArtisanFinancesSectionProps = {
  interventions: Intervention[]
  artisanId: string
}

export function ArtisanFinancesSection({ interventions, artisanId }: ArtisanFinancesSectionProps) {
  const { data: referenceData } = useReferenceDataQuery()

  // Calculer les statistiques
  const stats = useMemo(() => {
    let totalCoutSST = 0
    let totalCoutIntervention = 0
    let totalMarge = 0
    let countWithMarge = 0

    interventions.forEach((intervention) => {
      // Les interventions sont déjà filtrées par artisan via getByArtisan
      // Donc toutes les interventions dans cette liste ont cet artisan assigné
      
      if (intervention.costs && Array.isArray(intervention.costs) && intervention.costs.length > 0) {
        // Debug temporaire pour voir les labels disponibles
        if (process.env.NODE_ENV === "development") {
          const labels = intervention.costs.map((c) => c.label).filter(Boolean)
          if (labels.length > 0) {
          }
        }

        // Chercher les coûts avec les labels exacts "Coût SST" et "Coût Intervention"
        // Comparaison flexible pour gérer les variations de casse et accents
        const coutSST = intervention.costs.find((cost) => {
          const label = (cost.label || "").trim()
          if (!label) return false
          const normalizedLabel = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          return (
            normalizedLabel === "cout sst" ||
            normalizedLabel === "coût sst" ||
            (normalizedLabel.includes("sst") && normalizedLabel.includes("cout"))
          )
        })

        const coutIntervention = intervention.costs.find((cost) => {
          const label = (cost.label || "").trim()
          if (!label) return false
          const normalizedLabel = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          return (
            normalizedLabel === "cout intervention" ||
            normalizedLabel === "coût intervention" ||
            (normalizedLabel.includes("intervention") && normalizedLabel.includes("cout"))
          )
        })

        if (coutSST) {
          totalCoutSST += Number(coutSST.amount || 0)
        }

        if (coutIntervention) {
          totalCoutIntervention += Number(coutIntervention.amount || 0)
        }

        // Calculer la marge
        if (coutSST && coutIntervention && Number(coutIntervention.amount) > 0) {
          const marge = ((Number(coutIntervention.amount) - Number(coutSST.amount)) / Number(coutIntervention.amount)) * 100
          totalMarge += marge
          countWithMarge++
        }
      }
    })

    const averageMarge = countWithMarge > 0 ? totalMarge / countWithMarge : 0

    return {
      totalInterventions: interventions.length,
      totalCoutSST,
      totalCoutIntervention,
      averageMarge,
    }
  }, [interventions])

  // Données pour le bar chart
  const barChartData = useMemo(
    () => [
      {
        name: "Coût SST",
        value: stats.totalCoutSST,
      },
      {
        name: "Coût Net Inter",
        value: stats.totalCoutIntervention,
      },
    ],
    [stats.totalCoutSST, stats.totalCoutIntervention],
  )

  // Calculer les statistiques pour le pie chart (répartition par statut)
  const pieChartData = useMemo(() => {
    // Compter tous les statuts présents dans les interventions
    const statusCounts: Map<string, number> = new Map()
    const statusColors: Map<string, string> = new Map()

    interventions.forEach((intervention) => {
      if (!intervention.statut_id || !referenceData?.interventionStatuses) return

      const status = referenceData.interventionStatuses.find((s) => s.id === intervention.statut_id)
      if (!status) return

      const statusLabel = status.label || status.code || "Non défini"
      const statusColor = status.color || "#888888"

      // Incrémenter le compteur pour ce statut
      statusCounts.set(statusLabel, (statusCounts.get(statusLabel) || 0) + 1)
      
      // Stocker la couleur si pas déjà définie
      if (!statusColors.has(statusLabel)) {
        statusColors.set(statusLabel, statusColor)
      }
    })

    // Convertir en tableau pour le graphique
    const pieData = Array.from(statusCounts.entries())
      .map(([label, count]) => ({
        name: label,
        value: count,
        color: statusColors.get(label) || "#888888",
      }))
      .sort((a, b) => b.value - a.value) // Trier par valeur décroissante

    return pieData
  }, [interventions, referenceData])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0 py-2 px-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          Finances liées à l&apos;artisan
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 pt-0 overflow-hidden">
        <div className="h-full flex flex-col gap-2">
          {/* Statistiques de base - toujours visibles */}
          <div className="shrink-0 grid grid-cols-2 gap-2">
            <div className="p-2 rounded-md bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Interventions</p>
              <p className="text-lg font-bold">{stats.totalInterventions}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Marge moy.</p>
              <p className="text-lg font-bold">{stats.averageMarge.toFixed(1)}%</p>
            </div>
          </div>

          {/* Graphiques - zone scrollable si nécessaire */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
            {/* Bar Chart */}
            <div className="flex flex-col">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Coûts</p>
              <div className="flex-1 min-h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="name" hide />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={45}
                      tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `€${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        "",
                      ]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "#ef4444" : "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="flex flex-col">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Statuts</p>
              <div className="flex-1 min-h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius="80%"
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

