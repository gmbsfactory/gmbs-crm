"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { interventionsApi } from "@/lib/api/v2"
import { supabase } from "@/lib/supabase-client"
import type { WeeklyStats, MonthlyStats, YearlyStats, StatsPeriod } from "@/lib/api/v2"
import Loader from "@/components/ui/Loader"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardPeriodStats } from "@/hooks/useDashboardStats"

interface WeeklyStatsTableProps {
  weekStartDate?: string
  period?: {
    startDate?: string
    endDate?: string
  }
  userId?: string | null
}

// Helper pour déterminer le type de période à partir des dates
function getPeriodTypeFromDates(startDate?: string, endDate?: string): StatsPeriod {
  if (!startDate || !endDate) return "week"

  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) return "week"
  if (diffDays <= 35) return "month"
  return "year"
}

export function WeeklyStatsTable({ weekStartDate, period: externalPeriod, userId: propUserId }: WeeklyStatsTableProps) {
  // Si une période externe est fournie, utiliser son type, sinon semaine par défaut
  const [period, setPeriod] = useState<StatsPeriod>(
    externalPeriod ? getPeriodTypeFromDates(externalPeriod.startDate, externalPeriod.endDate) : "week"
  )

  // Mettre à jour la période si la période externe change
  useEffect(() => {
    if (externalPeriod) {
      const newPeriod = getPeriodTypeFromDates(externalPeriod.startDate, externalPeriod.endDate)
      setPeriod(newPeriod)
    }
  }, [externalPeriod])
  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  // Utiliser le prop userId s'il est fourni, sinon utiliser currentUser
  const userId = propUserId ?? currentUser?.id ?? null

  // Utiliser la date de début de la période externe si disponible
  const startDateForQuery = externalPeriod?.startDate || (period === "week" ? weekStartDate : undefined)

  // Utiliser TanStack Query pour charger les stats par période (cache partagé et déduplication automatique)
  const { data: stats, isLoading: loading, error: queryError } = useDashboardPeriodStats(
    userId && period ? { period, startDate: startDateForQuery } : null,
    userId
  )
  const error = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] rounded-xl bg-background border border-border/40 shadow-lg">
        <div style={{ transform: 'scale(1.25)' }}>
          <Loader />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg p-6">
        <p className="text-sm text-muted-foreground">
          Veuillez vous connecter pour voir vos statistiques
        </p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg p-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Aucune donnée disponible pour cette période.
          </p>
          <p className="text-xs text-muted-foreground">
            Vérifiez la console du navigateur (F12) pour voir les détails de debug.
          </p>
          <p className="text-xs text-muted-foreground">
            Possibles causes :
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
            <li>L&apos;utilisateur n&apos;a pas d&apos;interventions assignées</li>
            <li>Les données sont en dehors de la période sélectionnée</li>
            <li>Les interventions n&apos;ont pas les statuts recherchés (DEVIS_ENVOYE, INTER_EN_COURS, INTER_TERMINEE)</li>
          </ul>
        </div>
      </div>
    )
  }

  // Rendu pour la semaine
  if (period === "week" && "week_start" in stats) {
    const weekStats = stats as WeeklyStats
    const rows = [
      { label: "Devis envoyé", data: weekStats.devis_envoye },
      { label: "Inter en cours", data: weekStats.inter_en_cours },
      { label: "Inter Facturés", data: weekStats.inter_factures },
      { label: "Nouveaux Artisans", data: weekStats.nouveaux_artisans },
      { label: "Artisans Missionnés", data: weekStats.artisans_missionnes },
    ]

    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[200px] font-bold text-foreground">Action</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Lundi</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Mardi</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Mercredi</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Jeudi</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Vendredi</TableHead>
                <TableHead className="text-center font-bold bg-primary/10 dark:bg-primary/20 text-primary min-w-[80px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                // Palette de couleurs pour chaque type de ligne
                const rowColors = {
                  "Devis envoyé": {
                    bg: "bg-blue-50/60 dark:bg-blue-950/30",
                    hover: "hover:bg-blue-100/80 dark:hover:bg-blue-900/50",
                    label: "text-blue-700 dark:text-blue-300",
                    border: "border-blue-400 dark:border-blue-600"
                  },
                  "Inter en cours": {
                    bg: "bg-amber-50/60 dark:bg-amber-950/30",
                    hover: "hover:bg-amber-100/80 dark:hover:bg-amber-900/50",
                    label: "text-amber-700 dark:text-amber-300",
                    border: "border-amber-400 dark:border-amber-600"
                  },
                  "Inter Facturés": {
                    bg: "bg-green-50/60 dark:bg-green-950/30",
                    hover: "hover:bg-green-100/80 dark:hover:bg-green-900/50",
                    label: "text-green-700 dark:text-green-300",
                    border: "border-green-400 dark:border-green-600"
                  },
                  "Nouveaux Artisans": {
                    bg: "bg-purple-50/60 dark:bg-purple-950/30",
                    hover: "hover:bg-purple-100/80 dark:hover:bg-purple-900/50",
                    label: "text-purple-700 dark:text-purple-300",
                    border: "border-purple-400 dark:border-purple-600"
                  },
                  "Artisans Missionnés": {
                    bg: "bg-yellow-50/60 dark:bg-yellow-950/30",
                    hover: "hover:bg-yellow-100/80 dark:hover:bg-yellow-900/50",
                    label: "text-yellow-700 dark:text-yellow-300",
                    border: "border-yellow-400 dark:border-yellow-600"
                  }
                }
                const colors = rowColors[row.label as keyof typeof rowColors] || {
                  bg: index % 2 === 0 ? "bg-muted/30" : "bg-background",
                  hover: "hover:bg-muted/50",
                  label: "text-foreground",
                  border: "border-border/20"
                }

                return (
                  <TableRow
                    key={row.label}
                    className={`border-b-0 ${colors.bg} ${colors.hover} border-l-4 ${colors.border} transition-colors duration-200 h-14`}
                  >
                    <TableCell className={`font-semibold py-4 text-base ${colors.label}`}>{row.label}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.lundi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.mardi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.mercredi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.jeudi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.vendredi}</TableCell>
                    <TableCell className="text-center font-bold bg-muted/40 dark:bg-muted/60 py-4 text-lg">{row.data.total}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Rendu pour le mois
  if (period === "month" && "month_start" in stats) {
    const monthStats = stats as MonthlyStats
    const rows = [
      { label: "Devis envoyé", data: monthStats.devis_envoye },
      { label: "Inter en cours", data: monthStats.inter_en_cours },
      { label: "Inter Facturés", data: monthStats.inter_factures },
      { label: "Nouveaux Artisans", data: monthStats.nouveaux_artisans },
      { label: "Artisans Missionnés", data: monthStats.artisans_missionnes },
    ]

    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[200px] font-bold text-foreground">Action</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[70px]">Semaine 1</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[70px]">Semaine 2</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[70px]">Semaine 3</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[70px]">Semaine 4</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[70px]">Semaine 5</TableHead>
                <TableHead className="text-center font-bold bg-primary/10 dark:bg-primary/20 text-primary min-w-[80px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                // Palette de couleurs pour chaque type de ligne
                const rowColors = {
                  "Devis envoyé": {
                    bg: "bg-blue-50/60 dark:bg-blue-950/30",
                    hover: "hover:bg-blue-100/80 dark:hover:bg-blue-900/50",
                    label: "text-blue-700 dark:text-blue-300",
                    border: "border-blue-400 dark:border-blue-600"
                  },
                  "Inter en cours": {
                    bg: "bg-amber-50/60 dark:bg-amber-950/30",
                    hover: "hover:bg-amber-100/80 dark:hover:bg-amber-900/50",
                    label: "text-amber-700 dark:text-amber-300",
                    border: "border-amber-400 dark:border-amber-600"
                  },
                  "Inter Facturés": {
                    bg: "bg-green-50/60 dark:bg-green-950/30",
                    hover: "hover:bg-green-100/80 dark:hover:bg-green-900/50",
                    label: "text-green-700 dark:text-green-300",
                    border: "border-green-400 dark:border-green-600"
                  },
                  "Nouveaux Artisans": {
                    bg: "bg-purple-50/60 dark:bg-purple-950/30",
                    hover: "hover:bg-purple-100/80 dark:hover:bg-purple-900/50",
                    label: "text-purple-700 dark:text-purple-300",
                    border: "border-purple-400 dark:border-purple-600"
                  },
                  "Artisans Missionnés": {
                    bg: "bg-yellow-50/60 dark:bg-yellow-950/30",
                    hover: "hover:bg-yellow-100/80 dark:hover:bg-yellow-900/50",
                    label: "text-yellow-700 dark:text-yellow-300",
                    border: "border-yellow-400 dark:border-yellow-600"
                  }
                }
                const colors = rowColors[row.label as keyof typeof rowColors] || {
                  bg: index % 2 === 0 ? "bg-muted/30" : "bg-background",
                  hover: "hover:bg-muted/50",
                  label: "text-foreground",
                  border: "border-border/20"
                }

                return (
                  <TableRow
                    key={row.label}
                    className={`border-b-0 ${colors.bg} ${colors.hover} border-l-4 ${colors.border} transition-colors duration-200 h-14`}
                  >
                    <TableCell className={`font-semibold py-4 text-base ${colors.label}`}>{row.label}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.semaine1}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.semaine2}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.semaine3}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.semaine4}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.semaine5}</TableCell>
                    <TableCell className="text-center font-bold bg-muted/40 dark:bg-muted/60 py-4 text-base">{row.data.total}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Rendu pour l'année
  if (period === "year" && "year_start" in stats) {
    const yearStats = stats as YearlyStats
    const rows = [
      { label: "Devis envoyé", data: yearStats.devis_envoye },
      { label: "Inter en cours", data: yearStats.inter_en_cours },
      { label: "Inter Facturés", data: yearStats.inter_factures },
      { label: "Nouveaux Artisans", data: yearStats.nouveaux_artisans },
      { label: "Artisans Missionnés", data: yearStats.artisans_missionnes },
    ]

    const monthLabels = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ]

    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[180px] font-bold text-foreground">Action</TableHead>
                {monthLabels.map((month) => (
                  <TableHead key={month} className="text-center text-xs font-bold text-foreground min-w-[45px]">
                    {month.slice(0, 3)}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold bg-primary/10 dark:bg-primary/20 text-primary min-w-[60px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                // Palette de couleurs pour chaque type de ligne
                const rowColors = {
                  "Devis envoyé": {
                    bg: "bg-blue-50/60 dark:bg-blue-950/30",
                    hover: "hover:bg-blue-100/80 dark:hover:bg-blue-900/50",
                    label: "text-blue-700 dark:text-blue-300",
                    border: "border-blue-400 dark:border-blue-600"
                  },
                  "Inter en cours": {
                    bg: "bg-amber-50/60 dark:bg-amber-950/30",
                    hover: "hover:bg-amber-100/80 dark:hover:bg-amber-900/50",
                    label: "text-amber-700 dark:text-amber-300",
                    border: "border-amber-400 dark:border-amber-600"
                  },
                  "Inter Facturés": {
                    bg: "bg-green-50/60 dark:bg-green-950/30",
                    hover: "hover:bg-green-100/80 dark:hover:bg-green-900/50",
                    label: "text-green-700 dark:text-green-300",
                    border: "border-green-400 dark:border-green-600"
                  },
                  "Nouveaux Artisans": {
                    bg: "bg-purple-50/60 dark:bg-purple-950/30",
                    hover: "hover:bg-purple-100/80 dark:hover:bg-purple-900/50",
                    label: "text-purple-700 dark:text-purple-300",
                    border: "border-purple-400 dark:border-purple-600"
                  },
                  "Artisans Missionnés": {
                    bg: "bg-yellow-50/60 dark:bg-yellow-950/30",
                    hover: "hover:bg-yellow-100/80 dark:hover:bg-yellow-900/50",
                    label: "text-yellow-700 dark:text-yellow-300",
                    border: "border-yellow-400 dark:border-yellow-600"
                  }
                }
                const colors = rowColors[row.label as keyof typeof rowColors] || {
                  bg: index % 2 === 0 ? "bg-muted/30" : "bg-background",
                  hover: "hover:bg-muted/50",
                  label: "text-foreground",
                  border: "border-border/20"
                }

                return (
                  <TableRow
                    key={row.label}
                    className={`border-b-0 ${colors.bg} ${colors.hover} border-l-4 ${colors.border} transition-colors duration-200 h-14`}
                  >
                    <TableCell className={`font-semibold py-4 text-sm ${colors.label}`}>{row.label}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.janvier}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.fevrier}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.mars}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.avril}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.mai}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.juin}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.juillet}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.aout}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.septembre}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.octobre}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.novembre}</TableCell>
                    <TableCell className="text-center py-4 text-base font-medium">{row.data.decembre}</TableCell>
                    <TableCell className="text-center font-bold bg-muted/40 dark:bg-muted/60 py-4 text-base">{row.data.total}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return null
}
