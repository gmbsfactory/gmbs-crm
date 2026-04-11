// ===== INTERVENTIONS CRUD =====
// Opérations CRUD de base sur les interventions

import { supabase, getSupabaseClientForNode } from "@/lib/api/v2/common/client";
import type {
  CreateInterventionData,
  Intervention,
  BulkOperationResult,
  InterventionQueryParams,
  PaginatedResponse,
  UpdateInterventionData,
} from "@/lib/api/v2/common/types";
import {
  getSupabaseFunctionsUrl,
  getHeaders,
  handleResponse,
  mapInterventionRecord,
  getReferenceCache,
  invalidateReferenceCache as invalidateCentralCache,
  resolveMetierToId,
} from "@/lib/api/v2/common/utils";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";
import type { InterventionWithStatus } from "@/types/intervention";
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";
import type { InterventionStatusKey } from "@/config/interventions";

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

// Ré-exporter la fonction d'invalidation du cache centralisé pour compatibilité
export const invalidateReferenceCache = invalidateCentralCache;

// ===== HELPERS POUR update() =====

/** Vérifie le rôle admin et retire contexte_intervention si non-admin */
async function stripAdminOnlyFields(payload: UpdateInterventionData): Promise<UpdateInterventionData> {
  if (!Object.prototype.hasOwnProperty.call(payload, "contexte_intervention")) {
    return payload;
  }

  try {
    const { data: session } = await supabaseClient.auth.getSession();
    const token = session?.session?.access_token;
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    let isAdmin = false;
    if (response.ok) {
      const current = await response.json();
      const roles: string[] = Array.isArray(current?.user?.roles) ? current.user.roles : [];
      isAdmin = roles.some(
        (role) => typeof role === "string" && role.toLowerCase().includes("admin"),
      );
    }

    if (!isAdmin) {
      const { contexte_intervention: _ignored, ...rest } = payload;
      return rest as UpdateInterventionData;
    }
    return payload;
  } catch (error) {
    console.warn("[interventionsApi.update] Unable to verify user role, dropping context update", error);
    const { contexte_intervention: _ignored, ...rest } = payload;
    return rest as UpdateInterventionData;
  }
}

/** Récupère le statut actuel d'une intervention avant mise à jour */
async function fetchCurrentStatus(id: string): Promise<{ statut_id: string | null; statusCode: string | null }> {
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

/** Enregistre une transition de statut via le service automatique ou fallback RPC */
async function handleStatusTransition(
  interventionId: string,
  oldStatutId: string | null,
  newStatutId: string,
  oldStatusCode: string | null,
) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userId = user?.id || null;
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
        { updated_via: 'api_v2', updated_at: new Date().toISOString() },
      );
    } else {
      console.warn('[interventionsApi] Impossible de récupérer les codes de statut pour la transition', { oldStatutId, newStatutId });

      const { error: transitionError } = await supabaseClient.rpc(
        'log_status_transition_from_api',
        {
          p_intervention_id: interventionId,
          p_from_status_id: oldStatutId || null,
          p_to_status_id: newStatutId,
          p_changed_by_user_id: userId,
          p_metadata: { updated_via: 'api_v2', updated_at: new Date().toISOString(), fallback: true },
        },
      );

      if (transitionError) {
        console.warn('[interventionsApi] Erreur lors de l\'enregistrement de la transition (fallback):', transitionError);
      }
    }
  } catch (error) {
    console.warn('[interventionsApi] Erreur lors de l\'enregistrement de la transition:', error);
  }
}

