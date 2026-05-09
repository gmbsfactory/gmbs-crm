// ===== INTERVENTIONS CRUD - UPDATE HELPERS =====
// Helpers internes utilisés exclusivement par `update()` :
// - stripAdminOnlyFields : retire les champs admin-only si pas admin
// - fetchCurrentStatus   : pré-fetch du statut avant mise à jour
// - handleStatusTransition : enregistre la transition (service auto + fallback RPC)
// - recalculateArtisanStatuses : recalcule les statuts artisans liés sur transition terminale

import type { UpdateInterventionData } from "@/lib/api/common/types";
import { getReferenceCache } from "@/lib/api/common/utils";
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";
import type { InterventionStatusKey } from "@/config/interventions";
import { supabaseClient, resolveUserId, resolveIsAdmin } from "./_auth";
import type { InterventionAuthContext } from "./_auth";

/** Retire contexte_intervention si l'appelant n'est pas admin. */
export async function stripAdminOnlyFields(
  payload: UpdateInterventionData,
  auth?: InterventionAuthContext,
): Promise<UpdateInterventionData> {
  if (!Object.prototype.hasOwnProperty.call(payload, "contexte_intervention")) {
    return payload;
  }

  const isAdmin = await resolveIsAdmin(auth?.isAdmin);
  if (isAdmin) return payload;

  const { contexte_intervention: _ignored, ...rest } = payload;
  return rest as UpdateInterventionData;
}

/** Récupère le statut actuel d'une intervention avant mise à jour. */
export async function fetchCurrentStatus(
  id: string,
): Promise<{ statut_id: string | null; statusCode: string | null }> {
  const { data } = await supabaseClient
    .from("interventions")
    .select(`statut_id, status:intervention_statuses(code)`)
    .eq("id", id)
    .single();

  if (!data) return { statut_id: null, statusCode: null };

  const statusRaw = data.status;
  const statusObj = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  return {
    statut_id: data.statut_id,
    statusCode: statusObj?.code ?? null,
  };
}

/** Enregistre une transition de statut via le service automatique ou fallback RPC. */
export async function handleStatusTransition(
  interventionId: string,
  oldStatutId: string | null,
  newStatutId: string,
  oldStatusCode: string | null,
  providedUserId?: string,
) {
  try {
    const userId = await resolveUserId(providedUserId);
    const refs = await getReferenceCache();

    const newStatusObj = refs.interventionStatusesById.get(newStatutId);
    const newStatusCode = newStatusObj?.code as InterventionStatusKey;

    const resolvedOldCode = oldStatusCode
      ?? (oldStatutId ? (refs.interventionStatusesById.get(oldStatutId)?.code as InterventionStatusKey) : undefined);

    if (newStatusCode && resolvedOldCode) {
      await automaticTransitionService.executeTransition(
        interventionId,
        resolvedOldCode as InterventionStatusKey,
        newStatusCode,
        userId || undefined,
        { updated_via: "api_v2", updated_at: new Date().toISOString() },
      );
    } else {
      console.warn("[interventionsApi] Impossible de récupérer les codes de statut pour la transition", { oldStatutId, newStatutId });

      const { error: transitionError } = await supabaseClient.rpc(
        "log_status_transition_from_api",
        {
          p_intervention_id: interventionId,
          p_from_status_id: oldStatutId || null,
          p_to_status_id: newStatutId,
          p_changed_by_user_id: userId,
          p_metadata: { updated_via: "api_v2", updated_at: new Date().toISOString(), fallback: true },
        },
      );

      if (transitionError) {
        console.warn("[interventionsApi] Erreur lors de l'enregistrement de la transition (fallback):", transitionError);
      }
    }
  } catch (error) {
    console.warn("[interventionsApi] Erreur lors de l'enregistrement de la transition:", error);
  }
}

/** Recalcule le statut des artisans liés quand l'intervention entre/sort d'un statut terminal. */
export async function recalculateArtisanStatuses(
  updatedRow: Record<string, unknown>,
  oldStatutId: string | null,
  newStatutId: string,
) {
  const refs = await getReferenceCache();
  const terminatedCodes = ["TERMINE", "INTER_TERMINEE"];
  const oldStatusCode = oldStatutId ? refs.interventionStatusesById.get(oldStatutId)?.code : null;
  const newStatusCode = refs.interventionStatusesById.get(newStatutId)?.code;

  const wasTerminated = oldStatusCode && terminatedCodes.includes(oldStatusCode);
  const isNowTerminated = newStatusCode && terminatedCodes.includes(newStatusCode);

  if (!wasTerminated && !isNowTerminated) return;

  const artisanIds = ((updatedRow as { intervention_artisans?: Array<{ artisan_id: string | null }> }).intervention_artisans ?? [])
    .map((ia) => ia.artisan_id)
    .filter((id): id is string => !!id);

  for (const artisanId of artisanIds) {
    try {
      const { error: rpcError } = await supabaseClient.rpc("recalculate_artisan_status", {
        artisan_uuid: artisanId,
      });
      if (rpcError) {
        console.warn(`[interventionsApi] Erreur RPC artisan ${artisanId}:`, rpcError);
      }
    } catch (err) {
      console.warn(`[interventionsApi] Exception artisan ${artisanId}:`, err);
    }
  }
}
