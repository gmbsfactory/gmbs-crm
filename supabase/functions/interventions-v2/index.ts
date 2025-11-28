// ===== API INTERVENTIONS COMPLÈTE ET SCALABLE =====
// Service API Supabase - CRUD complet pour les interventions
// 
// FEATURES:
// - CRUD complet (Create, Read, Update, Delete)
// - Assignation d'artisans par gestionnaire
// - Gestion des commentaires
// - Gestion des documents/attachments
// - Gestion des coûts et paiements
// - Pagination optimisée
// - Validation des données
// - Gestion d'erreurs robuste

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

// Types pour la validation
interface CreateInterventionRequest {
  id_inter?: string;
  agence_id?: string;
  reference_agence?: string;
  client_id?: string;
  tenant_id?: string;
  owner_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date: string;
  date_prevue?: string;
  contexte_intervention?: string;
  consigne_intervention?: string;
  consigne_second_artisan?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  numero_sst?: string;
  pourcentage_sst?: number;
  is_vacant?: boolean;
  key_code?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  vacant_housing_instructions?: string | null;
}

interface UpdateInterventionRequest {
  id_inter?: string;
  agence_id?: string;
  reference_agence?: string;
  client_id?: string;
  tenant_id?: string;
  owner_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date?: string;
  date_termine?: string;
  date_prevue?: string;
  contexte_intervention?: string;
  consigne_intervention?: string;
  consigne_second_artisan?: string;
  commentaire_agent?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  numero_sst?: string;
  pourcentage_sst?: number;
  is_active?: boolean;
  is_vacant?: boolean;
  key_code?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  vacant_housing_instructions?: string | null;
}

interface AssignArtisanRequest {
  intervention_id: string;
  artisan_id: string;
  role?: 'primary' | 'secondary';
  is_primary?: boolean;
}

interface CreateCommentRequest {
  intervention_id: string;
  content: string;
  comment_type?: string;
  is_internal?: boolean;
}

// Helper function pour créer les transitions automatiques lors de la création
async function createAutomaticStatusTransitions(
  supabase: SupabaseClient,
  interventionId: string,
  statusId: string | null,
  userId: string | null,
  requestId: string
): Promise<void> {
  if (!statusId) {
    return;
  }

  try {
    // Récupérer le code du statut
    const { data: statusData } = await supabase
      .from('intervention_statuses')
      .select('code')
      .eq('id', statusId)
      .single();

    if (statusData?.code) {
      // Appeler la fonction SQL pour créer les transitions automatiques
      const { error: transitionError } = await supabase.rpc(
        'create_automatic_status_transitions_on_creation',
        {
          p_intervention_id: interventionId,
          p_to_status_code: statusData.code,
          p_changed_by_user_id: userId,
          p_metadata: {
            created_via: 'edge_function',
            request_id: requestId,
          }
        }
      );

      if (transitionError) {
        console.warn(`Failed to create automatic status transitions: ${transitionError.message}`);
        // Ne pas échouer la création si les transitions échouent
      }
    }
  } catch (transitionErr) {
    console.warn(`Error creating automatic status transitions: ${transitionErr}`);
    // Ne pas échouer la création si les transitions échouent
  }
}

interface CreateAttachmentRequest {
  intervention_id: string;
  kind: string;
  url: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
}

interface CreateCostRequest {
  intervention_id: string;
  cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
  label?: string;
  amount: number;
  currency?: string;
  metadata?: any;
}

interface CreatePaymentRequest {
  intervention_id: string;
  payment_type: string;
  amount: number;
  currency?: string;
  is_received?: boolean;
  payment_date?: string;
  reference?: string;
}

const TERMINATED_INTERVENTION_CODES = ['TERMINE', 'INTER_TERMINEE'];
const ARTISAN_LEVEL_CODES = ['NOVICE', 'FORMATION', 'CONFIRME', 'EXPERT'];
const REQUIRED_DOCUMENT_KINDS = ['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
const INTERVENTION_ATTACHMENT_KINDS = [
  'devis',
  'photos',
  'facturesGMBS',
  'facturesArtisans',
  'facturesMateriel',
  'autre',
  'a_classe',
];

function normalizeInterventionAttachmentKind(kind: string): string {
  if (!kind) return kind;

  const trimmed = kind.trim();
  if (!trimmed) return kind;

  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[_\s-]/g, '');

  const needsClassification = new Set([
    'aclasser',
    'aclassifier',
    'àclasser',
    'àclassifier',
    'aclasse',
    'àclasse',
  ]);
  if (
    needsClassification.has(compact) ||
    lower === 'a classer' ||
    lower === 'a classifier' ||
    lower === 'à classer' ||
    lower === 'à classifier'
  ) {
    return 'a_classe';
  }

  const canonicalMap: Record<string, string> = {
    facturegmbs: 'facturesGMBS',
    facturesgmbs: 'facturesGMBS',
    factureartisan: 'facturesArtisans',
    facturesartisan: 'facturesArtisans',
    facturemateriel: 'facturesMateriel',
    facturesmateriel: 'facturesMateriel',
  };
  if (canonicalMap[compact]) {
    return canonicalMap[compact];
  }

  const legacyToAutre = new Set([
    'rapportintervention',
    'plan',
    'schema',
    'intervention',
    'cout',
  ]);
  if (legacyToAutre.has(compact)) {
    return 'autre';
  }

  return trimmed;
}

/**
 * Calcule le statut de dossier d'un artisan basé sur ses documents
 * 
 * @param attachments - Liste des documents de l'artisan
 * @param hasCompletedIntervention - Si l'artisan a effectué au moins une intervention terminée
 * @returns Le statut de dossier calculé : 'INCOMPLET', 'À compléter', ou 'COMPLET'
 */
