// ===== API METIERS V2 =====
// Gestion complète des métiers

import { supabase } from "@/lib/supabase-client";

// Types
export interface Metier {
  id: string;
  code: string; // Généré automatiquement, lecture seule
  label: string;
  description?: string | null;
  color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMetierData {
  label: string; // Le code sera généré automatiquement
  description?: string;
  color?: string;
}

export interface UpdateMetierData {
  label?: string; // Si le label change, le code sera régénéré
  description?: string;
  color?: string;
}

export const metiersApi = {
  /**
   * Récupérer tous les métiers
   * @param includeInactive - Inclure les métiers inactifs (is_active = false)
   */
  async getAll(params?: { includeInactive?: boolean }): Promise<Metier[]> {
    let query = supabase
      .from("metiers")
      .select("*")
      .order("label", { ascending: true });

    // Par défaut, afficher seulement les métiers actifs
    if (!params?.includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Erreur lors de la récupération des métiers: ${error.message}`);

    return data || [];
  },

  /**
   * Récupérer un métier par ID
   */
  async getById(id: string): Promise<Metier> {
    const { data, error } = await supabase
      .from("metiers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(`Erreur lors de la récupération du métier: ${error.message}`);

    return data;
  },

  /**
   * Créer un nouveau métier
   * Le code sera généré automatiquement à partir du label côté API
   */
  async create(metierData: CreateMetierData): Promise<Metier> {
    // Validation
    if (!metierData.label || metierData.label.trim() === '') {
      throw new Error('Le label du métier est requis');
    }

    // Générer le code à partir du label
    const code = metierData.label
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const { data, error } = await supabase
      .from("metiers")
      .insert({
        code,
        label: metierData.label.trim(),
        description: metierData.description?.trim() || null,
        color: metierData.color || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('duplicate_code');
      }
      throw new Error(`Erreur lors de la création du métier: ${error.message}`);
    }

    return data;
  },

  /**
   * Mettre à jour un métier
   * Si le label change, le code sera régénéré automatiquement
   */
  async update(id: string, metierData: UpdateMetierData): Promise<Metier> {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Si le label change, régénérer le code
    if (metierData.label !== undefined) {
      if (!metierData.label || metierData.label.trim() === '') {
        throw new Error('Le label du métier ne peut pas être vide');
      }
      updatePayload.label = metierData.label.trim();
      updatePayload.code = metierData.label
        .substring(0, 10)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    }

    if (metierData.description !== undefined) {
      updatePayload.description = metierData.description?.trim() || null;
    }

    if (metierData.color !== undefined) {
      updatePayload.color = metierData.color || null;
    }

    const { data, error } = await supabase
      .from("metiers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('duplicate_code');
      }
      throw new Error(`Erreur lors de la mise à jour du métier: ${error.message}`);
    }

    return data;
  },

  /**
   * Soft delete - Désactiver un métier (is_active = false)
   * Ne supprime JAMAIS physiquement le métier pour préserver les relations
   */
  async delete(id: string): Promise<{ message: string; data: Metier }> {
    const { data, error} = await supabase
      .from("metiers")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la désactivation du métier: ${error.message}`);
    }

    return {
      message: "Métier désactivé avec succès",
      data,
    };
  },
};
