// ===== INTERVENTIONS CRUD =====
// Façade publique des opérations CRUD sur les interventions.
// Toutes les implémentations sont dans `./crud/` :
//
//   - reads      : getAll, getAllLight, getTotalCount, getById, getByIds, getByArtisan
//   - mutations  : create, checkDuplicate, getDuplicateDetails, update,
//                  delete, upsert, upsertDirect, createBulk
//   - _auth            : InterventionAuthContext + resolveUserId/IsAdmin
//   - _update-helpers  : helpers internes utilisés par update()
//   - _select-clauses  : SELECT partagés (relations complètes)
//   - _search-params   : URLSearchParams builder pour getAll/getAllLight
//
// Les variantes `getByX` triviales (déléguant à `getAll`) restent ici car
// elles sont des one-liners.

import type {
  Intervention,
  InterventionQueryParams,
  PaginatedResponse,
} from "@/lib/api/common/types";
import * as reads from "./crud/reads";
import * as mutations from "./crud/mutations";

export type { InterventionAuthContext } from "./crud/_auth";

export const interventionsCrud = {
  // ===== Lectures =====
  ...reads,

  // ===== Mutations =====
  create: mutations.create,
  checkDuplicate: mutations.checkDuplicate,
  getDuplicateDetails: mutations.getDuplicateDetails,
  update: mutations.update,
  delete: mutations.deleteIntervention,
  upsert: mutations.upsert,
  upsertDirect: mutations.upsertDirect,
  createBulk: mutations.createBulk,

  // ===== Variantes triviales (délégations à getAll) =====
  async getByUser(
    userId: string,
    params?: InterventionQueryParams,
  ): Promise<PaginatedResponse<Intervention>> {
    return reads.getAll({ ...params, user: userId });
  },

  async getByStatus(
    statusId: string,
    params?: InterventionQueryParams,
  ): Promise<PaginatedResponse<Intervention>> {
    return reads.getAll({ ...params, statut: statusId });
  },

  async getByAgency(
    agencyId: string,
    params?: InterventionQueryParams,
  ): Promise<PaginatedResponse<Intervention>> {
    return reads.getAll({ ...params, agence: agencyId });
  },

  async getByDateRange(
    startDate: string,
    endDate: string,
    params?: InterventionQueryParams,
  ): Promise<PaginatedResponse<Intervention>> {
    return reads.getAll({ ...params, startDate, endDate });
  },
};
