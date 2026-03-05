import type { InterventionQueryParams } from "@/lib/api/v2"

// Alias pour compatibilité avec le code existant
type GetAllParams = InterventionQueryParams

/**
 * Factory pour générer les clés de requête TanStack Query
 * Centralise toutes les clés pour faciliter l'invalidation ciblée
 * 
 * @example
 * // Invalider toutes les listes après une création
 * queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
 * 
 * @example
 * // Invalider une vue spécifique
 * queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateView(params) })
 * 
 * @example
 * // Mettre à jour optimiste dans toutes les listes
 * queryClient.setQueriesData(
 *   { queryKey: interventionKeys.invalidateLists() },
 *   (oldData) => { /* mise à jour *\/ }
 * )
 */
export const interventionKeys = {
  /**
   * Clé racine pour toutes les queries d'interventions
   * Utilisée pour invalider l'ensemble du cache
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: interventionKeys.all })
   */
  all: ["interventions"] as const,
  
  /**
   * Préfixe pour les listes complètes d'interventions
   * 
   * @returns ["interventions", "list"]
   */
  lists: () => [...interventionKeys.all, "list"] as const,
  
  /**
   * Clé pour une liste complète d'interventions avec filtres
   * 
   * @param params - Paramètres de filtrage (statut, agence, artisan, etc.)
   * @returns ["interventions", "list", params]
   * 
   * @example
   * const key = interventionKeys.list({ statut: "INTER_EN_COURS", limit: 100, offset: 0 })
   */
  list: (params: GetAllParams) => [...interventionKeys.lists(), params] as const,
  
  /**
   * Préfixe pour les listes légères d'interventions (warm-up)
   * 
   * @returns ["interventions", "light"]
   */
  lightLists: () => [...interventionKeys.all, "light"] as const,
  
  /**
   * Clé pour une liste légère d'interventions (données minimales pour préchargement)
   * 
   * @param params - Paramètres de filtrage
   * @returns ["interventions", "light", params]
   * 
   * @example
   * const key = interventionKeys.lightList({ limit: 100, offset: 0 })
   */
  lightList: (params: GetAllParams) => [...interventionKeys.lightLists(), params] as const,
  
  /**
   * Préfixe pour les résumés d'interventions (métadonnées sans données complètes)
   * 
   * @returns ["interventions", "summary"]
   */
  summaries: () => [...interventionKeys.all, "summary"] as const,
  
  /**
   * Clé pour un résumé d'interventions (compteurs, métadonnées)
   * 
   * @param params - Paramètres de filtrage
   * @returns ["interventions", "summary", params]
   */
  summary: (params: GetAllParams) => [...interventionKeys.summaries(), params] as const,
  
  /**
   * Préfixe pour les détails d'interventions
   * 
   * @returns ["interventions", "detail"]
   */
  details: () => [...interventionKeys.all, "detail"] as const,
  
  /**
   * Clé pour le détail d'une intervention par ID
   * 
   * @param id - ID de l'intervention
   * @param include - Champs optionnels à inclure (ex: ["documents", "artisans"])
   * @returns ["interventions", "detail", id, include]
   * 
   * @example
   * const key = interventionKeys.detail("123", ["documents"])
   */
  detail: (id: string, include?: string[]) => [...interventionKeys.details(), id, include] as const,
  
  /**
   * Préfixe pour les comptages groupés par filtre (métier, agence, etc.)
   *
   * @returns ["interventions", "filter-counts"]
   */
  filterCounts: () => [...interventionKeys.all, "filter-counts"] as const,

  /**
   * Clé pour les comptages groupés par propriété avec filtres
   *
   * @param property - Propriété de groupement (metier, agence, statut, user)
   * @param filters - Filtres de base appliqués
   * @returns ["interventions", "filter-counts", property, filters]
   */
  filterCountsByProperty: (property: string, filters?: object) =>
    [...interventionKeys.all, "filter-counts", property, filters] as const,

  /**
   * Clé pour invalider tous les comptages de filtres
   *
   * @returns ["interventions", "filter-counts"]
   */
  invalidateFilterCounts: () => [...interventionKeys.all, "filter-counts"],

  /**
   * Clé pour invalider toutes les queries d'interventions
   *
   * @returns ["interventions"]
   *
   * @example
   * queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateAll() })
   */
  invalidateAll: () => interventionKeys.all,
  
  /**
   * Clé pour invalider toutes les listes (complètes et légères)
   * Utilisée après une création, mise à jour ou suppression
   * 
   * @returns ["interventions", "list"]
   * 
   * @example
   * // Après création d'une intervention
   * queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
   * queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists() })
   */
  invalidateLists: () => interventionKeys.lists(),

  /**
   * Clé pour invalider toutes les listes légères
   * 
   * @returns ["interventions", "light"]
   */
  invalidateLightLists: () => interventionKeys.lightLists(),
  
  /**
   * Clés pour invalider une vue spécifique par ses paramètres
   * Invalide la liste complète, la liste légère et le résumé correspondants
   * 
   * @param params - Paramètres de la vue à invalider
   * @returns Tableau de clés [listKey, lightListKey, summaryKey]
   * 
   * @example
   * // Invalider une vue spécifique après modification
   * const keys = interventionKeys.invalidateView({ statut: "INTER_EN_COURS", limit: 100 })
   * keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
   */
  invalidateView: (params: GetAllParams) => [
    interventionKeys.list(params),
    interventionKeys.lightList(params),
    interventionKeys.summary(params),
  ],
} as const

