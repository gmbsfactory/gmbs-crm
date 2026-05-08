// ===== INTERVENTIONS-V2 - HELPERS =====
// Constantes, parseurs d'URL, builders de requête (select / filtres / curseur),
// cache de comptage, et calcul du statut de dossier artisan.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  CursorDirection,
  FilterParams,
  InterventionCursor,
} from './types.ts';

// ---------- Constantes métier ----------

export const TERMINATED_INTERVENTION_CODES = ['TERMINE', 'INTER_TERMINEE'];
export const ARTISAN_LEVEL_CODES = ['NOVICE', 'FORMATION', 'CONFIRME', 'EXPERT'];
export const REQUIRED_DOCUMENT_KINDS = ['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
export const INTERVENTION_ATTACHMENT_KINDS = [
  'devis',
  'photos',
  'facturesGMBS',
  'facturesArtisans',
  'facturesMateriel',
  'autre',
  'a_classe',
];

// ---------- Normalisation des kinds d'attachements ----------

export function normalizeInterventionAttachmentKind(kind: string): string {
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
 * Calcule le statut de dossier d'un artisan basé sur ses documents.
 */
export function calculateDossierStatus(
  attachments: Array<{ kind: string }> | null | undefined,
  hasCompletedIntervention: boolean,
): 'INCOMPLET' | 'À compléter' | 'COMPLET' {
  if (!attachments || attachments.length === 0) {
    return hasCompletedIntervention ? 'À compléter' : 'INCOMPLET';
  }

  const presentKinds = new Set(
    attachments
      .map((att) => att.kind?.toLowerCase().trim())
      .filter(Boolean),
  );

  const requiredKindsLower = REQUIRED_DOCUMENT_KINDS.map((k) => k.toLowerCase());
  const missingDocuments = requiredKindsLower.filter(
    (kind) => !presentKinds.has(kind),
  );

  if (missingDocuments.length === 0) {
    return 'COMPLET';
  }

  const totalRequired = REQUIRED_DOCUMENT_KINDS.length;
  if (hasCompletedIntervention && (missingDocuments.length === totalRequired || missingDocuments.length === 1)) {
    return 'À compléter';
  }

  return 'INCOMPLET';
}

// ---------- Cache de comptage ----------

const COUNT_CACHE_TTL_MS = 120 * 1000;
const countCache = new Map<string, { value: number; expiresAt: number }>();

// ---------- Tri (whitelist) ----------

export const SORTABLE_DIRECT_COLUMNS: Record<string, string> = {
  date: 'created_at',
  created_at: 'created_at',
  dateIntervention: 'date',
  datePrevue: 'date_prevue',
  date_prevue: 'date_prevue',
  date_termine: 'date_termine',
  due_date: 'due_date',
  id_inter: 'id_inter',
  updated_at: 'updated_at',
};

export const SORTABLE_COST_PROPERTIES = new Set([
  'coutIntervention', 'coutSST', 'coutMateriel', 'marge',
]);

export function parseSortParams(url: URL): { sortBy: string | null; sortDir: 'asc' | 'desc' } {
  const rawSortBy = url.searchParams.get('sort_by')?.trim() ?? null;
  const rawSortDir = url.searchParams.get('sort_dir')?.trim()?.toLowerCase();
  const sortDir: 'asc' | 'desc' = rawSortDir === 'asc' ? 'asc' : 'desc';

  if (rawSortBy && (SORTABLE_DIRECT_COLUMNS[rawSortBy] || SORTABLE_COST_PROPERTIES.has(rawSortBy))) {
    return { sortBy: rawSortBy, sortDir };
  }
  return { sortBy: null, sortDir: 'desc' };
}

export function applySort<T extends { order: Function }>(
  query: T,
  sortBy: string | null,
  sortDir: 'asc' | 'desc',
): T {
  if (sortBy && SORTABLE_DIRECT_COLUMNS[sortBy]) {
    const dbColumn = SORTABLE_DIRECT_COLUMNS[sortBy];
    query = query.order(dbColumn, { ascending: sortDir === 'asc', nullsFirst: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  query = query.order('id', { ascending: false });
  return query;
}

// ---------- SELECT par défaut + relations ----------

export const DEFAULT_INTERVENTION_COLUMNS = [
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
  'sous_statut_text',
  'sous_statut_text_color',
  'sous_statut_bg_color',
];

export const DEFAULT_SELECT = DEFAULT_INTERVENTION_COLUMNS.join(',');

export const AVAILABLE_RELATIONS: Record<string, string> = {
  agencies: 'agencies(id,label,code)',
  tenants: 'tenants:tenant_id(id,firstname,lastname,plain_nom_client,email,telephone,telephone2)',
  users: 'users!assigned_user_id(id,firstname,lastname,username,color,code_gestionnaire,avatar_url)',
  statuses: 'intervention_statuses(id,code,label,color,sort_order)',
  metiers: 'metiers(id,label,code)',
  artisans: 'intervention_artisans(id,artisan_id,is_primary,role,artisans(id,nom,prenom,plain_nom,email,telephone,telephone2,numero_associe,siret,raison_sociale,status:artisan_statuses(id,code,label,color)))',
  costs: 'intervention_costs(id,cost_type,label,amount,currency)',
  payments: 'intervention_payments(id,payment_type,amount,is_received,payment_date,reference)',
  owner: 'owner:owner_id(id,owner_firstname,owner_lastname,plain_nom_facturation,email,telephone)',
};

// ---------- Parseurs d'URL ----------

export const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Failed to parse JSON parameter', { raw, error });
    return null;
  }
};

export const parseDirection = (direction?: string | null): CursorDirection => {
  return direction === 'backward' ? 'backward' : 'forward';
};

export const parseCursorParam = (raw: string | null): InterventionCursor | null => {
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

export const parseListParam = (values: string[]): string[] => {
  return values
    .flatMap((value) => value.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

// ---------- SELECT clause builder ----------

export const buildSelectClause = (
  extraSelect: string | null,
  include: string[],
  hasSearch: boolean = false,
): string => {
  const base = new Set<string>(DEFAULT_INTERVENTION_COLUMNS);
  const selectFragments: string[] = [];

  // ⚠️ TOUJOURS inclure les artisans, coûts, tenants et users par défaut
  // Les tenants sont nécessaires pour l'affichage des informations client dans ExpandedRowContent
  // Les users sont nécessaires pour l'affichage des badges des gestionnaires dans TableView
  const defaultRelations = ['artisans', 'costs', 'payments', 'tenants', 'users'];

  // Si recherche active, inclure aussi agencies pour le filtrage client
  const searchRelations = hasSearch ? ['agencies'] : [];
  const allIncludes = [...new Set([...defaultRelations, ...searchRelations, ...include])];

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

// ---------- Recherche serveur (actuellement désactivée) ----------

// ⚠️ IMPORTANT: Maintenir cette liste synchronisée avec src/lib/api/v2/search.ts
export const INTERVENTION_SEARCH_FIELDS = [
  'id_inter',
  'contexte_intervention',
  'adresse',
  'ville',
  'code_postal',
  'commentaire_agent',
  'consigne_intervention',
] as const;

export const escapeIlike = (value: string): string => {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
};

export const buildSearchOrFilters = (searchTerm: string): string => {
  const trimmed = searchTerm.trim();
  if (!trimmed) return '';

  const pattern = escapeIlike(trimmed);
  if (!pattern || pattern.length === 0) return '';

  const orFilters = INTERVENTION_SEARCH_FIELDS.map(
    (field) => `${field}.ilike.*${pattern}*`,
  );

  return orFilters.join(',');
};

// ---------- Application des filtres ----------

export const applyFilters = <T extends { in: Function; eq: Function; gte: Function; lte: Function; ilike: Function; is: Function; or: Function }>(
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
  // ⚠️ Filtrage `search` désactivé côté serveur : laisser le client filtrer
  // (incluant les relations agence/tenant/artisan que .or() ne peut pas couvrir).
  // Le client récupère 3x plus de résultats pour compenser.

  return builder;
};

// ---------- Curseur (keyset pagination) ----------

export const buildCursorCondition = (cursor: InterventionCursor): string | null => {
  if (!cursor?.date || !cursor?.id) return null;
  const sanitizedDate = cursor.date.replace(/,/g, '\\,');
  const sanitizedId = cursor.id.replace(/,/g, '\\,');
  if (parseDirection(cursor.direction) === 'backward') {
    return `and(date.gt.${sanitizedDate}),and(date.eq.${sanitizedDate},id.gt.${sanitizedId})`;
  }
  return `and(date.lt.${sanitizedDate}),and(date.eq.${sanitizedDate},id.lt.${sanitizedId})`;
};

export const createCursor = (row: any, direction: CursorDirection): InterventionCursor | null => {
  if (!row?.date || !row?.id) return null;
  return { date: row.date, id: row.id, direction };
};

// ---------- Cache de comptage (filtres → total) ----------

const buildCountCacheKey = (filters: FilterParams) => {
  return JSON.stringify({
    ...filters,
    user: filters.user ?? null,
    userIsNull: filters.userIsNull ?? false,
  });
};

export const getCachedCount = async (supabase: SupabaseClient, filters: FilterParams) => {
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
