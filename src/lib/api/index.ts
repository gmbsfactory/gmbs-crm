// ===== API V2 - ORCHESTRATEUR CENTRAL =====
// Point d'entrée unique pour toutes les APIs modulaires
// 
// Ce fichier sert de façade pour l'ensemble de l'API V2.
// Il centralise les exports et permet une importation simplifiée.
//
// Usage recommandé:
//   import { interventionsApi, artisansApi } from '@/lib/api';
//   import type { Intervention, Artisan } from '@/lib/api';

// ===== TYPES COMMUNS =====
export * from "./common/types";

// Types spécifiques pour enumsApi
export type { FindOrCreateResult } from "./enumsApi";

// ===== CACHE CENTRALISÉ =====
export {
  getReferenceCache,
  invalidateReferenceCache,
  referenceCacheManager,
  type ReferenceCache,
  type ReferenceData,
} from "./common/cache";

// ===== CONSTANTES =====
export {
  INTERVENTION_STATUS,
  INTERVENTION_METIERS,
  DOCUMENT_TYPES,
  COMMENT_TYPES,
  COST_TYPES,
  ENTITY_TYPES,
  USER_STATUS,
  MAX_BATCH_SIZE,
  DEFAULT_FUNCTIONS_URL,
  type InterventionStatusCode,
  type InterventionMetierCode,
  type InterventionDocumentType,
  type ArtisanDocumentType,
  type CommentType,
  type CostType,
  type EntityType,
  type UserStatus,
} from "./common/constants";

// ===== UTILITAIRES =====
export {
  getSupabaseFunctionsUrl,
  SUPABASE_FUNCTIONS_URL,
  getHeaders,
  handleResponse,
  fileToBase64,
  formatFileSize,
  isValidMimeType,
  generateSecurePassword,
  isValidEmail,
  isValidUsername,
  generateUniqueCodeGestionnaire,
  buildUserDisplay,
  mapInterventionRecord,
  mapArtisanRecord,
  chunkArray,
  managedFetch,
} from "./common/utils";

// ===== IMPORTS DES APIs SPÉCIALISÉES =====
import { analyticsApi } from "./analyticsApi";
import { agenciesApi } from "./agenciesApi";
import { artisansApi } from "./artisansApi";
import { clientsApi } from "./clientsApi";
import { commentsApi } from "./commentsApi";
import { comptaApi } from "./comptaApi";
export type { FacturationEntriesResult } from "./comptaApi";
import { documentsApi } from "./documentsApi";
import { enumsApi } from "./enumsApi";
import { interventionsApi } from "./interventionsApi";
import { interventionStatusesApi } from "./interventionStatusesApi";
import { artisanStatusesApi } from "./artisanStatusesApi";
import { metiersApi } from "./metiersApi";
import { ownersApi } from "./ownersApi";
import { remindersApi } from "./remindersApi";
import { permissionsApi, rolesApi } from "./rolesApi";
import { tenantsApi } from "./tenantsApi";
import { usersApi } from "./usersApi";
import { utilsApi } from "./utilsApi";
import { updatesApi } from "./updatesApi";

// ===== EXPORTS DES APIs =====
export {
  analyticsApi,
  agenciesApi,
  artisansApi,
  clientsApi,
  commentsApi,
  comptaApi,
  documentsApi,
  enumsApi,
  interventionsApi,
  interventionStatusesApi,
  artisanStatusesApi,
  metiersApi,
  ownersApi,
  permissionsApi,
  remindersApi,
  rolesApi,
  tenantsApi,
  updatesApi,
  usersApi,
  utilsApi,
};