/**
 * Type pour les paramètres de requête des artisans
 */
export type ArtisanGetAllParams = {
  limit?: number
  offset?: number
  statut?: string
  statuts?: string[]
  metier?: string
  metiers?: string[]
  zone?: string
  gestionnaire?: string
  search?: string
  statut_dossier?: string
}

/**
 * Factory pour générer les clés de requête TanStack Query pour les artisans
 * Centralise toutes les clés pour faciliter l'invalidation ciblée
 * 
 * @example
 * // Invalider toutes les listes après une création
 * queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
 * 
 * @example
 * // Invalider une vue spécifique
 * queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateView(params) })
 */
export const artisanKeys = {
  /**
   * Clé racine pour toutes les queries d'artisans
   * Utilisée pour invalider l'ensemble du cache
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: artisanKeys.all })
   */
  all: ["artisans"] as const,
  
  /**
   * Préfixe pour les listes complètes d'artisans
   * 
   * @returns ["artisans", "list"]
   */
  lists: () => [...artisanKeys.all, "list"] as const,
  
  /**
   * Clé pour une liste complète d'artisans avec filtres
   * 
   * @param params - Paramètres de filtrage (statut, gestionnaire, etc.)
   * @returns ["artisans", "list", params]
   * 
   * @example
   * const key = artisanKeys.list({ gestionnaire: "user-id", limit: 100, offset: 0 })
   */
  list: (params: ArtisanGetAllParams) => [...artisanKeys.lists(), params] as const,
  
  /**
   * Préfixe pour les détails d'artisans
   * 
   * @returns ["artisans", "detail"]
   */
  details: () => [...artisanKeys.all, "detail"] as const,
  
  /**
   * Clé pour le détail d'un artisan par ID
   * 
   * @param id - ID de l'artisan
   * @param include - Champs optionnels à inclure
   * @returns ["artisans", "detail", id, include]
   * 
   * @example
   * const key = artisanKeys.detail("123", ["metiers", "zones"])
   */
  detail: (id: string, include?: string[]) => [...artisanKeys.details(), id, include] as const,
  
  /**
   * Clé pour invalider toutes les queries d'artisans
   * 
   * @returns ["artisans"]
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateAll() })
   */
  invalidateAll: () => artisanKeys.all,
  
  /**
   * Clé pour invalider toutes les listes
   * Utilisée après une création, mise à jour ou suppression
   * 
   * @returns ["artisans", "list"]
   * 
   * @example
   * // Après création d'un artisan
   * queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() })
   */
  invalidateLists: () => [...artisanKeys.all, "list"],
  
  /**
   * Clés pour invalider une vue spécifique par ses paramètres
   * 
   * @param params - Paramètres de la vue à invalider
   * @returns Clé de liste correspondante
   * 
   * @example
   * // Invalider une vue spécifique après modification
   * queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateView({ gestionnaire: "user-id" }) })
   */
  invalidateView: (params: ArtisanGetAllParams) => artisanKeys.list(params),
} as const

