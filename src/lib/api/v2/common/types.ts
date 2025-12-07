// ===== TYPES COMMUNS POUR L'API V2 =====
// Types partagés entre toutes les APIs

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface User {
  id: string;
  firstname: string | null;
  lastname: string | null;
  username: string;
  email: string | null;
  roles: string[];
  token_version: number | null;
  color: string | null;
  code_gestionnaire: string | null;
  status: "connected" | "dnd" | "busy" | "offline";
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Artisan {
  id: string;
  prenom: string | null;
  nom: string | null;
  plain_nom: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  raison_sociale: string | null;
  siret: string | null;
  statut_juridique: string | null;
  statut_id: string | null;
  gestionnaire_id: string | null;
  adresse_siege_social: string | null;
  ville_siege_social: string | null;
  code_postal_siege_social: string | null;
  departement: string | null;
  adresse_intervention: string | null;
  ville_intervention: string | null;
  code_postal_intervention: string | null;
  intervention_latitude: number | null;
  intervention_longitude: number | null;
  numero_associe: string | null;
  suivi_relances_docs: string | null;
  is_active: boolean | null;
  date_ajout: string | null;
  created_at: string | null;
  updated_at: string | null;
  metiers?: string[];
  zones?: string[];
}

export interface Intervention {
  id: string;
  id_inter: string | null;
  agence_id: string | null;
  reference_agence: string | null;
  tenant_id: string | null;
  owner_id: string | null;
  client_id?: string | null;
  artisan_id?: string | null;
  assigned_user_id: string | null;
  updated_by: string | null; // Utilisateur qui a effectué la dernière modification
  statut_id: string | null;
  metier_id: string | null;
  date: string;
  date_termine: string | null;
  date_prevue: string | null;
  due_date: string | null;
  contexte_intervention: string | null;
  consigne_intervention: string | null;
  consigne_second_artisan: string | null;
  commentaire_agent: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
  numero_sst: string | null;
  pourcentage_sst: number | null;
  is_vacant: boolean | null;
  key_code: string | null;
  floor: string | null;
  apartment_number: string | null;
  vacant_housing_instructions: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  artisans?: string[];
  costs?: InterventionCost[];
  payments?: InterventionPayment[];
  attachments?: InterventionAttachment[];
}

export interface InterventionCost {
  id: string;
  intervention_id: string;
  cost_type: "sst" | "materiel" | "intervention" | "marge";
  label: string | null;
  amount: number;
  currency: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionPayment {
  id: string;
  intervention_id: string;
  payment_type: string;
  amount: number;
  currency: string | null;
  is_received: boolean | null;
  payment_date: string | null;
  reference: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionAttachment {
  id: string;
  intervention_id: string;
  kind: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string | null;
}

export interface InterventionReminder {
  id: string;
  intervention_id: string;
  user_id: string;
  note: string | null;
  due_date: string | null;
  mentioned_user_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  mentioned_users?: Array<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  }>;
}

export interface ArtisanAttachment {
  id: string;
  artisan_id: string;
  kind: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  content_hash?: string | null;
  derived_sizes?: Record<string, string> | null;
  mime_preferred?: string | null;
  created_at: string | null;
  created_by: string | null;
  created_by_display: string | null;
  created_by_code: string | null;
  created_by_color: string | null;
}

export type CommentReasonType = "archive" | "done";

export interface Comment {
  id: string;
  entity_id: string;
  entity_type: "intervention" | "artisan" | "client";
  content: string;
  comment_type: string;
  is_internal: boolean | null;
  author_id: string | null;
  reason_type?: CommentReasonType | null;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    username: string;
    color: string | null;
  };
}

export interface Client {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Types pour les paramètres de requête
export interface BaseQueryParams {
  limit?: number;
  offset?: number;
}

export interface UserQueryParams extends BaseQueryParams {
  status?: string;
  role?: string;
}

export interface InterventionQueryParams extends BaseQueryParams {
  statut?: string;
  agence?: string;
  artisan?: string;
  user?: string;
  startDate?: string;
  endDate?: string;
  include?: string[];
}

export interface ArtisanQueryParams extends BaseQueryParams {
  statut?: string;
  metier?: string;
  zone?: string;
  gestionnaire?: string;
  statut_dossier?: string;
}

export interface DocumentQueryParams extends BaseQueryParams {
  entity_type?: "intervention" | "artisan";
  entity_id?: string;
  kind?: string;
}

export interface CommentQueryParams extends BaseQueryParams {
  entity_type?: "intervention" | "artisan" | "client";
  entity_id?: string;
  comment_type?: string;
  is_internal?: boolean;
  author_id?: string;
}

// Types pour les données de création/mise à jour
export interface CreateUserData {
  email: string;
  password: string;
  username: string;
  firstname?: string;
  lastname?: string;
  color?: string;
  code_gestionnaire?: string;
  roles?: string[];
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  color?: string;
  code_gestionnaire?: string;
  status?: "connected" | "dnd" | "busy" | "offline";
  roles?: string[];
}

export interface CreateInterventionData {
  id_inter?: string;
  agence_id?: string;
  reference_agence?: string | null;
  tenant_id?: string;
  owner_id?: string;
  client_id?: string;
  artisan_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date: string;
  date_prevue?: string | null;
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

export interface UpdateInterventionData {
  id_inter?: string | null;
  agence_id?: string;
  reference_agence?: string | null;
  tenant_id?: string | null;
  owner_id?: string | null;
  client_id?: string | null;
  artisan_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date?: string;
  date_termine?: string | null;
  date_prevue?: string | null;
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
  is_vacant?: boolean;
  key_code?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  vacant_housing_instructions?: string | null;
  is_active?: boolean;
}

export interface CreateArtisanData {
  prenom?: string;
  nom?: string;
  plain_nom?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  raison_sociale?: string;
  siret?: string;
  statut_juridique?: string;
  statut_id?: string;
  gestionnaire_id?: string;
  adresse_siege_social?: string;
  ville_siege_social?: string;
  code_postal_siege_social?: string;
  adresse_intervention?: string;
  ville_intervention?: string;
  code_postal_intervention?: string;
  intervention_latitude?: number;
  intervention_longitude?: number;
  numero_associe?: string;
  suivi_relances_docs?: string;
  metiers?: string[];
  zones?: string[];
}

export interface UpdateArtisanData {
  prenom?: string;
  nom?: string;
  plain_nom?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  raison_sociale?: string;
  siret?: string;
  statut_juridique?: string;
  statut_id?: string;
  gestionnaire_id?: string;
  adresse_siege_social?: string;
  ville_siege_social?: string;
  code_postal_siege_social?: string;
  adresse_intervention?: string;
  ville_intervention?: string;
  code_postal_intervention?: string;
  intervention_latitude?: number;
  intervention_longitude?: number;
  numero_associe?: string;
  suivi_relances_docs?: string;
  is_active?: boolean;
  metiers?: string[];
  zones?: string[];
}

export interface CreateClientData {
  firstname?: string;
  lastname?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
}

export interface UpdateClientData {
  firstname?: string;
  lastname?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
}

export interface CreateDocumentData {
  entity_id: string;
  entity_type: "intervention" | "artisan";
  kind: string;
  url: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
  created_by?: string;
  created_by_display?: string;
  created_by_code?: string;
  created_by_color?: string;
}

export interface FileUploadData {
  entity_id: string;
  entity_type: "intervention" | "artisan";
  kind: string;
  content: string; // Base64 encoded file content
  filename: string;
  mime_type?: string;
  file_size?: number;
  created_by?: string;
  created_by_display?: string;
  created_by_code?: string;
  created_by_color?: string;
}

export interface SupportedDocumentTypes {
  supported_types: Record<string, string[]>;
  max_file_size: string;
  allowed_mime_types: string[];
}

export interface UpdateDocumentData {
  kind?: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
  created_by?: string | null;
  created_by_display?: string | null;
  created_by_code?: string | null;
  created_by_color?: string | null;
}

export interface CreateCommentData {
  entity_id: string;
  entity_type: "intervention" | "artisan" | "client";
  content: string;
  comment_type?: string;
  is_internal?: boolean;
  author_id?: string;
  reason_type?: CommentReasonType | null;
}

export interface UpdateCommentData {
  content?: string;
  comment_type?: string;
  is_internal?: boolean;
  reason_type?: CommentReasonType | null;
}

export interface CreateRoleData {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface CreatePermissionData {
  key: string;
  description?: string;
}

// Types pour les réponses d'API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BulkOperationResult {
  success: number;
  errors: number;
  details: Array<{
    item: any;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

// Types pour les statistiques
export interface UserStats {
  total: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
  active_today: number;
}

export interface CommentStats {
  total: number;
  by_type: Record<string, number>;
  by_internal: { internal: number; external: number };
  recent_count: number;
}

export interface InterventionStatsByStatus {
  total: number;
  by_status: Record<string, number>; // Clé = code du statut (ex: "INTER_EN_COURS", "INTER_TERMINEE")
  by_status_label: Record<string, number>; // Clé = label du statut (ex: "Inter en cours", "Inter terminée")
  interventions_a_checker?: number; // Nombre d'interventions à checker (statut CHECK)
  period?: {
    start_date: string | null;
    end_date: string | null;
  };
}

export interface ArtisanStatsByStatus {
  total: number;
  by_status: Record<string, number>; // Clé = code du statut (ex: "EXPERT", "NOVICE")
  by_status_label: Record<string, number>; // Clé = label du statut (ex: "Expert", "Novice")
  dossiers_a_completer?: number; // Nombre de dossiers à compléter
  period?: {
    start_date: string | null;
    end_date: string | null;
  };
}

export interface MarginCalculation {
  revenue: number;
  costs: number;
  margin: number;
  marginPercentage: number;
}

export interface MarginStats {
  average_margin_percentage: number; // Pourcentage de marge moyen
  total_interventions: number; // Nombre total d'interventions avec coûts
  total_revenue: number; // Total des coûts d'intervention (revenus)
  total_costs: number; // Total des coûts (SST + Matériel)
  total_margin: number; // Marge totale (revenus - coûts)
  period?: {
    start_date: string | null;
    end_date: string | null;
  };
}

export interface GestionnaireMarginRanking {
  user_id: string;
  user_name: string;
  user_firstname: string | null;
  user_code: string | null;
  user_color: string | null;
  total_margin: number;
  total_revenue: number; // CA (chiffre d'affaires)
  total_interventions: number;
  average_margin_percentage: number;
  rank: number;
}

export interface MarginRankingResult {
  rankings: GestionnaireMarginRanking[];
  period?: {
    start_date: string | null;
    end_date: string | null;
  };
}

export type TargetPeriodType = "week" | "month" | "year"

// Alias pour compatibilité avec le code existant
export type StatsPeriod = "week" | "month" | "year"

export interface GestionnaireTarget {
  id: string
  user_id: string
  period_type: TargetPeriodType
  margin_target: number // Objectif de marge totale en euros
  performance_target: number | null // Objectif de performance en pourcentage (optionnel)
  created_at: string | null
  updated_at: string | null
  created_by: string | null // ID de l'utilisateur qui a créé/modifié l'objectif
}

export interface CreateGestionnaireTargetData {
  user_id: string
  period_type: TargetPeriodType
  margin_target: number
  performance_target?: number | null
}

export interface UpdateGestionnaireTargetData {
  margin_target?: number
  performance_target?: number | null
}
;

// Stats pour la semaine (jours de la semaine)
export interface WeekDayStats {
  lundi: number;
  mardi: number;
  mercredi: number;
  jeudi: number;
  vendredi: number;
  total: number;
}

// Stats pour le mois (semaines du mois)
export interface MonthWeekStats {
  semaine1: number;
  semaine2: number;
  semaine3: number;
  semaine4: number;
  semaine5: number;
  total: number;
}

// Stats pour l'année (mois de l'année)
export interface YearMonthStats {
  janvier: number;
  fevrier: number;
  mars: number;
  avril: number;
  mai: number;
  juin: number;
  juillet: number;
  aout: number;
  septembre: number;
  octobre: number;
  novembre: number;
  decembre: number;
  total: number;
}

// Union type pour les stats selon la période
export type PeriodStats = WeekDayStats | MonthWeekStats | YearMonthStats;

export interface WeeklyStats {
  devis_envoye: WeekDayStats;
  inter_en_cours: WeekDayStats;
  inter_factures: WeekDayStats;
  nouveaux_artisans: WeekDayStats;
  week_start: string; // Date de début de la semaine (lundi)
  week_end: string; // Date de fin de la semaine (vendredi)
}

export interface MonthlyStats {
  devis_envoye: MonthWeekStats;
  inter_en_cours: MonthWeekStats;
  inter_factures: MonthWeekStats;
  nouveaux_artisans: MonthWeekStats;
  month_start: string; // Date de début du mois
  month_end: string; // Date de fin du mois
  month: number; // Mois (1-12)
  year: number; // Année
}

export interface YearlyStats {
  devis_envoye: YearMonthStats;
  inter_en_cours: YearMonthStats;
  inter_factures: YearMonthStats;
  nouveaux_artisans: YearMonthStats;
  year_start: string; // Date de début de l'année
  year_end: string; // Date de fin de l'année
  year: number; // Année
  description?: string;
}

// Types pour les statistiques

export interface CommentStats {
  total: number;
  by_type: Record<string, number>;
  by_internal: { internal: number; external: number };
  recent_count: number;
}

export interface Tenant {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  telephone: string | null;
  telephone2: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  external_ref?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateTenantData {
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  telephone?: string | null;
  telephone2?: string | null;
  adresse?: string | null;
  ville?: string | null;
  code_postal?: string | null;
  external_ref?: string | null;
}

export interface UpdateTenantData {
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  telephone?: string | null;
  telephone2?: string | null;
  adresse?: string | null;
  ville?: string | null;
  code_postal?: string | null;
}

export interface TenantQueryParams extends BaseQueryParams {
  email?: string;
  telephone?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  paginated?: boolean;
}

// ===== TYPES POUR LES OWNERS (PROPRIÉTAIRES) =====

export interface Owner {
  id: string;
  external_ref: string | null;
  owner_firstname: string | null;
  owner_lastname: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOwnerData {
  external_ref?: string | null;
  owner_firstname?: string | null;
  owner_lastname?: string | null;
  telephone?: string | null;
  telephone2?: string | null;
  email?: string | null;
  adresse?: string | null;
  ville?: string | null;
  code_postal?: string | null;
}

export interface UpdateOwnerData {
  owner_firstname?: string | null;
  owner_lastname?: string | null;
  telephone?: string | null;
  telephone2?: string | null;
  email?: string | null;
  adresse?: string | null;
  ville?: string | null;
  code_postal?: string | null;
}

export interface OwnerQueryParams extends BaseQueryParams {
  telephone?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  paginated?: boolean;
}

// ===== TYPES POUR LE DASHBOARD ADMINISTRATEUR =====

export type PeriodType = 'day' | 'week' | 'month' | 'year';

export interface DashboardPeriodParams {
  periodType: PeriodType;
  referenceDate?: string; // Date de référence (par défaut: aujourd'hui)
  startDate?: string; // Optionnel: date de début explicite
  endDate?: string; // Optionnel: date de fin explicite
  agenceIds?: string[] | null; // Optionnel: filtrer par agences (multisélection)
  gestionnaireIds?: string[] | null; // Optionnel: filtrer par gestionnaires (multisélection)
  metierIds?: string[] | null; // Optionnel: filtrer par métiers (multisélection)
}

export interface InterventionStatusTransition {
  id: string;
  intervention_id: string;
  from_status_id: string | null;
  to_status_id: string;
  from_status_code: string | null;
  to_status_code: string;
  changed_by_user_id: string | null;
  transition_date: string;
  source: 'api' | 'trigger';
  metadata: any;
  created_at: string;
}

export interface AdminDashboardStats {
  // 1. Les stats principales avec Deltas et Cycle Time
  mainStats: {
    nbInterventionsDemandees: number;
    nbInterventionsTerminees: number;
    nbDevis: number;
    nbValides: number;
    chiffreAffaires: number;
    couts: number;
    marge: number;
    avgCycleTime: number; // En jours
    deltaInterventions: number; // Pourcentage
    deltaChiffreAffaires: number; // Pourcentage
    deltaMarge: number; // Pourcentage
    tauxTransformation?: number; // Calculé côté front ou SQL si ajouté
    tauxMarge?: number; // Calculé côté front ou SQL si ajouté
  };

  // 2. Sparklines pour les graphiques de tendance
  sparklines: Array<{
    date: string;
    countDemandees: number;
    countTerminees: number;
    ca_jour?: number; // Chiffre d'affaires quotidien
    marge_jour?: number; // Marge quotidienne
  }>;

  // 3. Données pour le Funnel (Status Breakdown)
  statusBreakdown: Array<{
    statusCode: string;
    statusLabel: string;
    count: number;
    avgCycleTime?: string; // Durée moyenne dans ce statut
  }>;

  // Nouveau champ pour l'entonnoir de conversion
  conversionFunnel: Array<{
    statusCode: string;
    count: number;
  }>;

  // Données pour le Stacked Bar Chart (volumétrie par jour et par statut)
  volumeByStatus?: Array<{
    date: string;
    demande: number;
    devis_envoye: number;
    accepte: number;
    en_cours: number;
    termine: number;
  }>;

  // 4. Statistiques par métier (breakdown complet)
  metierBreakdown: Array<{
    metierId: string;
    metierLabel: string;
    nbInterventionsPrises: number;
    nbInterventionsTerminees: number;
    ca: number;
    couts: number;
    marge: number;
    tauxMarge: number;
    percentage?: number;
    count?: number; // compatibilité avec les usages legacy
  }>;

  // 5. Statistiques par agence
  agencyStats: Array<{
    agencyId: string;
    agencyLabel: string;
    nbTotalInterventions: number;
    nbInterventionsTerminees: number;
    ca: number;
    couts: number;
    marge: number;
    tauxMarge: number;
  }>;

  // 6. Statistiques par gestionnaire
  gestionnaireStats: Array<{
    gestionnaireId: string;
    gestionnaireLabel: string;
    nbInterventionsPrises: number;
    nbInterventionsTerminees: number;
    tauxTransformation: number;
    tauxMarge: number;
    ca: number;
    couts: number;
    marge: number;
  }>;

  // 7. Statistiques par métier
  metierStats?: Array<{
    metierId: string;
    metierLabel: string;
    nbInterventionsPrises: number;
    nbInterventionsTerminees: number;
    ca: number;
    couts: number;
    marge: number;
    tauxMarge: number;
    percentage?: number;
    count?: number; // compatibilité avec les anciens graphiques qui lisent "count"
  }>;

  // Champs legacy pour compatibilité temporaire (optionnels)
  statusStats?: any;
}

/**
 * Données historiques du chiffre d'affaires par période
 */
export interface RevenueHistoryData {
  period: string; // Format: "YYYY-MM" pour mois, "YYYY-WW" pour semaine, etc.
  periodLabel: string; // Label affiché: "Janvier 2024", "Semaine 1", etc.
  revenue: number; // Chiffre d'affaires réel
  isProjection?: boolean; // true pour les projections
}

/**
 * Paramètres pour récupérer l'historique du CA
 */
export interface RevenueHistoryParams {
  periodType: PeriodType; // 'day' | 'week' | 'month' | 'year'
  startDate?: string;
  endDate?: string;
  agenceIds?: string[] | null;
  gestionnaireIds?: string[] | null;
  metierIds?: string[] | null;
  includeProjection?: boolean; // Inclure la projection de la période suivante
}

/**
 * Réponse de l'API pour l'historique du CA
 */
export interface RevenueHistoryResponse {
  historical: RevenueHistoryData[]; // Les 4 dernières périodes
  projection?: RevenueHistoryData; // Projection de la période suivante
  currentPeriod: RevenueHistoryData; // Période actuelle
}

/**
 * Interface générique pour les données historiques de n'importe quel KPI
 */
export interface KPIHistoryData<T = number> {
  period: string;
  periodLabel: string;
  value: T;
  isProjection?: boolean;
}

/**
 * Paramètres génériques pour récupérer l'historique
 */
export interface KPIHistoryParams {
  periodType: PeriodType;
  startDate?: string;
  endDate?: string;
  agenceIds?: string[] | null;
  gestionnaireIds?: string[] | null;
  metierIds?: string[] | null;
  includeProjection?: boolean;
}

/**
 * Réponse générique pour l'historique
 */
export interface KPIHistoryResponse<T = number> {
  historical: KPIHistoryData<T>[];
  projection?: KPIHistoryData<T>;
  currentPeriod: KPIHistoryData<T>;
}

/**
 * Données historiques pour les interventions (demandées + terminées)
 */
export interface InterventionsHistoryData {
  period: string;
  periodLabel: string;
  value: {
    demandees: number;
    terminees: number;
  };
  isProjection?: boolean;
}

/**
 * Réponse pour l'historique des interventions
 */
export interface InterventionsHistoryResponse {
  historical: InterventionsHistoryData[];
  projection?: InterventionsHistoryData;
  currentPeriod: InterventionsHistoryData;
}

/**
 * Données historiques pour le taux de transformation (demandées + terminées)
 */
export interface TransformationRateHistoryData {
  period: string;
  periodLabel: string;
  value: {
    demandees: number;
    terminees: number;
  };
  isProjection?: boolean;
}

/**
 * Réponse pour l'historique du taux de transformation
 */
export interface TransformationRateHistoryResponse {
  historical: TransformationRateHistoryData[];
  projection?: TransformationRateHistoryData;
  currentPeriod: TransformationRateHistoryData;
}

/**
 * Données historiques pour le cycle moyen (en jours)
 */
export interface CycleTimeHistoryData {
  period: string;
  periodLabel: string;
  value: number; // En jours
  isProjection?: boolean;
}

/**
 * Réponse pour l'historique du cycle moyen
 */
export interface CycleTimeHistoryResponse {
  historical: CycleTimeHistoryData[];
  projection?: CycleTimeHistoryData;
  currentPeriod: CycleTimeHistoryData;
}

/**
 * Données historiques pour la marge (en euros)
 */
export interface MarginHistoryData {
  period: string;
  periodLabel: string;
  value: number; // Marge en euros
  isProjection?: boolean;
}

/**
 * Réponse pour l'historique de la marge
 */
export interface MarginHistoryResponse {
  historical: MarginHistoryData[];
  projection?: MarginHistoryData;
  currentPeriod: MarginHistoryData;
}
