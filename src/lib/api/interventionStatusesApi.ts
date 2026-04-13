// ===== API INTERVENTION STATUSES V2 =====
// Gestion des statuts d'intervention (ÉDITION UNIQUEMENT)
// Pas de création ni suppression pour préserver les règles de workflow

import { supabase } from "./common/client";

// Types
export interface InterventionStatus {
  id: string;
  code: string; // LECTURE SEULE - utilisé dans le code
  label: string; // Éditable
  color: string; // Éditable
  sort_order: number;
  is_active: boolean;
}

export interface UpdateInterventionStatusData {
  label?: string; // Éditable
  color?: string; // Éditable
  // Code JAMAIS éditable
  // sort_order JAMAIS éditable (ordre fixé par les règles de workflow)
}

export const interventionStatusesApi = {
  /**
   * Récupérer tous les statuts d'intervention
   */
  async getAll(): Promise<InterventionStatus[]> {
    const { data, error } = await supabase
      .from("intervention_statuses")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(`Erreur lors de la récupération des statuts: ${error.message}`);

    return data || [];
  },

  /**
   * Récupérer un statut par ID
   */
  async getById(id: string): Promise<InterventionStatus> {
    const { data, error } = await supabase
      .from("intervention_statuses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(`Erreur lors de la récupération du statut: ${error.message}`);

    return data;
  },

  /**
   * Mettre à jour un statut d'intervention
   * IMPORTANT : Seuls le label et la couleur sont éditables
   * Le code et le sort_order sont en lecture seule
   */
  async update(id: string, statusData: UpdateInterventionStatusData): Promise<InterventionStatus> {
    const updatePayload: any = {};

    // Seuls label et color sont modifiables
    if (statusData.label !== undefined) {
      if (!statusData.label || statusData.label.trim() === '') {
        throw new Error('Le label du statut ne peut pas être vide');
      }
      updatePayload.label = statusData.label.trim();
    }

    if (statusData.color !== undefined) {
      updatePayload.color = statusData.color || null;
    }

    // Vérifier qu'il y a au moins un champ à mettre à jour
    if (Object.keys(updatePayload).length === 0) {
      throw new Error('Aucune donnée à mettre à jour');
    }

    const { data, error } = await supabase
      .from("intervention_statuses")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du statut: ${error.message}`);
    }

    return data;
  },

  // PAS de méthode create() - les statuts sont créés manuellement dans la seed
  // PAS de méthode delete() - les statuts ne doivent jamais être supprimés (utilisés dans le workflow)
};