/**
 * Type pour les paramètres de requête du dashboard
 */
export type DashboardStatsParams = {
  userId: string
  startDate?: string
  endDate?: string
}

export type DashboardMarginParams = {
  userId: string
  startDate: string
  endDate: string
}

export type DashboardPeriodStatsParams = {
  userId: string
  period: "week" | "month" | "year"
  startDate?: string
}

/**
 * Factory pour générer les clés de requête TanStack Query pour le dashboard
 * Centralise toutes les clés pour faciliter l'invalidation ciblée
 * 
 * @example
 * // Invalider toutes les stats après une modification d'intervention
 * queryClient.invalidateQueries({ queryKey: dashboardKeys.invalidateAll() })
 * 
 * @example
 * // Invalider les stats d'un utilisateur spécifique
 * queryClient.invalidateQueries({ queryKey: dashboardKeys.stats({ userId: "123", startDate: "...", endDate: "..." }) })
 */
export const dashboardKeys = {
  /**
   * Clé racine pour toutes les queries du dashboard
   * Utilisée pour invalider l'ensemble du cache
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
   */
  all: ["dashboard"] as const,
  
  /**
   * Préfixe pour les statistiques d'interventions par statut
   * 
   * @returns ["dashboard", "stats"]
   */
  stats: () => [...dashboardKeys.all, "stats"] as const,
  
  /**
   * Clé pour les statistiques d'interventions par statut pour un utilisateur et une période
   * 
   * @param params - Paramètres (userId, startDate, endDate)
   * @returns ["dashboard", "stats", params]
   * 
   * @example
   * const key = dashboardKeys.stats({ userId: "123", startDate: "2024-01-01", endDate: "2024-01-31" })
   */
  statsByUser: (params: DashboardStatsParams) => [...dashboardKeys.stats(), params] as const,
  
  /**
   * Préfixe pour les statistiques de marge
   * 
   * @returns ["dashboard", "margin"]
   */
  margin: () => [...dashboardKeys.all, "margin"] as const,
  
  /**
   * Clé pour les statistiques de marge pour un utilisateur et une période
   * 
   * @param params - Paramètres (userId, startDate, endDate)
   * @returns ["dashboard", "margin", params]
   * 
   * @example
   * const key = dashboardKeys.marginByUser({ userId: "123", startDate: "2024-01-01", endDate: "2024-01-31" })
   */
  marginByUser: (params: DashboardMarginParams) => [...dashboardKeys.margin(), params] as const,
  
  /**
   * Préfixe pour les statistiques par période (semaine/mois/année)
   * 
   * @returns ["dashboard", "period"]
   */
  period: () => [...dashboardKeys.all, "period"] as const,
  
  /**
   * Clé pour les statistiques par période pour un utilisateur
   * 
   * @param params - Paramètres (userId, period, startDate?)
   * @returns ["dashboard", "period", params]
   * 
   * @example
   * const key = dashboardKeys.periodStatsByUser({ userId: "123", period: "week", startDate: "2024-01-01" })
   */
  periodStatsByUser: (params: DashboardPeriodStatsParams) => [...dashboardKeys.period(), params] as const,

  /**
   * Préfixe pour les interventions récentes par statut (pour les tooltips/hover)
   * 
   * @returns ["dashboard", "recent-interventions"]
   */
  recentInterventions: () => [...dashboardKeys.all, "recent-interventions"] as const,

  /**
   * Clé pour les interventions récentes par statut pour un utilisateur
   * 
   * @param params - Paramètres (userId, statusLabel, limit, startDate, endDate)
   * @returns ["dashboard", "recent-interventions", params]
   */
  recentInterventionsByStatus: (params: { 
    userId: string; 
    statusLabel: string; 
    limit?: number; 
    startDate?: string; 
    endDate?: string 
  }) => [...dashboardKeys.recentInterventions(), params] as const,
  
  /**
   * Clé pour invalider toutes les queries du dashboard
   * 
   * @returns ["dashboard"]
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: dashboardKeys.invalidateAll() })
   */
  invalidateAll: () => dashboardKeys.all,
  
  /**
   * Clé pour invalider toutes les statistiques (stats, margin, period)
   * Utilisée après une modification d'intervention qui affecte les stats
   * 
   * @returns ["dashboard", "stats", "margin", "period"]
   * 
   * @example
   * // Après modification d'une intervention
   * queryClient.invalidateQueries({ queryKey: dashboardKeys.invalidateStats() })
   */
  invalidateStats: () => [...dashboardKeys.all, "stats", "margin", "period"],
} as const

