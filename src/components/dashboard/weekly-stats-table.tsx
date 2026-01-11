"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { interventionsApi } from "@/lib/api/v2"
import { supabase } from "@/lib/supabase-client"
import type { WeeklyStats, MonthlyStats, YearlyStats, StatsPeriod } from "@/lib/api/v2"
import Loader from "@/components/ui/Loader"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardPeriodStats } from "@/hooks/useDashboardStats"
import { INTERVENTION_STATUS } from "@/config/interventions"

// Configuration des couleurs par type de ligne du tableau
// Utilise les couleurs hex de INTERVENTION_STATUS pour les statuts correspondants
const ROW_COLORS_CONFIG = {
  "Devis envoyé": INTERVENTION_STATUS.DEVIS_ENVOYE.hexColor,      // #6366F1 (indigo)
  "Inter en cours": INTERVENTION_STATUS.INTER_EN_COURS.hexColor,  // #A855F7 (purple)
  "Inter Facturés": INTERVENTION_STATUS.INTER_TERMINEE.hexColor,  // #0EA5E9 (sky)
  "Nouveaux Artisans": "#22C55E",                                  // vert flash (pas de statut correspondant)
  "Artisans Missionnés": "#F59E0B",                               // amber (pas de statut correspondant)
} as const

// Helper pour convertir une couleur hex en styles CSS inline avec opacité
function getRowStyles(hexColor: string) {
  return {
    bg: hexColor,
    bgLight: `${hexColor}15`,      // 15 = ~8% opacité pour le fond clair
    bgHover: `${hexColor}25`,      // 25 = ~15% opacité pour le hover
    border: hexColor,
    text: hexColor,
  }
}

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
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Samedi</TableHead>
                <TableHead className="text-center font-bold text-foreground min-w-[80px]">Dimanche</TableHead>
                <TableHead className="text-center font-bold bg-primary/10 dark:bg-primary/20 text-primary min-w-[80px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 border-l-4 transition-colors duration-200 h-14 hover:brightness-95"
                    style={{
                      backgroundColor: styles?.bgLight ?? (index % 2 === 0 ? 'var(--muted)' : 'transparent'),
                      borderLeftColor: styles?.border ?? 'var(--border)',
                    }}
                  >
                    <TableCell
                      className="font-semibold py-4 text-base"
                      style={{ color: styles?.text ?? 'var(--foreground)' }}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.lundi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.mardi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.mercredi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.jeudi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.vendredi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.samedi}</TableCell>
                    <TableCell className="text-center py-4 text-lg font-medium">{row.data.dimanche}</TableCell>
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
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 border-l-4 transition-colors duration-200 h-14 hover:brightness-95"
                    style={{
                      backgroundColor: styles?.bgLight ?? (index % 2 === 0 ? 'var(--muted)' : 'transparent'),
                      borderLeftColor: styles?.border ?? 'var(--border)',
                    }}
                  >
                    <TableCell
                      className="font-semibold py-4 text-base"
                      style={{ color: styles?.text ?? 'var(--foreground)' }}
                    >
                      {row.label}
                    </TableCell>
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
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 border-l-4 transition-colors duration-200 h-14 hover:brightness-95"
                    style={{
                      backgroundColor: styles?.bgLight ?? (index % 2 === 0 ? 'var(--muted)' : 'transparent'),
                      borderLeftColor: styles?.border ?? 'var(--border)',
                    }}
                  >
                    <TableCell
                      className="font-semibold py-4 text-sm"
                      style={{ color: styles?.text ?? 'var(--foreground)' }}
                    >
                      {row.label}
                    </TableCell>
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
