// ===== INTERVENTIONS CRUD - MUTATIONS =====
// Création, mise à jour, suppression, upsert et création en masse.

import type {
  BulkOperationResult,
  CreateInterventionData,
  Intervention,
  UpdateInterventionData,
} from "@/lib/api/common/types";
import {
  getSupabaseFunctionsUrl,
  getHeaders,
  handleResponse,
  mapInterventionRecord,
  getReferenceCache,
} from "@/lib/api/common/utils";
import { safeErrorMessage } from "@/lib/api/common/error-handler";
import type { InterventionWithStatus } from "@/types/intervention";
import { supabase } from "@/lib/api/common/client";
import { supabaseClient } from "./_auth";
import type { InterventionAuthContext } from "./_auth";
import {
  stripAdminOnlyFields,
  fetchCurrentStatus,
  recalculateArtisanStatuses,
} from "./_update-helpers";

/** Créer une intervention. */
export async function create(
  data: CreateInterventionData,
  auth?: InterventionAuthContext,
): Promise<Intervention> {
  const { data: result, error } = await supabaseClient
    .from("interventions")
    .insert(auth?.userId ? { ...data, created_by: auth.userId, updated_by: auth.userId } : data)
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de la création de l'intervention: ${error.message}`);

  // La transition de création est enregistrée par le trigger DB
  // `log_intervention_status_transition_on_insert` (source unique de vérité).
  // L'acteur est propagé via created_by/updated_by ci-dessus.

  const refs = await getReferenceCache();
  return mapInterventionRecord(result, refs);
}

/** Vérifier si une intervention avec la même adresse et agence existe. */
export async function checkDuplicate(address: string, agencyId: string): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("interventions")
    .select("id")
    .eq("adresse", address)
    .eq("agence_id", agencyId)
    .limit(1);

  if (error) {
    console.error("Erreur lors de la vérification des doublons:", error);
    return false;
  }

  return !!(data && data.length > 0);
}

/** Récupérer les détails des interventions dupliquées. */
export async function getDuplicateDetails(
  address: string,
  agencyId: string,
): Promise<Array<{
  id: string;
  name: string;
  address: string;
  agencyId: string | null;
  agencyLabel: string | null;
  managerName: string | null;
  createdAt: string | null;
}>> {
  const { data, error } = await supabaseClient
    .from("interventions")
    .select(`
      id,
      contexte_intervention,
      adresse,
      agence_id,
      commentaire_agent,
      created_at,
      agences:agence_id(label),
      users:assigned_user_id(firstname, lastname)
    `)
    .eq("adresse", address)
    .eq("agence_id", agencyId)
    .limit(5);

  if (error) {
    console.error("Erreur lors de la récupération des détails des doublons:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((match: any) => {
    const agencyData = match.agences as { label?: string } | null;
    const userData = match.users as { firstname?: string; lastname?: string } | null;

    return {
      id: match.id,
      name: match.contexte_intervention || match.commentaire_agent || "Intervention sans nom",
      address: match.adresse || "",
      agencyId: match.agence_id,
      agencyLabel: agencyData?.label || null,
      managerName: userData
        ? `${userData.firstname || ""} ${userData.lastname || ""}`.trim() || null
        : null,
      createdAt: match.created_at || null,
    };
  });
}

/** Modifier une intervention. */
export async function update(
  id: string,
  data: UpdateInterventionData,
  auth?: InterventionAuthContext,
): Promise<InterventionWithStatus> {
  const payload = await stripAdminOnlyFields({ ...data }, auth);

  let oldStatutId: string | null = null;
  if (payload.statut_id) {
    const current = await fetchCurrentStatus(id);
    oldStatutId = current.statut_id;
  }

  // Le changement de statut est enregistré par le trigger DB
  // `log_intervention_status_transition_safety` (source unique). On propage l'acteur
  // via `updated_by` pour que le trigger l'attribue correctement.
  const statusChanged = payload.statut_id && oldStatutId !== payload.statut_id;

  const { data: updated, error } = await supabaseClient
    .from("interventions")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
      ...(auth?.userId ? { updated_by: auth.userId } : {}),
    })
    .eq("id", id)
    .select(`
      *,
      status:intervention_statuses(id,code,label,color,sort_order),
      intervention_artisans(artisan_id)
    `)
    .single();

  if (error) throw error;
  if (!updated) throw new Error("Impossible de mettre à jour l'intervention");

  const refs = await getReferenceCache();
  const mapped = mapInterventionRecord(updated, refs) as InterventionWithStatus;

  if (statusChanged) {
    await recalculateArtisanStatuses(updated as unknown as Record<string, unknown>, oldStatutId, payload.statut_id!);
  }

  return mapped;
}