// ---------------------------------------------------------------------------
// Email log query keys
// ---------------------------------------------------------------------------

/**
 * Factory pour les clés de requête des logs email.
 *
 * @example
 * // Invalider les logs email d'une intervention après envoi
 * queryClient.invalidateQueries({ queryKey: emailLogKeys.byIntervention(interventionId) })
 */
export const emailLogKeys = {
  all: ['email-logs'] as const,

  /** Tous les logs email d'une intervention */
  byIntervention: (interventionId: string) =>
    [...emailLogKeys.all, 'intervention', interventionId] as const,

  /** Logs email d'une intervention filtrés par type (devis | intervention) */
  byInterventionAndType: (interventionId: string, emailType: 'devis' | 'intervention') =>
    [...emailLogKeys.all, 'intervention', interventionId, 'type', emailType] as const,

  /** Invalider tous les logs email */
  invalidateAll: () => emailLogKeys.all,

  /** Invalider les logs d'une intervention (tous types) */
  invalidateByIntervention: (interventionId: string) =>
    emailLogKeys.byIntervention(interventionId),
} as const

// ---------------------------------------------------------------------------
// Comment query keys (centralisées — remplacent les clés manuelles ["comments", ...])
// ---------------------------------------------------------------------------

/**
 * Factory pour les clés de requête des commentaires.
 * Clés compatibles avec le format existant de CommentSection.tsx :
 *   ["comments", entityType, entityId, limit]
 *
 * @example
 * // Invalider tous les commentaires d'une intervention
 * queryClient.invalidateQueries({ queryKey: commentKeys.invalidateByEntity('intervention', id) })
 */
export const commentKeys = {
  all: ['comments'] as const,

  /** Tous les commentaires d'une entité (préfixe — matche toutes les paginations) */
  byEntity: (entityType: string, entityId: string) =>
    [...commentKeys.all, entityType, entityId] as const,

  /** Commentaires paginés (avec limit) — clé exacte compatible CommentSection */
  byEntityPaginated: (entityType: string, entityId: string, limit: number) =>
    [...commentKeys.all, entityType, entityId, limit] as const,

  /** Invalider tous les commentaires d'une entité (toutes paginations) */
  invalidateByEntity: (entityType: string, entityId: string) =>
    commentKeys.byEntity(entityType, entityId),

  /** Invalider tous les commentaires */
  invalidateAll: () => commentKeys.all,
} as const

// ---------------------------------------------------------------------------
// Document query keys
// ---------------------------------------------------------------------------

