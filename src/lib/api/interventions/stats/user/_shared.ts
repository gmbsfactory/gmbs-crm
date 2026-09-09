// ===== USER STATS - SHARED HELPERS =====
// Helpers utilisés par les sous-modules user/* : formatage de dates,
// fetchers communs (transitions, artisans, artisans missionnés), gestion
// des AbortError Supabase.

import { supabase } from "@/lib/api/common/client";
import type { ArtisanCreatedRow, ArtisanMissionneRow, TransitionRow } from "@/lib/api/interventions/stats/types";
import {
  dedupeFirstTransitionPerIntervention,
  REAL_DATA_START_ISO,
} from "@/lib/api/interventions/stats/transitions-scope";

export const TRACKED_STATUS_CODES = [
  "DEVIS_ENVOYE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
] as const;

export type SupabaseLikeError = { message?: string; code?: string } | null;

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Si l'erreur Supabase correspond à une annulation, lève une AbortError standard.
 * Sinon, lève une Error avec le message contextualisé.
 */
export function throwSupabaseError(error: SupabaseLikeError, context: string): never {
  if (error?.message?.includes("aborted") || error?.code === "ABORT_ERR") {
    const abortError = new Error(error.message);
    abortError.name = "AbortError";
    throw abortError;
  }
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export function requireUserId(userId: string): void {
  if (!userId) {
    throw new Error("userId is required");
  }
}

/**
 * Récupère les transitions de statut d'un utilisateur sur la plage
 * [startStrInclusive, endStrExclusive[.
 *
 * La borne haute est TOUJOURS exclusive et doit être le début de la période
 * suivante (lundi suivant, 1er du mois suivant, 1er janvier suivant). Les dates
 * sont au format `YYYY-MM-DD` : une borne haute inclusive sur le dernier jour
 * de la période serait castée à minuit par Postgres et perdrait silencieusement
 * toutes les transitions de ce dernier jour.
 *
 * Attribution à l'ACTEUR (`changed_by_user_id`), pas au propriétaire du
 * dossier : le gestionnaire qui fait passer le dossier au statut est celui
 * qui en récolte la statistique, même si le dossier est assigné à quelqu'un
 * d'autre (remplacement d'un collègue absent). Cf. règle n°4 de
 * transitions-scope.ts.
 *
 * Périmètre « données réelles » (cf. transitions-scope.ts) : uniquement les
 * transitions postérieures au go-live ET portées par un acteur humain — le
 * filtre sur l'acteur exclut de fait les cascades sans acteur de l'import des
 * 28-29/06. Le résultat est dédupliqué : une intervention ne compte qu'une
 * fois par statut et par acteur (premier passage).
 */
export async function fetchUserTransitions(params: {
  userId: string;
  startStr: string;
  endStrExclusive: string;
  signal?: AbortSignal;
}): Promise<TransitionRow[]> {
  const { userId, startStr, endStrExclusive, signal } = params;

  let query = supabase
    .from("intervention_status_transitions")
    .select(`
      id,
      intervention_id,
      transition_date,
      to_status_code,
      changed_by_user_id,
      interventions!inner(assigned_user_id, is_active)
    `)
    .eq("changed_by_user_id", userId)
    .eq("interventions.is_active", true)
    .in("to_status_code", TRACKED_STATUS_CODES as unknown as string[])
    .gte("transition_date", REAL_DATA_START_ISO)
    .gte("transition_date", startStr)
    .lt("transition_date", endStrExclusive);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    throwSupabaseError(error, "Erreur lors de la récupération des transitions de statut");
  }

  return dedupeFirstTransitionPerIntervention((data as unknown as TransitionRow[]) ?? []);
}

/**
 * Récupère les artisans créés par un gestionnaire sur une plage [startStr, endStrExclusive[.
 */
export async function fetchUserArtisans(params: {
  userId: string;
  startStr: string;
  endStrExclusive: string;
}): Promise<ArtisanCreatedRow[]> {
  const { userId, startStr, endStrExclusive } = params;

  const { data, error } = await supabase
    .from("artisans")
    .select("id, created_at, gestionnaire_id")
    .eq("gestionnaire_id", userId)
    .eq("is_active", true)
    .gte("created_at", startStr)
    .lt("created_at", endStrExclusive);

  if (error) {
    throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
  }

  return (data as ArtisanCreatedRow[]) ?? [];
}

/**
 * Récupère les artisans créés sur la période ET ayant au moins une intervention active.
 * Dédupliqué par id (le JOIN crée plusieurs lignes par artisan).
 *
 * Le comportement historique tolère un échec : on log et retourne une Map vide.
 */
export async function fetchUserArtisansMissionnesDeduped(params: {
  userId: string;
  startStr: string;
  endStrExclusive: string;
}): Promise<Map<string, ArtisanMissionneRow>> {
  const { userId, startStr, endStrExclusive } = params;

  const { data, error } = await supabase
    .from("artisans")
    .select(`
      id,
      created_at,
      gestionnaire_id,
      intervention_artisans!inner(
        interventions!inner(id, is_active)
      )
    `)
    .eq("gestionnaire_id", userId)
    .eq("is_active", true)
    .eq("intervention_artisans.interventions.is_active", true)
    .gte("created_at", startStr)
    .lt("created_at", endStrExclusive);

  const deduped = new Map<string, ArtisanMissionneRow>();
  if (error) {
    console.error("Erreur lors de la récupération des artisans missionnés:", error);
    return deduped;
  }

  ((data as ArtisanMissionneRow[]) ?? []).forEach((artisan) => {
    if (!deduped.has(artisan.id)) {
      deduped.set(artisan.id, artisan);
    }
  });

  return deduped;
}
