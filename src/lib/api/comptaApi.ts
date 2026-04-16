import { supabase } from "./common/client"

export interface FacturationEntriesResult {
  dateMap: Map<string, string>
  sortedIds: string[]
  total: number
}

/**
 * API pour la gestion des checks comptabilité
 * Permet de marquer les interventions comme "gérées" dans l'onglet compta
 */
export const comptaApi = {
  /**
   * Récupère les interventions dont le statut actuel est INTER_TERMINEE.
   * Enrichit avec la date de facturation (dernière transition vers INTER_TERMINEE).
   * Exclut les interventions marquées comme exclues de la compta.
   */
  async getAllFacturationEntries(
    dateRange?: { start: string; end: string } | null
  ): Promise<FacturationEntriesResult> {
    // 1. Résoudre l'UUID du statut INTER_TERMINEE
    const { data: statusData, error: statusError } = await supabase
      .from("intervention_statuses")
      .select("id")
      .eq("code", "INTER_TERMINEE")
      .single()

    if (statusError || !statusData) {
      console.error("Error fetching INTER_TERMINEE status:", statusError)
      throw statusError || new Error("Status INTER_TERMINEE not found")
    }

    // 2. En parallèle : interventions au statut actuel INTER_TERMINEE + transitions (dates) + exclusions
    const [interventionsResult, transitionsResult, exclusionsResult] = await Promise.all([
      supabase
        .from("interventions")
        .select("id")
        .eq("statut_id", statusData.id),
      supabase
        .from("intervention_status_transitions")
        .select("intervention_id, transition_date")
        .eq("to_status_code", "INTER_TERMINEE")
        .order("transition_date", { ascending: false }),
      supabase
        .from("intervention_compta_exclusions")
        .select("intervention_id"),
    ])

    if (interventionsResult.error) {
      console.error("Error fetching INTER_TERMINEE interventions:", interventionsResult.error)
      throw interventionsResult.error
    }

    // Set des IDs au statut actuel INTER_TERMINEE
    const termineeIds = new Set<string>(
      (interventionsResult.data || []).map((row: { id: string }) => row.id)
    )

    // Set des IDs exclus
    const excludedIds = new Set(
      (exclusionsResult.data || []).map((row: { intervention_id: string }) => row.intervention_id)
    )

    // Map des dates de facturation (dernière transition vers INTER_TERMINEE)
    const dateMap = new Map<string, string>()
    for (const row of transitionsResult.data || []) {
      if (
        termineeIds.has(row.intervention_id) &&
        !excludedIds.has(row.intervention_id) &&
        !dateMap.has(row.intervention_id)
      ) {
        dateMap.set(row.intervention_id, row.transition_date)
      }
    }

    // Ajouter les interventions INTER_TERMINEE sans transition (cas rare)
    for (const id of termineeIds) {
      if (!excludedIds.has(id) && !dateMap.has(id)) {
        dateMap.set(id, "")
      }
    }

    // Filtrer par date range sur la date de facturation
    let sortedIds: string[]
    if (dateRange) {
      sortedIds = Array.from(dateMap.entries())
        .filter(([, date]) => {
          if (!date) return false
          return date >= dateRange.start && date <= dateRange.end
        })
        .sort(([, a], [, b]) => (b || "").localeCompare(a || ""))
        .map(([id]) => id)
    } else {
      sortedIds = Array.from(dateMap.entries())
        .sort(([, a], [, b]) => (b || "").localeCompare(a || ""))
        .map(([id]) => id)
    }

    // Nettoyer la dateMap pour ne garder que les IDs filtrés
    const filteredDateMap = new Map<string, string>()
    for (const id of sortedIds) {
      const date = dateMap.get(id)
      if (date) filteredDateMap.set(id, date)
    }

    return { dateMap: filteredDateMap, sortedIds, total: sortedIds.length }
  },

  /**
   * Récupère les dates de facturation (date de passage à INTER_TERMINEE) pour les interventions
   * @returns Map intervention_id -> date de facturation
   */
  async getFacturationDates(interventionIds: string[]): Promise<Map<string, string>> {
    if (!interventionIds.length) return new Map()

    const dateMap = new Map<string, string>()
    const BATCH_SIZE = 50 // Limiter la taille des requêtes pour éviter les URLs trop longues

    // Diviser en lots
    for (let i = 0; i < interventionIds.length; i += BATCH_SIZE) {
      const batch = interventionIds.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from("intervention_status_transitions")
        .select("intervention_id, transition_date")
        .in("intervention_id", batch)
        .eq("to_status_code", "INTER_TERMINEE")
        .order("transition_date", { ascending: false })

      if (error) {
        console.error("Error fetching facturation dates batch:", error)
        continue
      }

      // Ajouter à la map (la date la plus récente pour chaque intervention)
      for (const row of data || []) {
        if (!dateMap.has(row.intervention_id)) {
          dateMap.set(row.intervention_id, row.transition_date)
        }
      }
    }

    return dateMap
  },

  /**
   * Récupère les IDs des interventions cochées comme "gérées"
   */
  async getCheckedInterventions(interventionIds: string[]): Promise<Set<string>> {
    if (!interventionIds.length) return new Set()

    const checkedIds = new Set<string>()
    const BATCH_SIZE = 50

    // Diviser en lots pour éviter les URLs trop longues
    for (let i = 0; i < interventionIds.length; i += BATCH_SIZE) {
      const batch = interventionIds.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from("intervention_compta_checks")
        .select("intervention_id")
        .in("intervention_id", batch)

      if (error) {
        console.error("Error fetching compta checks batch:", error)
        continue
      }

      for (const row of data || []) {
        checkedIds.add(row.intervention_id)
      }
    }

    return checkedIds
  },

  /**
   * Vérifie si une intervention est cochée
   */
  async isChecked(interventionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("intervention_compta_checks")
      .select("id")
      .eq("intervention_id", interventionId)

    if (error) {
      console.error("Error checking compta status:", error)
      return false
    }

    return (data?.length ?? 0) > 0
  },

  /**
   * Coche une intervention comme "gérée"
   */
  async check(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_checks")
      .upsert(
        { intervention_id: interventionId },
        { onConflict: "intervention_id" }
      )

    if (error) {
      console.error("Error adding compta check:", error)
      return false
    }
    return true
  },

  /**
   * Décoche une intervention
   */
  async uncheck(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_checks")
      .delete()
      .eq("intervention_id", interventionId)

    if (error) {
      console.error("Error removing compta check:", error)
      return false
    }
    return true
  },

  /**
   * Exclut une intervention de la vue comptabilité
   */
  async exclude(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_exclusions")
      .upsert(
        { intervention_id: interventionId },
        { onConflict: "intervention_id" }
      )

    if (error) {
      console.error("Error excluding intervention from compta:", error)
      return false
    }
    return true
  },

  /**
   * Restaure une intervention exclue dans la vue comptabilité
   */
  async restore(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_exclusions")
      .delete()
      .eq("intervention_id", interventionId)

    if (error) {
      console.error("Error restoring intervention to compta:", error)
      return false
    }
    return true
  },
}
