"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { WeeklyStats, MonthlyStats, YearlyStats, StatsPeriod } from "@/lib/api"
import Loader from "@/components/ui/Loader"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useUserRoles } from "@/hooks/useUserRoles"
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

// ── Styles inline (en-têtes ET cellules) ────────────────────────────────────
// La feuille globale `app/styles/tables.css` impose le fond des cellules via
// `.data-table tbody tr td { background-color: var(--cell-base-color) }` (+ stripe
// pattern qui pose --cell-base-color sur chaque <td>), et l'alignement/couleur des
// <th> via `.data-table th`. Ces sélecteurs sont plus spécifiques que les classes
// Tailwind. On pilote donc fond/couleur/alignement EN INLINE (qui prime), pour
// retrouver le rendu de la maquette : teinte par ligne + colonne en cours en bleu.
const HILITE_TEXT = "var(--info)"      // bleu "info" du thème (s'adapte clair / sombre)
const HILITE_BG = "var(--info-bg)"     // fond bleu clair de la colonne en cours
const NEUTRAL_BG = "hsl(var(--muted) / 0.5)" // gris neutre pour la colonne Total

// En-tête d'une colonne de données (jour / semaine / mois). `accent` = colonne en cours.
function columnHeaderStyle(accent: boolean): CSSProperties {
  return {
    textAlign: "center",
    fontWeight: 700,
    color: accent ? HILITE_TEXT : "var(--text)",
    backgroundColor: accent ? HILITE_BG : undefined,
  }
}

// En-tête de la colonne Total : libellé bleu accentué sur fond gris neutre
const TOTAL_HEADER_STYLE: CSSProperties = {
  textAlign: "center",
  fontWeight: 700,
  color: HILITE_TEXT,
  backgroundColor: NEUTRAL_BG,
}

// Cellule de données : fond = teinte de la ligne, sauf colonne en cours (bleu)
function dataCellStyle(rowTint: string | undefined, current: boolean): CSSProperties {
  if (current) return { backgroundColor: HILITE_BG, color: HILITE_TEXT, fontWeight: 700 }
  return { backgroundColor: rowTint }
}

// Cellule Total : fond gris neutre, en gras
const TOTAL_CELL_STYLE: CSSProperties = { backgroundColor: NEUTRAL_BG, fontWeight: 700 }

// Cellule "Action" (libellé de ligne) : barre colorée à gauche + teinte de la ligne
function actionCellStyle(rowStyles: ReturnType<typeof getRowStyles> | null): CSSProperties {
  return {
    color: rowStyles?.text ?? "var(--foreground)",
    backgroundColor: rowStyles?.bgLight,
    borderLeft: `4px solid ${rowStyles?.border ?? "var(--border)"}`,
  }
}

// Libellés et clés des colonnes, par période
const WEEK_DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const
const WEEK_DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const
const YEAR_MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const
const YEAR_MONTH_KEYS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
] as const

