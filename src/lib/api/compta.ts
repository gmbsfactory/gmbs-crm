import { supabase } from "@/lib/supabase-client"

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
   * Récupère toutes les entrées de facturation (transitions vers INTER_TERMINEE).
   * Query légère sur intervention_status_transitions, sans charger les interventions complètes.
   * Dédoublonne par intervention (garde la plus récente) et trie par date DESC.
   */
  async getAllFacturationEntries(
    dateRange?: { start: string; end: string } | null
  ): Promise<FacturationEntriesResult> {
    let query = supabase
      .from("intervention_status_transitions")
      .select("intervention_id, transition_date")
      .eq("to_status_code", "INTER_TERMINEE")
      .order("transition_date", { ascending: false })

    if (dateRange) {
      query = query.gte("transition_date", dateRange.start).lte("transition_date", dateRange.end)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching all facturation entries:", error)
      throw error
    }

    // Dédoublonnage : garder la transition la plus récente par intervention
    const dateMap = new Map<string, string>()
    for (const row of data || []) {
      if (!dateMap.has(row.intervention_id)) {
        dateMap.set(row.intervention_id, row.transition_date)
      }
    }

    // IDs triés par date de facturation DESC (l'ordre est déjà garanti par la query)
    const sortedIds = Array.from(dateMap.keys())

    return { dateMap, sortedIds, total: sortedIds.length }
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
  }
}
