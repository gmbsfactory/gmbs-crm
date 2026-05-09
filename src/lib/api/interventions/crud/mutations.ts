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
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";
import { supabase } from "@/lib/api/common/client";
import { supabaseClient, resolveUserId } from "./_auth";
import type { InterventionAuthContext } from "./_auth";
import {
  stripAdminOnlyFields,
  fetchCurrentStatus,
  handleStatusTransition,
  recalculateArtisanStatuses,
} from "./_update-helpers";

/** Créer une intervention. */
export async function create(
  data: CreateInterventionData,
  auth?: InterventionAuthContext,
): Promise<Intervention> {
  const { data: result, error } = await supabaseClient
    .from("interventions")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de la création de l'intervention: ${error.message}`);

  // Créer la chaîne de transitions si nécessaire
  if (result.statut_id) {
    try {
      // Le trigger a créé une transition NULL → statut_actuel lors de l'INSERT.
      // On la supprime pour la remplacer par la chaîne complète.
      await supabaseClient
        .from("intervention_status_transitions")
        .delete()
        .eq("intervention_id", result.id)
        .eq("source", "trigger");

      const userId = await resolveUserId(auth?.userId);

      await automaticTransitionService.createAutomaticTransitions(
        result.id,
        result.statut_id,
        null,
        userId,
        { updated_via: "create", api_operation: true },
      );
    } catch (transitionError) {
      console.error("Erreur lors de la création des transitions automatiques:", transitionError);
      // Ne pas bloquer la création si les transitions échouent
    }
  }

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
  let oldStatusCode: string | null = null;
  if (payload.statut_id) {
    const current = await fetchCurrentStatus(id);
    oldStatutId = current.statut_id;
    oldStatusCode = current.statusCode;
  }

  const statusChanged = payload.statut_id && oldStatutId !== payload.statut_id;
  if (statusChanged) {
    await handleStatusTransition(id, oldStatutId, payload.statut_id!, oldStatusCode, auth?.userId);
  }

  const { data: updated, error } = await supabaseClient
    .from("interventions")
    .update({ ...payload, updated_at: new Date().toISOString() })
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
  let oldStatusId: string | null = null;

  if (data.id_inter) {
    const { data: existing } = await client
      .from("interventions")
      .select("id, statut_id")
      .eq("id_inter", data.id_inter)
      .maybeSingle();

    existingIntervention = existing;
    oldStatusId = existing?.statut_id || null;
  }

  const operation: "created" | "updated" = existingIntervention ? "updated" : "created";
  const matchedBy: "id_inter" | undefined = existingIntervention ? "id_inter" : undefined;

  // 2. Faire l'upsert
  const { data: result, error } = await client
    .from("interventions")
    .upsert(data, { onConflict: "id_inter", ignoreDuplicates: false })
    .select()
    .single();

  if (error) throw new Error(`Erreur lors de l'upsert de l'intervention: ${error.message}`);

  // 3. Créer la chaîne de transitions si nécessaire
  if (result.statut_id) {
    try {
      if (!existingIntervention) {
        await client
          .from("intervention_status_transitions")
          .delete()
          .eq("intervention_id", result.id)
          .eq("source", "trigger");
      } else if (oldStatusId && oldStatusId !== result.statut_id) {
        await client
          .from("intervention_status_transitions")
          .delete()
          .eq("intervention_id", result.id)
          .eq("from_status_id", oldStatusId)
          .eq("to_status_id", result.statut_id)
          .eq("source", "trigger");
      }

      const userId = await resolveUserId(auth?.userId);

      await automaticTransitionService.createAutomaticTransitions(
        result.id,
        result.statut_id,
        oldStatusId,
        userId,
        {
          updated_via: "upsertDirect",
          import_operation: true,
          id_inter: data.id_inter,
        },
      );
    } catch (transitionError) {
      console.error("Erreur lors de la création des transitions automatiques:", transitionError);
    }
  }

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
