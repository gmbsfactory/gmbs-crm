// ===== INTERVENTIONS STATUS & WORKFLOW =====
// Gestion des statuts, transitions et artisans

import { supabase, getSupabaseClientForNode } from "@/lib/api/v2/common/client";
import type {
  InterventionStatusTransition,
} from "@/lib/api/v2/common/types";
import {
  getReferenceCache,
} from "@/lib/api/v2/common/utils";
import type { UpdateInterventionData } from "@/lib/api/v2/common/types";
import type { InterventionWithStatus, InterventionStatus } from "@/types/intervention";

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

// Référence vers les méthodes CRUD — sera injectée par l'index
let _crudRef: { update: (id: string, data: UpdateInterventionData) => Promise<InterventionWithStatus> } | null = null;

export function _setCrudRef(ref: typeof _crudRef) {
  _crudRef = ref;
}

export const interventionsStatus = {
  // Mettre à jour uniquement le statut d'une intervention
  async updateStatus(id: string, statusId: string): Promise<InterventionWithStatus> {
    if (!statusId) {
      throw new Error("Status ID is required");
    }
    if (!_crudRef) throw new Error("CRUD reference not initialized");
    return _crudRef.update(id, { statut_id: statusId });
  },

  async setPrimaryArtisan(interventionId: string, artisanId: string | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    const { data: existingPrimary, error: primaryError } = await supabaseClient
      .from('intervention_artisans')
      .select('id, artisan_id, role')
      .eq('intervention_id', interventionId)
      .eq('is_primary', true)
      .maybeSingle();

    if (primaryError) {
      throw new Error(`Erreur lors de la récupération de l'artisan primaire: ${primaryError.message}`);
    }

    // Aucun artisan sélectionné => supprimer le primaire courant
    if (!artisanId) {
      if (existingPrimary?.id) {
        const { error: deleteError } = await supabaseClient
          .from('intervention_artisans')
          .delete()
          .eq('id', existingPrimary.id);

        if (deleteError) {
          throw new Error(`Erreur lors de la suppression de l'artisan primaire: ${deleteError.message}`);
        }
      }
      return;
    }

    // Rien à faire, c'est déjà le bon artisan
    if (existingPrimary?.artisan_id === artisanId) {
      const { error: ensurePrimaryError } = await supabaseClient
        .from('intervention_artisans')
        .update({
          role: 'primary',
          is_primary: true,
        })
        .eq('id', existingPrimary.id);

      if (ensurePrimaryError) {
        throw new Error(`Erreur lors de la mise à jour de l'artisan primaire: ${ensurePrimaryError.message}`);
      }
      return;
    }

    // Récupérer un éventuel lien existant avec cet artisan
    const { data: existingLink, error: linkError } = await supabaseClient
      .from('intervention_artisans')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .maybeSingle();

    if (linkError) {
      throw new Error(`Erreur lors de la récupération de l'artisan: ${linkError.message}`);
    }

    // Rétrograder l'artisan primaire actuel (le garder comme secondaire)
    if (existingPrimary?.id) {
      const { error: demoteError } = await supabaseClient
        .from('intervention_artisans')
        .update({
          is_primary: false,
          role: existingPrimary.role === 'primary' ? 'secondary' : existingPrimary.role,
        })
        .eq('id', existingPrimary.id);

      if (demoteError) {
        throw new Error(`Erreur lors de la mise à jour de l'ancien artisan primaire: ${demoteError.message}`);
      }
    }

    if (existingLink?.id) {
      const { error: promoteError } = await supabaseClient
        .from('intervention_artisans')
        .update({
          role: 'primary',
          is_primary: true,
        })
        .eq('id', existingLink.id);

      if (promoteError) {
        throw new Error(`Erreur lors de la mise à jour de l'artisan primaire: ${promoteError.message}`);
      }
      return;
    }

    const { error: insertError } = await supabaseClient
      .from('intervention_artisans')
      .insert({
        intervention_id: interventionId,
        artisan_id: artisanId,
        role: 'primary',
        is_primary: true,
      });

    if (insertError) {
      throw new Error(`Erreur lors de l'assignation de l'artisan primaire: ${insertError.message}`);
    }
  },

  async setSecondaryArtisan(interventionId: string, artisanId: string | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    // Récupérer l'artisan secondaire actuel
    const { data: existingSecondary, error: secondaryError } = await supabaseClient
      .from('intervention_artisans')
      .select('id, artisan_id, role')
      .eq('intervention_id', interventionId)
      .eq('is_primary', false)
      .maybeSingle();

    if (secondaryError) {
      throw new Error(`Erreur lors de la récupération de l'artisan secondaire: ${secondaryError.message}`);
    }

    // Aucun artisan sélectionné => supprimer le secondaire courant
    if (!artisanId) {
      if (existingSecondary?.id) {
        const { error: deleteError } = await supabaseClient
          .from('intervention_artisans')
          .delete()
          .eq('id', existingSecondary.id);

        if (deleteError) {
          throw new Error(`Erreur lors de la suppression de l'artisan secondaire: ${deleteError.message}`);
        }
      }
      return;
    }

    // Rien à faire, c'est déjà le bon artisan
    if (existingSecondary?.artisan_id === artisanId) {
      return;
    }

    // Vérifier si l'artisan est déjà lié (peut-être comme primaire)
    const { data: existingLink, error: linkError } = await supabaseClient
      .from('intervention_artisans')
      .select('id, is_primary')
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .maybeSingle();

    if (linkError) {
      throw new Error(`Erreur lors de la récupération de l'artisan: ${linkError.message}`);
    }

    // Si l'artisan est déjà le primaire, ne pas le rétrograder
    if (existingLink?.is_primary) {
      throw new Error("Cet artisan est déjà l'artisan principal. Veuillez d'abord le retirer.");
    }

    // Supprimer l'ancien artisan secondaire s'il existe
    if (existingSecondary?.id) {
      const { error: deleteError } = await supabaseClient
        .from('intervention_artisans')
        .delete()
        .eq('id', existingSecondary.id);

      if (deleteError) {
        throw new Error(`Erreur lors de la suppression de l'ancien artisan secondaire: ${deleteError.message}`);
      }
    }

    // Si un lien existe déjà avec cet artisan (mais pas comme primaire), le mettre à jour
    if (existingLink?.id) {
      const { error: updateError } = await supabaseClient
        .from('intervention_artisans')
        .update({
          role: 'secondary',
          is_primary: false,
        })
        .eq('id', existingLink.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de l'artisan secondaire: ${updateError.message}`);
      }
      return;
    }

    // Insérer le nouvel artisan secondaire
    const { error: insertError } = await supabaseClient
      .from('intervention_artisans')
      .insert({
        intervention_id: interventionId,
        artisan_id: artisanId,
        role: 'secondary',
        is_primary: false,
      });

    if (insertError) {
      throw new Error(`Erreur lors de l'assignation de l'artisan secondaire: ${insertError.message}`);
    }
  },

  // Assigner un artisan à une intervention
  async assignArtisan(
    interventionId: string,
    artisanId: string,
    role: "primary" | "secondary" = "primary",
    customClient?: typeof supabaseClient
  ): Promise<Record<string, unknown>> {
    const client = customClient || supabaseClient;

    const { data: result, error } = await client
      .from('intervention_artisans')
      .insert({
        intervention_id: interventionId,
        artisan_id: artisanId,
        role: role,
        is_primary: role === "primary"
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de l'assignation de l'artisan: ${error.message}`);
    }

    return result;
  },

  /**
   * Récupère tous les statuts d'intervention disponibles
   */
  async getAllStatuses(): Promise<InterventionStatus[]> {
    const { data, error } = await supabaseClient
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data as InterventionStatus[] | null) ?? [];
  },

  /**
   * Récupère un statut par son code (ou null si introuvable)
   */
  async getStatusByCode(code: string): Promise<InterventionStatus | null> {
    if (!code) return null;
    const { data, error } = await supabaseClient
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .eq('code', code)
      .single();

    if (error) {
      if ('code' in error && error.code === 'PGRST116') return null;
      if (error.message?.includes('Results contain 0 rows')) return null;
      throw error;
    }
    return (data as InterventionStatus | null) ?? null;
  },

  /**
   * Récupère un statut par son label (ou null si introuvable)
   */
  async getStatusByLabel(label: string): Promise<InterventionStatus | null> {
    if (!label) return null;
    const { data, error } = await supabaseClient
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .ilike('label', label)
      .single();

    if (error) {
      if ('code' in error && error.code === 'PGRST116') return null;
      if (error.message?.includes('Results contain 0 rows')) return null;
      throw error;
    }
    return (data as InterventionStatus | null) ?? null;
  },

  /**
   * Récupère l'historique des transitions de statut pour une intervention
   */
  async getStatusTransitions(
    interventionId: string
  ): Promise<InterventionStatusTransition[]> {
    const { data, error } = await supabaseClient
      .from('intervention_status_transitions')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('transition_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },
};
