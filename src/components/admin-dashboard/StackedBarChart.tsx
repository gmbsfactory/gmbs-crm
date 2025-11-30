"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTheme } from "next-themes"

interface VolumeByStatusData {
  date: string
  demande: number
  devis_envoye: number
  accepte: number
  en_cours: number
  termine: number
}

interface StackedBarChartProps {
  data?: VolumeByStatusData[]
  isLoading?: boolean
  periodStart?: string
  periodEnd?: string
  title?: string
  description?: string
}

// Configuration des statuts (ordre d'empilement du bas vers le haut)
const STATUS_CONFIG = [
  {
    key: "demande" as const,
    label: "Demandé",
    color: "#93C5FD", // Bleu très clair
  },
  {
    key: "devis_envoye" as const,
    label: "Devis Envoyé",
    color: "#60A5FA", // Bleu ciel
  },
  {
    key: "accepte" as const,
    label: "Accepté",
    color: "#3B82F6", // Bleu intermédiaire
  },
  {
    key: "en_cours" as const,
    label: "En Cours",
    color: "#2563EB", // Bleu roi
  },
  {
    key: "termine" as const,
    label: "Terminé",
    color: "#10B981", // Vert émeraude
  },
] as const

export function StackedBarChart({
  data,
  isLoading,
  periodStart,
  periodEnd,
  title = "Évolution de la Volumétrie",
  description = "Répartition quotidienne des interventions par statut",
}: StackedBarChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  // État pour gérer la légende cliquable (masquer/afficher les statuts)
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())

  // Détecter la période pour adapter l'affichage
  const periodInfo = useMemo(() => {
    if (!periodStart || !periodEnd) {
      return { type: "month" as const, days: 30 }
    }
    
    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > 180) {
      // Plus de 6 mois = mode annuel, agréger par mois
      return { type: "year" as const, days: daysDiff }
    } else if (daysDiff > 60) {
      // Entre 2 et 6 mois = afficher par semaine
      return { type: "quarter" as const, days: daysDiff }
    } else {
      // Moins de 2 mois = afficher par jour
      return { type: "month" as const, days: daysDiff }
    }
  }, [periodStart, periodEnd])

  // Formater les dates selon la période
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString)
      
      if (periodInfo.type === "year") {
        // Format mois pour période annuelle
        return date.toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        })
      } else if (periodInfo.type === "quarter") {
        // Format semaine pour période trimestrielle
        const week = Math.ceil(date.getDate() / 7)
        return `S${week} ${date.toLocaleDateString("fr-FR", { month: "short" })}`
      } else {
        // Format jour pour période mensuelle
        return date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        })
      }
    } catch {
      return dateString
    }
  }, [periodInfo.type])

  // Agréger les données par mois pour les périodes annuelles
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    if (periodInfo.type === "year") {
      // Agréger par mois
      const monthlyMap = new Map<string, {
        demande: number
        devis_envoye: number
        accepte: number
        en_cours: number
        termine: number
        date: string
        dateKey: string
      }>()
      
      data.forEach((item) => {
        const date = new Date(item.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const monthLabel = date.toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        })
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            demande: 0,
            devis_envoye: 0,
            accepte: 0,
            en_cours: 0,
            termine: 0,
            date: monthLabel,
            dateKey: monthKey,
          })
        }
        
        const monthData = monthlyMap.get(monthKey)!
        monthData.demande += item.demande
        monthData.devis_envoye += item.devis_envoye
        monthData.accepte += item.accepte
        monthData.en_cours += item.en_cours
        monthData.termine += item.termine
      })
      
      return Array.from(monthlyMap.values()).sort((a, b) => {
        return a.dateKey.localeCompare(b.dateKey)
      })
    }
    
    return data
  }, [data, periodInfo.type])

  // Préparer les données pour Recharts
  const chartData = useMemo(() => {
    if (!aggregatedData || aggregatedData.length === 0) return []

    return aggregatedData.map((item) => {
      const total =
        item.demande +
        item.devis_envoye +
        item.accepte +
        item.en_cours +
        item.termine

      return {
        date: item.date,
        dateFormatted: periodInfo.type === "year" ? item.date : formatDate(item.date),
        demande: item.demande,
        devis_envoye: item.devis_envoye,
        accepte: item.accepte,
        en_cours: item.en_cours,
        termine: item.termine,
        total,
      }
    })
  }, [aggregatedData, formatDate, periodInfo.type])

  // Calculer l'intervalle d'affichage des ticks selon la période
  const tickInterval = useMemo(() => {
    if (periodInfo.type === "year") {
      return Math.max(0, Math.floor(chartData.length / 12)) // Afficher environ 12 mois
    } else if (periodInfo.type === "quarter") {
      return Math.max(0, Math.floor(chartData.length / 8)) // Afficher environ 8 semaines
    } else {
      return 0 // Afficher tous les jours pour période mensuelle
    }
  }, [chartData.length, periodInfo.type])

  // Gérer le clic sur la légende
  const handleLegendClick = (dataKey: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(dataKey)) {
        next.delete(dataKey)
      } else {
        next.add(dataKey)
      }
      return next
    })
  }

  // Tooltip personnalisé
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const total = data.total

      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <div className="mb-2 font-semibold text-foreground">
            {periodInfo.type === "year" ? label : formatDate(label)}
          </div>
          <div className="space-y-1">
            {STATUS_CONFIG.map((status) => {
              const value = data[status.key] || 0
              if (value === 0) return null
              return (
                <div
                  key={status.key}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-muted-foreground">
                      {status.label}:
                    </span>
                  </div>
                  <span className="font-medium">{value}</span>
                </div>
              )
            })}
            <div className="mt-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total:</span>
                <span className="font-bold text-foreground">{total}</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Légende personnalisée cliquable
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        {payload?.map((entry: any, index: number) => {
          const isHidden = hiddenStatuses.has(entry.dataKey)
          return (
            <div
              key={index}
              onClick={() => handleLegendClick(entry.dataKey)}
              className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
              style={{ opacity: isHidden ? 0.3 : 1 }}
            >
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">
                {entry.value}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[340px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-[340px] flex items-center justify-center text-muted-foreground">
          Aucune donnée disponible
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-1 border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          {title}
        </CardTitle>
        <CardDescription>
          {periodInfo.type === "year" 
            ? "Répartition mensuelle des interventions par statut"
            : periodInfo.type === "quarter"
            ? "Répartition hebdomadaire des interventions par statut"
            : description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "hsl(var(--border))" : "#e5e7eb"}
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="dateFormatted"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={tickInterval}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => value.toLocaleString("fr-FR")}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />

              {/* Barres empilées dans l'ordre (du bas vers le haut) */}
              {STATUS_CONFIG.map((status, index) => {
                const isLast = index === STATUS_CONFIG.length - 1
                return (
                  <Bar
                    key={status.key}
                    dataKey={status.key}
                    stackId="a"
                    fill={status.color}
                    radius={isLast ? [4, 4, 0, 0] : [0, 0, 0, 0]} // Radius uniquement sur le haut de la pile
                    hide={hiddenStatuses.has(status.key)}
                  />
                )
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

