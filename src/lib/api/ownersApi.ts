// ===== API OWNERS V2 =====
// Gestion des propriétaires (owners)

import { supabase } from "./common/client";
import type { CreateOwnerData, Owner, OwnerQueryParams, PaginatedResponse, UpdateOwnerData } from "./common/types";

// ===== FONCTIONS DE LECTURE =====

/**
 * Récupère tous les owners avec pagination et filtres
 */
export const getAll = async (params: OwnerQueryParams = {}): Promise<Owner[] | PaginatedResponse<Owner>> => {
  const { limit = 50, offset = 0, sortBy = "created_at", sortOrder = "desc", paginated = false } = params;

  let query = supabase.from("owner").select("*", { count: paginated ? "exact" : undefined });

  // Filtres
  if (params.telephone) {
    query = query.or(`telephone.ilike.%${params.telephone}%,telephone2.ilike.%${params.telephone}%`);
  }
  if (params.search) {
    query = query.or(
      `owner_firstname.ilike.%${params.search}%,owner_lastname.ilike.%${params.search}%`
    );
  }

  // Tri et pagination
  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Erreur lors de la récupération des owners: ${error.message}`);

  if (paginated && count !== null) {
    return {
      data: data || [],
      pagination: {
        limit,
        offset,
        total: count,
        hasMore: offset + limit < count,
      },
    };
  }

  return data || [];
};

/**
 * Récupère un owner par son ID
 */
export const getById = async (id: string): Promise<Owner | null> => {
  const { data, error } = await supabase.from("owner").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération du owner: ${error.message}`);
  }

  return data;
};

/**
 * Récupère un owner par son external_ref
 */
export const getByExternalRef = async (externalRef: string): Promise<Owner | null> => {
  const { data, error } = await supabase.from("owner").select("*").eq("external_ref", externalRef).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération du owner: ${error.message}`);
  }

  return data;
};

/**
 * Recherche des owners par nom
 */
export const searchByName = async (searchTerm: string, limit = 20): Promise<Owner[]> => {
  const { data, error } = await supabase
    .from("owner")
    .select("*")
    .or(`owner_firstname.ilike.%${searchTerm}%,owner_lastname.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) throw new Error(`Erreur lors de la recherche de owners: ${error.message}`);

  return data || [];
};

/**
 * Recherche des owners par téléphone
 */
export const searchByPhone = async (phone: string): Promise<Owner[]> => {
  const { data, error } = await supabase
    .from("owner")
    .select("*")
    .or(`telephone.ilike.%${phone}%,telephone2.ilike.%${phone}%`)
    .limit(20);

  if (error) throw new Error(`Erreur lors de la recherche par téléphone: ${error.message}`);

  return data || [];
};

// ===== FONCTIONS DE CRÉATION =====

/**
 * Crée un nouveau owner
 */
export const create = async (ownerData: CreateOwnerData): Promise<Owner> => {
  const { data, error } = await supabase.from("owner").insert(ownerData).select().single();

  if (error) throw new Error(`Erreur lors de la création du owner: ${error.message}`);

  return data;
};

/**
 * Crée ou met à jour un owner (upsert)
 */
export const upsert = async (ownerData: CreateOwnerData): Promise<Owner> => {
  const { data, error } = await supabase
    .from("owner")
    .upsert(ownerData, { onConflict: "external_ref" })
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de l'upsert du owner: ${error.message}`);

  return data;
};

/**
 * Crée plusieurs owners en une seule fois
 */
export const createBulk = async (ownersData: CreateOwnerData[]): Promise<{ success: number; errors: number; data: Owner[] }> => {
  const results = {
    success: 0,
    errors: 0,
    data: [] as Owner[],
  };

  // Insertion par lots de 100
  const batchSize = 100;
  for (let i = 0; i < ownersData.length; i += batchSize) {
    const batch = ownersData.slice(i, i + batchSize);

    const { data, error } = await supabase.from("owner").insert(batch).select();

    if (error) {
      results.errors += batch.length;
      console.error(`Erreur lors de l'insertion du lot ${i / batchSize + 1}:`, error.message);
    } else {
      results.success += data?.length || 0;
      results.data.push(...(data || []));
    }
  }

  return results;
};

// ===== FONCTIONS DE MISE À JOUR =====

/**
 * Met à jour un owner
 */
export const update = async (id: string, updates: UpdateOwnerData): Promise<Owner> => {
  const { data, error } = await supabase
    .from("owner")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de la mise à jour du owner: ${error.message}`);

  return data;
};

// ===== FONCTIONS DE SUPPRESSION =====

/**
 * Supprime un owner
 */
export const deleteOwner = async (id: string): Promise<void> => {
  const { error } = await supabase.from("owner").delete().eq("id", id);

  if (error) throw new Error(`Erreur lors de la suppression du owner: ${error.message}`);
};

// ===== FONCTIONS UTILITAIRES =====

/**
 * Vérifie si un owner existe par téléphone
 */
export const existsByPhone = async (phone: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("owner")
    .select("id")
    .or(`telephone.eq.${phone},telephone2.eq.${phone}`)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Erreur lors de la vérification du téléphone: ${error.message}`);
  }

  return !!data;
};

/**
 * Obtient les statistiques des owners
 */
export const getStats = async (): Promise<{
  total: number;
  withPhone: number;
}> => {
  const { count: total, error: errorTotal } = await supabase.from("owner").select("*", { count: "exact", head: true });

  const { count: withPhone, error: errorPhone } = await supabase
    .from("owner")
    .select("*", { count: "exact", head: true })
    .not("telephone", "is", null);

  if (errorTotal || errorPhone) {
    throw new Error("Erreur lors de la récupération des statistiques");
  }

  return {
    total: total || 0,
    withPhone: withPhone || 0,
  };
};

// Export de l'API complète
export const ownersApi = {
  getAll,
  getById,
  getByExternalRef,
  searchByName,
  searchByPhone,
  create,
  upsert,
  createBulk,
  update,
  delete: deleteOwner,
  existsByPhone,
  getStats,
};