function calculateDossierStatus(
  attachments: Array<{ kind: string }> | null | undefined,
  hasCompletedIntervention: boolean
): 'INCOMPLET' | 'À compléter' | 'COMPLET' {
  if (!attachments || attachments.length === 0) {
    // Si pas de documents et a effectué une intervention → À compléter
    // Sinon → INCOMPLET
    return hasCompletedIntervention ? 'À compléter' : 'INCOMPLET';
  }

  // Créer un Set des kinds présents (normaliser en lowercase pour comparaison)
  const presentKinds = new Set(
    attachments
      .map(att => att.kind?.toLowerCase().trim())
      .filter(Boolean)
  );

  // Vérifier quels documents requis sont présents
  const requiredKindsLower = REQUIRED_DOCUMENT_KINDS.map(k => k.toLowerCase());
  const missingDocuments = requiredKindsLower.filter(
    kind => !presentKinds.has(kind)
  );

  // Si tous les documents requis sont présents → COMPLET
  if (missingDocuments.length === 0) {
    return 'COMPLET';
  }

  // À compléter : dossier vide (tous les documents requis manquants) OU 1 seul fichier manquant ET artisan a effectué une intervention
  const totalRequired = REQUIRED_DOCUMENT_KINDS.length; // 5 documents requis
  if (hasCompletedIntervention && (missingDocuments.length === totalRequired || missingDocuments.length === 1)) {
    return 'À compléter';
  }

  // Sinon → INCOMPLET
  return 'INCOMPLET';
}

type CursorDirection = 'forward' | 'backward';

interface InterventionCursor {
  date: string;
  id: string;
  direction?: CursorDirection;
}

interface FilterParams {
  statut?: string[];
  agence?: string[];
  metier?: string[];
  user?: string[];
  userIsNull?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
}

const COUNT_CACHE_TTL_MS = 120 * 1000;
const countCache = new Map<string, { value: number; expiresAt: number }>();

const DEFAULT_INTERVENTION_COLUMNS = [
  'id',
  'id_inter',
  'created_at',
  'updated_at',
  'statut_id',
  'assigned_user_id',
  'updated_by',
  'agence_id',
  'reference_agence',
  'tenant_id',
  'owner_id',
  'metier_id',
  'date',
  'date_termine',
  'date_prevue',
  'due_date',
  'contexte_intervention',
  'consigne_intervention',
  'consigne_second_artisan',
  'commentaire_agent',
  'adresse',
  'code_postal',
  'ville',
  'latitude',
  'longitude',
  'is_active',
];

const DEFAULT_SELECT = DEFAULT_INTERVENTION_COLUMNS.join(',');

const AVAILABLE_RELATIONS: Record<string, string> = {
  agencies: 'agencies(id,label,code)',
  tenants: 'tenants:tenant_id(id,firstname,lastname,email,telephone,telephone2)',
  users: 'users!assigned_user_id(id,firstname,lastname,username,color,code_gestionnaire)',
  statuses: 'intervention_statuses(id,code,label,color,sort_order)',
  metiers: 'metiers(id,label,code)',
  artisans: 'intervention_artisans(id,artisan_id,is_primary,role,artisans(id,nom,prenom,plain_nom,email,telephone))',
  costs: 'intervention_costs(id,cost_type,label,amount,currency)',
  owner: 'owner:owner_id(id,owner_firstname,owner_lastname,email,telephone)',
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Failed to parse JSON parameter', { raw, error });
    return null;
  }
};

const parseDirection = (direction?: string | null): CursorDirection => {
  return direction === 'backward' ? 'backward' : 'forward';
};

const parseCursorParam = (raw: string | null): InterventionCursor | null => {
  const parsed = parseJson<InterventionCursor>(raw);
  if (!parsed || !parsed.date || !parsed.id) {
    return null;
  }
  return {
    date: parsed.date,
    id: parsed.id,
    direction: parseDirection(parsed.direction),
  };
};

