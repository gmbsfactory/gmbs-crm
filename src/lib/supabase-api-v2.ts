// ===== API V2 - FICHIER DE COMPATIBILITÉ =====
/**
 * @deprecated Ce fichier est déprécié. Utilisez les imports depuis '@/lib/api' à la place.
 * 
 * Migration recommandée:
 * ```typescript
 * 
 * // ✅ Nouveau
 * import { interventionsApi, artisansApi } from '@/lib/api';
 * import type { Intervention, InterventionQueryParams } from '@/lib/api';
 * ```
 * 
 * Ce fichier sera supprimé dans une future version.
 */

// ===== RÉ-EXPORTS DEPUIS @/lib/api =====
// Tous les exports principaux sont désormais dans @/lib/api

import {
  interventionsApi,
  artisansApi,
  usersApi,
  rolesApi,
  permissionsApi,
} from "./api";

// Types
export type {
  Intervention,
  InterventionCost,
  InterventionPayment,
  InterventionAttachment,
  InterventionWithStatus,
  InterventionStatus,
  User,
  Artisan,
  Comment,
  ArtisanAttachment,
  PaginatedResponse,
  CreateInterventionData,
  UpdateInterventionData,
  CreateArtisanData,
  UpdateArtisanData,
  InterventionQueryParams,
  ArtisanQueryParams,
} from "./api";

// APIs (nouveaux noms) — ré-exports directs
export {
  interventionsApi,
  artisansApi,
  usersApi,
  rolesApi,
  permissionsApi,
};
export {
  documentsApi,
  commentsApi,
  clientsApi,
  enumsApi,
  utilsApi,
  tenantsApi,
  ownersApi,
  agenciesApi,
  remindersApi,
} from "./api";

// APIs (anciens noms V2) — alias locaux pour les scripts Node legacy
export const interventionsApiV2 = interventionsApi;
export const artisansApiV2 = artisansApi;
export const usersApiV2 = usersApi;
export const rolesApiV2 = rolesApi;
export const permissionsApiV2 = permissionsApi;

// Cache et utilitaires
export {
  invalidateReferenceCache,
  getReferenceCache,
  referenceCacheManager,
  INTERVENTION_STATUS,
  INTERVENTION_METIERS,
  DOCUMENT_TYPES,
  COMMENT_TYPES,
  getHeaders,
  handleResponse,
  mapInterventionRecord,
  mapArtisanRecord,
  chunkArray,
  MAX_BATCH_SIZE,
} from "./api";

// ===== TYPES LEGACY POUR COMPATIBILITÉ =====

type FilterValue = string | string[] | null | undefined;

/**
 * @deprecated Utilisez InterventionQueryParams depuis '@/lib/api' à la place
 */
export type GetAllParams = {
  limit?: number;
  offset?: number;
  statut?: FilterValue;
  agence?: FilterValue;
  artisan?: FilterValue;
  metier?: FilterValue;
  user?: FilterValue;
  startDate?: string;
  endDate?: string;
  search?: string;
  fields?: string[];
  isCheck?: boolean;
};

/**
 * @deprecated Utilisez InterventionQueryParams depuis '@/lib/api' à la place
 */
export type GetDistinctParams = Omit<GetAllParams, "limit" | "fields"> & {
  limit?: number;
};

export type CursorDirection = "forward" | "backward";

export interface InterventionCursor {
  date: string;
  id: string;
  direction?: CursorDirection;
}

// ===== FONCTIONS DE COMPATIBILITÉ =====
// Ces fonctions délèguent aux nouvelles méthodes de l'API v2

/**
 * Convertit les paramètres legacy vers le format InterventionQueryParams
 */
function convertLegacyParams(params?: GetAllParams): Parameters<typeof interventionsApi.getTotalCountWithFilters>[0] {
  if (!params) return undefined;

  return {
    statut: typeof params.statut === "string" ? params.statut : undefined,
    statuts: Array.isArray(params.statut) ? params.statut : undefined,
    agence: typeof params.agence === "string" ? params.agence : undefined,
    metier: typeof params.metier === "string" ? params.metier : undefined,
    metiers: Array.isArray(params.metier) ? params.metier : undefined,
    user: params.user === null ? null : (typeof params.user === "string" ? params.user : undefined),
    startDate: params.startDate,
    endDate: params.endDate,
    isCheck: params.isCheck,
  };
}

/**
 * Obtient le nombre total d'interventions correspondant aux filtres
 * @deprecated Utilisez interventionsApi.getTotalCountWithFilters() depuis '@/lib/api' à la place
 */
export async function getInterventionTotalCount(
  params?: Omit<GetAllParams, "limit" | "offset" | "fields" | "sortBy" | "sortDir" | "cursor" | "direction">
): Promise<number> {
  return interventionsApi.getTotalCountWithFilters(convertLegacyParams(params));
}

/**
 * Obtient le nombre total d'artisans correspondant aux filtres basiques
 * @deprecated Utilisez artisansApi.getTotalCount() depuis '@/lib/api' à la place
 */
export async function getArtisanTotalCount(
  params?: {
    gestionnaire?: string;
    statut?: string;
  }
): Promise<number> {
  return artisansApi.getTotalCount(params);
}

/**
 * Obtient le nombre total d'artisans avec tous les filtres appliqués
 * @deprecated Utilisez artisansApi.getCountWithFilters() depuis '@/lib/api' à la place
 */
export async function getArtisanCountWithFilters(
  params?: {
    gestionnaire?: string;
    statut?: string;
    statuts?: string[];
    metier?: string;
    metiers?: string[];
    search?: string;
    statut_dossier?: string;
  }
): Promise<number> {
  return artisansApi.getCountWithFilters(params);
}

/**
 * Obtient le nombre d'interventions par statut
 * @deprecated Utilisez interventionsApi.getCountsByStatus() depuis '@/lib/api' à la place
 */
export async function getInterventionCounts(
  params?: Omit<GetDistinctParams, "statut">
): Promise<Record<string, number>> {
  return interventionsApi.getCountsByStatus(convertLegacyParams(params));
}

/**
 * Obtient les valeurs distinctes d'une colonne d'intervention
 * @deprecated Utilisez interventionsApi.getDistinctValues() depuis '@/lib/api' à la place
 */
export async function getDistinctInterventionValues(
  property: string,
  params?: GetDistinctParams
): Promise<string[]> {
  return interventionsApi.getDistinctValues(property, convertLegacyParams(params));
}
