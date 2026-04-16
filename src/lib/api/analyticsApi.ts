// ===== API ANALYTICS V2 =====
// Données du dashboard analytics admin

import { supabase } from "./common/client"

// ===== TYPES =====

export interface AnalyticsKPIs {
  revenue: number
  revenueGrowth: number
  revenueYear: number
  margin: number
  marginGrowth: number
  cac: number
  cacGrowth: number
  ltv: number
  ltvGrowth: number
  churn: number
  churnGrowth: number
  dealCount: number
  winRate: number
  avgBasket: number
}

export interface AnalyticsSalesBySector {
  name: string
  value: number
  margin: number
}

export interface AnalyticsSalesByRegion {
  name: string
  value: number
  growth: number
}

export interface AnalyticsPipelineStage {
  stage: string
  count: number
  value: number
}

export interface AnalyticsMapIntervention {
  id: string
  address: string
  status: string
  metier: string
  lat?: number
  lng?: number
}

export interface AnalyticsData {
  kpis: AnalyticsKPIs
  salesBySector: AnalyticsSalesBySector[]
  salesByRegion: AnalyticsSalesByRegion[]
  pipeline: AnalyticsPipelineStage[]
  predictions: {
    revenueForecast: { date: string; value: number; lower: number; upper: number }[]
    churnRisk: { segment: string; risk: number; count: number }[]
  }
  mapInterventions: AnalyticsMapIntervention[]
}

// ===== HELPERS INTERNES =====

function getMonthBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getYearBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), 0, 1)
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function sumAmounts(rows: { amount?: number | string | null }[] | null): number {
  return rows?.reduce((sum, item) => sum + Number(item.amount || 0), 0) ?? 0
}

async function fetchRevenueByCostType(
  startISO: string,
  endISO: string
): Promise<number> {
  const { data, error } = await supabase
    .from("intervention_costs")
    .select("amount, intervention_id, interventions!inner(date)")
    .eq("cost_type", "intervention")
    .gte("interventions.date", startISO)
    .lte("interventions.date", endISO)

  if (error) {
    console.warn("Erreur lors du calcul du CA:", error)
  }
  return sumAmounts(data)
}

async function fetchRPCStats(startISO: string, endISO: string) {
  const { data, error } = await supabase.rpc("get_admin_dashboard_stats", {
    p_period_start: startISO,
    p_period_end: endISO,
    p_demande_status_code: "DEMANDE",
    p_devis_status_code: "DEVIS_ENVOYE",
    p_accepte_status_code: "ACCEPTE",
    p_en_cours_status_code: "INTER_EN_COURS",
    p_terminee_status_code: "INTER_TERMINEE",
    p_att_acompte_status_code: "ATT_ACOMPTE",
    p_valid_status_codes: ["INTER_TERMINEE", "INTER_EN_COURS", "ACCEPTE"],
  })

  if (error) {
    throw new Error(`Erreur RPC: ${error.message || JSON.stringify(error)}`)
  }
  if (!data) {
    throw new Error("Aucune donnee retournee par la fonction RPC")
  }
  return data
}

async function fetchActiveInterventions() {
  const { data, error } = await supabase
    .from("interventions")
    .select(`
      id,
      adresse,
      latitude,
      longitude,
      intervention_statuses!inner(code, label),
      metiers!inner(label)
    `)
    .eq("is_active", true)
    .not("adresse", "is", null)
    .limit(100)

  if (error) {
    throw new Error(
      `Erreur lors de la recuperation des interventions: ${error.message || JSON.stringify(error)}`
    )
  }
  return data ?? []
}

async function fetchLabelMap(
  table: "metiers" | "agencies",
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from(table)
    .select("id, label")
    .in("id", ids)

  if (error) {
    console.warn(`Erreur lors de la recuperation des ${table}:`, error)
    return {}
  }

  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[(row as { id: string }).id] = (row as { label: string }).label
  }
  return result
}

// ===== API PUBLIQUE =====