/**
 * Factory pour les clés de requête des documents.
 *
 * @example
 * queryClient.invalidateQueries({ queryKey: documentKeys.invalidateByEntity('intervention', id) })
 */
export const documentKeys = {
  all: ['documents'] as const,

  byEntity: (entityType: string, entityId: string) =>
    [...documentKeys.all, entityType, entityId] as const,

  invalidateByEntity: (entityType: string, entityId: string) =>
    documentKeys.byEntity(entityType, entityId),

  invalidateAll: () => documentKeys.all,
} as const

// ---------------------------------------------------------------------------
// Reference query keys
// ---------------------------------------------------------------------------

/**
 * Type pour les paramètres de requête de la comptabilité
 */
export type ComptabiliteQueryParams = {
  dateStart?: string
  dateEnd?: string
  page?: number
  pageSize?: number
}

/**
 * Factory pour générer les clés de requête TanStack Query pour la comptabilité
 * Centralise toutes les clés pour faciliter l'invalidation ciblée
 *
 * @example
 * // Invalider toutes les données compta après une modification
 * queryClient.invalidateQueries({ queryKey: comptabiliteKeys.invalidateAll() })
 */
export const comptabiliteKeys = {
  all: ["comptabilite"] as const,

  lists: () => [...comptabiliteKeys.all, "list"] as const,

  list: (params: ComptabiliteQueryParams) => [...comptabiliteKeys.lists(), params] as const,

  checks: () => [...comptabiliteKeys.all, "checks"] as const,

  checksByDateRange: (params: ComptabiliteQueryParams) => [...comptabiliteKeys.checks(), params] as const,

  invalidateAll: () => comptabiliteKeys.all,

  invalidateLists: () => comptabiliteKeys.lists(),

  invalidateChecks: () => comptabiliteKeys.checks(),
} as const

/**
 * Factory pour générer les clés de requête TanStack Query pour les données de référence
 * Centralise toutes les clés pour faciliter l'invalidation ciblée
 *
 * @example
 * // Invalider toutes les données de référence après un import
 * queryClient.invalidateQueries({ queryKey: referenceKeys.invalidateAll() })
 */
export const referenceKeys = {
  /**
   * Clé racine pour toutes les queries de données de référence
   * Utilisée pour invalider l'ensemble du cache
   * 
   * @example
   * queryClient.invalidateQueries({ queryKey: referenceKeys.all })
   */
  all: ["references"] as const,
  
  /**
   * Clé pour toutes les données de référence (statuts, utilisateurs, agences, métiers, etc.)
   * 
   * @returns ["references", "all"]
   */
  allData: () => [...referenceKeys.all, "all"] as const,
  
  /**
   * Préfixe pour les statuts d'interventions
   * 
   * @returns ["references", "statuses"]
   */
  statuses: () => [...referenceKeys.all, "statuses"] as const,
  
  /**
   * Préfixe pour les utilisateurs
   * 
   * @returns ["references", "users"]
   */
  users: () => [...referenceKeys.all, "users"] as const,
  
  /**
   * Préfixe pour les agences
   * 
   * @returns ["references", "agencies"]
   */
  agencies: () => [...referenceKeys.all, "agencies"] as const,
  
  /**
   * Préfixe pour les métiers
   * 
   * @returns ["references", "metiers"]
   */
  metiers: () => [...referenceKeys.all, "metiers"] as const,

  /**
   * Préfixe pour les statuts d'artisans
   *
   * @returns ["references", "artisan-statuses"]
   */
  artisanStatuses: () => [...referenceKeys.all, "artisan-statuses"] as const,

  /**
   * Clé pour invalider toutes les queries de données de référence
   *
   * @returns ["references"]
   *
   * @example
   * // Après un import massif de données de référence
   * queryClient.invalidateQueries({ queryKey: referenceKeys.invalidateAll() })
   */
  invalidateAll: () => referenceKeys.all,
} as const
