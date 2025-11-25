// ===== API INTERVENTIONS V2 =====
// Gestion complète des interventions

import { referenceApi } from "@/lib/reference-api";
import { supabase } from "@/lib/supabase-client";
import { RevenueProjectionService } from "@/lib/services/revenueProjection";
import type {
  AdminDashboardStats,
  BulkOperationResult,
  CreateInterventionData,
  CycleTimeHistoryData,
  CycleTimeHistoryResponse,
  DashboardPeriodParams,
  GestionnaireMarginRanking,
  Intervention,
  InterventionCost,
  InterventionPayment,
  InterventionsHistoryData,
  InterventionsHistoryResponse,
  InterventionQueryParams,
  InterventionStatsByStatus,
  InterventionStatusTransition,
  KPIHistoryParams,
  MarginCalculation,
  MarginHistoryData,
  MarginHistoryResponse,
  MarginRankingResult,
  MarginStats,
  MonthlyStats,
  PaginatedResponse,
  PeriodType,
  RevenueHistoryData,
  RevenueHistoryParams,
  RevenueHistoryResponse,
  StatsPeriod,
  TransformationRateHistoryData,
  TransformationRateHistoryResponse,
  UpdateInterventionData,
  WeeklyStats,
  WeekDayStats,
  MonthWeekStats,
  YearMonthStats,
  YearlyStats,
} from "./common/types";
import {
  getSupabaseFunctionsUrl,
  getHeaders,
  handleResponse,
  mapInterventionRecord,
} from "./common/utils";
import type { InterventionWithStatus, InterventionStatus } from "@/types/intervention";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";
import type { InterventionStatusKey } from "@/config/interventions";

// Cache pour les données de référence
type ReferenceCache = {
  data: any;
  fetchedAt: number;
  usersById: Map<string, any>;
  agenciesById: Map<string, any>;
  interventionStatusesById: Map<string, any>;
  artisanStatusesById: Map<string, any>;
  metiersById: Map<string, any>;
};

const REFERENCE_CACHE_DURATION = 5 * 60 * 1000;
let referenceCache: ReferenceCache | null = null;
let referenceCachePromise: Promise<ReferenceCache> | null = null;


export const invalidateReferenceCache = () => {
  referenceCache = null;
  referenceCachePromise = null;
};

async function getReferenceCache(): Promise<ReferenceCache> {
  const now = Date.now();
  if (referenceCache && now - referenceCache.fetchedAt < REFERENCE_CACHE_DURATION) {
    return referenceCache;
  }

  if (referenceCachePromise) {
    return referenceCachePromise;
  }

  referenceCachePromise = (async () => {
    const data = await referenceApi.getAll();
    const cache: ReferenceCache = {
      data,
      fetchedAt: Date.now(),
      usersById: new Map(data.users.map((user: any) => [user.id, user])),
      agenciesById: new Map(data.agencies.map((agency: any) => [agency.id, agency])),
      interventionStatusesById: new Map(data.interventionStatuses.map((status: any) => [status.id, status])),
      artisanStatusesById: new Map(data.artisanStatuses.map((status: any) => [status.id, status])),
      metiersById: new Map(data.metiers.map((metier: any) => [metier.id, metier])),
    };
    referenceCache = cache;
    referenceCachePromise = null;
    return cache;
  })();

  try {
    return await referenceCachePromise;
  } catch (error) {
    referenceCachePromise = null;
    throw error;
  }
}

