import type { AdminDashboardStats, PeriodType } from "@/lib/api/v2/common/types"

// Re-export for convenience
export type { AdminDashboardStats, PeriodType }

/** Chart dimension type for distribution views */
export type ChartType = "metier" | "agences" | "gestionnaire"

/** Chart metric for distribution views */
export type ChartMetric = "volume" | "ca" | "marge"

/** Common filter state shared across dashboard sections */
export interface DashboardFilterState {
  agenceIds: string[]
  gestionnaireIds: string[]
  metierIds: string[]
  startDate: string | null
  endDate: string | null
  apiPeriodType: PeriodType
}

/** Props for modal components that share filter context */
export interface ModalFilterProps {
  periodType: PeriodType
  startDate: string | undefined
  endDate: string | undefined
  agenceIds: string[] | undefined
  gestionnaireIds: string[] | undefined
  metierIds: string[] | undefined
}

/** Chart data point for the horizontal bar chart */
export interface ChartDataPoint {
  name: string
  value: number
}

/** Agency stat row type (extracted from AdminDashboardStats) */
export type AgencyStat = AdminDashboardStats["agencyStats"][number]

/** Gestionnaire stat row type (extracted from AdminDashboardStats) */
export type GestionnaireStat = AdminDashboardStats["gestionnaireStats"][number]

/** Metier breakdown row type (extracted from AdminDashboardStats) */
export type MetierBreakdownStat = AdminDashboardStats["metierBreakdown"][number]

/** Metier stat row type (extracted from AdminDashboardStats) */
export type MetierStat = NonNullable<AdminDashboardStats["metierStats"]>[number]