/** Recalcule le statut des artisans liés quand l'intervention entre/sort d'un statut terminal */
async function recalculateArtisanStatuses(
  updatedRow: Record<string, unknown>,
  oldStatutId: string | null,
  newStatutId: string,
) {
  const refs = await getReferenceCache();
  const terminatedCodes = ['TERMINE', 'INTER_TERMINEE'];
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
      const { error: rpcError } = await supabaseClient.rpc('recalculate_artisan_status', {
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

export const interventionsCrud = {
  // Récupérer toutes les interventions (via Edge Function)
  async getAll(params?: InterventionQueryParams): Promise<PaginatedResponse<InterventionWithStatus>> {
    type FilterValue = string | string[] | null | undefined;

    const limit = Math.max(1, params?.limit ?? 100);

    // Convertir les codes métier en IDs si nécessaire
    let metierParam = params?.metier;
    let metiersParam = params?.metiers;

    if (params?.metier || params?.metiers) {
      const refs = await getReferenceCache();

      if (params?.metier && typeof params.metier === 'string') {
        metierParam = resolveMetierToId(params.metier, refs.metiersById);
      }

      if (params?.metiers && params.metiers.length > 0) {
        metiersParam = params.metiers.map((code) => resolveMetierToId(code, refs.metiersById));
      }
    }

    const searchParams = new URLSearchParams();
    searchParams.set("limit", limit.toString());
    if (params?.offset !== undefined) {
      searchParams.set("offset", params.offset.toString());
    }

    const appendFilterParam = (key: string, value?: FilterValue) => {
      // Cas spécial pour user === null (vue Market) : envoyer "null" comme chaîne
      if (key === "user" && value === null) {
        searchParams.append(key, "null");
        return;
      }

      if (value === undefined || value === null) {
        // Ne pas envoyer le paramètre si la valeur est undefined ou null
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          // Ignorer les valeurs null dans les tableaux
          if (entry !== null && typeof entry === "string" && entry.length > 0) {
            searchParams.append(key, entry);
          }
        });
        return;
      }
      if (typeof value === "string" && value.length > 0) {
        searchParams.append(key, value);
      }
    };

    // Gérer statut et statuts (comme metier et metiers)
    if (params?.statuts && params.statuts.length > 0) {
      appendFilterParam("statut", params.statuts);
    } else {
      appendFilterParam("statut", params?.statut);
    }
    appendFilterParam("agence", params?.agence);
    appendFilterParam("artisan", params?.artisan);

    // Gérer metier et metiers
    if (metiersParam && Array.isArray(metiersParam) && metiersParam.length > 0) {
      appendFilterParam("metier", metiersParam);
    } else if (metierParam) {
      appendFilterParam("metier", metierParam);
    }

    appendFilterParam("user", params?.user);

    if (params?.startDate) {
      searchParams.set("startDate", params.startDate);
    }
    if (params?.endDate) {
      searchParams.set("endDate", params.endDate);
    }
    if (params?.isCheck !== undefined) {
      searchParams.set("isCheck", params.isCheck.toString());
    }
    if (params?.search) {
      searchParams.set("search", params.search);
    }

    // Ajouter les relations à inclure (payments, artisans, costs, etc.)
    if (params?.include && Array.isArray(params.include) && params.include.length > 0) {
      params.include.forEach((relation) => {
        searchParams.append("include", relation);
      });
    }

    // Tri serveur
    if (params?.sortBy) {
      searchParams.set("sort_by", params.sortBy);
    }
    if (params?.sortDir) {
      searchParams.set("sort_dir", params.sortDir);
    }

    if (process.env.NODE_ENV === "production") {
      searchParams.set("_ts", Date.now().toString());
    }

    const queryString = searchParams.toString();
    const functionsUrl = getSupabaseFunctionsUrl();
    const url = `${functionsUrl}/interventions-v2/interventions${queryString ? `?${queryString}` : ""}`;

    const fetchStart = Date.now();
    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);
    const rawLength = Array.isArray(raw?.data) ? raw.data.length : 0;
    const fetchDuration = Date.now() - fetchStart;

    const refs = await getReferenceCache();

    const mapStart = Date.now();
    // Mapping direct batch (synchrone = plus rapide)
    const transformedData = Array.isArray(raw?.data)
      ? raw.data.map((item: Record<string, unknown>) => mapInterventionRecord(item, refs) as InterventionWithStatus)
      : [];
    const mapDuration = Date.now() - mapStart;

    const total =
      typeof raw?.pagination?.total === "number"
        ? raw.pagination.total
        : transformedData.length;

    const offset = params?.offset ?? 0;

    return {
      data: transformedData,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  },

  /**
   * Récupère toutes les interventions en version légère (via Edge Function)
   * Version optimisée pour le warm-up avec moins de données
   */
  async getAllLight(params?: InterventionQueryParams): Promise<PaginatedResponse<InterventionWithStatus>> {
    type FilterValue = string | string[] | null | undefined;

    const limit = Math.max(1, params?.limit ?? 100);

    const searchParams = new URLSearchParams();
    searchParams.set("limit", limit.toString());
    if (params?.offset !== undefined) {
      searchParams.set("offset", params.offset.toString());
    }

    const appendFilterParam = (key: string, value?: FilterValue) => {
      if (key === "user" && value === null) {
        searchParams.append(key, "null");
        return;
      }

      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry !== null && typeof entry === "string" && entry.length > 0) {
            searchParams.append(key, entry);
          }
        });
        return;
      }
      if (typeof value === "string" && value.length > 0) {
        searchParams.append(key, value);
      }
    };

    if (params?.statuts && params.statuts.length > 0) {
      appendFilterParam("statut", params.statuts);
    } else {
      appendFilterParam("statut", params?.statut);
    }
    appendFilterParam("agence", params?.agence);
    appendFilterParam("artisan", params?.artisan);
    appendFilterParam("metier", params?.metier);
    appendFilterParam("user", params?.user);

    if (params?.startDate) {
      searchParams.set("startDate", params.startDate);
    }
    if (params?.endDate) {
      searchParams.set("endDate", params.endDate);
    }
    if (params?.isCheck !== undefined) {
      searchParams.set("isCheck", params.isCheck.toString());
    }
    if (params?.search) {
      searchParams.set("search", params.search);
    }

    const queryString = searchParams.toString();
    const functionsUrl = getSupabaseFunctionsUrl();
    const url = `${functionsUrl}/interventions-v2/interventions/light${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);

    const refs = await getReferenceCache();

    const transformedData = Array.isArray(raw?.data)
      ? raw.data.map((item: Record<string, unknown>) => mapInterventionRecord(item, refs) as InterventionWithStatus)
      : [];

    const total =
      typeof raw?.pagination?.total === "number"
        ? raw.pagination.total
        : transformedData.length;

    const offset = params?.offset ?? 0;

    return {
      data: transformedData,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  },

  /**
   * Obtient le nombre total d'interventions (sans les charger)
   */
  async getTotalCount(): Promise<number> {
    const { count, error } = await supabaseClient
      .from("interventions")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Erreur lors du comptage des interventions:", error);
      return 0;
    }

    return count || 0;
  },

  // Récupérer une intervention par ID
  async getById(id: string, include?: string[]): Promise<InterventionWithStatus> {
    const { data, error } = await supabaseClient
      .from("interventions")
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order),
        tenants (
          id,
          firstname,
          lastname,
          plain_nom_client,
          email,
          telephone,
          telephone2,
          adresse,
          ville,
          code_postal
        ),
        owner (
          id,
          owner_firstname,
          owner_lastname,
          plain_nom_facturation,
          telephone,
          telephone2,
          email,
          adresse,
          ville,
          code_postal
        ),
        intervention_artisans (
          artisan_id,
          role,
          is_primary,
          artisans (
            id,
            prenom,
            nom,
            plain_nom,
            raison_sociale,
            telephone,
            email
          )
        ),
        intervention_costs (
          id,
          cost_type,
          label,
          amount,
          currency,
          metadata,
          artisan_order
        ),
        intervention_payments (
          id,
          payment_type,
          amount,
          currency,
          is_received,
          payment_date,
          reference
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Intervention introuvable");

    const refs = await getReferenceCache();
    return mapInterventionRecord(data, refs) as InterventionWithStatus;
  },

  // Récupérer plusieurs interventions par leurs IDs (pour la pagination comptabilité)
  async getByIds(ids: string[]): Promise<InterventionWithStatus[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabaseClient
      .from("interventions")
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order),
        tenants (
          id,
          firstname,
          lastname,
          plain_nom_client,
          email,
          telephone,
          telephone2,
          adresse,
          ville,
          code_postal
        ),
        owner (
          id,
          owner_firstname,
          owner_lastname,
          plain_nom_facturation,
          telephone,
          telephone2,
          email,
          adresse,
          ville,
          code_postal
        ),
        intervention_artisans (
          artisan_id,
          role,
          is_primary,
          artisans (
            id,
            prenom,
            nom,
            plain_nom,
            raison_sociale,
            telephone,
            email
          )
        ),
        intervention_costs (
          id,
          cost_type,
          label,
          amount,
          currency,
          metadata,
          artisan_order
        ),
        intervention_payments (
          id,
          payment_type,
          amount,
          currency,
          is_received,
          payment_date,
          reference
        )
      `)
      .in("id", ids);

    if (error) throw error;

    const refs = await getReferenceCache();
    return (data || []).map((item: any) => mapInterventionRecord(item, refs) as InterventionWithStatus);
  },

  // Créer une intervention
  async create(data: CreateInterventionData): Promise<Intervention> {
    // 1. Faire l'INSERT
    const { data: result, error } = await supabaseClient
      .from('interventions')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Erreur lors de la création de l'intervention: ${error.message}`);

    // 2. Créer la chaîne de transitions si nécessaire
    if (result.statut_id) {
      try {
        // Le trigger a créé une transition NULL → statut_actuel lors de l'INSERT
        // On la supprime pour la remplacer par la chaîne complète
        await supabaseClient
          .from('intervention_status_transitions')
          .delete()
          .eq('intervention_id', result.id)
          .eq('source', 'trigger');

        // Récupérer l'utilisateur actuel
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user?.id;

        // Créer les transitions automatiques
        await automaticTransitionService.createAutomaticTransitions(
          result.id,
          result.statut_id,
          null, // fromStatusId = null pour INSERT
          userId,
          {
            updated_via: 'create',
            api_operation: true,
          }
        );
      } catch (transitionError) {
        console.error('Erreur lors de la création des transitions automatiques:', transitionError);
        // Ne pas bloquer la création si les transitions échouent
      }
    }

    const refs = await getReferenceCache();
    return mapInterventionRecord(result, refs);
  },

  // Vérifier si une intervention avec la même adresse et agence existe
  async checkDuplicate(address: string, agencyId: string): Promise<boolean> {
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

    return data && data.length > 0;
  },

  // Récupérer les détails des interventions dupliquées
  async getDuplicateDetails(address: string, agencyId: string): Promise<Array<{
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

    if (!data || data.length === 0) {
      return [];
    }

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
  },

  // Modifier une intervention
  async update(id: string, data: UpdateInterventionData): Promise<InterventionWithStatus> {
    const payload = await stripAdminOnlyFields({ ...data });

    // Pré-fetch du statut actuel si on change de statut
    let oldStatutId: string | null = null;
    let oldStatusCode: string | null = null;
    if (payload.statut_id) {
      const current = await fetchCurrentStatus(id);
      oldStatutId = current.statut_id;
      oldStatusCode = current.statusCode;
    }

    // Enregistrer la transition AVANT la mise à jour
    const statusChanged = payload.statut_id && oldStatutId !== payload.statut_id;
    if (statusChanged) {
      await handleStatusTransition(id, oldStatutId, payload.statut_id!, oldStatusCode);
    }

    // Mise à jour en base
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

    // Recalculer le statut des artisans si nécessaire
    if (statusChanged) {
      await recalculateArtisanStatuses(updated as unknown as Record<string, unknown>, oldStatutId, payload.statut_id!);
    }

    return mapped;
  },

  // Supprimer une intervention (soft delete)
  async delete(id: string): Promise<{ message: string; data: Intervention }> {
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/interventions-v2/interventions/${id}`,
      {
        method: "DELETE",
        headers,
      }
    );
    return handleResponse(response);
  },

  // Upsert une intervention (créer ou mettre à jour)
  async upsert(data: CreateInterventionData & { id_inter?: string }): Promise<Intervention> {
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/interventions-v2/interventions/upsert`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Upsert direct via Supabase (pour import en masse)
  async upsertDirect(
    data: CreateInterventionData & { id_inter?: string },
    customClient?: typeof supabase
  ): Promise<Intervention & { _operation: 'created' | 'updated'; _matchedBy?: 'id_inter' }> {
    // Utiliser le client personnalisé si fourni, sinon utiliser supabaseClient (qui utilise getSupabaseClientForNode() dans Node.js)
    const client = customClient || supabaseClient;

    // 1. Vérifier si l'intervention existe déjà
    let existingIntervention = null;
    let oldStatusId = null;

    if (data.id_inter) {
      const { data: existing } = await client
        .from('interventions')
        .select('id, statut_id')
        .eq('id_inter', data.id_inter)
        .maybeSingle();

      existingIntervention = existing;
      oldStatusId = existing?.statut_id || null;
    }

    const operation: 'created' | 'updated' = existingIntervention ? 'updated' : 'created';
    const matchedBy: 'id_inter' | undefined = existingIntervention ? 'id_inter' : undefined;

    // 2. Faire l'upsert
    const { data: result, error } = await client
      .from('interventions')
      .upsert(data, {
        onConflict: 'id_inter',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur lors de l'upsert de l'intervention: ${error.message}`);

    // 3. Créer la chaîne de transitions si nécessaire
    if (result.statut_id) {
      try {
        if (!existingIntervention) {
          await client
            .from('intervention_status_transitions')
            .delete()
            .eq('intervention_id', result.id)
            .eq('source', 'trigger');
        } else if (oldStatusId && oldStatusId !== result.statut_id) {
          await client
            .from('intervention_status_transitions')
            .delete()
            .eq('intervention_id', result.id)
            .eq('from_status_id', oldStatusId)
            .eq('to_status_id', result.statut_id)
            .eq('source', 'trigger');
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user?.id;

        await automaticTransitionService.createAutomaticTransitions(
          result.id,
          result.statut_id,
          oldStatusId,
          userId,
          {
            updated_via: 'upsertDirect',
            import_operation: true,
            id_inter: data.id_inter,
          }
        );
      } catch (transitionError) {
        console.error('Erreur lors de la création des transitions automatiques:', transitionError);
      }
    }

    const refs = await getReferenceCache();
    const intervention = mapInterventionRecord(result, refs);
    return Object.assign(intervention, { _operation: operation, _matchedBy: matchedBy });
  },

  // Créer plusieurs interventions en lot
  async createBulk(interventions: CreateInterventionData[]): Promise<BulkOperationResult> {
    const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

    for (const intervention of interventions) {
      try {
        const result = await this.create(intervention);
        results.success++;
        results.details.push({ item: intervention as unknown as Record<string, unknown>, success: true, data: result as unknown as Record<string, unknown> });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: intervention as unknown as Record<string, unknown>, success: false, error: safeErrorMessage(error, "la création de l'intervention") });
      }
    }

    return results;
  },

  // Récupérer les interventions par utilisateur
  async getByUser(userId: string, params?: InterventionQueryParams): Promise<PaginatedResponse<Intervention>> {
    return this.getAll({ ...params, user: userId });
  },

  // Récupérer les interventions par statut
  async getByStatus(statusId: string, params?: InterventionQueryParams): Promise<PaginatedResponse<Intervention>> {
    return this.getAll({ ...params, statut: statusId });
  },

  // Récupérer les interventions par agence
  async getByAgency(agencyId: string, params?: InterventionQueryParams): Promise<PaginatedResponse<Intervention>> {
    return this.getAll({ ...params, agence: agencyId });
  },

  // Récupérer les interventions par artisan via interventions_artisans
  async getByArtisan(artisanId: string, params?: Omit<InterventionQueryParams, "artisan">): Promise<PaginatedResponse<InterventionWithStatus>> {
    const { data: interventionArtisans, error: joinError } = await supabaseClient
      .from("intervention_artisans")
      .select("intervention_id")
      .eq("artisan_id", artisanId);

    if (joinError) throw joinError;

    const interventionIds = (interventionArtisans || []).map((ia: any) => ia.intervention_id).filter(Boolean);

    if (interventionIds.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          limit: params?.limit || 5000,
          offset: params?.offset || 0,
          hasMore: false,
        },
      };
    }

    let query = supabaseClient
      .from("interventions")
      .select(
        `
          *,
          status:intervention_statuses(id,code,label,color,sort_order),
          intervention_artisans (
            artisan_id,
            is_primary,
            role
          ),
          intervention_costs (
            id,
            cost_type,
            label,
            amount,
            currency,
            metadata,
            artisan_order
          )
        `,
        { count: "exact" }
      )
      .in("id", interventionIds)
      .order("created_at", { ascending: false });

    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.user) {
      query = query.eq("assigned_user_id", params.user);
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    const limit = params?.limit || 5000;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item: any) =>
      mapInterventionRecord(item, refs) as InterventionWithStatus
    );

    return {
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },

  // Récupérer les interventions par période
  async getByDateRange(
    startDate: string,
    endDate: string,
    params?: InterventionQueryParams
  ): Promise<PaginatedResponse<Intervention>> {
    return this.getAll({ ...params, startDate, endDate });
  },
};