const parseListParam = (values: string[]): string[] => {
  return values
    .flatMap((value) => value.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const buildSelectClause = (extraSelect: string | null, include: string[]): string => {
  const base = new Set<string>(DEFAULT_INTERVENTION_COLUMNS);
  const selectFragments: string[] = [];
  
  // ⚠️ TOUJOURS inclure les artisans et les coûts par défaut
  const defaultRelations = ['artisans', 'costs'];
  const allIncludes = [...new Set([...defaultRelations, ...include])];
  
  if (extraSelect) {
    selectFragments.push(extraSelect);
  }
  for (const key of allIncludes) {
    const relation = AVAILABLE_RELATIONS[key];
    if (relation) {
      selectFragments.push(relation);
    }
  }
  const baseSelect = Array.from(base).join(',');
  if (selectFragments.length === 0) {
    return baseSelect;
  }
  return `${baseSelect},${selectFragments.join(',')}`;
};

const applyFilters = <T extends { in: Function; eq: Function; gte: Function; lte: Function; ilike: Function; is: Function }>(
  query: T,
  filters: FilterParams,
) => {
  let builder = query;

  if (filters.statut && filters.statut.length > 0) {
    builder = builder.in('statut_id', filters.statut);
  }

  if (filters.agence && filters.agence.length > 0) {
    builder = builder.in('agence_id', filters.agence);
  }

  if (filters.metier && filters.metier.length > 0) {
    builder = builder.in('metier_id', filters.metier);
  }

  if (filters.user && filters.user.length > 0) {
    builder = builder.in('assigned_user_id', filters.user);
  } else if (filters.userIsNull) {
    builder = builder.is('assigned_user_id', null);
  }

  if (filters.startDate) {
    builder = builder.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    builder = builder.lte('date', filters.endDate);
  }

  if (filters.search) {
    builder = builder.ilike('contexte_intervention', `%${filters.search}%`);
  }

  return builder;
};

const buildCursorCondition = (cursor: InterventionCursor): string | null => {
  if (!cursor?.date || !cursor?.id) {
    return null;
  }
  const sanitizedDate = cursor.date.replace(/,/g, '\\,');
  const sanitizedId = cursor.id.replace(/,/g, '\\,');
  if (parseDirection(cursor.direction) === 'backward') {
    return `and(date.gt.${sanitizedDate}),and(date.eq.${sanitizedDate},id.gt.${sanitizedId})`;
  }
  return `and(date.lt.${sanitizedDate}),and(date.eq.${sanitizedDate},id.lt.${sanitizedId})`;
};

const buildCountCacheKey = (filters: FilterParams) => {
  return JSON.stringify({
    ...filters,
    user: filters.user ?? null,
    userIsNull: filters.userIsNull ?? false,
  });
};

const getCachedCount = async (supabase: SupabaseClient, filters: FilterParams) => {
  const cacheKey = buildCountCacheKey(filters);
  const now = Date.now();
  const cached = countCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let countQuery = supabase
    .from('interventions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  countQuery = applyFilters(countQuery, filters);

  const { count, error } = await countQuery;

  if (error) {
    throw new Error(`Failed to count interventions: ${error.message}`);
  }

  const value = count ?? 0;
  countCache.set(cacheKey, { value, expiresAt: now + COUNT_CACHE_TTL_MS });
  return value;
};

const createCursor = (row: any, direction: CursorDirection): InterventionCursor | null => {
  if (!row?.date || !row?.id) {
    return null;
  }
  return {
    date: row.date,
    id: row.id,
    direction,
  };
};

async function handleInterventionCompletionSideEffects(
  supabase: SupabaseClient,
  intervention: { id: string; statut_id?: string | null },
  requestId: string,
) {
  if (!intervention?.id || !intervention?.statut_id) {
    return;
  }

  try {
    const { data: terminatedStatuses, error: terminatedStatusError } = await supabase
      .from('intervention_statuses')
      .select('id, code')
      .in('code', TERMINATED_INTERVENTION_CODES);

    if (terminatedStatusError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load terminated intervention statuses',
          error: terminatedStatusError.message,
        }),
      );
      return;
    }

    const terminatedStatusIds = new Set(
      (terminatedStatuses ?? [])
        .filter((row) => row?.id)
        .map((row) => row.id as string),
    );

    if (!terminatedStatusIds.has(intervention.statut_id)) {
      return;
    }

    const { data: artisanLinks, error: artisanLinkError } = await supabase
      .from('intervention_artisans')
      .select('artisan_id, is_primary')
      .eq('intervention_id', intervention.id);

    if (artisanLinkError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load intervention artisans',
          error: artisanLinkError.message,
        }),
      );
      return;
    }

    if (!artisanLinks || artisanLinks.length === 0) {
      return;
    }

    let artisanIds = artisanLinks
      .filter((link) => link && link.is_primary === true && link.artisan_id)
      .map((link) => link.artisan_id as string);

    if (artisanIds.length === 0) {
      artisanIds = artisanLinks
        .filter((link) => link?.artisan_id)
        .map((link) => link.artisan_id as string);
    }

    artisanIds = Array.from(new Set(artisanIds));

    if (artisanIds.length === 0) {
      return;
    }

    const { data: artisanStatuses, error: artisanStatusError } = await supabase
      .from('artisan_statuses')
      .select('id, code');

    if (artisanStatusError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load artisan statuses',
          error: artisanStatusError.message,
        }),
      );
      return;
    }

    const codeToStatusId = new Map<string, string>();
    const statusIdToCode = new Map<string, string>();

    for (const status of artisanStatuses ?? []) {
      if (status?.code && status?.id) {
        const upperCode = (status.code as string).toUpperCase();
        codeToStatusId.set(upperCode, status.id as string);
        statusIdToCode.set(status.id as string, upperCode);
      }
    }

    const missingCodes = ARTISAN_LEVEL_CODES.filter(
      (code) => !codeToStatusId.has(code),
    );

    if (missingCodes.length === ARTISAN_LEVEL_CODES.length) {
      // Aucun statut cible n'est disponible, inutile de continuer
      console.warn(
        JSON.stringify({
          level: 'warn',
          requestId,
          interventionId: intervention.id,
          message:
            'Automatic artisan status update skipped because no target status codes are available',
          missingCodes,
        }),
      );
      return;
    }

    for (const artisanId of artisanIds) {
      // Charger l'artisan avec son statut actuel et son statut de dossier
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id, statut_id, statut_dossier')
        .eq('id', artisanId)
        .single();

      if (artisanError || !artisan) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan for status update',
            error: artisanError?.message ?? 'NOT_FOUND',
          }),
        );
        continue;
      }

      // Charger les documents de l'artisan pour calculer le statut de dossier
      const { data: attachments, error: attachmentsError } = await supabase
        .from('artisan_attachments')
        .select('kind')
        .eq('artisan_id', artisanId)
        .neq('kind', 'autre');

      if (attachmentsError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan attachments',
            error: attachmentsError.message,
          }),
        );
        // Continuer quand même, on utilisera une valeur par défaut
      }

      const { data: linkedInterventions, error: linkedError } = await supabase
        .from('intervention_artisans')
        .select('intervention_id')
        .eq('artisan_id', artisanId)
        .eq('is_primary', true);

      if (linkedError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan interventions',
            error: linkedError.message,
          }),
        );
        continue;
      }

      const interventionIds = (linkedInterventions ?? [])
        .map((row) => row?.intervention_id as string | null)
        .filter((value): value is string => Boolean(value));

      if (interventionIds.length === 0) {
        continue;
      }

      const { count: completedCount, error: countError } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .in('id', interventionIds)
        .in('statut_id', Array.from(terminatedStatusIds));

      if (countError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to count completed interventions for artisan',
            error: countError.message,
          }),
        );
        continue;
      }

      const completed = completedCount ?? 0;
      const currentCode = artisan.statut_id
        ? statusIdToCode.get(artisan.statut_id as string) ?? null
        : null;

      // Ne pas modifier les statuts ONE_SHOT et ARCHIVE automatiquement
      // Ces statuts sont gérés manuellement uniquement
      if (currentCode === 'ONE_SHOT' || currentCode === 'ARCHIVE') {
        // Mettre à jour uniquement le statut de dossier si nécessaire
        const currentDossierStatus = artisan.statut_dossier as string | null;
        const newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);
        
        if (newDossierStatus !== currentDossierStatus) {
          const { error: dossierUpdateError } = await supabase
            .from('artisans')
            .update({
              statut_dossier: newDossierStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', artisanId);

          if (dossierUpdateError) {
            console.error(
              JSON.stringify({
                level: 'error',
                requestId,
                interventionId: intervention.id,
                artisanId,
                message: 'Failed to update artisan dossier status',
                error: dossierUpdateError.message,
              }),
            );
          }
        }
        continue;
      }

      // Calculer le nouveau statut selon les règles
      let nextCode = currentCode;

      // Règle : candidat → novice après 1 intervention terminée
      // Règle : potentiel → novice après première intervention terminée
      if (completed >= 10) {
        nextCode = 'EXPERT';
      } else if (completed >= 6) {
        nextCode = 'CONFIRME';
      } else if (completed >= 3) {
        nextCode = 'FORMATION';
      } else if (completed >= 1) {
        // Si CANDIDAT ou POTENTIEL → NOVICE après 1 intervention
        if (currentCode === 'CANDIDAT' || currentCode === 'POTENTIEL') {
          nextCode = 'NOVICE';
        } else if (currentCode === null) {
          nextCode = 'NOVICE';
        } else {
          // Pour les autres statuts, on garde le statut actuel jusqu'au seuil suivant
          nextCode = currentCode;
        }
      } else {
        // Moins de 1 intervention → reste CANDIDAT ou POTENTIEL
        nextCode = currentCode || 'CANDIDAT';
      }

      // Ne pas mettre à jour si le statut n'a pas changé
      if (!nextCode || nextCode === currentCode) {
        // Mais on peut quand même mettre à jour le statut de dossier
        const currentDossierStatus = artisan.statut_dossier as string | null;
        const newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);
        
        if (newDossierStatus !== currentDossierStatus) {
          const { error: dossierUpdateError } = await supabase
            .from('artisans')
            .update({
              statut_dossier: newDossierStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', artisanId);

          if (dossierUpdateError) {
            console.error(
              JSON.stringify({
                level: 'error',
                requestId,
                interventionId: intervention.id,
                artisanId,
                message: 'Failed to update artisan dossier status',
                error: dossierUpdateError.message,
              }),
            );
          }
        }
        continue;
      }

      const nextStatusId = codeToStatusId.get(nextCode);
      if (!nextStatusId) {
        continue;
      }

      // Calculer le nouveau statut de dossier
      const currentDossierStatus = artisan.statut_dossier as string | null;
      let newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);

      // Règle ARC-002 : Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"
      if (
        currentDossierStatus === 'INCOMPLET' &&
        nextCode === 'NOVICE' &&
        currentCode !== 'NOVICE'
      ) {
        newDossierStatus = 'À compléter';
      }

      // Préparer la mise à jour
      const updateData: any = {
        statut_id: nextStatusId,
        updated_at: new Date().toISOString(),
      };

      // Mettre à jour le statut de dossier seulement s'il a changé
      if (newDossierStatus !== currentDossierStatus) {
        updateData.statut_dossier = newDossierStatus;
      }

      const { error: updateError } = await supabase
        .from('artisans')
        .update(updateData)
        .eq('id', artisanId);

      if (updateError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to update artisan status',
            error: updateError.message,
          }),
        );
        continue;
      }

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          interventionId: intervention.id,
          artisanId,
          previousStatus: currentCode,
          newStatus: nextCode,
          previousDossierStatus: currentDossierStatus,
          newDossierStatus: newDossierStatus,
          completedInterventions: completed,
          timestamp: new Date().toISOString(),
          message: 'Artisan status and dossier status updated based on completed interventions',
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        interventionId: intervention?.id ?? null,
        message: 'Unexpected error while updating artisan status',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  const startTime = Date.now();
  let requestId: string | undefined;
  
  try {
    requestId = crypto.randomUUID();

    console.log(JSON.stringify({
      level: 'info',
      requestId,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      message: 'Interventions API request started'
    }));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment);
    
    // Parsing plus robuste pour gérer les sous-ressources
    let resource = pathSegments[pathSegments.length - 1];
    let resourceId: string | null = null;
    let subResource: string | null = null;
    
    // Pour /interventions-v2/interventions/{id}/artisans
    if (pathSegments.length >= 4 && pathSegments[pathSegments.length - 3] === 'interventions') {
      resourceId = pathSegments[pathSegments.length - 2];
      resource = pathSegments[pathSegments.length - 1];
    }
    // Pour /interventions-v2/interventions/light ou /interventions-v2/interventions/summary
    // Vérifier AVANT les IDs pour éviter de confondre 'light' ou 'summary' avec un ID
    else if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'interventions') {
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment === 'light' || lastSegment === 'summary') {
        resource = 'interventions';
        subResource = lastSegment;
      } else {
        // Sinon c'est probablement un ID
        resourceId = lastSegment;
        resource = 'interventions';
      }
    }
    // Pour /interventions-v2/interventions
    else if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1] === 'interventions') {
      resource = 'interventions';
    }

    // ===== GET /interventions/light - Liste légère pour warm-up =====
    if (req.method === 'GET' && resource === 'interventions' && subResource === 'light') {
      const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
      const clampedLimit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 50000));
      const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
      const clampedOffset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

      const statutFilters = parseListParam(url.searchParams.getAll('statut'));
      const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
      const metierFilters = parseListParam(url.searchParams.getAll('metier'));

      const userValues = url.searchParams.getAll('user');
      const userIds = parseListParam(
        userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
      );
      const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

      const searchRaw = url.searchParams.get('search')?.trim() ?? null;
      const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
      const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;

      const filters: FilterParams = {
        search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
        startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
        endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
      };

      if (statutFilters.length > 0) {
        filters.statut = statutFilters;
      }
      if (agenceFilters.length > 0) {
        filters.agence = agenceFilters;
      }
      if (metierFilters.length > 0) {
        filters.metier = metierFilters;
      }
      if (userIds.length > 0) {
        filters.user = userIds;
      } else if (userIsNull) {
        filters.userIsNull = true;
      }

      // Sélection minimale pour le warm-up : uniquement les champs essentiels
      const lightSelect = 'id,id_inter,statut_id,date,date_prevue,agence_id,assigned_user_id,updated_by,metier_id,created_at,updated_at';

      let query = supabase
        .from('interventions')
        .select(lightSelect, { count: 'exact' })
        .eq('is_active', true)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      query = applyFilters(query, filters);
      query = query.range(clampedOffset, clampedOffset + clampedLimit - 1);

      const fetchStart = Date.now();
      const { data, error, count } = await query;
      const fetchDuration = Date.now() - fetchStart;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const filteredData = Array.isArray(data) ? data : [];
      const totalCount = count ?? await getCachedCount(supabase, filters);

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          endpoint: 'light',
          responseTime: fetchDuration,
          dataCount: filteredData.length,
          totalCount,
          offset: clampedOffset,
          limit: clampedLimit,
          timestamp: new Date().toISOString(),
          message: 'Light interventions retrieved successfully',
        }),
      );

      return new Response(
        JSON.stringify({
          data: filteredData,
          pagination: {
            total: totalCount,
            limit: clampedLimit,
            offset: clampedOffset,
            hasMore: clampedOffset + clampedLimit < totalCount,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ===== GET /interventions/summary - Résumé par vue =====
    if (req.method === 'GET' && resource === 'interventions' && subResource === 'summary') {
      const statutFilters = parseListParam(url.searchParams.getAll('statut'));
      const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
      const metierFilters = parseListParam(url.searchParams.getAll('metier'));

      const userValues = url.searchParams.getAll('user');
      const userIds = parseListParam(
        userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
      );
      const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

      const searchRaw = url.searchParams.get('search')?.trim() ?? null;
      const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
      const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;

      const filters: FilterParams = {
        search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
        startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
        endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
      };

      if (statutFilters.length > 0) {
        filters.statut = statutFilters;
      }
      if (agenceFilters.length > 0) {
        filters.agence = agenceFilters;
      }
      if (metierFilters.length > 0) {
        filters.metier = metierFilters;
      }
      if (userIds.length > 0) {
        filters.user = userIds;
      } else if (userIsNull) {
        filters.userIsNull = true;
      }

      // Obtenir le total avec cache
      const totalCount = await getCachedCount(supabase, filters);

      // Obtenir les compteurs par statut si aucun filtre de statut n'est appliqué
      let countsByStatus: Record<string, number> = {};
      if (!filters.statut || filters.statut.length === 0) {
        // Construire une requête avec les mêmes filtres mais sans filtre de statut
        let countQuery = supabase
          .from('interventions')
          .select('statut_id', { count: 'exact' })
          .eq('is_active', true);

        // Appliquer les autres filtres (agence, metier, user, dates, search)
        const filtersWithoutStatut: FilterParams = { ...filters };
        delete filtersWithoutStatut.statut;
        countQuery = applyFilters(countQuery, filtersWithoutStatut);

        const { data: interventions, error: statusError } = await countQuery;

        if (!statusError && interventions) {
          // Compter par statut
          const statusMap = new Map<string, number>();
          for (const item of interventions) {
            const statusId = item.statut_id;
            if (statusId) {
              statusMap.set(statusId, (statusMap.get(statusId) || 0) + 1);
            }
          }
          countsByStatus = Object.fromEntries(statusMap);
        }
      }

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          endpoint: 'summary',
          totalCount,
          countsByStatus,
          timestamp: new Date().toISOString(),
          message: 'Interventions summary retrieved successfully',
        }),
      );

      return new Response(
        JSON.stringify({
          total: totalCount,
          countsByStatus,
          filters: {
            statut: filters.statut || [],
            agence: filters.agence || [],
            metier: filters.metier || [],
            user: filters.user || [],
            userIsNull: filters.userIsNull || false,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            search: filters.search || null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ===== GET /interventions - Liste toutes les interventions =====
    // ✅ Pagination avec offset et limit
    if (req.method === 'GET' && resource === 'interventions') {
      const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
      const clampedLimit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 50000));
      const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
      const clampedOffset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
      
      console.log(`[Edge Function] Pagination - rawOffset: ${rawOffset}, clampedOffset: ${clampedOffset}, rawLimit: ${rawLimit}, clampedLimit: ${clampedLimit}`);
      
      const include = parseListParam(url.searchParams.getAll('include'));
      const extraSelect = url.searchParams.get('select');
      const artisanFilters = parseListParam(url.searchParams.getAll('artisan'));

      const statutFilters = parseListParam(url.searchParams.getAll('statut'));
      const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
      const metierFilters = parseListParam(url.searchParams.getAll('metier'));

      const userValues = url.searchParams.getAll('user');
      const userIds = parseListParam(
        userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
      );
      const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

      const searchRaw = url.searchParams.get('search')?.trim() ?? null;
      const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
      const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;

      const filters: FilterParams = {
        search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
        startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
        endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
      };

      if (statutFilters.length > 0) {
        filters.statut = statutFilters;
      }
      if (agenceFilters.length > 0) {
        filters.agence = agenceFilters;
      }
      if (metierFilters.length > 0) {
        filters.metier = metierFilters;
      }
      if (userIds.length > 0) {
        filters.user = userIds;
      } else if (userIsNull) {
        filters.userIsNull = true;
      }

      const selectClause = buildSelectClause(extraSelect, include);

      let query = supabase
        .from('interventions')
        .select(selectClause, { count: 'exact' })
        .eq('is_active', true)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      query = applyFilters(query, filters);
      
      // Appliquer la pagination APRÈS les filtres
      query = query.range(clampedOffset, clampedOffset + clampedLimit - 1);
      
      console.log(`[Edge Function] Requête avec range(${clampedOffset}, ${clampedOffset + clampedLimit - 1})`);

      const fetchStart = Date.now();
      const { data, error, count } = await query;
      const fetchDuration = Date.now() - fetchStart;
      
      if (data && Array.isArray(data) && data.length > 0) {
        console.log(`[Edge Function] Résultats - Premier ID: ${data[0].id}, Dernier ID: ${data[data.length - 1].id}, Total: ${data.length}`);
      } else {
        console.log(`[Edge Function] Résultats - Aucune donnée retournée`);
      }

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      let filteredData = Array.isArray(data) ? data : [];

      // Filtrage artisan en post-traitement si nécessaire
      if (artisanFilters.length > 0) {
        const { data: artisanInterventions, error: artisanError } = await supabase
          .from('intervention_artisans')
          .select('intervention_id')
          .in('artisan_id', artisanFilters);

        if (artisanError) {
          console.error(
            JSON.stringify({
              level: 'error',
              requestId,
              error: artisanError.message,
              artisanFilters,
              message: 'Failed to filter interventions by artisan',
            }),
          );
        } else {
          const interventionIds = new Set(
            (artisanInterventions ?? [])
              .map((entry) => entry?.intervention_id as string | null)
              .filter((value): value is string => Boolean(value)),
          );
          filteredData = filteredData.filter((intervention) => interventionIds.has(intervention.id));
        }
      }

      const totalCount = count ?? await getCachedCount(supabase, filters);
      const hasMore = clampedOffset + clampedLimit < totalCount;

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          responseTime: fetchDuration,
          dataCount: filteredData.length,
          totalCount,
          offset: clampedOffset,
          limit: clampedLimit,
          hasMore,
          timestamp: new Date().toISOString(),
          message: 'Interventions retrieved successfully',
        }),
      );

      return new Response(
        JSON.stringify({
          data: filteredData,
          pagination: {
            total: totalCount,
            limit: clampedLimit,
            offset: clampedOffset,
            hasMore,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ===== GET /interventions/{id} - Intervention par ID =====
    if (req.method === 'GET' && resourceId && resource === 'interventions') {
      const includeRelations = url.searchParams.get('include')?.split(',') || [];

      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id,
          id_inter,
          agence_id,
          tenant_id,
          owner_id,
          assigned_user_id,
          updated_by,
          statut_id,
          metier_id,
          date,
          date_termine,
          date_prevue,
          due_date,
          contexte_intervention,
          consigne_intervention,
          consigne_second_artisan,
          commentaire_agent,
          adresse,
          code_postal,
          ville,
          latitude,
          longitude,
          is_active,
          created_at,
          updated_at
          ${includeRelations.includes('agencies') ? ',agencies(id,label,code)' : ''}
          ${
            includeRelations.includes('tenants') || includeRelations.includes('clients')
              ? ',tenants:tenant_id(id,firstname,lastname,email,telephone,telephone2)'
              : ''
          }
          ${includeRelations.includes('users') ? ',users!assigned_user_id(id,firstname,lastname,username)' : ''}
          ${includeRelations.includes('statuses') ? ',intervention_statuses(id,code,label,color)' : ''}
          ${includeRelations.includes('metiers') ? ',metiers(id,label,code)' : ''}
          ${includeRelations.includes('artisans') ? ',intervention_artisans(artisan_id,role,is_primary,artisans(id,prenom,nom,telephone,email))' : ''}
          ${includeRelations.includes('costs') ? ',intervention_costs(id,cost_type,label,amount,currency,created_at)' : ''}
          ${includeRelations.includes('payments') ? ',intervention_payments(id,payment_type,amount,is_received,payment_date,reference)' : ''}
          ${includeRelations.includes('attachments') ? ',intervention_attachments(id,kind,url,filename,mime_type,file_size)' : ''}
          ${includeRelations.includes('comments') ? ',comments(id,content,comment_type,is_internal,created_at,users!author_id(firstname,lastname))' : ''}
        `)
        .eq('id', resourceId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Intervention not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/upsert - Upsert une intervention =====
    if (req.method === 'POST' && resource === 'interventions' && resourceId === 'upsert') {
      const body: CreateInterventionRequest = await req.json();

      // Validation des données requises
      if (!body.date) {
        return new Response(
          JSON.stringify({ error: 'Date is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Si id_inter est fourni, chercher l'intervention existante
      if (body.id_inter) {
        const { data: existing, error: findError } = await supabase
          .from('interventions')
          .select('id')
          .eq('id_inter', body.id_inter)
          .single();

        if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
          throw new Error(`Failed to search intervention: ${findError.message}`);
        }

        if (existing) {
          // Mettre à jour l'intervention existante
          const { data, error } = await supabase
            .from('interventions')
            .update({
              agence_id: body.agence_id,
              reference_agence: body.reference_agence ?? null,
              tenant_id: body.tenant_id ?? body.client_id ?? null,
              owner_id: body.owner_id ?? null,
              assigned_user_id: body.assigned_user_id,
              statut_id: body.statut_id,
              metier_id: body.metier_id,
              date: body.date,
              date_prevue: body.date_prevue,
              contexte_intervention: body.contexte_intervention,
              consigne_intervention: body.consigne_intervention,
              consigne_second_artisan: body.consigne_second_artisan,
              adresse: body.adresse,
              code_postal: body.code_postal,
              ville: body.ville,
              latitude: body.latitude,
              longitude: body.longitude,
              is_vacant: body.is_vacant ?? false,
              key_code: body.key_code ?? null,
              floor: body.floor ?? null,
              apartment_number: body.apartment_number ?? null,
              vacant_housing_instructions: body.vacant_housing_instructions ?? null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to update intervention: ${error.message}`);
          }

          console.log(JSON.stringify({
            level: 'info',
            requestId,
            interventionId: data.id,
            idInter: data.id_inter,
            timestamp: new Date().toISOString(),
            message: 'Intervention updated via upsert'
          }));

          await handleInterventionCompletionSideEffects(supabase, data, requestId);

          return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Créer une nouvelle intervention
      const { data, error } = await supabase
        .from('interventions')
        .insert([{
          id_inter: body.id_inter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create intervention: ${error.message}`);
      }

      // Créer les transitions automatiques si un statut est défini
      const authHeader = req.headers.get('authorization');
      let userId: string | null = null;
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
      await createAutomaticStatusTransitions(supabase, data.id, data.statut_id, userId, requestId);

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: data.id,
        idInter: data.id_inter,
        timestamp: new Date().toISOString(),
        message: 'Intervention created via upsert'
      }));

      await handleInterventionCompletionSideEffects(supabase, data, requestId);

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions - Créer une intervention =====
    if (req.method === 'POST' && resource === 'interventions') {
      const body: CreateInterventionRequest = await req.json();

      // Validation des données requises
      if (!body.date) {
        return new Response(
          JSON.stringify({ error: 'Date is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fonction helper pour générer un nouvel id_inter en cas de collision
      const generateUniqueIdInter = async (baseIdInter: string | null | undefined): Promise<string | null> => {
        if (!baseIdInter) return null;
        
        // Si ce n'est pas un ID auto-généré, retourner tel quel (sera vérifié plus tard)
        if (!baseIdInter.startsWith('AUTO-')) {
          return baseIdInter;
        }

        // Pour les IDs auto-générés, vérifier l'unicité et générer un nouveau si nécessaire
        let attemptIdInter = baseIdInter;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          const { data: existing } = await supabase
            .from('interventions')
            .select('id')
            .eq('id_inter', attemptIdInter)
            .maybeSingle();

          if (!existing) {
            // ID unique trouvé
            return attemptIdInter;
          }

          // Collision détectée, générer un nouvel ID
          attempts++;
          const timestampSegment = Date.now().toString().slice(-6);
          const randomSegment = Math.floor(Math.random() * 100000)
            .toString()
            .padStart(5, '0');
          const uuidSegment = crypto.randomUUID().slice(0, 8);
          attemptIdInter = `AUTO-${timestampSegment}-${randomSegment}-${uuidSegment}`;
        }

        // Si après plusieurs tentatives on a toujours une collision, retourner null
        // La base de données générera une erreur et on la gérera
        return attemptIdInter;
      };

      // Vérifier si id_inter existe déjà (sauf pour les IDs auto-générés qui seront régénérés)
      let finalIdInter = body.id_inter;
      if (finalIdInter && !finalIdInter.startsWith('AUTO-')) {
        const { data: existing, error: checkError } = await supabase
          .from('interventions')
          .select('id')
          .eq('id_inter', finalIdInter)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw new Error(`Failed to check id_inter uniqueness: ${checkError.message}`);
        }

        if (existing) {
          return new Response(
            JSON.stringify({ error: `An intervention with id_inter "${finalIdInter}" already exists` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (finalIdInter && finalIdInter.startsWith('AUTO-')) {
        // Pour les IDs auto-générés, s'assurer de l'unicité
        finalIdInter = await generateUniqueIdInter(finalIdInter) ?? finalIdInter;
      }

      const { data, error } = await supabase
        .from('interventions')
        .insert([{
          id_inter: finalIdInter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        // Si l'erreur est une violation de contrainte unique sur id_inter, essayer avec un nouvel ID
        if (error.message?.includes('duplicate key') && error.message?.includes('id_inter') && finalIdInter?.startsWith('AUTO-')) {
          console.log(JSON.stringify({
            level: 'warn',
            requestId,
            originalIdInter: finalIdInter,
            message: 'Duplicate id_inter detected, generating new one'
          }));

          // Générer un nouvel ID unique
          const newIdInter = await generateUniqueIdInter(finalIdInter);
          if (newIdInter && newIdInter !== finalIdInter) {
            // Réessayer avec le nouvel ID
            const { data: retryData, error: retryError } = await supabase
              .from('interventions')
              .insert([{
                id_inter: newIdInter,
                agence_id: body.agence_id,
                reference_agence: body.reference_agence ?? null,
                tenant_id: body.tenant_id ?? body.client_id ?? null,
                owner_id: body.owner_id ?? null,
                assigned_user_id: body.assigned_user_id,
                statut_id: body.statut_id,
                metier_id: body.metier_id,
                date: body.date,
                date_prevue: body.date_prevue,
                contexte_intervention: body.contexte_intervention,
                consigne_intervention: body.consigne_intervention,
                consigne_second_artisan: body.consigne_second_artisan,
                adresse: body.adresse,
                code_postal: body.code_postal,
                ville: body.ville,
                latitude: body.latitude,
                longitude: body.longitude,
                is_vacant: body.is_vacant ?? false,
                key_code: body.key_code ?? null,
                floor: body.floor ?? null,
                apartment_number: body.apartment_number ?? null,
                vacant_housing_instructions: body.vacant_housing_instructions ?? null,
                is_active: true
              }])
              .select()
              .single();

            if (retryError) {
              throw new Error(`Failed to create intervention after retry: ${retryError.message}`);
            }

            console.log(JSON.stringify({
              level: 'info',
              requestId,
              interventionId: retryData.id,
              originalIdInter: finalIdInter,
              newIdInter: newIdInter,
              timestamp: new Date().toISOString(),
              message: 'Intervention created successfully with regenerated id_inter'
            }));

            // Créer les transitions automatiques si un statut est défini
            const authHeaderRetry = req.headers.get('authorization');
            let userIdRetry: string | null = null;
            if (authHeaderRetry) {
              const tokenRetry = authHeaderRetry.replace('Bearer ', '');
              const { data: { user: userRetry } } = await supabase.auth.getUser(tokenRetry);
              userIdRetry = userRetry?.id || null;
            }
            await createAutomaticStatusTransitions(supabase, retryData.id, retryData.statut_id, userIdRetry, requestId);

            await handleInterventionCompletionSideEffects(supabase, retryData, requestId);

            return new Response(
              JSON.stringify(retryData),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        throw new Error(`Failed to create intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Intervention created successfully'
      }));

      // Créer les transitions automatiques si un statut est défini
      const authHeaderPost = req.headers.get('authorization');
      let userIdPost: string | null = null;
      if (authHeaderPost) {
        const tokenPost = authHeaderPost.replace('Bearer ', '');
        const { data: { user: userPost } } = await supabase.auth.getUser(tokenPost);
        userIdPost = userPost?.id || null;
      }
      await createAutomaticStatusTransitions(supabase, data.id, data.statut_id, userIdPost, requestId);

      await handleInterventionCompletionSideEffects(supabase, data, requestId);

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUT /interventions/{id} - Modifier une intervention =====
    if (req.method === 'PUT' && resourceId && resource === 'interventions') {
      const body: UpdateInterventionRequest = await req.json();

      // Récupérer l'intervention actuelle pour avoir le statut précédent
      const { data: currentIntervention, error: fetchError } = await supabase
        .from('interventions')
        .select('statut_id')
        .eq('id', resourceId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch current intervention: ${fetchError.message}`);
      }

      const oldStatutId = currentIntervention?.statut_id || null;

      // Si le statut change, enregistrer la transition AVANT la mise à jour
      if (body.statut_id && oldStatutId !== body.statut_id) {
        try {
          // Récupérer l'utilisateur depuis le token JWT
          const authHeader = req.headers.get('authorization');
          let userId: string | null = null;

          if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
          }

          // Enregistrer la transition explicitement via la fonction SQL
          // Le trigger SQL détectera cette transition (source='api') et ne créera pas de doublon
          const { error: transitionError } = await supabase.rpc(
            'log_status_transition_from_api',
            {
              p_intervention_id: resourceId,
              p_from_status_id: oldStatutId,
              p_to_status_id: body.statut_id,
              p_changed_by_user_id: userId,
              p_metadata: {
                updated_via: 'edge_function',
                updated_at: new Date().toISOString(),
                created_by: 'EdgeFunction',
                // Note: Le trigger SQL vérifie les transitions avec source='api' dans les 5 dernières secondes
                // pour éviter les doublons lors de l'UPDATE qui suit
              }
            }
          );

          if (transitionError) {
            console.error(JSON.stringify({
              level: 'warn',
              requestId,
              interventionId: resourceId,
              message: 'Erreur lors de l\'enregistrement de la transition',
              error: transitionError.message,
            }));
            // Ne pas bloquer la mise à jour si l'enregistrement de la transition échoue
            // Le trigger de sécurité prendra le relais
          }
        } catch (error) {
          console.error(JSON.stringify({
            level: 'warn',
            requestId,
            interventionId: resourceId,
            message: 'Erreur lors de l\'enregistrement de la transition',
            error: error instanceof Error ? error.message : String(error),
          }));
          // Continuer quand même, le trigger de sécurité enregistrera
        }
      }

      const { data, error } = await supabase
        .from('interventions')
        .update({
          id_inter: body.id_inter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_termine: body.date_termine,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          commentaire_agent: body.commentaire_agent,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          is_active: body.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Intervention updated successfully'
      }));

      await handleInterventionCompletionSideEffects(supabase, data, requestId);

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /interventions/{id} - Supprimer une intervention (soft delete) =====
    if (req.method === 'DELETE' && resourceId && resource === 'interventions') {
      const { data, error } = await supabase
        .from('interventions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delete intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Intervention deleted successfully'
      }));

      return new Response(
        JSON.stringify({ message: 'Intervention deleted successfully', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/artisans - Assigner un artisan =====
    if (req.method === 'POST' && resourceId && resource === 'artisans') {
      const body: AssignArtisanRequest = await req.json();

      if (!body.artisan_id) {
        return new Response(
          JSON.stringify({ error: 'artisan_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_artisans')
        .insert([{
          intervention_id: resourceId,
          artisan_id: body.artisan_id,
          role: body.role || 'primary',
          is_primary: body.is_primary ?? (body.role === 'primary')
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign artisan: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        artisanId: body.artisan_id,
        timestamp: new Date().toISOString(),
        message: 'Artisan assigned successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/comments - Ajouter un commentaire =====
    if (req.method === 'POST' && resourceId && resource === 'comments') {
      const body: CreateCommentRequest = await req.json();

      if (!body.content) {
        return new Response(
          JSON.stringify({ error: 'content is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          entity_id: resourceId,
          entity_type: 'intervention',
          content: body.content,
          comment_type: body.comment_type || 'internal',
          is_internal: body.is_internal ?? true
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        commentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Comment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/attachments - Ajouter un document =====
    if (req.method === 'POST' && resourceId && resource === 'attachments') {
      const body: CreateAttachmentRequest = await req.json();

      if (!body.kind || !body.url) {
        return new Response(
          JSON.stringify({ error: 'kind and url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const canonicalKind = normalizeInterventionAttachmentKind(body.kind);
      if (!INTERVENTION_ATTACHMENT_KINDS.includes(canonicalKind)) {
        return new Response(
          JSON.stringify({
            error: `Invalid attachment kind. Allowed: ${INTERVENTION_ATTACHMENT_KINDS.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_attachments')
        .insert([{
          intervention_id: resourceId,
          kind: canonicalKind,
          url: body.url,
          filename: body.filename,
          mime_type: body.mime_type,
          file_size: body.file_size
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create attachment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        attachmentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Attachment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/costs - Ajouter un coût =====
    if (req.method === 'POST' && resourceId && resource === 'costs') {
      const body: CreateCostRequest = await req.json();

      if (!body.cost_type || body.amount === null || body.amount === undefined) {
        return new Response(
          JSON.stringify({ error: 'cost_type and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_costs')
        .insert([{
          intervention_id: resourceId,
          cost_type: body.cost_type,
          label: body.label,
          amount: body.amount,
          currency: body.currency || 'EUR',
          metadata: body.metadata
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create cost: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        costId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Cost created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/payments - Ajouter un paiement =====
    if (req.method === 'POST' && resourceId && resource === 'payments') {
      const body: CreatePaymentRequest = await req.json();

      if (!body.payment_type || !body.amount) {
        return new Response(
          JSON.stringify({ error: 'payment_type and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_payments')
        .insert([{
          intervention_id: resourceId,
          payment_type: body.payment_type,
          amount: body.amount,
          currency: body.currency || 'EUR',
          is_received: body.is_received ?? false,
          payment_date: body.payment_date,
          reference: body.reference
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create payment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        paymentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Payment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.log(JSON.stringify({
      level: 'error',
      requestId: requestId || 'unknown',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      message: 'Interventions API request failed'
    }));

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