export const interventionsApi = {
  // Récupérer toutes les interventions (ULTRA-OPTIMISÉ)
  async getAll(params?: InterventionQueryParams): Promise<PaginatedResponse<InterventionWithStatus>> {
    // Version ultra-rapide : requête simple sans joins complexes
    let query = supabase
      .from("interventions")
      .select(
        `
          *,
          status:intervention_statuses(id,code,label,color,sort_order),
          payments:intervention_payments(*)
        `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Appliquer les filtres si nécessaire
    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.user) {
      query = query.eq("assigned_user_id", params.user);
    }
    if (params?.artisan) {
      query = query.eq("artisan_id", params.artisan);
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    // Pagination
    const limit = params?.limit || 500;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item) =>
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

  /**
   * Obtient le nombre total d'interventions (sans les charger)
   */
  async getTotalCount(): Promise<number> {
    const { count, error } = await supabase
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
    const { data, error } = await supabase
      .from("interventions")
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order),
        tenants (
          id,
          firstname,
          lastname,
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
          metadata
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

  // Créer une intervention
  async create(data: CreateInterventionData): Promise<Intervention> {
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/interventions-v2/interventions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return await handleResponse(response);
  },

  // Modifier une intervention
  async update(id: string, data: UpdateInterventionData): Promise<InterventionWithStatus> {
    let payload: UpdateInterventionData = { ...data }

    if (Object.prototype.hasOwnProperty.call(payload, "contexte_intervention")) {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        let isAdmin = false
        if (response.ok) {
          const current = await response.json()
          const roles: string[] = Array.isArray(current?.user?.roles) ? current.user.roles : []
          isAdmin = roles.some(
            (role) => typeof role === "string" && role.toLowerCase().includes("admin"),
          )
        }

        if (!isAdmin) {
          const { contexte_intervention: _ignored, ...rest } = payload
          payload = rest as UpdateInterventionData
        }
      } catch (error) {
        console.warn("[interventionsApi.update] Unable to verify user role, dropping context update", error)
        const { contexte_intervention: _ignored, ...rest } = payload
        payload = rest as UpdateInterventionData
      }
    }

    // Récupérer le statut actuel avant la mise à jour pour détecter si on passe à "terminé"
    let wasTerminatedBefore = false;
    let oldStatutId: string | null = null;
    let currentIntervention: any = null; // Déclarer la variable en dehors du bloc if

    if (payload.statut_id && typeof window !== "undefined") {
      const { data } = await supabase
        .from("interventions")
        .select(`
          statut_id,
          status:intervention_statuses(code)
        `)
        .eq("id", id)
        .single();

      currentIntervention = data; // Assigner la valeur

      if (currentIntervention) {
        oldStatutId = currentIntervention.statut_id;

        if ((currentIntervention as any).status) {
          const terminatedStatusCodes = ['TERMINE', 'INTER_TERMINEE'];
          const currentStatusCode = (currentIntervention as any).status?.code;
          wasTerminatedBefore = currentStatusCode && terminatedStatusCodes.includes(currentStatusCode);
        }
      }
    }

    // Si on change le statut, enregistrer la transition AVANT la mise à jour
    if (payload.statut_id && oldStatutId !== payload.statut_id) {
      try {
        // Récupérer l'utilisateur actuel
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;

        // Récupérer les codes de statut pour le service de transition
        // On utilise le cache de référence pour éviter une requête supplémentaire
        const refs = await getReferenceCache();

        // Récupérer le code du nouveau statut
        const newStatusObj = refs.interventionStatusesById.get(payload.statut_id);
        const newStatusCode = newStatusObj?.code as InterventionStatusKey;

        // Récupérer le code de l'ancien statut
        // On essaie d'abord via currentIntervention, sinon via le cache
        let oldStatusCode: InterventionStatusKey | undefined;
        if (currentIntervention && (currentIntervention as any).status?.code) {
          oldStatusCode = (currentIntervention as any).status.code as InterventionStatusKey;
        } else if (oldStatutId) {
          const oldStatusObj = refs.interventionStatusesById.get(oldStatutId);
          oldStatusCode = oldStatusObj?.code as InterventionStatusKey;
        }

        if (newStatusCode && oldStatusCode) {
          // Utiliser le service de transition automatique
          await automaticTransitionService.executeTransition(
            id,
            oldStatusCode,
            newStatusCode,
            userId || undefined,
            {
              updated_via: 'api_v2',
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          console.warn('[interventionsApi] Impossible de récupérer les codes de statut pour la transition', { oldStatutId, newStatutId: payload.statut_id });

          // Fallback: Enregistrer la transition directe si on n'a pas les codes
          const { error: transitionError } = await supabase.rpc(
            'log_status_transition_from_api',
            {
              p_intervention_id: id,
              p_from_status_id: oldStatutId || null,
              p_to_status_id: payload.statut_id,
              p_changed_by_user_id: userId,
              p_metadata: {
                updated_via: 'api_v2',
                updated_at: new Date().toISOString(),
                fallback: true
              }
            }
          );

          if (transitionError) {
            console.warn('[interventionsApi] Erreur lors de l\'enregistrement de la transition (fallback):', transitionError);
          }
        }
      } catch (error) {
        console.warn('[interventionsApi] Erreur lors de l\'enregistrement de la transition:', error);
        // Continuer quand même, le trigger de sécurité enregistrera
      }
    }

    const { data: updated, error } = await supabase
      .from("interventions")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order)
      `)
      .single();

    if (error) throw error;
    if (!updated) throw new Error("Impossible de mettre à jour l'intervention");

    const refs = await getReferenceCache();
    const mapped = mapInterventionRecord(updated, refs) as InterventionWithStatus;

    // Si l'intervention vient de passer à un statut terminé, recalculer les statuts des artisans associés
    const terminatedStatusCodes = ['TERMINE', 'INTER_TERMINEE'];
    const isTerminated = mapped.status?.code && terminatedStatusCodes.includes(mapped.status.code);

    // Si le statut vient de passer à "terminé", recalculer les statuts des artisans
    if (isTerminated && !wasTerminatedBefore && typeof window !== "undefined") {
      // Récupérer les artisans associés à cette intervention
      const { data: interventionArtisans } = await supabase
        .from('intervention_artisans')
        .select('artisan_id, is_primary')
        .eq('intervention_id', id);

      if (interventionArtisans && interventionArtisans.length > 0) {
        // Prioriser les artisans primaires, sinon prendre tous
        const artisanIds = interventionArtisans
          .filter(ia => ia.is_primary === true)
          .map(ia => ia.artisan_id)
          .filter(Boolean) as string[];

        const finalArtisanIds = artisanIds.length > 0
          ? artisanIds
          : interventionArtisans.map(ia => ia.artisan_id).filter(Boolean) as string[];

        // Appeler l'API route pour recalculer chaque artisan en arrière-plan
        finalArtisanIds.forEach(artisanId => {
          fetch(`/api/artisans/${artisanId}/recalculate-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(error => {
            console.warn(`[interventionsApi] Erreur lors du recalcul pour artisan ${artisanId}:`, error);
          });
        });
      }
    }

    // Note: L'invalidation des queries TanStack Query est gérée par useInterventionsMutations
    // Les composants utilisant TanStack Query seront automatiquement mis à jour via invalidateQueries

    return mapped;
  },

  // Mettre à jour uniquement le statut d'une intervention
  async updateStatus(id: string, statusId: string): Promise<InterventionWithStatus> {
    if (!statusId) {
      throw new Error("Status ID is required");
    }
    return this.update(id, { statut_id: statusId });
  },

  async setPrimaryArtisan(interventionId: string, artisanId: string | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    const { data: existingPrimary, error: primaryError } = await supabase
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
        const { error: deleteError } = await supabase
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
      const { error: ensurePrimaryError } = await supabase
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
    const { data: existingLink, error: linkError } = await supabase
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
      const { error: demoteError } = await supabase
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
      const { error: promoteError } = await supabase
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

    const { error: insertError } = await supabase
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

  // Assigner un artisan à une intervention
  async assignArtisan(
    interventionId: string,
    artisanId: string,
    role: "primary" | "secondary" = "primary"
  ): Promise<any> {
    const { data: result, error } = await supabase
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

  // Ajouter un coût à une intervention
  async addCost(
    interventionId: string,
    data: {
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
    }
  ): Promise<InterventionCost> {
    const { data: result, error } = await supabase
      .from('intervention_costs')
      .insert({
        intervention_id: interventionId,
        cost_type: data.cost_type,
        label: data.label || null,
        amount: data.amount,
        currency: data.currency || 'EUR',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de l'ajout du coût: ${error.message}`);
    }

    return result;
  },

  // Mettre à jour ou créer un coût pour une intervention (upsert)
  async upsertCost(
    interventionId: string,
    data: {
      cost_type: "sst" | "materiel" | "intervention" | "total";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
    }
  ): Promise<InterventionCost> {
    // "total" n'est pas un type valide pour la base de données, on le mappe vers "marge"
    const costType: "sst" | "materiel" | "intervention" | "marge" =
      data.cost_type === "total" ? "marge" : data.cost_type;

    // Vérifier si le coût existe déjà
    const { data: existingCost, error: findError } = await supabase
      .from('intervention_costs')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('cost_type', costType)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      throw new Error(`Erreur lors de la recherche du coût: ${findError.message}`);
    }

    if (existingCost) {
      // Mettre à jour le coût existant
      const { data: result, error: updateError } = await supabase
        .from('intervention_costs')
        .update({
          amount: data.amount,
          label: data.label || null,
          currency: data.currency || 'EUR',
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCost.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du coût: ${updateError.message}`);
      }

      return result;
    } else {
      // Créer un nouveau coût avec le type mappé
      return this.addCost(interventionId, {
        ...data,
        cost_type: costType
      });
    }
  },

  // Ajouter un paiement à une intervention
  async addPayment(
    interventionId: string,
    data: {
      payment_type: string;
      amount: number;
      currency?: string;
      is_received?: boolean;
      payment_date?: string;
      reference?: string;
    }
  ): Promise<InterventionPayment> {
    const { data: result, error } = await supabase
      .from('intervention_payments')
      .insert({
        intervention_id: interventionId,
        payment_type: data.payment_type,
        amount: data.amount,
        currency: data.currency || 'EUR',
        is_received: data.is_received || false,
        payment_date: data.payment_date || null,
        reference: data.reference || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de l'ajout du paiement: ${error.message}`);
    }

    return result;
  },

  // Mettre à jour ou créer un paiement pour une intervention (upsert)
  async upsertPayment(
    interventionId: string,
    data: {
      payment_type: string;
      amount?: number;
      currency?: string;
      is_received?: boolean;
      payment_date?: string | null;
      reference?: string | null;
    }
  ): Promise<InterventionPayment> {
    // Vérifier si le paiement existe déjà
    const { data: existingPayment, error: findError } = await supabase
      .from('intervention_payments')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('payment_type', data.payment_type)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      throw new Error(`Erreur lors de la recherche du paiement: ${findError.message}`);
    }

    if (existingPayment) {
      // Mettre à jour le paiement existant
      const { data: result, error: updateError } = await supabase
        .from('intervention_payments')
        .update({
          ...data,
          // Ne pas mettre à jour updated_at car il n'existe pas forcément sur cette table ou est géré par trigger
        })
        .eq('id', existingPayment.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du paiement: ${updateError.message}`);
      }

      return result;
    } else {
      // Créer un nouveau paiement
      // Pour la création, amount est requis s'il n'est pas fourni (mais ici on suppose qu'il l'est ou que la DB a une default)
      // On utilise addPayment qui attend amount. Si data.amount est undefined, on met 0 par défaut pour la création.
      return this.addPayment(interventionId, {
        payment_type: data.payment_type,
        amount: data.amount ?? 0,
        currency: data.currency,
        is_received: data.is_received,
        payment_date: data.payment_date || undefined,
        reference: data.reference || undefined
      });
    }
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
  async upsertDirect(data: CreateInterventionData & { id_inter?: string }): Promise<Intervention> {
    const { data: result, error } = await supabase
      .from('interventions')
      .upsert(data, {
        onConflict: 'id_inter',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur lors de l'upsert de l'intervention: ${error.message}`);

    const refs = await getReferenceCache();
    return mapInterventionRecord(result, refs);
  },

  // Insérer plusieurs coûts pour des interventions
  async insertInterventionCosts(
    costs: Array<{
      intervention_id: string;
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
    }>
  ): Promise<BulkOperationResult> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const cost of costs) {
      try {
        const result = await this.addCost(cost.intervention_id, cost);
        results.success++;
        results.details.push({ item: cost, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ item: cost, success: false, error: error.message });
      }
    }

    return results;
  },

  // Créer plusieurs interventions en lot
  async createBulk(interventions: CreateInterventionData[]): Promise<BulkOperationResult> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const intervention of interventions) {
      try {
        const result = await this.create(intervention);
        results.success++;
        results.details.push({ item: intervention, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ item: intervention, success: false, error: error.message });
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
    // Requête avec join sur interventions_artisans
    // On utilise une sous-requête pour obtenir les IDs d'interventions liées à l'artisan
    const { data: interventionArtisans, error: joinError } = await supabase
      .from("intervention_artisans")
      .select("intervention_id")
      .eq("artisan_id", artisanId);

    if (joinError) throw joinError;

    const interventionIds = (interventionArtisans || []).map((ia) => ia.intervention_id).filter(Boolean);

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

    let query = supabase
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
            metadata
          )
        `,
        { count: "exact" }
      )
      .in("id", interventionIds)
      .order("created_at", { ascending: false });

    // Appliquer les autres filtres si nécessaire
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

    // Pagination
    const limit = params?.limit || 5000;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item) =>
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

  /**
   * Récupère tous les statuts d'intervention disponibles
   */
  async getAllStatuses(): Promise<InterventionStatus[]> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .eq('code', code)
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') return null;
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
    const { data, error } = await supabase
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .ilike('label', label)
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') return null;
      if (error.message?.includes('Results contain 0 rows')) return null;
      throw error;
    }
    return (data as InterventionStatus | null) ?? null;
  },

  /**
   * Récupère les statistiques d'interventions par statut pour un utilisateur
   * @param userId - ID de l'utilisateur
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques avec le nombre d'interventions par statut
   */
  async getStatsByUser(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<InterventionStatsByStatus> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Construire la requête de base
    let query = supabase
      .from("interventions")
      .select(
        `
        statut_id,
        date_prevue,
        status:intervention_statuses(id, code, label)
        `,
        { count: "exact" }
      )
      .eq("assigned_user_id", userId)
      .eq("is_active", true); // Seulement les interventions actives

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    // Initialiser les compteurs
    const byStatus: Record<string, number> = {};
    const byStatusLabel: Record<string, number> = {};
    let interventionsAChecker = 0;

    // Compter les interventions par statut
    (data || []).forEach((item: any) => {
      const status = item.status;
      const statusCode = status?.code || null;
      const datePrevue = item.date_prevue || null;

      // Vérifier si c'est une intervention CHECK
      if (isCheckStatus(statusCode, datePrevue)) {
        interventionsAChecker++;
      }

      if (status) {
        const code = status.code || "SANS_STATUT";
        const label = status.label || "Sans statut";

        byStatus[code] = (byStatus[code] || 0) + 1;
        byStatusLabel[label] = (byStatusLabel[label] || 0) + 1;
      } else {
        // Intervention sans statut
        byStatus["SANS_STATUT"] = (byStatus["SANS_STATUT"] || 0) + 1;
        byStatusLabel["Sans statut"] = (byStatusLabel["Sans statut"] || 0) + 1;
      }
    });

    return {
      total: count || 0,
      by_status: byStatus,
      by_status_label: byStatusLabel,
      interventions_a_checker: interventionsAChecker,
      period: {
        start_date: startDate || null,
        end_date: endDate || null,
      },
    };
  },

  // ========================================
  // FONCTION COMMUNALISÉE DE CALCUL DE MARGE
  // ========================================
  /**
   * Calcule la marge pour une intervention à partir de ses coûts
   * Formule utilisée : Taux de marque = (marge / prix de vente) * 100
   * 
   * @param costs - Liste des coûts de l'intervention
   * @param interventionId - ID de l'intervention (optionnel, pour les logs)
   * @returns Objet avec revenue, costs, margin, marginPercentage ou null si pas de revenu
   */
  calculateMarginForIntervention(
    costs: InterventionCost[],
    interventionId?: string | number
  ): MarginCalculation | null {
    if (!costs || costs.length === 0) {
      return null;
    }

    // Extraire les coûts par type
    let coutIntervention = 0; // Prix de vente
    let coutSST = 0;
    let coutMateriel = 0;

    costs.forEach((cost) => {
      switch (cost.cost_type) {
        case "intervention":
          coutIntervention = cost.amount || 0;
          break;
        case "sst":
          coutSST = cost.amount || 0;
          break;
        case "materiel":
          coutMateriel = cost.amount || 0;
          break;
      }
    });

    // Pas de calcul si pas de revenu (prix de vente)
    if (coutIntervention <= 0) {
      return null;
    }

    const totalCostForIntervention = coutSST + coutMateriel;
    const marge = coutIntervention - totalCostForIntervention;

    // Calcul du pourcentage : Taux de marque = marge / prix de vente
    // Exemple : vente 100€, coûts 80€ → marge 20€ → 20/100 = 20%
    const marginPercentage = (marge / coutIntervention) * 100;

    // Debug pour interventions avec marge négative
    if (marge < 0) {
      const idStr = interventionId ? ` (ID: ${interventionId})` : '';
      console.log(
        `[MarginStats] Intervention avec perte${idStr} : ` +
        `vente ${coutIntervention.toFixed(2)}€, ` +
        `coûts ${totalCostForIntervention.toFixed(2)}€, ` +
        `marge ${marge.toFixed(2)}€ (${marginPercentage.toFixed(2)}%)`
      );
    }

    return {
      revenue: coutIntervention,
      costs: totalCostForIntervention,
      margin: marge,
      marginPercentage: marginPercentage,
    };
  },

  /**
   * Récupère les statistiques de marge pour un utilisateur
   * @param userId - ID de l'utilisateur
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques de marge avec le pourcentage moyen
   */
  async getMarginStatsByUser(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MarginStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Construire la requête avec les coûts
    let query = supabase
      .from("interventions")
      .select(
        `
        id,
        id_inter,
        intervention_costs (
          id,
          cost_type,
          amount,
          label
        )
        `
      )
      .eq("assigned_user_id", userId)
      .eq("is_active", true); // Seulement les interventions actives

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des statistiques de marge: ${error.message}`
      );
    }

    let totalRevenue = 0;
    let totalCosts = 0;
    let totalMargin = 0;
    let interventionsWithCosts = 0;

    // Parcourir les interventions et calculer les marges
    (data || []).forEach((intervention: any) => {
      const marginCalc = this.calculateMarginForIntervention(
        intervention.intervention_costs || [],
        intervention.id_inter || intervention.id
      );

      if (marginCalc) {
        totalRevenue += marginCalc.revenue;
        totalCosts += marginCalc.costs;
        totalMargin += marginCalc.margin;
        interventionsWithCosts++;
      }
    });

    // ✅ CORRECTION : Calculer le pourcentage global (pas la moyenne des pourcentages)
    let averageMarginPercentage = 0;
    if (totalRevenue > 0) {
      averageMarginPercentage = (totalMargin / totalRevenue) * 100;
    }

    // Debug : vérifier la cohérence des calculs
    console.log(`[MarginStats] Résumé du calcul pour user ${userId} :`);
    console.log(`  - Nombre d'interventions : ${interventionsWithCosts}`);
    console.log(`  - Revenu total : ${totalRevenue.toFixed(2)}€`);
    console.log(`  - Coûts totaux : ${totalCosts.toFixed(2)}€`);
    console.log(`  - Marge totale : ${totalMargin.toFixed(2)}€`);
    console.log(`  - % marge global : ${averageMarginPercentage.toFixed(2)}%`);

    return {
      average_margin_percentage: Math.round(averageMarginPercentage * 100) / 100,
      total_interventions: interventionsWithCosts,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_costs: Math.round(totalCosts * 100) / 100,
      total_margin: Math.round(totalMargin * 100) / 100,
      period: {
        start_date: startDate || null,
        end_date: endDate || null,
      },
    };
  },

  /**
   * Récupère le classement des gestionnaires par marge totale sur une période
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Classement des gestionnaires trié par marge totale décroissante
   */
  async getMarginRankingByPeriod(
    startDate?: string,
    endDate?: string
  ): Promise<MarginRankingResult> {
    // Normaliser les dates pour correspondre au format attendu par la fonction SQL
    // La fonction SQL attend des timestamps avec heures/minutes/secondes
    // Si la date contient déjà 'T', c'est une ISO string complète, sinon on ajoute l'heure
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (startDate) {
      periodStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
    }

    if (endDate) {
      if (endDate.includes('T')) {
        periodEnd = endDate;
      } else {
        // Pour la fin de période, utiliser le début du jour suivant moins 1 seconde
        // pour être cohérent avec get_admin_dashboard_stats qui utilise date < periodEnd
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        endDateObj.setHours(0, 0, 0, 0);
        endDateObj.setSeconds(endDateObj.getSeconds() - 1);
        periodEnd = endDateObj.toISOString();
      }
    }

    if (!periodStart || !periodEnd) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Appeler la fonction RPC SQL qui calcule les rankings
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_podium_ranking_by_period',
      {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      }
    );

    if (rpcError) {
      throw new Error(`Erreur lors de la récupération du classement: ${rpcError.message}`);
    }

    if (!rpcResult || !rpcResult.rankings || rpcResult.rankings.length === 0) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Récupérer les informations des utilisateurs pour enrichir les résultats
    const userIds = rpcResult.rankings.map((r: any) => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, firstname, lastname, code_gestionnaire, color")
      .in("id", userIds);

    if (usersError) {
      throw new Error(`Erreur lors de la récupération des utilisateurs: ${usersError.message}`);
    }

    // Créer un map pour accéder rapidement aux infos utilisateur
    const usersMap = new Map(
      (users || []).map((u) => [u.id, u])
    );

    // Mapper les résultats SQL avec les informations utilisateur
    const rankings: GestionnaireMarginRanking[] = rpcResult.rankings.map((item: any, index: number) => {
      const user = usersMap.get(item.user_id);
      const fullName = user
        ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.code_gestionnaire || "Utilisateur"
        : "Utilisateur";

      return {
        user_id: item.user_id,
        user_name: fullName,
        user_firstname: user?.lastname || null, // Utiliser lastname car c'est le prénom dans votre système
        user_code: user?.code_gestionnaire || null,
        user_color: user?.color || null,
        total_margin: item.total_margin || 0,
        total_revenue: item.total_revenue || 0,
        total_interventions: item.total_interventions || 0,
        average_margin_percentage: item.average_margin_percentage || 0,
        rank: index + 1, // Les rangs sont déjà triés par la fonction SQL (par marge décroissante)
      };
    });

    return {
      rankings,
      period: {
        start_date: rpcResult.period?.start_date || startDate || null,
        end_date: rpcResult.period?.end_date || endDate || null,
      },
    };
  },

  /**
   * Récupère les statistiques hebdomadaires pour un utilisateur (semaine en cours)
   * @param userId - ID de l'utilisateur
   * @param weekStartDate - Date de début de la semaine (optionnelle, lundi de la semaine en cours par défaut)
   * @returns Statistiques par jour de la semaine (Lundi à Vendredi)
   */
  async getWeeklyStatsByUser(
    userId: string,
    weekStartDate?: string
  ): Promise<WeeklyStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Calculer les dates de la semaine (lundi à vendredi)
    let monday: Date;
    if (weekStartDate) {
      monday = new Date(weekStartDate);
      monday.setHours(0, 0, 0, 0);
    } else {
      // Trouver le lundi de la semaine en cours
      const now = new Date();
      const day = now.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour que lundi = 1
      monday = new Date(now.getFullYear(), now.getMonth(), diff);
      monday.setHours(0, 0, 0, 0);

      console.log(`[WeeklyStats] Date actuelle: ${now.toISOString()}, Jour de la semaine: ${day}, Diff: ${diff}`);
      console.log(`[WeeklyStats] Lundi calculé: ${monday.toISOString()}`);
    }

    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    // Formater les dates pour les requêtes (YYYY-MM-DD)
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const mondayStr = formatDate(monday);
    const tuesdayStr = formatDate(tuesday);
    const wednesdayStr = formatDate(wednesday);
    const thursdayStr = formatDate(thursday);
    const fridayStr = formatDate(friday);
    const saturdayStr = formatDate(saturday); // Pour la fin de vendredi

    // Récupérer les statuts d'intervention nécessaires
    const { data: statuses, error: statusError } = await supabase
      .from("intervention_statuses")
      .select("id, code")
      .in("code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"]);

    if (statusError) {
      throw new Error(`Erreur lors de la récupération des statuts: ${statusError.message}`);
    }

    const statusMap = new Map(statuses?.map((s: any) => [s.code, s.id]) || []);

    // Fonction helper pour initialiser les stats d'un jour
    const initDayStats = (): WeekDayStats => ({
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      total: 0,
    });

    // Initialiser les compteurs
    const devisEnvoye = initDayStats();
    const interEnCours = initDayStats();
    const interFactures = initDayStats();
    const nouveauxArtisans = initDayStats();

    // Récupérer les interventions de l'utilisateur pour la semaine
    const { data: interventions, error: interventionsError } = await supabase
      .from("interventions")
      .select(`
        id,
        date,
        statut_id,
        status:intervention_statuses(code)
      `)
      .eq("assigned_user_id", userId)
      .eq("is_active", true)
      .gte("date", mondayStr)
      .lt("date", saturdayStr); // Jusqu'à la fin de vendredi

    if (interventionsError) {
      throw new Error(`Erreur lors de la récupération des interventions: ${interventionsError.message}`);
    }

    // Debug: vérifier si des interventions ont été trouvées
    console.log(`[WeeklyStats] Période: ${mondayStr} à ${saturdayStr}`);
    console.log(`[WeeklyStats] UserId: ${userId}`);
    console.log(`[WeeklyStats] Interventions trouvées: ${interventions?.length || 0}`);

    // Vérifier toutes les interventions de l'utilisateur (sans filtre de date) pour debug
    const { data: allUserInterventions, count: totalCount } = await supabase
      .from("interventions")
      .select("id, date, assigned_user_id", { count: "exact" })
      .eq("assigned_user_id", userId)
      .eq("is_active", true)
      .limit(10);

    console.log(`[WeeklyStats] Total interventions pour cet utilisateur (sans filtre date): ${totalCount ?? 0}`);
    if (allUserInterventions && allUserInterventions.length > 0) {
      console.log(`[WeeklyStats] Exemples de dates d'interventions:`,
        allUserInterventions.map(i => ({ id: i.id, date: i.date }))
      );
    }

    if (interventions && interventions.length > 0) {
      const firstIntervention = interventions[0] as any;
      console.log(`[WeeklyStats] Exemple d'intervention dans la période:`, {
        date: firstIntervention.date,
        statusCode: firstIntervention.status?.code,
      });
    }

    // Compter les interventions par jour et par statut
    (interventions || []).forEach((intervention: any) => {
      const interventionDate = new Date(intervention.date);
      const dateStr = formatDate(interventionDate);
      const statusCode = intervention.status?.code;

      if (!statusCode) {
        console.log(`[WeeklyStats] Intervention sans statut:`, intervention.id);
        return;
      }

      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";

      if (!dayKey) {
        console.log(`[WeeklyStats] Date hors période: ${dateStr} (attendu: ${mondayStr}-${fridayStr})`);
        return;
      }

      // Compter selon le statut
      if (statusCode === "DEVIS_ENVOYE") {
        devisEnvoye[dayKey]++;
        devisEnvoye.total++;
      } else if (statusCode === "INTER_EN_COURS" || statusCode === "EN_COURS") {
        interEnCours[dayKey]++;
        interEnCours.total++;
      } else if (statusCode === "INTER_TERMINEE" || statusCode === "TERMINE") {
        interFactures[dayKey]++;
        interFactures.total++;
      } else {
        console.log(`[WeeklyStats] Statut non compté: ${statusCode} pour intervention ${intervention.id}`);
      }
    });

    // Récupérer les artisans créés par l'utilisateur pour la semaine
    const { data: artisans, error: artisansError } = await supabase
      .from("artisans")
      .select("id, date_ajout, created_at, gestionnaire_id")
      .eq("gestionnaire_id", userId)
      .eq("is_active", true)
      .gte("date_ajout", mondayStr)
      .lt("date_ajout", saturdayStr);

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    // Compter les artisans par jour
    (artisans || []).forEach((artisan: any) => {
      // Utiliser date_ajout en priorité, sinon created_at
      const artisanDate = artisan.date_ajout
        ? new Date(artisan.date_ajout)
        : artisan.created_at
          ? new Date(artisan.created_at)
          : null;

      if (!artisanDate) return;

      const dateStr = formatDate(artisanDate);
      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";

      if (dayKey) {
        nouveauxArtisans[dayKey]++;
        nouveauxArtisans.total++;
      }
    });

    return {
      devis_envoye: devisEnvoye,
      inter_en_cours: interEnCours,
      inter_factures: interFactures,
      nouveaux_artisans: nouveauxArtisans,
      week_start: monday.toISOString(),
      week_end: friday.toISOString(),
    };
  },

  /**
   * Récupère les statistiques par période pour un utilisateur (semaine, mois ou année)
   * @param userId - ID de l'utilisateur
   * @param period - Type de période ("week", "month", "year")
   * @param startDate - Date de début (optionnelle, période en cours par défaut)
   * @returns Statistiques selon la période choisie
   */
  async getPeriodStatsByUser(
    userId: string,
    period: StatsPeriod,
    startDate?: string
  ): Promise<WeeklyStats | MonthlyStats | YearlyStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (period === "week") {
      return this.getWeeklyStatsByUser(userId, startDate);
    }

    if (period === "month") {
      // Calculer le mois (mois en cours par défaut)
      let monthStart: Date;
      if (startDate) {
        monthStart = new Date(startDate);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
      } else {
        const now = new Date();
        monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
      }

      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
      const monthStartStr = formatDate(monthStart);
      const monthEndStr = formatDate(monthEnd);

      // Calculer les semaines du mois
      const weeks: { start: Date; end: Date }[] = [];
      let currentWeekStart = new Date(monthStart);

      // Trouver le lundi de la première semaine
      const firstDay = currentWeekStart.getDay();
      const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
      currentWeekStart.setDate(currentWeekStart.getDate() + diffToMonday);

      while (currentWeekStart <= monthEnd) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 4); // Vendredi

        if (currentWeekStart <= monthEnd) {
          weeks.push({
            start: new Date(currentWeekStart),
            end: weekEnd <= monthEnd ? weekEnd : monthEnd,
          });
        }

        currentWeekStart.setDate(currentWeekStart.getDate() + 7); // Semaine suivante
      }

      // Initialiser les stats par semaine
      const initWeekStats = (): MonthWeekStats => ({
        semaine1: 0,
        semaine2: 0,
        semaine3: 0,
        semaine4: 0,
        semaine5: 0,
        total: 0,
      });

      const devisEnvoye = initWeekStats();
      const interEnCours = initWeekStats();
      const interFactures = initWeekStats();
      const nouveauxArtisans = initWeekStats();

      // Récupérer les interventions du mois
      const { data: interventions, error: interventionsError } = await supabase
        .from("interventions")
        .select(`
          id,
          date,
          statut_id,
          status:intervention_statuses(code)
        `)
        .eq("assigned_user_id", userId)
        .eq("is_active", true)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr);

      if (interventionsError) {
        throw new Error(`Erreur lors de la récupération des interventions: ${interventionsError.message}`);
      }

      // Compter par semaine
      (interventions || []).forEach((intervention: any) => {
        const interventionDate = new Date(intervention.date);
        const statusCode = intervention.status?.code;
        if (!statusCode) return;

        // Trouver dans quelle semaine tombe cette intervention
        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (interventionDate >= week.start && interventionDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;

            if (statusCode === "DEVIS_ENVOYE") {
              devisEnvoye[weekKey]++;
              devisEnvoye.total++;
            } else if (statusCode === "INTER_EN_COURS" || statusCode === "EN_COURS") {
              interEnCours[weekKey]++;
              interEnCours.total++;
            } else if (statusCode === "INTER_TERMINEE" || statusCode === "TERMINE") {
              interFactures[weekKey]++;
              interFactures.total++;
            }
            break;
          }
        }
      });

      // Récupérer les artisans du mois
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, date_ajout, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("date_ajout", monthStartStr)
        .lte("date_ajout", monthEndStr);

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par semaine
      (artisans || []).forEach((artisan: any) => {
        const artisanDate = artisan.date_ajout
          ? new Date(artisan.date_ajout)
          : artisan.created_at
            ? new Date(artisan.created_at)
            : null;

        if (!artisanDate) return;

        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (artisanDate >= week.start && artisanDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;
            nouveauxArtisans[weekKey]++;
            nouveauxArtisans.total++;
            break;
          }
        }
      });

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        month_start: monthStart.toISOString(),
        month_end: monthEnd.toISOString(),
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
      };
    }

    if (period === "year") {
      // Calculer l'année (année en cours par défaut)
      let yearStart: Date;
      if (startDate) {
        yearStart = new Date(startDate);
        yearStart.setMonth(0, 1);
        yearStart.setHours(0, 0, 0, 0);
      } else {
        const now = new Date();
        yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
      }

      const yearEnd = new Date(yearStart.getFullYear(), 11, 31, 23, 59, 59);
      const yearStartStr = formatDate(yearStart);
      const yearEndStr = formatDate(yearEnd);

      // Initialiser les stats par mois
      const initMonthStats = (): YearMonthStats => ({
        janvier: 0,
        fevrier: 0,
        mars: 0,
        avril: 0,
        mai: 0,
        juin: 0,
        juillet: 0,
        aout: 0,
        septembre: 0,
        octobre: 0,
        novembre: 0,
        decembre: 0,
        total: 0,
      });

      const devisEnvoye = initMonthStats();
      const interEnCours = initMonthStats();
      const interFactures = initMonthStats();
      const nouveauxArtisans = initMonthStats();

      const monthNames: (keyof YearMonthStats)[] = [
        "janvier", "fevrier", "mars", "avril", "mai", "juin",
        "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
      ];

      // Récupérer les interventions de l'année
      const { data: interventions, error: interventionsError } = await supabase
        .from("interventions")
        .select(`
          id,
          date,
          statut_id,
          status:intervention_statuses(code)
        `)
        .eq("assigned_user_id", userId)
        .eq("is_active", true)
        .gte("date", yearStartStr)
        .lte("date", yearEndStr);

      if (interventionsError) {
        throw new Error(`Erreur lors de la récupération des interventions: ${interventionsError.message}`);
      }

      // Compter par mois
      (interventions || []).forEach((intervention: any) => {
        const interventionDate = new Date(intervention.date);
        const monthIndex = interventionDate.getMonth();
        const monthKey = monthNames[monthIndex];
        const statusCode = intervention.status?.code;
        if (!statusCode || !monthKey) return;

        if (statusCode === "DEVIS_ENVOYE") {
          devisEnvoye[monthKey]++;
          devisEnvoye.total++;
        } else if (statusCode === "INTER_EN_COURS" || statusCode === "EN_COURS") {
          interEnCours[monthKey]++;
          interEnCours.total++;
        } else if (statusCode === "INTER_TERMINEE" || statusCode === "TERMINE") {
          interFactures[monthKey]++;
          interFactures.total++;
        }
      });

      // Récupérer les artisans de l'année
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, date_ajout, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("date_ajout", yearStartStr)
        .lte("date_ajout", yearEndStr);

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par mois
      (artisans || []).forEach((artisan: any) => {
        const artisanDate = artisan.date_ajout
          ? new Date(artisan.date_ajout)
          : artisan.created_at
            ? new Date(artisan.created_at)
            : null;

        if (!artisanDate) return;

        const monthIndex = artisanDate.getMonth();
        const monthKey = monthNames[monthIndex];
        if (monthKey) {
          nouveauxArtisans[monthKey]++;
          nouveauxArtisans.total++;
        }
      });

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        year_start: yearStart.toISOString(),
        year_end: yearEnd.toISOString(),
        year: yearStart.getFullYear(),
      };
    }

    throw new Error(`Période non supportée: ${period}`);
  },

  /**
   * Récupère les interventions récentes pour un utilisateur, triées par due_date
   * @param userId - ID de l'utilisateur
   * @param limit - Nombre d'interventions à récupérer (défaut: 10)
   * @param startDate - Date de début (optionnelle)
   * @param endDate - Date de fin (optionnelle)
   * @returns Liste des interventions avec leurs informations de base et coûts
   */
  async getRecentInterventionsByUser(
    userId: string,
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: string;
    id_inter: string | null;
    due_date: string | null;
    date_prevue: string | null;
    date: string;
    status: { label: string; code: string } | null;
    adresse: string | null;
    ville: string | null;
    costs: {
      sst?: number;
      materiel?: number;
      intervention?: number;
      marge?: number;
    };
  }>> {
    if (!userId) {
      throw new Error("userId is required");
    }

    let query = supabase
      .from("interventions")
      .select(
        `
        id,
        id_inter,
        due_date,
        date_prevue,
        date,
        adresse,
        ville,
        status:intervention_statuses(id, code, label),
        intervention_costs (
          cost_type,
          amount
        )
        `
      )
      .eq("assigned_user_id", userId)
      .eq("is_active", true);

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // Trier par due_date (nulls en dernier), puis par date
    query = query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("date", { ascending: true })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des interventions récentes: ${error.message}`);
    }

    return (data || []).map((item: any) => {
      // Grouper les coûts par type
      const costs: { sst?: number; materiel?: number; intervention?: number; marge?: number } = {};
      if (item.intervention_costs && Array.isArray(item.intervention_costs)) {
        item.intervention_costs.forEach((cost: any) => {
          const costType = cost.cost_type as "sst" | "materiel" | "intervention" | "marge";
          if (costType && cost.amount !== null && cost.amount !== undefined) {
            if (costs[costType] === undefined) {
              costs[costType] = 0;
            }
            costs[costType] = (costs[costType] || 0) + Number(cost.amount);
          }
        });
      }

      return {
        id: item.id,
        id_inter: item.id_inter,
        due_date: item.due_date,
        date_prevue: item.date_prevue,
        date: item.date,
        status: item.status ? { label: item.status.label, code: item.status.code } : null,
        adresse: item.adresse,
        ville: item.ville,
        costs,
      };
    });
  },

  /**
   * Récupère les 5 dernières interventions par statut pour un utilisateur, triées par due_date
   * @param userId - ID de l'utilisateur
   * @param statusLabel - Label du statut (ex: "Demandé", "Inter en cours", "Accepté", "Check")
   * @param limit - Nombre d'interventions à récupérer (défaut: 5)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des interventions avec leurs informations de base, statut, agence et marge
   */
  async getRecentInterventionsByStatusAndUser(
    userId: string,
    statusLabel: string,
    limit: number = 5,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: string;
    id_inter: string | null;
    due_date: string | null;
    status_label: string | null;
    status_color: string | null;
    agence_label: string | null;
    metier_label: string | null;
    metier_code: string | null;
    marge: number;
  }>> {
    if (!userId) {
      throw new Error("userId is required");
    }
    if (!statusLabel) {
      throw new Error("statusLabel is required");
    }

    // Gérer le cas spécial "Check" qui n'est pas un statut réel dans la DB
    const isCheckStatus = statusLabel === "Check";

    let query = supabase
      .from("interventions")
      .select(
        `
        id,
        id_inter,
        due_date,
        date_prevue,
        date,
        agence_id,
        metier_id,
        status:intervention_statuses(id, code, label, color),
        agence:agencies(id, label, code),
        metier:metiers(id, label, code),
        intervention_costs (
          cost_type,
          amount
        )
        `
      )
      .eq("assigned_user_id", userId)
      .eq("is_active", true);

    // Pour "Check", on filtre par date_prevue (interventions avec date_prevue passée)
    if (isCheckStatus) {
      const now = new Date().toISOString();
      query = query.not("date_prevue", "is", null).lt("date_prevue", now);
    } else {
      // Pour les autres statuts, filtrer par le label du statut
      // On doit d'abord trouver le statut_id correspondant au label
      // Pour cela, on va filtrer via la relation status
      // Note: Supabase ne permet pas de filtrer directement sur status.label dans une relation
      // On va donc récupérer toutes les interventions et filtrer côté client
    }

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // Trier par due_date (nulls en dernier)
    query = query
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("date", { ascending: false })
      .limit(100); // Récupérer plus pour filtrer côté client si nécessaire

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des interventions: ${error.message}`);
    }

    // Filtrer et mapper les interventions
    const filtered = (data || [])
      .filter((item: any) => {
        if (isCheckStatus) {
          // Pour Check, on a déjà filtré par date_prevue, mais on doit aussi vérifier le statut
          // Check s'applique à certaines interventions selon leur statut et date_prevue
          // Pour simplifier, on accepte toutes les interventions avec date_prevue passée
          return true;
        } else {
          // Filtrer par label du statut
          const status = item.status;
          return status && status.label === statusLabel;
        }
      })
      .map((item: any) => {
        // Calculer la marge (somme des coûts de type 'marge')
        let marge = 0;
        if (item.intervention_costs && Array.isArray(item.intervention_costs)) {
          item.intervention_costs.forEach((cost: any) => {
            if (cost.cost_type === "marge" && cost.amount !== null && cost.amount !== undefined) {
              marge += Number(cost.amount);
            }
          });
        }

        // Extraire le statut
        const status = item.status;
        const status_label = isCheckStatus ? "Check" : (status?.label || null);
        const status_color = isCheckStatus ? "#EF4444" : (status?.color || null);

        // Extraire l'agence
        const agence = item.agence;
        const agence_label = agence?.label || null;

        // Extraire le métier
        const metier = item.metier;
        const metier_label = metier?.label || null;
        const metier_code = metier?.code || null;

        return {
          id: item.id,
          id_inter: item.id_inter,
          due_date: item.due_date,
          status_label,
          status_color,
          agence_label,
          metier_label,
          metier_code,
          marge,
        };
      })
      .sort((a, b) => {
        // Trier par due_date (nulls en dernier)
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      })
      .slice(0, limit);

    return filtered;
  },

  // ========================================
  // DASHBOARD ADMINISTRATEUR
  // ========================================

  /**
   * Récupère toutes les statistiques du dashboard administrateur
   * OPTIMISATION: Utilise une fonction SQL RPC unique pour réduire de 12-13 requêtes à 1 seule
   */
  async getAdminDashboardStats(
    params: DashboardPeriodParams
  ): Promise<AdminDashboardStats> {
    const { periodType, referenceDate, startDate, endDate, agenceId, gestionnaireId, metierId } = params;

    // Calculer les dates de période
    let periodStart: string;
    let periodEnd: string;

    if (startDate && endDate) {
      periodStart = startDate;
      periodEnd = endDate;
    } else {
      const refDate = referenceDate ? new Date(referenceDate) : new Date();
      const dates = this.calculatePeriodDates(periodType, refDate, startDate, endDate);
      periodStart = dates.start;
      periodEnd = dates.end;
    }

    const periodStartTimestamp = `${periodStart}T00:00:00`;
    const periodEndTimestamp = `${periodEnd}T23:59:59`;

    // Log: Paramètres de la requête
    console.log('\n📊 ========================================');
    console.log('📊 DASHBOARD ADMIN - Récupération des statistiques');
    console.log('📊 ========================================');
    console.log(`📅 Période: ${periodType}`);
    console.log(`📅 Date début: ${periodStart}`);
    console.log(`📅 Date fin: ${periodEnd}`);
    if (agenceId) console.log(`🏢 Agence: ${agenceId}`);
    if (gestionnaireId) console.log(`👤 Gestionnaire: ${gestionnaireId}`);
    if (metierId) console.log(`🔧 Métier: ${metierId}`);

    // Définir les codes de statut directement (plus besoin de chercher les IDs)
    const demandeStatusCode = 'DEMANDE';
    const devisEnvoyeStatusCode = 'DEVIS_ENVOYE';
    const accepteStatusCode = 'ACCEPTE';
    const enCoursStatusCode = 'INTER_EN_COURS';
    const termineeStatusCode = 'INTER_TERMINEE';
    const attAcompteStatusCode = 'ATT_ACOMPTE';

    const statusCodesValides = [
      devisEnvoyeStatusCode,
      accepteStatusCode,
      enCoursStatusCode,
      termineeStatusCode,
      attAcompteStatusCode
    ].filter(Boolean) as string[];

    // Log: Opération en cours
    console.log('\n🔍 Opération: Appel de la fonction RPC get_admin_dashboard_stats...');

    // Appeler la fonction RPC unique qui fait tout en une seule requête SQL
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_admin_dashboard_stats',
      {
        p_period_start: periodStartTimestamp,
        p_period_end: periodEndTimestamp,
        p_demande_status_code: demandeStatusCode,
        p_devis_status_code: devisEnvoyeStatusCode,
        p_accepte_status_code: accepteStatusCode,
        p_en_cours_status_code: enCoursStatusCode,
        p_terminee_status_code: termineeStatusCode,
        p_att_acompte_status_code: attAcompteStatusCode,
        p_valid_status_codes: statusCodesValides,
        p_agence_id: agenceId || null,
        p_gestionnaire_id: gestionnaireId || null,
        p_metier_id: metierId || null,
      }
    );

    if (rpcError) {
      console.error('\n❌ ========================================');
      console.error('❌ ERREUR lors de l\'appel RPC');
      console.error('❌ ========================================');
      console.error('❌ Fonction:', 'get_admin_dashboard_stats');
      console.error('❌ Erreur:', rpcError);
      throw rpcError;
    }

    if (!rpcResult) {
      console.error('\n❌ Aucune donnée retournée par la fonction RPC');
      throw new Error('Aucune donnée retournée par la fonction RPC');
    }

    console.log('✅ RPC exécuté avec succès');

    // Parser le résultat JSON de la fonction SQL
    const mainStatsData = rpcResult.mainStats || {};
    const sparklines = rpcResult.sparklines || [];
    const statusBreakdown = rpcResult.statusBreakdown || [];
    const metierBreakdown = rpcResult.metierBreakdown || [];
    // Support both naming conventions just in case
    const rawAgencyStats = rpcResult.agencyStats || rpcResult.agencyBreakdown || [];
    const rawGestionnaireStats = rpcResult.gestionnaireStats || rpcResult.gestionnaireBreakdown || [];
    const globalFinancials = rpcResult.globalFinancials || {};

    // DEBUG: Données brutes reçues
    console.log('\n🏢 ========================================');
    console.log('🏢 DEBUG: Données brutes reçues');
    console.log('🏢 ========================================');
    console.log('📊 rawAgencyStats:', JSON.stringify(rawAgencyStats, null, 2));
    console.log('👤 rawGestionnaireStats:', JSON.stringify(rawGestionnaireStats, null, 2));
    console.log('📊 rawAgencyStats.length:', rawAgencyStats?.length || 0);
    console.log('👤 rawGestionnaireStats.length:', rawGestionnaireStats?.length || 0);

    // Calculer les taux (côté client car ils nécessitent des calculs)
    // Taux de transformation = (Interventions terminées / Interventions demandées) × 100
    const nbDemandees = mainStatsData.nbInterventionsDemandees || 0;
    const nbTerminees = mainStatsData.nbInterventionsTerminees || 0;
    const tauxTransformation = nbDemandees > 0
      ? Math.round((nbTerminees / nbDemandees) * 1000) / 10
      : 0;

    const totalPaiements = Number(mainStatsData.chiffreAffaires || 0);
    const totalCouts = Number(mainStatsData.couts || 0);
    const tauxMarge = totalPaiements > 0
      ? Math.round(((totalPaiements - totalCouts) / totalPaiements) * 100)
      : 0;

    // Log: KPIs principaux
    console.log('\n📈 ========================================');
    console.log('📈 KPIs PRINCIPAUX');
    console.log('📈 ========================================');
    console.log(`📥 Interventions demandées: ${mainStatsData.nbInterventionsDemandees || 0}`);
    console.log(`✅ Interventions terminées: ${mainStatsData.nbInterventionsTerminees || 0}`);
    console.log(`📊 Taux de transformation: ${tauxTransformation.toFixed(2)}%`);
    console.log(`💰 Taux de marge: ${tauxMarge.toFixed(2)}%`);
    console.log(`💵 Chiffre d'affaires total: ${totalPaiements.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
    console.log(`💸 Coûts totaux: ${totalCouts.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
    console.log(`💎 Marge nette: ${(totalPaiements - totalCouts).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);

    // Construire mainStats
    // Utiliser le chiffre d'affaires depuis mainStatsData si disponible, sinon depuis globalFinancials
    const chiffreAffaires = mainStatsData.chiffreAffaires !== undefined
      ? Number(mainStatsData.chiffreAffaires || 0)
      : totalPaiements;

    const mainStats = {
      nbInterventionsDemandees: mainStatsData.nbInterventionsDemandees || 0,
      nbInterventionsTerminees: mainStatsData.nbInterventionsTerminees || 0,
      nbDevis: mainStatsData.nbDevis || 0,
      nbValides: mainStatsData.nbValides || 0,
      tauxTransformation,
      chiffreAffaires,
      tauxMarge,
      couts: totalCouts,
      marge: totalPaiements - totalCouts,
      avgCycleTime: mainStatsData.avgCycleTime || 0,
      deltaInterventions: mainStatsData.deltaInterventions || 0,
      deltaChiffreAffaires: mainStatsData.deltaChiffreAffaires || 0,
      deltaMarge: mainStatsData.deltaMarge || 0,
    };

    // Récupérer le cache de référence pour mapper les codes aux labels
    console.log('\n🔍 Opération: Récupération du cache de référence...');
    const refs = await getReferenceCache();

    // Récupérer les statuts pour mapper les codes aux labels
    const { data: statuses } = await supabase
      .from('intervention_statuses')
      .select('id, code, label');

    const statusMapByCode = new Map(statuses?.map((s: any) => [s.code, s]) || []);

    // ========================================
    // 2. STATISTIQUES DES STATUTS
    // ========================================
    console.log('\n🔍 Opération: Calcul des statistiques par statut...');

    const statusCounts: Record<string, { label: string; count: number }> = {};

    statusBreakdown.forEach((item: any) => {
      if (item.statut_code) {
        const code = item.statut_code;
        const statusInfo = statusMapByCode.get(code);
        if (!statusCounts[code]) {
          statusCounts[code] = {
            label: statusInfo?.label || code,
            count: 0
          };
        }
        statusCounts[code].count = item.count || 0;
      }
    });

    const breakdown = Object.entries(statusCounts).map(([code, data]) => ({
      statusCode: code,
      statusLabel: data.label,
      count: data.count,
    }));

    const statusStats = {
      nbDemandesRecues: mainStats.nbInterventionsDemandees,
      nbDevisEnvoye: statusCounts['DEVIS_ENVOYE']?.count || 0,
      nbEnCours: statusCounts['INTER_EN_COURS']?.count || 0,
      nbAttAcompte: statusCounts['ATT_ACOMPTE']?.count || 0,
      nbAccepte: statusCounts['ACCEPTE']?.count || 0,
      nbTermine: statusCounts['INTER_TERMINEE']?.count || 0,
      breakdown,
    };

    // Log: Statistiques par statut
    console.log('\n📋 ========================================');
    console.log('📋 STATISTIQUES PAR STATUT');
    console.log('📋 ========================================');
    console.log(`📥 Demandes reçues: ${statusStats.nbDemandesRecues}`);
    console.log(`📄 Devis envoyés: ${statusStats.nbDevisEnvoye}`);
    console.log(`🔄 En cours: ${statusStats.nbEnCours}`);
    console.log(`⏳ Attente acompte: ${statusStats.nbAttAcompte}`);
    console.log(`✅ Acceptées: ${statusStats.nbAccepte}`);
    console.log(`🏁 Terminées: ${statusStats.nbTermine}`);

    // ========================================
    // 3. STATISTIQUES PAR MÉTIER
    // ========================================
    console.log('\n🔍 Opération: Calcul des statistiques par métier...');

    const metierCounts: Record<string, { label: string; count: number }> = {};
    let totalMetiers = 0;

    metierBreakdown.forEach((item: any) => {
      if (item.metier_id) {
        const metierInfo = refs.metiersById.get(item.metier_id);
        metierCounts[item.metier_id] = {
          label: metierInfo?.label || 'Inconnu',
          count: item.count || 0
        };
        totalMetiers += item.count || 0;
      }
    });

    const metierStats = Object.entries(metierCounts).map(([metierId, data]) => ({
      metierId,
      metierLabel: data.label,
      count: data.count,
      percentage: totalMetiers > 0 ? Math.round((data.count / totalMetiers) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // Log: Statistiques par métier (top 5)
    console.log('\n🔧 ========================================');
    console.log('🔧 STATISTIQUES PAR MÉTIER (Top 5)');
    console.log('🔧 ========================================');
    metierStats.slice(0, 5).forEach((metier, index) => {
      console.log(`${index + 1}. ${metier.metierLabel}: ${metier.count} interventions (${metier.percentage.toFixed(1)}%)`);
    });
    if (metierStats.length > 5) {
      console.log(`... et ${metierStats.length - 5} autre(s) métier(s)`);
    }

    // ========================================
    // 4. STATISTIQUES PAR AGENCE
    // ========================================
    console.log('\n🔍 Opération: Calcul des statistiques par agence...');

    const agencyStats = rawAgencyStats.map((item: any) => {
      const agencyInfo = refs.agenciesById.get(item.agence_id);
      const totalPaiements = Number(item.totalPaiements || 0);
      const totalCouts = Number(item.totalCouts || 0);
      const marge = totalPaiements - totalCouts;
      const tauxMargeAgence = totalPaiements > 0
        ? Math.round((marge / totalPaiements) * 100)
        : 0;

      return {
        agencyId: item.agence_id,
        agencyLabel: agencyInfo?.label || 'Inconnu',
        nbTotalInterventions: item.totalInterventions || 0,
        nbInterventionsTerminees: item.terminatedInterventions || 0,
        tauxMarge: tauxMargeAgence,
        ca: totalPaiements,
        couts: totalCouts,
        marge,
      };
    }).sort((a: any, b: any) => b.ca - a.ca);

    // DEBUG: agencyStats après mapping
    console.log('\n✅ agencyStats mappées:', agencyStats.length);
    if (agencyStats.length > 0) {
      console.log('📋 Premier élément:', JSON.stringify(agencyStats[0], null, 2));
    }

    // Log: Statistiques par agence (top 5)
    console.log('\n🏢 ========================================');
    console.log('🏢 STATISTIQUES PAR AGENCE (Top 5)');
    console.log('🏢 ========================================');
    agencyStats.slice(0, 5).forEach((agency: typeof agencyStats[0], index: number) => {
      console.log(`${index + 1}. ${agency.agencyLabel}:`);
      console.log(`   - Interventions: ${agency.nbTotalInterventions} totales, ${agency.nbInterventionsTerminees} terminées`);
      console.log(`   - CA: ${agency.ca.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
      console.log(`   - Marge: ${agency.marge.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} (${agency.tauxMarge.toFixed(2)}%)`);
    });
    if (agencyStats.length > 5) {
      console.log(`... et ${agencyStats.length - 5} autre(s) agence(s)`);
    }

    // ========================================
    // 5. STATISTIQUES PAR GESTIONNAIRE
    // ========================================
    console.log('\n🔍 Opération: Calcul des statistiques par gestionnaire...');

    const gestionnaireStats = rawGestionnaireStats.map((item: any) => {
      const gestionnaireInfo = refs.usersById.get(item.gestionnaire_id);
      const totalPaiements = Number(item.totalPaiements || 0);
      const totalCouts = Number(item.totalCouts || 0);
      const marge = totalPaiements - totalCouts;
      const tauxMargeGestionnaire = totalPaiements > 0
        ? Math.round((marge / totalPaiements) * 100)
        : 0;

      // Taux de transformation = (Interventions terminées / Interventions prises) × 100
      const nbInterventionsPrises = item.totalInterventions || 0;
      const nbInterventionsTerminees = item.terminatedInterventions || 0;
      const tauxTransformationGestionnaire = nbInterventionsPrises > 0
        ? Math.round((nbInterventionsTerminees / nbInterventionsPrises) * 100)
        : 0;

      // Construire le label du gestionnaire
      const gestionnaireLabel = gestionnaireInfo
        ? `${gestionnaireInfo.firstname || ''} ${gestionnaireInfo.lastname || ''}`.trim() || gestionnaireInfo.code_gestionnaire || 'Inconnu'
        : 'Inconnu';

      return {
        gestionnaireId: item.gestionnaire_id,
        gestionnaireLabel,
        nbInterventionsPrises,
        nbInterventionsTerminees,
        tauxTransformation: tauxTransformationGestionnaire,
        tauxMarge: tauxMargeGestionnaire,
        ca: totalPaiements,
        couts: totalCouts,
        marge,
      };
    }).sort((a: any, b: any) => b.ca - a.ca);

    // DEBUG: gestionnaireStats après mapping
    console.log('\n✅ gestionnaireStats mappées:', gestionnaireStats.length);
    if (gestionnaireStats.length > 0) {
      console.log('📋 Premier élément:', JSON.stringify(gestionnaireStats[0], null, 2));
    }

    // Log: Statistiques par gestionnaire (top 5)
    console.log('\n👤 ========================================');
    console.log('👤 STATISTIQUES PAR GESTIONNAIRE (Top 5)');
    console.log('👤 ========================================');
    gestionnaireStats.slice(0, 5).forEach((gestionnaire: typeof gestionnaireStats[0], index: number) => {
      console.log(`${index + 1}. ${gestionnaire.gestionnaireLabel}:`);
      console.log(`   - Interventions: ${gestionnaire.nbInterventionsPrises} prises, ${gestionnaire.nbInterventionsTerminees} terminées`);
      console.log(`   - Taux transformation: ${gestionnaire.tauxTransformation.toFixed(2)}%`);
      console.log(`   - CA: ${gestionnaire.ca.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
      console.log(`   - Marge: ${gestionnaire.marge.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} (${gestionnaire.tauxMarge.toFixed(2)}%)`);
    });
    if (gestionnaireStats.length > 5) {
      console.log(`... et ${gestionnaireStats.length - 5} autre(s) gestionnaire(s)`);
    }

    console.log('✅ ========================================\n');

    return {
      mainStats,
      sparklines,
      statusBreakdown: breakdown,
      metierBreakdown: metierStats,
      agencyStats,
      gestionnaireStats,
    };
  },

  /**
   * Récupère l'historique des transitions de statut pour une intervention
   */
  async getStatusTransitions(
    interventionId: string
  ): Promise<InterventionStatusTransition[]> {
    const { data, error } = await supabase
      .from('intervention_status_transitions')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('transition_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère l'historique du chiffre d'affaires pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getRevenueHistory(
    params: RevenueHistoryParams
  ): Promise<RevenueHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceId,
      gestionnaireId,
      metierId,
      includeProjection = true,
    } = params;

    // Calculer les 4 dernières périodes basées sur periodType
    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    // Récupérer les données pour chaque période
    const historical: RevenueHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceId,
          gestionnaireId,
          metierId,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          revenue: stats.mainStats.chiffreAffaires,
          isProjection: false,
        };
      })
    );

    // Calculer la projection
    let projection: RevenueHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = this.calculateNextPeriod(periodType, startDate, endDate);
      const projectedRevenue = RevenueProjectionService.calculateProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        revenue: projectedRevenue,
        isProjection: true,
      };
    }

    // Période actuelle (dernière période historique)
    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        revenue: 0,
        isProjection: false,
      } as RevenueHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Calcule les 4 dernières périodes selon le type
   */
  calculateLast4Periods(
    periodType: PeriodType,
    startDate?: string,
    endDate?: string
  ): Array<{ key: string; label: string; start: string; end: string }> {
    const periods: Array<{ key: string; label: string; start: string; end: string }> = [];
    const now = new Date();

    // Si des dates sont fournies, utiliser la dernière comme référence
    const referenceDate = endDate ? new Date(endDate) : now;

    for (let i = 3; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let key: string;
      let label: string;

      switch (periodType) {
        case "month": {
          periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
          periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
          periodEnd.setHours(23, 59, 59, 999);
          key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
          label = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          // Capitaliser la première lettre
          label = label.charAt(0).toUpperCase() + label.slice(1);
          break;
        }

        case "week": {
          // Calculer le lundi de la semaine
          const day = referenceDate.getDay();
          const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1) - i * 7;
          periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 4);
          periodEnd.setHours(23, 59, 59, 999);
          const weekNumber = this.getWeekNumber(periodStart);
          key = `W${weekNumber}-${periodStart.getFullYear()}`;
          label = `Semaine ${weekNumber}`;
          break;
        }

        case "day": {
          periodStart = new Date(referenceDate);
          periodStart.setDate(periodStart.getDate() - i);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setHours(23, 59, 59, 999);
          key = periodStart.toISOString().split("T")[0];
          label = periodStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          break;
        }

        case "year": {
          periodStart = new Date(referenceDate.getFullYear() - i, 0, 1);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart.getFullYear(), 11, 31);
          periodEnd.setHours(23, 59, 59, 999);
          key = String(periodStart.getFullYear());
          label = String(periodStart.getFullYear());
          break;
        }

        default:
          throw new Error(`Invalid period type: ${periodType}`);
      }

      periods.push({
        key,
        label,
        start: periodStart.toISOString().split("T")[0],
        end: periodEnd.toISOString().split("T")[0],
      });
    }

    return periods;
  },

  /**
   * Calcule la période suivante pour la projection
   */
  calculateNextPeriod(
    periodType: PeriodType,
    startDate?: string,
    endDate?: string
  ): { key: string; label: string; start: string; end: string } {
    const now = new Date();
    const referenceDate = endDate ? new Date(endDate) : now;

    let periodStart: Date;
    let periodEnd: Date;
    let key: string;
    let label: string;

    switch (periodType) {
      case "month": {
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
        key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
        label = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        label = label.charAt(0).toUpperCase() + label.slice(1);
        break;
      }

      case "week": {
        const day = referenceDate.getDay();
        const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1) + 7;
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 4);
        periodEnd.setHours(23, 59, 59, 999);
        const weekNumber = this.getWeekNumber(periodStart);
        key = `W${weekNumber}-${periodStart.getFullYear()}`;
        label = `Semaine ${weekNumber}`;
        break;
      }

      case "day": {
        periodStart = new Date(referenceDate);
        periodStart.setDate(periodStart.getDate() + 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setHours(23, 59, 59, 999);
        key = periodStart.toISOString().split("T")[0];
        label = periodStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        break;
      }

      case "year": {
        periodStart = new Date(referenceDate.getFullYear() + 1, 0, 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart.getFullYear(), 11, 31);
        periodEnd.setHours(23, 59, 59, 999);
        key = String(periodStart.getFullYear());
        label = String(periodStart.getFullYear());
        break;
      }

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }

    return {
      key,
      label,
      start: periodStart.toISOString().split("T")[0],
      end: periodEnd.toISOString().split("T")[0],
    };
  },

  /**
   * Calcule le numéro de semaine ISO
   */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  },

  /**
   * Récupère l'historique des interventions pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getInterventionsHistory(
    params: KPIHistoryParams
  ): Promise<InterventionsHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceId,
      gestionnaireId,
      metierId,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: InterventionsHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceId,
          gestionnaireId,
          metierId,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: {
            demandees: stats.mainStats.nbInterventionsDemandees,
            terminees: stats.mainStats.nbInterventionsTerminees,
          },
          isProjection: false,
        };
      })
    );

    let projection: InterventionsHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = this.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValues = RevenueProjectionService.calculateInterventionsProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValues,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: { demandees: 0, terminees: 0 },
        isProjection: false,
      } as InterventionsHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique du taux de transformation pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getTransformationRateHistory(
    params: KPIHistoryParams
  ): Promise<TransformationRateHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceId,
      gestionnaireId,
      metierId,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: TransformationRateHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceId,
          gestionnaireId,
          metierId,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: {
            demandees: stats.mainStats.nbInterventionsDemandees,
            terminees: stats.mainStats.nbInterventionsTerminees,
          },
          isProjection: false,
        };
      })
    );

    let projection: TransformationRateHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = this.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValues = RevenueProjectionService.calculateTransformationRateProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValues,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: { demandees: 0, terminees: 0 },
        isProjection: false,
      } as TransformationRateHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique du cycle moyen pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getCycleTimeHistory(
    params: KPIHistoryParams
  ): Promise<CycleTimeHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceId,
      gestionnaireId,
      metierId,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: CycleTimeHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceId,
          gestionnaireId,
          metierId,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: stats.mainStats.avgCycleTime,
          isProjection: false,
        };
      })
    );

    let projection: CycleTimeHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = this.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValue = RevenueProjectionService.calculateCycleTimeProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValue,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: 0,
        isProjection: false,
      } as CycleTimeHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique de la marge pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getMarginHistory(
    params: KPIHistoryParams
  ): Promise<MarginHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceId,
      gestionnaireId,
      metierId,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: MarginHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceId,
          gestionnaireId,
          metierId,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: stats.mainStats.marge,
          isProjection: false,
        };
      })
    );

    let projection: MarginHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = this.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValue = RevenueProjectionService.calculateMarginProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValue,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: 0,
        isProjection: false,
      } as MarginHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Helper pour calculer les dates de période
   */
  calculatePeriodDates(
    periodType: PeriodType,
    referenceDate: Date,
    startDate?: string,
    endDate?: string
  ): { start: string; end: string } {
    // Si des dates spécifiques sont fournies, les utiliser
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const date = new Date(referenceDate);
    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'day':
        start = new Date(date);
        end = new Date(date);
        break;

      case 'week':
        // Semaine du lundi au vendredi
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Lundi
        start = new Date(date.getFullYear(), date.getMonth(), diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 4); // Vendredi
        end.setHours(23, 59, 59, 999);
        break;

      case 'month':
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        break;

      case 'year':
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31);
        break;

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  },
};
