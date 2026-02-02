import { supabase } from "@/lib/supabase-client"

/**
 * API pour la gestion des checks comptabilité
 * Permet de marquer les interventions comme "gérées" dans l'onglet compta
 */
export const comptaApi = {
  /**
   * Récupère les IDs des interventions cochées comme "gérées"
   */
  async getCheckedInterventions(interventionIds: string[]): Promise<Set<string>> {
    if (!interventionIds.length) return new Set()
    
    const { data, error } = await supabase
      .from("intervention_compta_checks")
      .select("intervention_id")
      .in("intervention_id", interventionIds)
    
    if (error) {
      console.error("Error fetching compta checks:", error)
      return new Set()
    }
    
    return new Set(data?.map(d => d.intervention_id) || [])
  },

  /**
   * Toggle le statut "géré" d'une intervention
   * @returns true si coché après l'opération, false sinon
   */
  async toggleCheck(interventionId: string): Promise<boolean> {
    // Vérifier si déjà coché
    const { data: existing } = await supabase
      .from("intervention_compta_checks")
      .select("id")
      .eq("intervention_id", interventionId)
      .single()
    
    if (existing) {
      // Supprimer le check
      const { error } = await supabase
        .from("intervention_compta_checks")
        .delete()
        .eq("intervention_id", interventionId)
      
      if (error) {
        console.error("Error removing compta check:", error)
        return true // Garde l'état coché en cas d'erreur
      }
      return false
    } else {
      // Ajouter le check
      const { error } = await supabase
        .from("intervention_compta_checks")
        .insert({ intervention_id: interventionId })
      
      if (error) {
        console.error("Error adding compta check:", error)
        return false // Garde l'état non coché en cas d'erreur
      }
      return true
    }
  }
}
