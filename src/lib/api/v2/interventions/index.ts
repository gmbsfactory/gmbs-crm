// ===== INTERVENTIONS API - INDEX =====
// Réexporte l'API unifiée depuis les sous-modules

import { interventionsCrud } from "./interventions-crud";
import { interventionsStatus, _setCrudRef } from "./interventions-status";
import { interventionsCosts } from "./interventions-costs";
import { interventionsStats, _setCostsRef } from "./interventions-stats";
import { interventionsFilters } from "./interventions-filters";

// Injecter les références croisées entre modules
_setCrudRef(interventionsCrud);
_setCostsRef(interventionsCosts);

// Objet unifié qui expose toutes les méthodes sous la même interface
// que l'ancien interventionsApi monolithique
export const interventionsApi = {
  // === CRUD ===
  getAll: interventionsCrud.getAll.bind(interventionsCrud),
  getAllLight: interventionsCrud.getAllLight.bind(interventionsCrud),
  getTotalCount: interventionsCrud.getTotalCount.bind(interventionsCrud),
  getById: interventionsCrud.getById.bind(interventionsCrud),
  create: interventionsCrud.create.bind(interventionsCrud),
  update: interventionsCrud.update.bind(interventionsCrud),
  delete: interventionsCrud.delete.bind(interventionsCrud),
  checkDuplicate: interventionsCrud.checkDuplicate.bind(interventionsCrud),
  getDuplicateDetails: interventionsCrud.getDuplicateDetails.bind(interventionsCrud),
  upsert: interventionsCrud.upsert.bind(interventionsCrud),
  upsertDirect: interventionsCrud.upsertDirect.bind(interventionsCrud),
  createBulk: interventionsCrud.createBulk.bind(interventionsCrud),
  getByUser: interventionsCrud.getByUser.bind(interventionsCrud),
  getByStatus: interventionsCrud.getByStatus.bind(interventionsCrud),
  getByAgency: interventionsCrud.getByAgency.bind(interventionsCrud),
  getByArtisan: interventionsCrud.getByArtisan.bind(interventionsCrud),
  getByDateRange: interventionsCrud.getByDateRange.bind(interventionsCrud),
  getByIds: interventionsCrud.getByIds.bind(interventionsCrud),

  // === STATUS & WORKFLOW ===
  updateStatus: interventionsStatus.updateStatus.bind(interventionsStatus),
  setPrimaryArtisan: interventionsStatus.setPrimaryArtisan.bind(interventionsStatus),
  setSecondaryArtisan: interventionsStatus.setSecondaryArtisan.bind(interventionsStatus),
  assignArtisan: interventionsStatus.assignArtisan.bind(interventionsStatus),
  getAllStatuses: interventionsStatus.getAllStatuses.bind(interventionsStatus),
  getStatusByCode: interventionsStatus.getStatusByCode.bind(interventionsStatus),
  getStatusByLabel: interventionsStatus.getStatusByLabel.bind(interventionsStatus),
  getStatusTransitions: interventionsStatus.getStatusTransitions.bind(interventionsStatus),

  // === COSTS & PAYMENTS ===
  upsertCost: interventionsCosts.upsertCost.bind(interventionsCosts),
  upsertCostsBatch: interventionsCosts.upsertCostsBatch.bind(interventionsCosts),
  getCosts: interventionsCosts.getCosts.bind(interventionsCosts),
  deleteCost: interventionsCosts.deleteCost.bind(interventionsCosts),
  addCost: interventionsCosts.addCost.bind(interventionsCosts),
  addPayment: interventionsCosts.addPayment.bind(interventionsCosts),
  upsertPayment: interventionsCosts.upsertPayment.bind(interventionsCosts),
  insertInterventionCosts: interventionsCosts.insertInterventionCosts.bind(interventionsCosts),
  calculateMarginForIntervention: interventionsCosts.calculateMarginForIntervention.bind(interventionsCosts),

  // === STATS & DASHBOARD ===
  getStatsByUser: interventionsStats.getStatsByUser.bind(interventionsStats),
  getMarginStatsByUser: interventionsStats.getMarginStatsByUser.bind(interventionsStats),
  getMarginRankingByPeriod: interventionsStats.getMarginRankingByPeriod.bind(interventionsStats),
  getMarginRankingByPeriodV3: interventionsStats.getMarginRankingByPeriodV3.bind(interventionsStats),
  getWeeklyStatsByUser: interventionsStats.getWeeklyStatsByUser.bind(interventionsStats),
  getPeriodStatsByUser: interventionsStats.getPeriodStatsByUser.bind(interventionsStats),
  getRecentInterventionsByUser: interventionsStats.getRecentInterventionsByUser.bind(interventionsStats),
  getRecentInterventionsByStatusAndUser: interventionsStats.getRecentInterventionsByStatusAndUser.bind(interventionsStats),
  getAdminDashboardStats: interventionsStats.getAdminDashboardStats.bind(interventionsStats),
  getRevenueHistory: interventionsStats.getRevenueHistory.bind(interventionsStats),
  calculateLast4Periods: interventionsStats.calculateLast4Periods.bind(interventionsStats),
  calculateNextPeriod: interventionsStats.calculateNextPeriod.bind(interventionsStats),
  getWeekNumber: interventionsStats.getWeekNumber.bind(interventionsStats),
  getInterventionsHistory: interventionsStats.getInterventionsHistory.bind(interventionsStats),
  getTransformationRateHistory: interventionsStats.getTransformationRateHistory.bind(interventionsStats),
  getCycleTimeHistory: interventionsStats.getCycleTimeHistory.bind(interventionsStats),
  getMarginHistory: interventionsStats.getMarginHistory.bind(interventionsStats),
  calculatePeriodDates: interventionsStats.calculatePeriodDates.bind(interventionsStats),

  // === FILTERS & COUNTING ===
  getTotalCountWithFilters: interventionsFilters.getTotalCountWithFilters.bind(interventionsFilters),
  getCountsByStatus: interventionsFilters.getCountsByStatus.bind(interventionsFilters),
  getCountByPropertyValue: interventionsFilters.getCountByPropertyValue.bind(interventionsFilters),
  getFilterCountsGrouped: interventionsFilters.getFilterCountsGrouped.bind(interventionsFilters),
  getDistinctValues: interventionsFilters.getDistinctValues.bind(interventionsFilters),
  getCountWithFilters: interventionsFilters.getCountWithFilters.bind(interventionsFilters),
};