/** Supprimer une intervention (soft delete via Edge Function). */
export async function deleteIntervention(
  id: string,
): Promise<{ message: string; data: Intervention }> {
  const headers = await getHeaders();
  const response = await fetch(
    `${getSupabaseFunctionsUrl()}/interventions-v2/interventions/${id}`,
    { method: "DELETE", headers },
  );
  return handleResponse(response);
}

/** Upsert une intervention via Edge Function (créer ou mettre à jour). */
export async function upsert(
  data: CreateInterventionData & { id_inter?: string },
): Promise<Intervention> {
  const headers = await getHeaders();
  const response = await fetch(
    `${getSupabaseFunctionsUrl()}/interventions-v2/interventions/upsert`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    },
  );
  return handleResponse(response);
}

/** Upsert direct via Supabase (pour import en masse). */
export async function upsertDirect(
  data: CreateInterventionData & { id_inter?: string },
  customClient?: typeof supabase,
  auth?: InterventionAuthContext,
): Promise<Intervention & { _operation: "created" | "updated"; _matchedBy?: "id_inter" }> {
  const client = customClient || supabaseClient;

  // 1. Vérifier si l'intervention existe déjà
  let existingIntervention: { id: string; statut_id: string | null } | null = null;

  if (data.id_inter) {
    const { data: existing } = await client
      .from("interventions")
      .select("id, statut_id")
      .eq("id_inter", data.id_inter)
      .maybeSingle();

    existingIntervention = existing;
  }

  const operation: "created" | "updated" = existingIntervention ? "updated" : "created";
  const matchedBy: "id_inter" | undefined = existingIntervention ? "id_inter" : undefined;

  // 2. Faire l'upsert (propagation de l'acteur : created_by à l'insertion, updated_by toujours)
  const actorFields = auth?.userId
    ? (existingIntervention
        ? { updated_by: auth.userId }
        : { created_by: auth.userId, updated_by: auth.userId })
    : {};

  const { data: result, error } = await client
    .from("interventions")
    .upsert({ ...data, ...actorFields }, { onConflict: "id_inter", ignoreDuplicates: false })
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de l'upsert de l'intervention: ${error.message}`);

  // Les transitions (création ET changement de statut) sont enregistrées par les triggers DB
  // `log_intervention_status_transition_on_insert` / `_safety` (source unique). Plus aucune
  // chaîne synthétique ni suppression de la ligne trigger côté applicatif.

  const refs = await getReferenceCache();
  const intervention = mapInterventionRecord(result, refs);
  return Object.assign(intervention, { _operation: operation, _matchedBy: matchedBy });
}

/** Création en masse (best-effort, accumule succès/erreurs par item). */
export async function createBulk(
  interventions: CreateInterventionData[],
): Promise<BulkOperationResult> {
  const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

  for (const intervention of interventions) {
    try {
      const result = await create(intervention);
      results.success++;
      results.details.push({
        item: intervention as unknown as Record<string, unknown>,
        success: true,
        data: result as unknown as Record<string, unknown>,
      });
    } catch (error: unknown) {
      results.errors++;
      results.details.push({
        item: intervention as unknown as Record<string, unknown>,
        success: false,
        error: safeErrorMessage(error, "la création de l'intervention"),
      });
    }
  }

  return results;
}
