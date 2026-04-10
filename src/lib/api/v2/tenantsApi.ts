// ===== API TENANTS V2 =====
// Gestion des locataires (tenants)

import { supabase } from "./common/client";
import type { CreateTenantData, PaginatedResponse, Tenant, TenantQueryParams, UpdateTenantData } from "./common/types";

// ===== FONCTIONS DE LECTURE =====

/**
 * Récupère tous les tenants avec pagination et filtres
 */
export const getAll = async (params: TenantQueryParams = {}): Promise<Tenant[] | PaginatedResponse<Tenant>> => {
  const { limit = 50, offset = 0, sortBy = "created_at", sortOrder = "desc", paginated = false } = params;

  let query = supabase.from("tenants").select("*", { count: paginated ? "exact" : undefined });

  // Filtres
  if (params.email) {
    query = query.ilike("email", `%${params.email}%`);
  }
  if (params.telephone) {
    query = query.or(`telephone.ilike.%${params.telephone}%,telephone2.ilike.%${params.telephone}%`);
  }
  if (params.search) {
    query = query.or(
      `firstname.ilike.%${params.search}%,lastname.ilike.%${params.search}%,email.ilike.%${params.search}%`
    );
  }

  // Tri et pagination
  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Erreur lors de la récupération des tenants: ${error.message}`);

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
 * Récupère un tenant par son ID
 */
export const getById = async (id: string): Promise<Tenant | null> => {
  const { data, error } = await supabase.from("tenants").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération du tenant: ${error.message}`);
  }

  return data;
};

/**
 * Récupère un tenant par son external_ref
 */
export const getByExternalRef = async (externalRef: string): Promise<Tenant | null> => {
  const { data, error } = await supabase.from("tenants").select("*").eq("external_ref", externalRef).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération du tenant: ${error.message}`);
  }

  return data;
};

/**
 * Recherche des tenants par nom
 */
export const searchByName = async (searchTerm: string, limit = 20): Promise<Tenant[]> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .or(`firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) throw new Error(`Erreur lors de la recherche de tenants: ${error.message}`);

  return data || [];
};

/**
 * Recherche des tenants par email
 */
export const searchByEmail = async (email: string): Promise<Tenant[]> => {
  const { data, error } = await supabase.from("tenants").select("*").ilike("email", `%${email}%`).limit(20);

  if (error) throw new Error(`Erreur lors de la recherche par email: ${error.message}`);

  return data || [];
};

/**
 * Recherche des tenants par téléphone
 */
export const searchByPhone = async (phone: string): Promise<Tenant[]> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .or(`telephone.ilike.%${phone}%,telephone2.ilike.%${phone}%`)
    .limit(20);

  if (error) throw new Error(`Erreur lors de la recherche par téléphone: ${error.message}`);

  return data || [];
};

// ===== FONCTIONS DE CRÉATION =====

/**
 * Crée un nouveau tenant
 */
export const create = async (tenantData: CreateTenantData): Promise<Tenant> => {
  const { data, error } = await supabase.from("tenants").insert(tenantData).select().single();

  if (error) throw new Error(`Erreur lors de la création du tenant: ${error.message}`);

  return data;
};

/**
 * Crée ou met à jour un tenant (upsert)
 */
export const upsert = async (tenantData: CreateTenantData): Promise<Tenant> => {
  const { data, error } = await supabase
    .from("tenants")
    .upsert(tenantData, { onConflict: "external_ref" })
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de l'upsert du tenant: ${error.message}`);

  return data;
};

/**
 * Crée plusieurs tenants en une seule fois
 */
export const createBulk = async (tenantsData: CreateTenantData[]): Promise<{ success: number; errors: number; data: Tenant[] }> => {
  const results = {
    success: 0,
    errors: 0,
    data: [] as Tenant[],
  };

  // Insertion par lots de 100
  const batchSize = 100;
  for (let i = 0; i < tenantsData.length; i += batchSize) {
    const batch = tenantsData.slice(i, i + batchSize);

    const { data, error } = await supabase.from("tenants").insert(batch).select();

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
 * Met à jour un tenant
 */
export const update = async (id: string, updates: UpdateTenantData): Promise<Tenant> => {
  const { data, error } = await supabase
    .from("tenants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de la mise à jour du tenant: ${error.message}`);

  return data;
};

// ===== FONCTIONS DE SUPPRESSION =====

/**
 * Supprime un tenant
 */
export const deleteTenant = async (id: string): Promise<void> => {
  const { error } = await supabase.from("tenants").delete().eq("id", id);

  if (error) throw new Error(`Erreur lors de la suppression du tenant: ${error.message}`);
};

// ===== FONCTIONS UTILITAIRES =====

/**
 * Vérifie si un tenant existe par email
 */
export const existsByEmail = async (email: string): Promise<boolean> => {
  const { data, error } = await supabase.from("tenants").select("id").eq("email", email).single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Erreur lors de la vérification de l'email: ${error.message}`);
  }

  return !!data;
};

/**
 * Vérifie si un tenant existe par téléphone
 */
export const existsByPhone = async (phone: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .or(`telephone.eq.${phone},telephone2.eq.${phone}`)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Erreur lors de la vérification du téléphone: ${error.message}`);
  }

  return !!data;
};

/**
 * Obtient les statistiques des tenants
 */
export const getStats = async (): Promise<{
  total: number;
  withEmail: number;
  withPhone: number;
}> => {
  const { count: total, error: errorTotal } = await supabase.from("tenants").select("*", { count: "exact", head: true });

  const { count: withEmail, error: errorEmail } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);

  const { count: withPhone, error: errorPhone } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .not("telephone", "is", null);

  if (errorTotal || errorEmail || errorPhone) {
    throw new Error("Erreur lors de la récupération des statistiques");
  }

  return {
    total: total || 0,
    withEmail: withEmail || 0,
    withPhone: withPhone || 0,
  };
};

// Export de l'API complète
export const tenantsApi = {
  getAll,
  getById,
  getByExternalRef,
  searchByName,
  searchByEmail,
  searchByPhone,
  create,
  upsert,
  createBulk,
  update,
  delete: deleteTenant,
  existsByEmail,
  existsByPhone,
  getStats,
};

