// ===== API V2 - EXPORT CENTRAL =====
// Point d'entrée unique pour toutes les APIs modulaires

// Types communs
export * from "./common/types";

// Types pour enumsApi
export type { FindOrCreateResult } from "./enumsApi";

// Utilitaires communs
export * from "./common/utils";

// Imports des APIs spécialisées
import { agenciesApi } from "./agenciesApi";
import { artisansApi } from "./artisansApi";
import { clientsApi } from "./clientsApi";
import { commentsApi } from "./commentsApi";
import { documentsApi } from "./documentsApi";
import { enumsApi } from "./enumsApi";
import { interventionsApi, invalidateReferenceCache } from "./interventionsApi";
import { ownersApi } from "./ownersApi";
import { remindersApi } from "./reminders";
import { permissionsApi, rolesApi } from "./rolesApi";
import { tenantsApi } from "./tenantsApi";
import { usersApi } from "./usersApi";
import { utilsApi } from "./utilsApi";

// Exports des APIs spécialisées
export { agenciesApi, artisansApi, clientsApi, commentsApi, documentsApi, enumsApi, interventionsApi, invalidateReferenceCache, ownersApi, permissionsApi, remindersApi, rolesApi, tenantsApi, usersApi, utilsApi };

// Exports avec alias pour compatibilité
export const agenciesApiV2 = agenciesApi;
export const usersApiV2 = usersApi;
export const interventionsApiV2 = interventionsApi;
export const artisansApiV2 = artisansApi;
export const clientsApiV2 = clientsApi;
export const documentsApiV2 = documentsApi;
export const commentsApiV2 = commentsApi;
export const rolesApiV2 = rolesApi;
export const permissionsApiV2 = permissionsApi;
export const tenantsApiV2 = tenantsApi;
export const ownersApiV2 = ownersApi;
export const enumsApiV2 = enumsApi;
export const remindersApiV2 = remindersApi;
export const utilsApiV2 = utilsApi;

// Export par défaut avec toutes les APIs
const apiV2 = {
  agencies: agenciesApi,
  users: usersApi,
  interventions: interventionsApi,
  artisans: artisansApi,
  clients: clientsApi,
  documents: documentsApi,
  comments: commentsApi,
  roles: rolesApi,
  permissions: permissionsApi,
  tenants: tenantsApi,
  owners: ownersApi,
  reminders: remindersApi,
  enums: enumsApi,
  utils: utilsApi,

  // Alias pour compatibilité
  agenciesApiV2,
  usersApiV2,
  interventionsApiV2,
  artisansApiV2,
  clientsApiV2,
  documentsApiV2,
  commentsApiV2,
  rolesApiV2,
  permissionsApiV2,
  tenantsApiV2,
  ownersApiV2,
  remindersApiV2,
  enumsApiV2,
  utilsApiV2,
}

export default apiV2;