// Les 7 jours (lundi -> dimanche) d'une semaine à partir de son lundi ISO
function weekDays(weekStartISO: string): Date[] {
  const monday = new Date(weekStartISO)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

// Libellé de plage d'une semaine du mois, ex. "1–4 janv."
function formatWeekRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  return `${format(start, "d", { locale: fr })}–${format(end, "d MMM", { locale: fr })}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Index de la plage (semaine du mois) contenant aujourd'hui, ou -1 — pour surligner la colonne courante
function indexContainingToday(ranges: { start: string; end: string }[]): number {
  const now = new Date()
  return ranges.findIndex((r) => now >= new Date(r.start) && now <= new Date(r.end))
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
  const { data: currentUser } = useCurrentUser()
  const { isAdmin } = useUserRoles()
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
    const days = weekDays(weekStats.week_start)
    const today = new Date()
    const todayIdx = days.findIndex((d) => isSameDay(d, today))
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
          <Table className="stats-clean">
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[200px]" style={{ textAlign: "left", fontWeight: 700, color: "var(--text)" }}>Action</TableHead>
                {days.map((day, i) => (
                  <TableHead
                    key={day.toISOString()}
                    className="min-w-[80px] leading-tight"
                    style={columnHeaderStyle(i === todayIdx)}
                  >
                    {WEEK_DAY_NAMES[i]}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {format(day, "d MMM", { locale: fr })}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="min-w-[80px]" style={TOTAL_HEADER_STYLE}>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 transition-colors duration-200 h-14 hover:brightness-95"
                  >
                    <TableCell className="font-semibold py-4 text-base" style={actionCellStyle(styles)}>
                      {row.label}
                    </TableCell>
                    {WEEK_DAY_KEYS.map((key, i) => (
                      <TableCell
                        key={key}
                        className="text-center py-4 text-lg font-medium"
                        style={dataCellStyle(styles?.bgLight, i === todayIdx)}
                      >
                        {row.data[key]}
                      </TableCell>
                    ))}
                    <TableCell className="text-center py-4 text-lg" style={TOTAL_CELL_STYLE}>{row.data.total}</TableCell>
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
    const weeks = monthStats.weeks ?? []
    const currentWeekIdx = indexContainingToday(weeks)
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
          <Table className="stats-clean">
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[200px]" style={{ textAlign: "left", fontWeight: 700, color: "var(--text)" }}>Action</TableHead>
                {weeks.map((week, i) => (
                  <TableHead
                    key={week.start}
                    className="min-w-[78px] leading-tight"
                    style={columnHeaderStyle(i === currentWeekIdx)}
                  >
                    Sem. {i + 1}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {formatWeekRange(week.start, week.end)}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="min-w-[80px]" style={TOTAL_HEADER_STYLE}>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 transition-colors duration-200 h-14 hover:brightness-95"
                  >
                    <TableCell className="font-semibold py-4 text-base" style={actionCellStyle(styles)}>
                      {row.label}
                    </TableCell>
                    {weeks.map((week, i) => (
                      <TableCell
                        key={week.start}
                        className="text-center py-4 text-base font-medium"
                        style={dataCellStyle(styles?.bgLight, i === currentWeekIdx)}
                      >
                        {row.data.counts[i] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-center py-4 text-base" style={TOTAL_CELL_STYLE}>{row.data.total}</TableCell>
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
    if (!isAdmin) {
      return (
        <div className="rounded-xl bg-background border border-border/40 shadow-lg p-6">
          <p className="text-sm text-muted-foreground">
            L&apos;affichage annuel est réservé aux administrateurs.
          </p>
        </div>
      )
    }
    const yearStats = stats as YearlyStats
    const now = new Date()
    const currentMonthIdx = yearStats.year === now.getFullYear() ? now.getMonth() : -1
    const rows = [
      { label: "Devis envoyé", data: yearStats.devis_envoye },
      { label: "Inter en cours", data: yearStats.inter_en_cours },
      { label: "Inter Facturés", data: yearStats.inter_factures },
      { label: "Nouveaux Artisans", data: yearStats.nouveaux_artisans },
      { label: "Artisans Missionnés", data: yearStats.artisans_missionnes },
    ]

    return (
      <div className="rounded-xl bg-background border border-border/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table className="stats-clean">
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                <TableHead className="w-[180px]" style={{ textAlign: "left", fontWeight: 700, color: "var(--text)" }}>Action</TableHead>
                {YEAR_MONTH_LABELS.map((month, i) => (
                  <TableHead
                    key={month}
                    className="min-w-[45px] text-xs"
                    style={columnHeaderStyle(i === currentMonthIdx)}
                  >
                    {month.slice(0, 3)}
                  </TableHead>
                ))}
                <TableHead className="min-w-[60px]" style={TOTAL_HEADER_STYLE}>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hexColor = ROW_COLORS_CONFIG[row.label as keyof typeof ROW_COLORS_CONFIG]
                const styles = hexColor ? getRowStyles(hexColor) : null

                return (
                  <TableRow
                    key={row.label}
                    className="border-b-0 transition-colors duration-200 h-14 hover:brightness-95"
                  >
                    <TableCell className="font-semibold py-4 text-sm" style={actionCellStyle(styles)}>
                      {row.label}
                    </TableCell>
                    {YEAR_MONTH_KEYS.map((key, i) => (
                      <TableCell
                        key={key}
                        className="text-center py-4 text-base font-medium"
                        style={dataCellStyle(styles?.bgLight, i === currentMonthIdx)}
                      >
                        {row.data[key]}
                      </TableCell>
                    ))}
                    <TableCell className="text-center py-4 text-base" style={TOTAL_CELL_STYLE}>{row.data.total}</TableCell>
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
