// ===== API AGENCIES V2 =====
// Gestion complète des agences

import { supabase } from "@/lib/supabase-client";

// Types
export interface Agency {
  id: string;
  code: string; // Généré automatiquement, lecture seule
  label: string;
  region?: string | null;
  color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgencyData {
  label: string; // Le code sera généré automatiquement
  region?: string;
  color?: string;
}

export interface UpdateAgencyData {
  label?: string; // Si le label change, le code sera régénéré
  region?: string;
  color?: string;
}

export const agenciesApi = {
  /**
   * Récupérer toutes les agences
   * @param includeInactive - Inclure les agences inactives (is_active = false)
   */
  async getAll(params?: { includeInactive?: boolean }): Promise<Agency[]> {
    let query = supabase
      .from("agencies")
      .select("*")
      .order("label", { ascending: true });

    // Par défaut, afficher seulement les agences actives
    if (!params?.includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Erreur lors de la récupération des agences: ${error.message}`);

    return data || [];
  },

  /**
   * Récupérer une agence par ID
   */
  async getById(id: string): Promise<Agency> {
    const { data, error } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(`Erreur lors de la récupération de l'agence: ${error.message}`);

    return data;
  },

  /**
   * Créer une nouvelle agence
   * Le code sera généré automatiquement à partir du label côté API
   */
  async create(agencyData: CreateAgencyData): Promise<Agency> {
    // Validation
    if (!agencyData.label || agencyData.label.trim() === '') {
      throw new Error('Le label de l\'agence est requis');
    }

    // Générer le code à partir du label
    const code = agencyData.label
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const { data, error } = await supabase
      .from("agencies")
      .insert({
        code,
        label: agencyData.label.trim(),
        region: agencyData.region?.trim() || null,
        color: agencyData.color || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('duplicate_code');
      }
      throw new Error(`Erreur lors de la création de l'agence: ${error.message}`);
    }

    return data;
  },

  /**
   * Mettre à jour une agence
   * Si le label change, le code sera régénéré automatiquement
   */
  async update(id: string, agencyData: UpdateAgencyData): Promise<Agency> {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Si le label change, régénérer le code
    if (agencyData.label !== undefined) {
      if (!agencyData.label || agencyData.label.trim() === '') {
        throw new Error('Le label de l\'agence ne peut pas être vide');
      }
      updatePayload.label = agencyData.label.trim();
      updatePayload.code = agencyData.label
        .substring(0, 10)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    }

    if (agencyData.region !== undefined) {
      updatePayload.region = agencyData.region?.trim() || null;
    }

    if (agencyData.color !== undefined) {
      updatePayload.color = agencyData.color || null;
    }

    const { data, error } = await supabase
      .from("agencies")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('duplicate_code');
      }
      throw new Error(`Erreur lors de la mise à jour de l'agence: ${error.message}`);
    }

    return data;
  },

  /**
   * Soft delete - Désactiver une agence (is_active = false)
   * Ne supprime JAMAIS physiquement l'agence pour préserver les relations
   */
  async delete(id: string): Promise<{ message: string; data: Agency }> {
    const { data, error } = await supabase
      .from("agencies")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la désactivation de l'agence: ${error.message}`);
    }

    return {
      message: "Agence désactivée avec succès",
      data,
    };
  },
};
