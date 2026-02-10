// ===== API INTERVENTIONS V2 =====
// Gestion complète des interventions

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
  getReferenceCache,
  invalidateReferenceCache as invalidateCentralCache,
} from "./common/utils";
import type { InterventionWithStatus, InterventionStatus } from "@/types/intervention";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";
import type { InterventionStatusKey } from "@/config/interventions";

/**
 * Crée un client Supabase admin pour Node.js avec les bonnes credentials
 * Utilise la service role key pour contourner les RLS lors des imports
 */
function getSupabaseClientForNode() {
  // Si on est dans le navigateur, utiliser le client standard
  if (typeof window !== 'undefined') {
    return supabase;
  }

  // Dans Node.js, créer un nouveau client avec les credentials du service role
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[interventionsApi] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants, utilisation du client standard');
    return supabase;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  });
}

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

// Ré-exporter la fonction d'invalidation du cache centralisé pour compatibilité
export const invalidateReferenceCache = invalidateCentralCache;

export const interventionsApi = {
  // Récupérer toutes les interventions (via Edge Function)
  async getAll(params?: InterventionQueryParams): Promise<PaginatedResponse<InterventionWithStatus>> {
    type FilterValue = string | string[] | null | undefined;

    const limit = Math.max(1, params?.limit ?? 100);

    // Convertir les codes métier en IDs si nécessaire
    let metierParam = params?.metier;
    let metiersParam = params?.metiers;

    if (params?.metier || params?.metiers) {
      const refs = await getReferenceCache();

      // Convertir un seul métier (code → ID) - insensible à la casse
      if (params?.metier && typeof params.metier === 'string') {
        const metierObj = Array.from(refs.metiersById.values()).find(
          (m: any) =>
            m.code?.toUpperCase() === params.metier?.toUpperCase() ||
            m.id === params.metier
        );
        metierParam = metierObj?.id || params.metier;
      }

      // Convertir plusieurs métiers (codes → IDs) - insensible à la casse
      if (params?.metiers && params.metiers.length > 0) {
        metiersParam = params.metiers.map((metierCodeOrId) => {
          const metierObj = Array.from(refs.metiersById.values()).find(
            (m: any) =>
              m.code?.toUpperCase() === metierCodeOrId?.toUpperCase() ||
              m.id === metierCodeOrId
          );
          return metierObj?.id || metierCodeOrId;
        });
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
      ? raw.data.map((item: any) => mapInterventionRecord(item, refs) as InterventionWithStatus)
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
      ? raw.data.map((item: any) => mapInterventionRecord(item, refs) as InterventionWithStatus)
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
    // 1. Faire l'INSERT
    const { data: result, error } = await supabase
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
        await supabase
          .from('intervention_status_transitions')
          .delete()
          .eq('intervention_id', result.id)
          .eq('source', 'trigger');

        // Récupérer l'utilisateur actuel
        const { data: { user } } = await supabase.auth.getUser();
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
      const agencyData = match.agences as any;
      const userData = match.users as any;

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

    // Récupérer le statut actuel avant la mise à jour pour la transition
    let oldStatutId: string | null = null;
    let currentIntervention: any = null;

    if (payload.statut_id) {
      const { data } = await supabase
        .from("interventions")
        .select(`
          statut_id,
          status:intervention_statuses(code)
        `)
        .eq("id", id)
        .single();

      currentIntervention = data;
      if (currentIntervention) {
        oldStatutId = currentIntervention.statut_id;
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
        status:intervention_statuses(id,code,label,color,sort_order),
        intervention_artisans(artisan_id)
      `)
      .single();

    if (error) throw error;
    if (!updated) throw new Error("Impossible de mettre à jour l'intervention");

    const refs = await getReferenceCache();
    const mapped = mapInterventionRecord(updated, refs) as InterventionWithStatus;

    // Recalculer le statut des artisans si le statut de l'intervention a changé
    // Le trigger SQL ne fonctionne pas de manière fiable, donc on appelle explicitement la RPC
    console.log(`[interventionsApi] 🔍 Vérification recalcul artisan: payload.statut_id=${payload.statut_id}, oldStatutId=${oldStatutId}`);

    if (payload.statut_id && oldStatutId !== payload.statut_id) {
      const terminatedCodes = ['TERMINE', 'INTER_TERMINEE'];
      const oldStatusCode = oldStatutId ? refs.interventionStatusesById.get(oldStatutId)?.code : null;
      const newStatusCode = refs.interventionStatusesById.get(payload.statut_id)?.code;

      console.log(`[interventionsApi] 🔍 Codes statut: oldStatusCode=${oldStatusCode}, newStatusCode=${newStatusCode}`);

      // Recalculer seulement si on entre ou sort d'un statut terminé
      const wasTerminated = oldStatusCode && terminatedCodes.includes(oldStatusCode);
      const isNowTerminated = newStatusCode && terminatedCodes.includes(newStatusCode);

      console.log(`[interventionsApi] 🔍 Condition terminée: wasTerminated=${wasTerminated}, isNowTerminated=${isNowTerminated}`);

      if (wasTerminated || isNowTerminated) {
        // Récupérer les artisans liés à cette intervention
        const artisanIds = (updated as any).intervention_artisans
          ?.map((ia: { artisan_id: string | null }) => ia.artisan_id)
          .filter((id: string | null): id is string => !!id) || [];

        console.log(`[interventionsApi] 🔍 Artisans liés à recalculer:`, artisanIds);

        // Recalculer le statut de chaque artisan
        for (const artisanId of artisanIds) {
          try {
            console.log(`[interventionsApi] 📞 Appel RPC recalculate_artisan_status pour artisan ${artisanId}...`);
            const { data: rpcResult, error: rpcError } = await supabase.rpc('recalculate_artisan_status', {
              artisan_uuid: artisanId
            });
            if (rpcError) {
              console.warn(`[interventionsApi] ❌ Erreur RPC artisan ${artisanId}:`, rpcError);
            } else {
              console.log(`[interventionsApi] ✅ Statut artisan ${artisanId} recalculé: ${rpcResult}`);
            }
          } catch (err) {
            console.warn(`[interventionsApi] ❌ Exception artisan ${artisanId}:`, err);
          }
        }
      } else {
        console.log(`[interventionsApi] ⏭️ Pas de recalcul: le changement de statut n'implique pas un statut terminé`);
      }
    } else {
      console.log(`[interventionsApi] ⏭️ Pas de recalcul: statut_id non changé ou non fourni`);
    }

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

  async setSecondaryArtisan(interventionId: string, artisanId: string | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    // Récupérer l'artisan secondaire actuel
    const { data: existingSecondary, error: secondaryError } = await supabase
      .from('intervention_artisans')
      .select('id, artisan_id, role')
      .eq('intervention_id', interventionId)
      .eq('is_primary', false)
      .maybeSingle();

    if (secondaryError) {
      throw new Error(`Erreur lors de la récupération de l'artisan secondaire: ${secondaryError.message}`);
    }

    // Aucun artisan sélectionné => supprimer le secondaire courant
    if (!artisanId) {
      if (existingSecondary?.id) {
        const { error: deleteError } = await supabase
          .from('intervention_artisans')
          .delete()
          .eq('id', existingSecondary.id);

        if (deleteError) {
          throw new Error(`Erreur lors de la suppression de l'artisan secondaire: ${deleteError.message}`);
        }
      }
      return;
    }

    // Rien à faire, c'est déjà le bon artisan
    if (existingSecondary?.artisan_id === artisanId) {
      return;
    }

    // Vérifier si l'artisan est déjà lié (peut-être comme primaire)
    const { data: existingLink, error: linkError } = await supabase
      .from('intervention_artisans')
      .select('id, is_primary')
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .maybeSingle();

    if (linkError) {
      throw new Error(`Erreur lors de la récupération de l'artisan: ${linkError.message}`);
    }

    // Si l'artisan est déjà le primaire, ne pas le rétrograder
    if (existingLink?.is_primary) {
      throw new Error("Cet artisan est déjà l'artisan principal. Veuillez d'abord le retirer.");
    }

    // Supprimer l'ancien artisan secondaire s'il existe
    if (existingSecondary?.id) {
      const { error: deleteError } = await supabase
        .from('intervention_artisans')
        .delete()
        .eq('id', existingSecondary.id);

      if (deleteError) {
        throw new Error(`Erreur lors de la suppression de l'ancien artisan secondaire: ${deleteError.message}`);
      }
    }

    // Si un lien existe déjà avec cet artisan (mais pas comme primaire), le mettre à jour
    if (existingLink?.id) {
      const { error: updateError } = await supabase
        .from('intervention_artisans')
        .update({
          role: 'secondary',
          is_primary: false,
        })
        .eq('id', existingLink.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de l'artisan secondaire: ${updateError.message}`);
      }
      return;
    }

    // Insérer le nouvel artisan secondaire
    const { error: insertError } = await supabase
      .from('intervention_artisans')
      .insert({
        intervention_id: interventionId,
        artisan_id: artisanId,
        role: 'secondary',
        is_primary: false,
      });

    if (insertError) {
      throw new Error(`Erreur lors de l'assignation de l'artisan secondaire: ${insertError.message}`);
    }
  },

  /**
   * Créer ou mettre à jour un coût d'intervention
   * Note: Utilise select + update/insert car les index uniques sont partiels
   * Pour plusieurs coûts, préférer upsertCostsBatch() qui est plus optimisé
   * @param interventionId - ID de l'intervention
   * @param cost - Données du coût (type, montant, ordre artisan)
   */
  async upsertCost(interventionId: string, cost: {
    cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
    amount: number;
    artisan_order?: 1 | 2 | null;
    label?: string | null;
  }): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    // Par défaut, tous les coûts sont reliés à l'artisan 1 (sauf intervention/marge qui sont globaux)
    const artisanOrder = cost.artisan_order ?? (cost.cost_type === 'intervention' || cost.cost_type === 'marge' ? null : 1);

    // Chercher un coût existant avec le même type et ordre
    let query = supabase
      .from('intervention_costs')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('cost_type', cost.cost_type);

    if (artisanOrder === null) {
      query = query.is('artisan_order', null);
    } else {
      query = query.eq('artisan_order', artisanOrder);
    }

    const { data: existing, error: selectError } = await query.maybeSingle();

    if (selectError) {
      throw new Error(`Erreur lors de la recherche du coût: ${selectError.message}`);
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('intervention_costs')
        .update({
          amount: cost.amount,
          label: cost.label ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du coût: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('intervention_costs')
        .insert({
          intervention_id: interventionId,
          cost_type: cost.cost_type,
          amount: cost.amount,
          artisan_order: artisanOrder,
          label: cost.label ?? null,
        });

      if (insertError) {
        throw new Error(`Erreur lors de la création du coût: ${insertError.message}`);
      }
    }
  },

  /**
   * Créer ou mettre à jour plusieurs coûts d'intervention en batch (optimisé)
   * Réduit le nombre de requêtes réseau via batch select + batch insert + parallel updates
   * @param interventionId - ID de l'intervention
   * @param costs - Liste des coûts à upsert
   */
  async upsertCostsBatch(interventionId: string, costs: Array<{
    cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
    amount: number;
    artisan_order?: 1 | 2 | null;
    label?: string | null;
  }>): Promise<void> {
    if (!interventionId || costs.length === 0) {
      return;
    }

    // Normaliser les artisan_order
    const normalizedCosts = costs.map(c => ({
      ...c,
      artisan_order: c.artisan_order ?? (c.cost_type === 'intervention' || c.cost_type === 'marge' ? null : 1)
    }));

    // 1. Récupérer tous les coûts existants pour cette intervention en une seule requête
    const { data: existingCosts, error: selectError } = await supabase
      .from('intervention_costs')
      .select('id, cost_type, artisan_order')
      .eq('intervention_id', interventionId);

    if (selectError) {
      throw new Error(`Erreur lors de la recherche des coûts existants: ${selectError.message}`);
    }

    // Créer une map pour retrouver rapidement les coûts existants
    // Clé: "cost_type|artisan_order" (artisan_order peut être null)
    const existingMap = new Map<string, string>();
    for (const e of existingCosts || []) {
      const key = `${e.cost_type}|${e.artisan_order ?? 'null'}`;
      existingMap.set(key, e.id);
    }

    // 2. Séparer en updates et inserts
    const toUpdate: Array<{ id: string; amount: number; label: string | null }> = [];
    const toInsert: Array<{
      intervention_id: string;
      cost_type: string;
      amount: number;
      artisan_order: number | null;
      label: string | null
    }> = [];

    for (const cost of normalizedCosts) {
      const key = `${cost.cost_type}|${cost.artisan_order ?? 'null'}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        toUpdate.push({ id: existingId, amount: cost.amount, label: cost.label ?? null });
      } else {
        toInsert.push({
          intervention_id: interventionId,
          cost_type: cost.cost_type,
          amount: cost.amount,
          artisan_order: cost.artisan_order ?? null,
          label: cost.label ?? null
        });
      }
    }

    // 3. Exécuter les updates en parallèle et l'insert batch simultanément
    const operations: Promise<void>[] = [];

    // Updates parallèles (Supabase ne supporte pas les updates batch avec IDs différents)
    if (toUpdate.length > 0) {
      operations.push(
        Promise.all(toUpdate.map(async ({ id, amount, label }) => {
          const { error } = await supabase
            .from('intervention_costs')
            .update({ amount, label, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) {
            throw new Error(`Erreur lors de la mise à jour du coût: ${error.message}`);
          }
        })).then(() => {})
      );
    }

    // Insert batch
    if (toInsert.length > 0) {
      operations.push(
        (async () => {
          const { error } = await supabase
            .from('intervention_costs')
            .insert(toInsert);
          if (error) {
            throw new Error(`Erreur lors de l'insertion des coûts: ${error.message}`);
          }
        })()
      );
    }

    // Attendre toutes les opérations
    await Promise.all(operations);
  },

  /**
   * Récupérer les coûts d'une intervention
   * @param interventionId - ID de l'intervention
   * @param artisanOrder - Optionnel: filtrer par ordre d'artisan (1, 2 ou null pour global)
   */
  async getCosts(interventionId: string, artisanOrder?: 1 | 2 | null): Promise<any[]> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    let query = supabase
      .from('intervention_costs')
      .select('*')
      .eq('intervention_id', interventionId);

    if (artisanOrder !== undefined) {
      if (artisanOrder === null) {
        query = query.is('artisan_order', null);
      } else {
        query = query.eq('artisan_order', artisanOrder);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des coûts: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Supprimer un coût d'intervention
   * @param interventionId - ID de l'intervention
   * @param costType - Type de coût
   * @param artisanOrder - Ordre de l'artisan
   */
  async deleteCost(interventionId: string, costType: string, artisanOrder?: 1 | 2 | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    let query = supabase
      .from('intervention_costs')
      .delete()
      .eq('intervention_id', interventionId)
      .eq('cost_type', costType);

    if (artisanOrder === null || artisanOrder === undefined) {
      query = query.is('artisan_order', null);
    } else {
      query = query.eq('artisan_order', artisanOrder);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la suppression du coût: ${error.message}`);
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
    role: "primary" | "secondary" = "primary",
    customClient?: any
  ): Promise<any> {
    // Utiliser le client personnalisé si fourni, sinon utiliser supabaseClient (qui utilise getSupabaseClientForNode() dans Node.js)
    const client = customClient || supabaseClient;

    const { data: result, error } = await client
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
      artisan_order?: 1 | 2 | null;
    }
  ): Promise<InterventionCost> {
    // Valider l'UUID de l'intervention
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!interventionId || !uuidRegex.test(interventionId)) {
      throw new Error(`ID d'intervention invalide: ${interventionId}`);
    }

    // Valider le montant
    if (typeof data.amount !== 'number' || isNaN(data.amount)) {
      throw new Error(`Montant invalide: ${data.amount}`);
    }

    // Déterminer artisan_order selon les règles :
    // - Par défaut lors de l'import, tous les coûts sont reliés à l'artisan 1 (artisan principal)
    // - Si artisan_order est explicitement fourni (y compris null), on l'utilise
    const artisanOrder = data.artisan_order !== undefined
      ? data.artisan_order
      : 1;

    // Préparer les données d'insertion
    const insertData = {
      intervention_id: interventionId,
      cost_type: data.cost_type,
      label: data.label || null,
      amount: data.amount,
      currency: data.currency || 'EUR',
      metadata: data.metadata || null, // Ne pas stringify, Supabase gère automatiquement les objets vers jsonb
      artisan_order: artisanOrder
    };

    try {
      const { data: result, error } = await supabase
        .from('intervention_costs')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[addCost] Erreur Supabase:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        throw new Error(`Erreur lors de l'ajout du coût: ${error.message || error.code || 'Erreur inconnue'}`);
      }

      return result;
    } catch (err: any) {
      // Capturer les erreurs réseau ou autres erreurs non-Supabase
      console.error('[addCost] Erreur inattendue:', err);
      if (err.message?.includes('invalid response') || err.message?.includes('upstream server')) {
        throw new Error(`Erreur de connexion Supabase - veuillez réessayer: ${err.message}`);
      }
      throw err;
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
  async upsertDirect(data: CreateInterventionData & { id_inter?: string }, customClient?: any): Promise<Intervention> {
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
        // Supprimer la transition créée par le trigger
        // - Pour INSERT: le trigger crée NULL → statut_actuel
        // - Pour UPDATE: le trigger crée oldStatusId → newStatusId
        // On supprime ces transitions pour les remplacer par la chaîne complète
        if (!existingIntervention) {
          // Cas INSERT: supprimer toutes les transitions du trigger
          await client
            .from('intervention_status_transitions')
            .delete()
            .eq('intervention_id', result.id)
            .eq('source', 'trigger');
        } else if (oldStatusId && oldStatusId !== result.statut_id) {
          // Cas UPDATE: supprimer la transition spécifique oldStatusId → newStatusId créée par le trigger
          await client
            .from('intervention_status_transitions')
            .delete()
            .eq('intervention_id', result.id)
            .eq('from_status_id', oldStatusId)
            .eq('to_status_id', result.statut_id)
            .eq('source', 'trigger');
        }

        // Récupérer l'utilisateur actuel (utiliser le client par défaut pour l'auth)
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        // Créer les transitions automatiques
        await automaticTransitionService.createAutomaticTransitions(
          result.id,
          result.statut_id,
          oldStatusId, // null pour INSERT, statut précédent pour UPDATE
          userId,
          {
            updated_via: 'upsertDirect',
            import_operation: true,
            id_inter: data.id_inter,
          }
        );
      } catch (transitionError) {
        console.error('Erreur lors de la création des transitions automatiques:', transitionError);
        // Ne pas bloquer l'upsert si les transitions échouent
      }
    }

    const refs = await getReferenceCache();
    return mapInterventionRecord(result, refs);
  },

  // Insérer plusieurs coûts pour des interventions
  // Utilise upsertCost pour éviter les doublons lors de l'import
  async insertInterventionCosts(
    costs: Array<{
      intervention_id: string;
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
      artisan_order?: 1 | 2 | null;
    }>
  ): Promise<BulkOperationResult> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const cost of costs) {
      try {
        // Utiliser upsertCost pour éviter les doublons (gère artisan_order correctement)
        await this.upsertCost(cost.intervention_id, {
          cost_type: cost.cost_type,
          amount: cost.amount,
          label: cost.label || null,
          artisan_order: cost.artisan_order ?? (cost.cost_type === 'intervention' || cost.cost_type === 'marge' ? null : 1)
        });
        results.success++;
        results.details.push({ item: cost, success: true });
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

    // Construire la requête de base - inclure date_prevue pour détecter le statut "Check"
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

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
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

      // Vérifier si c'est une intervention CHECK (statut virtuel)
      const isCheck = isCheckStatus(statusCode, datePrevue);
      if (isCheck) {
        interventionsAChecker++;
        // Ajouter au comptage du statut virtuel CHECK
        byStatus["CHECK"] = (byStatus["CHECK"] || 0) + 1;
        byStatusLabel["Check"] = (byStatusLabel["Check"] || 0) + 1;
      }

      // Compter aussi le statut réel (en plus du statut virtuel CHECK si applicable)
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
      .select("id, firstname, lastname, code_gestionnaire, color, avatar_url")
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
        user_avatar_url: user?.avatar_url || null,
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
   * Récupère le classement des gestionnaires par marge totale sur une période
   * Utilise get_dashboard_performance_gestionnaires_v3 (cohérent avec admin dashboard)
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Classement des gestionnaires trié par marge totale décroissante
   */
  async getMarginRankingByPeriodV3(
    startDate?: string,
    endDate?: string
  ): Promise<MarginRankingResult> {
    // Normaliser les dates pour correspondre au format attendu par la fonction SQL
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (startDate) {
      periodStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
    }

    if (endDate) {
      if (endDate.includes('T')) {
        periodEnd = endDate;
      } else {
        // Pour la fin de période, utiliser la fin du jour
        periodEnd = `${endDate}T23:59:59`;
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

    // Appeler la fonction RPC SQL spécialisée pour le podium (basée sur la date de complétion)
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

    if (!rpcResult || !rpcResult.rankings || !Array.isArray(rpcResult.rankings) || rpcResult.rankings.length === 0) {
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
      .select("id, firstname, lastname, code_gestionnaire, color, avatar_url")
      .in("id", userIds);

    if (usersError) {
      throw new Error(`Erreur lors de la récupération des informations utilisateurs: ${usersError.message}`);
    }

    // Créer un map pour accéder rapidement aux infos utilisateur
    const usersMap = new Map(
      (users || []).map((u) => [u.id, u])
    );

    // Mapper les résultats SQL avec les informations utilisateur
    // Note: get_podium_ranking_by_period renvoie déjà les résultats triés par marge décroissante
    const rankings: GestionnaireMarginRanking[] = rpcResult.rankings.map((item: any, index: number) => {
      const user = usersMap.get(item.user_id);

      const firstname = user?.firstname || "";
      const lastname = user?.lastname || "";
      const fullName = [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur inconnu";

      return {
        user_id: item.user_id,
        user_name: fullName,
        user_firstname: firstname || null,
        user_code: user?.code_gestionnaire || null,
        user_color: user?.color || null,
        user_avatar_url: user?.avatar_url || null,
        total_margin: Number(item.total_margin || 0),
        total_revenue: Number(item.total_revenue || 0),
        total_interventions: Number(item.total_interventions || 0),
        average_margin_percentage: Number(item.average_margin_percentage || 0),
        rank: index + 1,
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
      // Si dimanche (0), reculer de 6 jours. Sinon, reculer de (day - 1) jours
      const daysToSubtract = day === 0 ? 6 : day - 1;
      monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
      monday.setHours(0, 0, 0, 0);

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
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    // Formater les dates pour les requêtes (YYYY-MM-DD) en utilisant le temps local
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const mondayStr = formatDate(monday);
    const tuesdayStr = formatDate(tuesday);
    const wednesdayStr = formatDate(wednesday);
    const thursdayStr = formatDate(thursday);
    const fridayStr = formatDate(friday);
    const saturdayStr = formatDate(saturday);
    const sundayStr = formatDate(sunday);

    // Pour la fin de période, on utilise le début du lundi suivant
    const nextMondayStr = formatDate(nextMonday);

    // Récupérer les transitions de statut pour la période
    // Fonction helper pour initialiser les stats d'un jour
    const initDayStats = (): WeekDayStats => ({
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
      total: 0,
    });

    // Initialiser les compteurs
    const devisEnvoye = initDayStats();
    const interEnCours = initDayStats();
    const interFactures = initDayStats();
    const nouveauxArtisans = initDayStats();

    const { data: transitions, error: transitionsError } = await supabase
      .from("intervention_status_transitions")
      .select(`
        id,
        transition_date,
        to_status_code,
        interventions!inner(assigned_user_id, is_active)
      `)
      .eq("interventions.assigned_user_id", userId)
      .eq("interventions.is_active", true)
      .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
      .gte("transition_date", mondayStr)
      .lt("transition_date", nextMondayStr);

    if (transitionsError) {
      throw new Error(`Erreur lors de la récupération des transitions de statut: ${transitionsError.message}`);
    }

    // Compter les transitions par jour et par statut
    (transitions || []).forEach((transition: any) => {
      const transitionDate = new Date(transition.transition_date);
      const dateStr = formatDate(transitionDate);
      const statusCode = transition.to_status_code;

      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";
      else if (dateStr === saturdayStr) dayKey = "samedi";
      else if (dateStr === sundayStr) dayKey = "dimanche";

      // Compter selon le statut (pour le total)
      if (statusCode === "DEVIS_ENVOYE") {
        if (dayKey) devisEnvoye[dayKey]++;
        devisEnvoye.total++;
      } else if (statusCode === "INTER_EN_COURS") {
        if (dayKey) interEnCours[dayKey]++;
        interEnCours.total++;
      } else if (statusCode === "INTER_TERMINEE") {
        if (dayKey) interFactures[dayKey]++;
        interFactures.total++;
      }
    });

    // Récupérer les artisans créés par l'utilisateur pour la semaine
    const { data: artisans, error: artisansError } = await supabase
      .from("artisans")
      .select("id, created_at, gestionnaire_id")
      .eq("gestionnaire_id", userId)
      .eq("is_active", true)
      .gte("created_at", mondayStr)
      .lt("created_at", nextMondayStr);

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    // Compter les artisans par jour
    (artisans || []).forEach((artisan: any) => {
      // Utiliser uniquement created_at
      const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

      if (!artisanDate) return;

      const dateStr = formatDate(artisanDate);
      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";
      else if (dateStr === saturdayStr) dayKey = "samedi";
      else if (dateStr === sundayStr) dayKey = "dimanche";

      if (dayKey) {
        nouveauxArtisans[dayKey]++;
      }

      nouveauxArtisans.total++;
    });

    // Récupérer les artisans créés sur la période avec au moins une intervention active (artisans missionnés)
    const artisansMissionnes: WeekDayStats = {
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
      total: 0,
    };

    // On récupère les artisans créés pendant la semaine qui ont au moins une intervention active
    const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
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
      .gte("created_at", mondayStr)
      .lt("created_at", nextMondayStr);

    if (artisansMissionnesError) {
      console.error("Erreur lors de la récupération des artisans missionnés:", artisansMissionnesError);
    } else if (artisansMissionnesData) {
      // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
      const uniqueArtisans = new Map<string, any>();
      artisansMissionnesData.forEach((artisan: any) => {
        if (!uniqueArtisans.has(artisan.id)) {
          uniqueArtisans.set(artisan.id, artisan);
        }
      });

      // Compter les artisans missionnés par jour
      uniqueArtisans.forEach((artisan) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        const dateStr = formatDate(artisanDate);
        let dayKey: keyof WeekDayStats | null = null;
        if (dateStr === mondayStr) dayKey = "lundi";
        else if (dateStr === tuesdayStr) dayKey = "mardi";
        else if (dateStr === wednesdayStr) dayKey = "mercredi";
        else if (dateStr === thursdayStr) dayKey = "jeudi";
        else if (dateStr === fridayStr) dayKey = "vendredi";
        else if (dateStr === saturdayStr) dayKey = "samedi";
        else if (dateStr === sundayStr) dayKey = "dimanche";

        if (dayKey) {
          artisansMissionnes[dayKey]++;
        }

        artisansMissionnes.total++;
      });
    }

    return {
      devis_envoye: devisEnvoye,
      inter_en_cours: interEnCours,
      inter_factures: interFactures,
      nouveaux_artisans: nouveauxArtisans,
      artisans_missionnes: artisansMissionnes,
      week_start: monday.toISOString(),
      week_end: sunday.toISOString(),
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

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

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
      const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const monthStartStr = formatDate(monthStart);
      const monthEndStr = formatDate(monthEnd);
      const nextMonthStartStr = formatDate(nextMonthStart);

      // Calculer les semaines du mois
      const weeks: { start: Date; end: Date }[] = [];
      let currentWeekStart = new Date(monthStart);

      // Trouver le lundi de la première semaine
      const firstDay = currentWeekStart.getDay();
      const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
      currentWeekStart.setDate(currentWeekStart.getDate() + diffToMonday);

      while (currentWeekStart <= monthEnd) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999); // S'assurer que dimanche est inclus

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

      // Récupérer les transitions de statut du mois
      const { data: transitions, error: transitionsError } = await supabase
        .from("intervention_status_transitions")
        .select(`
          id,
          transition_date,
          to_status_code,
          interventions!inner(assigned_user_id, is_active)
        `)
        .eq("interventions.assigned_user_id", userId)
        .eq("interventions.is_active", true)
        .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
        .gte("transition_date", monthStartStr)
        .lte("transition_date", monthEndStr);

      if (transitionsError) {
        throw new Error(`Erreur lors de la récupération des transitions: ${transitionsError.message}`);
      }

      // Compter par semaine
      (transitions || []).forEach((transition: any) => {
        const transitionDate = new Date(transition.transition_date);
        const statusCode = transition.to_status_code;

        // Trouver dans quelle semaine tombe cette transition
        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (transitionDate >= week.start && transitionDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;

            if (statusCode === "DEVIS_ENVOYE") {
              devisEnvoye[weekKey]++;
              devisEnvoye.total++;
            } else if (statusCode === "INTER_EN_COURS") {
              interEnCours[weekKey]++;
              interEnCours.total++;
            } else if (statusCode === "INTER_TERMINEE") {
              interFactures[weekKey]++;
              interFactures.total++;
            }
            break;
          }
        }
      });

      const nouveauxArtisans = initWeekStats();

      // Récupérer les artisans du mois
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("created_at", monthStartStr)
        .lt("created_at", nextMonthStartStr); // Utiliser lt pour tout le mois

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par semaine
      (artisans || []).forEach((artisan: any) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (artisanDate >= week.start && artisanDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;
            nouveauxArtisans[weekKey]++;
            break;
          }
        }

        // Toujours incrémenter le total pour le mois (même si WE ou hors buckets semaine)
        nouveauxArtisans.total++;
      });

      // Récupérer les artisans créés sur la période avec au moins une intervention (artisans missionnés)
      const artisansMissionnes = initWeekStats();

      // On récupère les artisans créés pendant le mois qui ont au moins une intervention active
      const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
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
        .gte("created_at", monthStartStr)
        .lt("created_at", nextMonthStartStr);

      if (!artisansMissionnesError && artisansMissionnesData) {
        // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
        const uniqueArtisans = new Map<string, any>();
        artisansMissionnesData.forEach((artisan: any) => {
          if (!uniqueArtisans.has(artisan.id)) {
            uniqueArtisans.set(artisan.id, artisan);
          }
        });

        // Compter les artisans missionnés par semaine
        uniqueArtisans.forEach((artisan) => {
          const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

          if (!artisanDate) return;

          let matched = false;
          for (let i = 0; i < weeks.length && i < 5; i++) {
            const week = weeks[i];
            if (artisanDate >= week.start && artisanDate <= week.end) {
              const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;
              artisansMissionnes[weekKey]++;
              matched = true;
              break;
            }
          }

          artisansMissionnes.total++;
        });
      }

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        artisans_missionnes: artisansMissionnes,
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
      const nextYearStart = new Date(yearStart.getFullYear() + 1, 0, 1);
      const yearStartStr = formatDate(yearStart);
      const yearEndStr = formatDate(yearEnd);
      const nextYearStartStr = formatDate(nextYearStart);

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

      const monthNames: (keyof YearMonthStats)[] = [
        "janvier", "fevrier", "mars", "avril", "mai", "juin",
        "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
      ];

      // Récupérer les transitions de statut de l'année
      const { data: transitions, error: transitionsError } = await supabase
        .from("intervention_status_transitions")
        .select(`
          id,
          transition_date,
          to_status_code,
          interventions!inner(assigned_user_id, is_active)
        `)
        .eq("interventions.assigned_user_id", userId)
        .eq("interventions.is_active", true)
        .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
        .gte("transition_date", yearStartStr)
        .lte("transition_date", yearEndStr);

      if (transitionsError) {
        throw new Error(`Erreur lors de la récupération des transitions: ${transitionsError.message}`);
      }

      // Compter par mois
      (transitions || []).forEach((transition: any) => {
        const transitionDate = new Date(transition.transition_date);
        const monthIndex = transitionDate.getMonth();
        const monthKey = monthNames[monthIndex];
        const statusCode = transition.to_status_code;

        if (!monthKey) return;

        if (statusCode === "DEVIS_ENVOYE") {
          devisEnvoye[monthKey]++;
          devisEnvoye.total++;
        } else if (statusCode === "INTER_EN_COURS") {
          interEnCours[monthKey]++;
          interEnCours.total++;
        } else if (statusCode === "INTER_TERMINEE") {
          interFactures[monthKey]++;
          interFactures.total++;
        }
      });

      const nouveauxArtisans = initMonthStats();

      // Récupérer les artisans de l'année
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("created_at", yearStartStr)
        .lt("created_at", nextYearStartStr);

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par mois
      (artisans || []).forEach((artisan: any) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        const monthIndex = artisanDate.getMonth();
        const monthKey = monthNames[monthIndex];
        if (monthKey) {
          nouveauxArtisans[monthKey]++;
          nouveauxArtisans.total++;
        }
      });

      // Récupérer les artisans créés sur l'année avec au moins une intervention (artisans missionnés)
      const artisansMissionnes = initMonthStats();

      // On récupère les artisans créés pendant l'année qui ont au moins une intervention active
      const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
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
        .gte("created_at", yearStartStr)
        .lt("created_at", nextYearStartStr);

      if (!artisansMissionnesError && artisansMissionnesData) {
        // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
        const uniqueArtisans = new Map<string, any>();
        artisansMissionnesData.forEach((artisan: any) => {
          if (!uniqueArtisans.has(artisan.id)) {
            uniqueArtisans.set(artisan.id, artisan);
          }
        });

        // Compter les artisans missionnés par mois
        uniqueArtisans.forEach((artisan) => {
          const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

          if (!artisanDate) return;

          const monthIndex = artisanDate.getMonth();
          const monthKey = monthNames[monthIndex];
          if (monthKey) {
            artisansMissionnes[monthKey]++;
            artisansMissionnes.total++;
          }
        });
      }

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        artisans_missionnes: artisansMissionnes,
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
        metier:metiers!metier_id(id, label, code),
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
    const { periodType, referenceDate, startDate, endDate, agenceIds, gestionnaireIds, metierIds } = params;

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

    // Appeler la fonction RPC V3
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_admin_dashboard_stats_v3',
      {
        p_period_start: periodStartTimestamp,
        p_period_end: periodEndTimestamp,
        p_agence_ids: agenceIds && agenceIds.length > 0 ? agenceIds : null,
        p_metier_ids: metierIds && metierIds.length > 0 ? metierIds : null,
        p_gestionnaire_ids: gestionnaireIds && gestionnaireIds.length > 0 ? gestionnaireIds : null,
        p_top_gestionnaires: 10,
        p_top_agences: 10,
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

    // Parser le résultat JSON de la fonction SQL V3
    const kpiMain = rpcResult.kpi_main || {};

    // Mapper les sparklines depuis sparkline_data (v3)
    const rawSparklines = rpcResult.sparkline_data || [];
    const sparklines = Array.isArray(rawSparklines) ? rawSparklines.map((item: any) => ({
      date: item.date,
      countDemandees: item.nb_interventions_demandees ?? 0,
      countTerminees: item.nb_interventions_terminees ?? 0,
      ca_jour: item.ca_jour ?? 0,
      marge_jour: item.marge_jour ?? 0
    })) : [];

    // Mapper les données de volume par statut depuis volume_by_status (v3)
    const rawVolumeByStatus = rpcResult.volume_by_status || [];
    const volumeByStatus = Array.isArray(rawVolumeByStatus) ? rawVolumeByStatus.map((item: any) => ({
      date: item.date,
      demande: item.demande ?? 0,
      devis_envoye: item.devis_envoye ?? 0,
      accepte: item.accepte ?? 0,
      en_cours: item.en_cours ?? 0,
      termine: item.termine ?? 0
    })) : [];

    // Récupérer les données de funnel et status depuis la v3
    const rawConversionFunnel = rpcResult.conversion_funnel || [];
    const conversionFunnel = Array.isArray(rawConversionFunnel) ? rawConversionFunnel : [];

    const rawStatusBreakdown = rpcResult.status_breakdown || [];
    const statusBreakdown = Array.isArray(rawStatusBreakdown) ? rawStatusBreakdown : [];

    // Récupérer les données de performance depuis la v3
    const rawMetierStats = rpcResult.performance_metiers || [];
    const rawAgencyStats = rpcResult.performance_agences || [];
    const rawGestionnaireStats = rpcResult.performance_gestionnaires || [];

    // DEBUG: Données brutes reçues

    // Normaliser les codes du funnel de conversion depuis v3
    // V3 retourne déjà: { status_code: 'DEMANDE', count: X }
    // On normalise les codes si nécessaire pour le front
    const normalizedConversionFunnel = conversionFunnel.map((item: any) => ({
      statusCode: item.status_code || '',
      count: item.count || 0,
    }));

    // Récupérer les valeurs depuis kpi_main (v3)
    const nbDemandees = kpiMain.nb_interventions_demandees || 0;
    const nbTerminees = kpiMain.nb_interventions_terminees || 0;
    const tauxTransformation = kpiMain.taux_transformation || 0;
    const totalPaiements = Number(kpiMain.ca_total || 0);
    const totalCouts = Number(kpiMain.couts_total || 0);
    const margeTotal = Number(kpiMain.marge_total || 0);
    const tauxMarge = kpiMain.taux_marge || 0;

    // Log: KPIs principaux

    // Construire mainStats
    const mainStats = {
      nbInterventionsDemandees: nbDemandees,
      nbInterventionsTerminees: nbTerminees,
      nbDevis: 0, // v3 ne retourne pas ce champ
      nbValides: 0, // v3 ne retourne pas ce champ
      tauxTransformation,
      chiffreAffaires: totalPaiements,
      tauxMarge,
      couts: totalCouts,
      marge: margeTotal,
      avgCycleTime: 0,
      deltaInterventions: 0, // v3 ne calcule pas les deltas
      deltaChiffreAffaires: 0, // v3 ne calcule pas les deltas
      deltaMarge: 0, // v3 ne calcule pas les deltas
    };

    // Récupérer le cache de référence pour mapper les codes aux labels
    const refs = await getReferenceCache();

    // Récupérer les statuts pour mapper les codes aux labels
    const { data: statuses } = await supabase
      .from('intervention_statuses')
      .select('id, code, label');

    const statusMapByCode = new Map(statuses?.map((s: any) => [s.code, s]) || []);

    // ========================================
    // 2. STATISTIQUES DES STATUTS (V3)
    // ========================================

    // Mapper le status breakdown retourné par v3
    // V3 retourne: { status_code: 'XXX', status_label: 'Label', count: N }
    const breakdown = statusBreakdown.map((item: any) => ({
      statusCode: item.status_code || '',
      statusLabel: item.status_label || '',
      count: item.count || 0,
    }));

    // Construire statusStats depuis le breakdown
    const nbDevisEnvoye = breakdown.find((s: any) => s.statusCode === 'DEVIS_ENVOYE')?.count || 0;
    const nbEnCours = breakdown.find((s: any) => s.statusCode === 'INTER_EN_COURS')?.count || 0;
    const nbAttAcompte = breakdown.find((s: any) => s.statusCode === 'ATT_ACOMPTE')?.count || 0;
    const nbAccepte = breakdown.find((s: any) => s.statusCode === 'ACCEPTE')?.count || 0;

    const statusStats = {
      nbDemandesRecues: mainStats.nbInterventionsDemandees,
      nbDevisEnvoye,
      nbEnCours,
      nbAttAcompte,
      nbAccepte,
      nbTermine: mainStats.nbInterventionsTerminees,
      breakdown,
    };

    // Log: Statistiques par statut

    // ========================================
    // 3. STATISTIQUES PAR MÉTIER (V3)
    // ========================================

    const metierStats = rawMetierStats
      .map((item: any) => {
        const metierId = item.metier_id;
        if (!metierId) return null;

        const ca = Number(item.ca_total || 0);
        const marge = Number(item.marge_total || 0);
        const tauxMarge = Number(item.taux_marge || 0);
        const nbInterventionsPrises = item.nb_interventions_demandees || 0;
        const nbInterventionsTerminees = item.nb_interventions_terminees || 0;
        const pourcentageVolume = Number(item.pourcentage_volume || 0);

        return {
          metierId,
          metierLabel: item.metier_nom || 'Inconnu',
          nbInterventionsPrises,
          nbInterventionsTerminees,
          ca,
          couts: ca - marge, // Calculé depuis CA et marge
          marge,
          tauxMarge,
          percentage: pourcentageVolume,
          count: nbInterventionsPrises, // compatibilité avec les usages existants
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.nbInterventionsPrises - a.nbInterventionsPrises);

    // Log: Statistiques par métier (top 5)
    metierStats.slice(0, 5).forEach((metier: any, index: number) => {
    });
    if (metierStats.length > 5) {
    }

    // ========================================
    // 4. STATISTIQUES PAR AGENCE (V3)
    // ========================================

    const agencyStats = rawAgencyStats.map((item: any) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      const tauxMarge = Number(item.taux_marge || 0);

      return {
        agencyId: item.agence_id,
        agencyLabel: item.agence_nom || 'Inconnu',
        nbTotalInterventions: item.nb_interventions_demandees || 0,
        nbInterventionsTerminees: item.nb_interventions_terminees || 0,
        tauxMarge,
        ca,
        couts: ca - marge, // Calculé depuis CA et marge
        marge,
      };
    }).sort((a: any, b: any) => b.ca - a.ca);

    // DEBUG: agencyStats après mapping
    if (agencyStats.length > 0) {
    }

    // Log: Statistiques par agence (top 5)
    agencyStats.slice(0, 5).forEach((agency: typeof agencyStats[0], index: number) => {
    });
    if (agencyStats.length > 5) {
    }

    // ========================================
    // 5. STATISTIQUES PAR GESTIONNAIRE (V3)
    // ========================================

    const gestionnaireStats = rawGestionnaireStats.map((item: any) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      const tauxMarge = Number(item.taux_marge || 0);
      const nbInterventionsPrises = item.nb_interventions_prises || 0;
      const nbInterventionsTerminees = item.nb_interventions_terminees || 0;
      const tauxCompletion = Number(item.taux_completion || 0);

      return {
        gestionnaireId: item.gestionnaire_id,
        gestionnaireLabel: item.gestionnaire_nom || 'Inconnu',
        nbInterventionsPrises,
        nbInterventionsTerminees,
        tauxTransformation: tauxCompletion, // V3 appelle ça taux_completion
        tauxMarge,
        ca,
        couts: ca - marge, // Calculé depuis CA et marge
        marge,
      };
    }).sort((a: any, b: any) => b.ca - a.ca);

    // DEBUG: gestionnaireStats après mapping
    if (gestionnaireStats.length > 0) {
    }

    // Log: Statistiques par gestionnaire (top 5)
    gestionnaireStats.slice(0, 5).forEach((gestionnaire: typeof gestionnaireStats[0], index: number) => {
    });
    if (gestionnaireStats.length > 5) {
    }

    return {
      mainStats,
      sparklines,
      statusBreakdown: breakdown,
      conversionFunnel: normalizedConversionFunnel,
      volumeByStatus,
      metierBreakdown: metierStats,
      metierStats,
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
      agenceIds,
      gestionnaireIds,
      metierIds,
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
          agenceIds,
          gestionnaireIds,
          metierIds,
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
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: InterventionsHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
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
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: TransformationRateHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
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
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: CycleTimeHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
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
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = this.calculateLast4Periods(periodType, startDate, endDate);

    const historical: MarginHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await this.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
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

  // ===== FONCTIONS DE COMPTAGE AVEC FILTRES =====

  /**
   * Obtient le nombre total d'interventions correspondant aux filtres
   * Remplace l'ancienne fonction getInterventionTotalCount de supabase-api-v2.ts
   * 
   * @param params - Paramètres de filtrage (statut, agence, metier, user, dates, search)
   * @returns Le nombre total d'interventions correspondant aux filtres
   */
  async getTotalCountWithFilters(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
  ): Promise<number> {
    try {
      let query = supabase
        .from("interventions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      // Appliquer les filtres
      if (params?.statut) {
        query = query.eq("statut_id", params.statut);
      }
      if (params?.statuts && params.statuts.length > 0) {
        query = query.in("statut_id", params.statuts);
      }
      if (params?.agence) {
        query = query.eq("agence_id", params.agence);
      }
      if (params?.metier && typeof params.metier === 'string') {
        // Convertir le code métier en ID si nécessaire
        const refs = await getReferenceCache();
        const metierObj = Array.from(refs.metiersById.values()).find(
          (m: any) =>
            m.code?.toUpperCase() === params.metier?.toUpperCase() ||
            m.id === params.metier
        );
        const metierId = metierObj?.id || params.metier;
        query = query.eq("metier_id", metierId);
      }
      if (params?.metiers && params.metiers.length > 0) {
        const refs = await getReferenceCache();
        const metierIds = params.metiers.map((metierCodeOrId) => {
          const metierObj = Array.from(refs.metiersById.values()).find(
            (m: any) =>
              m.code?.toUpperCase() === metierCodeOrId?.toUpperCase() ||
              m.id === metierCodeOrId
          );
          return metierObj?.id || metierCodeOrId;
        });
        query = query.in("metier_id", metierIds);
      }
      if (params?.user !== undefined) {
        if (params.user === null) {
          query = query.is("assigned_user_id", null);
        } else {
          query = query.eq("assigned_user_id", params.user);
        }
      }
      if (params?.startDate) {
        query = query.gte("date", params.startDate);
      }
      if (params?.endDate) {
        query = query.lte("date", params.endDate);
      }

      // Filtre isCheck pour les interventions en retard
      if (params?.isCheck) {
        const today = new Date().toISOString().split("T")[0];
        query = query.lte("date_prevue", today);
        // Filtrer sur les statuts CHECK (VISITE_TECHNIQUE ou INTER_EN_COURS)
        const refs = await getReferenceCache();
        const checkStatusIds = Array.from(refs.interventionStatusesById.values())
          .filter((s: any) => isCheckStatus(s.code as InterventionStatusKey, null))
          .map((s: any) => s.id);
        if (checkStatusIds.length > 0) {
          query = query.in("statut_id", checkStatusIds);
        }
      }

      const { count, error } = await query;

      if (error) {
        const errorMessage = error.message || JSON.stringify(error, Object.getOwnPropertyNames(error));
        console.error(`[interventionsApi.getTotalCountWithFilters] Erreur Supabase:`, {
          error,
          errorMessage,
          params,
        });
        throw new Error(`Erreur lors du comptage des interventions: ${errorMessage}`);
      }

      return count ?? 0;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Erreur inattendue lors du comptage: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
    }
  },

  /**
   * Obtient le nombre d'interventions par statut
   * Remplace l'ancienne fonction getInterventionCounts de supabase-api-v2.ts
   * 
   * @param params - Paramètres de filtrage (sans le statut, qui est la clé de regroupement)
   * @returns Un objet avec les statut_id comme clés et les comptages comme valeurs
   */
  async getCountsByStatus(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include" | "statut" | "statuts">
  ): Promise<Record<string, number>> {
    let query = supabase
      .from("interventions")
      .select("statut_id", { count: "exact", head: false })
      .eq("is_active", true);

    // Appliquer les filtres (sauf statut qui est la clé de regroupement)
    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.metier && typeof params.metier === 'string') {
      const refs = await getReferenceCache();
      const metierObj = Array.from(refs.metiersById.values()).find(
        (m: any) =>
          m.code?.toUpperCase() === params.metier?.toUpperCase() ||
          m.id === params.metier
      );
      const metierId = metierObj?.id || params.metier;
      query = query.eq("metier_id", metierId);
    }
    if (params?.metiers && params.metiers.length > 0) {
      const refs = await getReferenceCache();
      const metierIds = params.metiers.map((metierCodeOrId) => {
        const metierObj = Array.from(refs.metiersById.values()).find(
          (m: any) =>
            m.code?.toUpperCase() === metierCodeOrId?.toUpperCase() ||
            m.id === metierCodeOrId
        );
        return metierObj?.id || metierCodeOrId;
      });
      query = query.in("metier_id", metierIds);
    }
    if (params?.user !== undefined) {
      if (params.user === null) {
        query = query.is("assigned_user_id", null);
      } else {
        query = query.eq("assigned_user_id", params.user);
      }
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return {};

    // Compter les occurrences par statut_id
    const counts: Record<string, number> = {};
    for (const row of data) {
      const statusId = row.statut_id;
      if (statusId) {
        counts[statusId] = (counts[statusId] || 0) + 1;
      }
    }

    return counts;
  },

  /**
   * Compte le nombre d'interventions pour une valeur spécifique d'une propriété
   * Utile pour les compteurs dans les dropdowns de filtres
   *
   * @param property - Propriété à compter (ex: 'metier', 'agence', 'statut', 'user')
   * @param value - Valeur spécifique de la propriété (ex: ID du métier)
   * @param baseFilters - Filtres de base à appliquer (filtres de la vue + autres filtres actifs)
   * @returns Le nombre d'interventions correspondantes
   */
  async getCountByPropertyValue(
    property: 'metier' | 'agence' | 'statut' | 'user',
    value: string | null,
    baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>
  ): Promise<number> {
    try {
      // Construire les paramètres en ajoutant la propriété spécifique
      const params: InterventionQueryParams = {
        ...baseFilters,
      }

      // Mapper la propriété vers le bon paramètre de requête
      switch (property) {
        case 'metier':
          params.metier = value || undefined
          break
        case 'agence':
          params.agence = value || undefined
          break
        case 'statut':
          params.statut = value || undefined
          break
        case 'user':
          params.user = value === null ? null : value
          break
      }

      // Utiliser la fonction getTotalCountWithFilters existante
      return await this.getTotalCountWithFilters(params)
    } catch (error) {
      console.error(`[getCountByPropertyValue] Erreur pour ${property}=${value}:`, error)
      return 0
    }
  },

  /**
   * Obtient les valeurs distinctes d'une colonne d'intervention
   * Remplace l'ancienne fonction getDistinctInterventionValues de supabase-api-v2.ts
   * 
   * @param column - Nom de la colonne (statusValue, attribueA, agence, metier, codePostal, ville)
   * @param params - Paramètres de filtrage
   * @returns Liste des valeurs distinctes
   */
  async getDistinctValues(
    column: string,
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
  ): Promise<string[]> {
    const refs = await getReferenceCache();

    // Pour certaines propriétés, utiliser le cache de référence
    const normalizedColumn = column.trim().toLowerCase();

    switch (normalizedColumn) {
      case "statusvalue":
      case "statut":
      case "statut_id":
        return refs.data.interventionStatuses.map((s) => s.code || s.label);
      case "attribuea":
      case "assigned_user_id":
        return refs.data.users.map((u) => {
          const fullName = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
          return fullName || u.username;
        });
      case "agence":
      case "agence_id":
        return refs.data.agencies.map((a) => a.label || a.code);
      case "metier":
      case "metier_id":
        return refs.data.metiers.map((m) => m.code || m.label);
    }

    // Pour les autres colonnes, faire une requête directe
    const columnMap: Record<string, string> = {
      codepostal: "code_postal",
      code_postal: "code_postal",
      ville: "ville",
    };

    const dbColumn = columnMap[normalizedColumn] || column;
    const limit = 250;

    let query = supabase
      .from("interventions")
      .select(dbColumn, { head: false })
      .eq("is_active", true)
      .order(dbColumn, { ascending: true, nullsFirst: false })
      .not(dbColumn, "is", null)
      .limit(limit);

    // Appliquer les filtres
    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.statuts && params.statuts.length > 0) {
      query = query.in("statut_id", params.statuts);
    }
    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.metier && typeof params.metier === 'string') {
      const metierObj = Array.from(refs.metiersById.values()).find(
        (m: any) =>
          m.code?.toUpperCase() === params.metier?.toUpperCase() ||
          m.id === params.metier
      );
      const metierId = metierObj?.id || params.metier;
      query = query.eq("metier_id", metierId);
    }
    if (params?.user !== undefined) {
      if (params.user === null) {
        query = query.is("assigned_user_id", null);
      } else {
        query = query.eq("assigned_user_id", params.user);
      }
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching distinct values for column "${dbColumn}":`, error);
      throw error;
    }
    if (!data) return [];

    // Dédupliquer les valeurs
    const seen = new Set<string>();
    const values: string[] = [];

    for (const row of data) {
      const raw = row[dbColumn as keyof typeof row];
      if (raw == null || raw === "") continue;
      const value = String(raw);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }

    return values;
  },

  /**
   * Alias pour getTotalCountWithFilters - cohérent avec l'API artisans
   * Obtient le nombre total d'interventions correspondant aux filtres
   * Utilisé notamment pour alimenter les compteurs dans les menus de sélection des filtres de la TableView
   *
   * @param params - Paramètres de filtrage (statut, agence, metier, user, dates, search)
   * @returns Le nombre total d'interventions correspondant aux filtres
   */
  async getCountWithFilters(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
  ): Promise<number> {
    return this.getTotalCountWithFilters(params);
  },
};