async function getDashboardData(): Promise<AnalyticsData> {
  const now = new Date()
  const currentMonth = getMonthBounds(now)
  const previousMonth = getMonthBounds(
    new Date(now.getFullYear(), now.getMonth() - 1, 1)
  )
  const currentYear = getYearBounds(now)

  // Batch 1: all independent fetches in parallel
  const [statsData, caMonth, caPreviousMonth, caYear, interventionsData] =
    await Promise.all([
      fetchRPCStats(currentMonth.start, currentMonth.end),
      fetchRevenueByCostType(currentMonth.start, currentMonth.end),
      fetchRevenueByCostType(previousMonth.start, previousMonth.end),
      fetchRevenueByCostType(currentYear.start, currentYear.end),
      fetchActiveInterventions(),
    ])

  // Batch 2: label lookups (depend on statsData)
  const metierIds = (statsData.metierBreakdown ?? [])
    .map((m: { metier_id?: string }) => m.metier_id)
    .filter(Boolean) as string[]
  const agenceIds = (statsData.agencyBreakdown ?? [])
    .map((a: { agence_id?: string }) => a.agence_id)
    .filter(Boolean) as string[]

  const [metiersMap, agenciesMap] = await Promise.all([
    fetchLabelMap("metiers", metierIds),
    fetchLabelMap("agencies", agenceIds),
  ])

  // Transform
  const mainStats = statsData.mainStats ?? {}
  const revenue = caMonth
  const revenueGrowth =
    caPreviousMonth > 0
      ? ((caMonth - caPreviousMonth) / caPreviousMonth) * 100
      : 0
  const nbValides = Number(mainStats.nbValides || 0)
  const nbDemandees = Number(mainStats.nbInterventionsDemandees || 0)

  return {
    kpis: {
      revenue,
      revenueGrowth,
      revenueYear: caYear,
      margin: Number(mainStats.marge || 0),
      marginGrowth: Number(mainStats.deltaMarge || 0),
      cac: 0,
      cacGrowth: 0,
      ltv: 0,
      ltvGrowth: 0,
      churn: 0,
      churnGrowth: 0,
      dealCount: nbValides,
      winRate: nbDemandees > 0 ? (nbValides / nbDemandees) * 100 : 0,
      avgBasket: nbValides > 0 ? revenue / nbValides : 0,
    },
    salesBySector: (statsData.metierBreakdown ?? []).map(
      (m: { metier_id?: string; count?: number }) => ({
        name: metiersMap[m.metier_id ?? ""] ?? m.metier_id ?? "Non defini",
        value: (m.count ?? 0) * 1000,
        margin: (m.count ?? 0) * 300,
      })
    ),
    salesByRegion: (statsData.agencyBreakdown ?? []).map(
      (a: { agence_id?: string; totalPaiements?: number }) => ({
        name: agenciesMap[a.agence_id ?? ""] ?? a.agence_id ?? "Non defini",
        value: Number(a.totalPaiements || 0),
        growth: 0,
      })
    ),
    pipeline: (statsData.statusBreakdown ?? []).map(
      (s: { statut_code?: string; count?: number }) => ({
        stage: s.statut_code ?? "UNKNOWN",
        count: Number(s.count || 0),
        value: Number(s.count || 0) * 500,
      })
    ),
    predictions: {
      revenueForecast: [],
      churnRisk: [],
    },
    mapInterventions: interventionsData.map((i: Record<string, unknown>) => {
      const statuses = i.intervention_statuses as { code?: string } | null
      const metier = i.metiers as { label?: string } | null
      return {
        id: i.id as string,
        address: (i.adresse as string) ?? "",
        status: statuses?.code ?? "UNKNOWN",
        metier: metier?.label ?? "General",
        lat: i.latitude ? Number(i.latitude) : undefined,
        lng: i.longitude ? Number(i.longitude) : undefined,
      }
    }),
  }
}

export const analyticsApi = {
  getDashboardData,
}
