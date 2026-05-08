// ===== INTERVENTIONS STATS - HISTORY =====
// Méthodes d'historique KPI sur les 4 dernières périodes + projection.
// Délègue à `getAdminDashboardStats` via injection de dépendance pour éviter
// l'import circulaire avec le module stats principal.

import { RevenueProjectionService } from "@/lib/services/revenueProjection";
import type {
  AdminDashboardStats,
  DashboardPeriodParams,
  KPIHistoryParams,
  RevenueHistoryParams,
  RevenueHistoryData,
  RevenueHistoryResponse,
  InterventionsHistoryData,
  InterventionsHistoryResponse,
  TransformationRateHistoryData,
  TransformationRateHistoryResponse,
  CycleTimeHistoryData,
  CycleTimeHistoryResponse,
  MarginHistoryData,
  MarginHistoryResponse,
} from "@/lib/api/common/types";
import { calculateLast4Periods, calculateNextPeriod } from "./_period-helpers";

type GetAdminDashboardStats = (params: DashboardPeriodParams) => Promise<AdminDashboardStats>;

interface HistoryDeps {
  getAdminDashboardStats: GetAdminDashboardStats;
}

/**
 * Construit l'ensemble des méthodes d'historique KPI.
 * Injecté via `createHistoryMethods(deps)` pour rompre la dépendance circulaire.
 */
export function createHistoryMethods(deps: HistoryDeps) {
  const { getAdminDashboardStats } = deps;

  /**
   * Récupère l'historique du chiffre d'affaires pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async function getRevenueHistory(
    params: RevenueHistoryParams
  ): Promise<RevenueHistoryResponse> {
    const {
      periodType, startDate, endDate,
      agenceIds, gestionnaireIds, metierIds,
      includeProjection = true,
    } = params;

    const periods = calculateLast4Periods(periodType, startDate, endDate);

    const historical: RevenueHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds, gestionnaireIds, metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          revenue: stats.mainStats.chiffreAffaires,
          isProjection: false,
        };
      })
    );

    let projection: RevenueHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = calculateNextPeriod(periodType, startDate, endDate);
      const projectedRevenue = RevenueProjectionService.calculateProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        revenue: projectedRevenue,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        revenue: 0,
        isProjection: false,
      } as RevenueHistoryData);

    return { historical, projection, currentPeriod };
  }

  /**
   * Récupère l'historique des interventions pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async function getInterventionsHistory(
    params: KPIHistoryParams
  ): Promise<InterventionsHistoryResponse> {
    const {
      periodType, startDate, endDate,
      agenceIds, gestionnaireIds, metierIds,
      includeProjection = true,
    } = params;

    const periods = calculateLast4Periods(periodType, startDate, endDate);

    const historical: InterventionsHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds, gestionnaireIds, metierIds,
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
      const nextPeriod = calculateNextPeriod(periodType, startDate, endDate);
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

    return { historical, projection, currentPeriod };
  }

  /**
   * Récupère l'historique du taux de transformation pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async function getTransformationRateHistory(
    params: KPIHistoryParams
  ): Promise<TransformationRateHistoryResponse> {
    const {
      periodType, startDate, endDate,
      agenceIds, gestionnaireIds, metierIds,
      includeProjection = true,
    } = params;

    const periods = calculateLast4Periods(periodType, startDate, endDate);

    const historical: TransformationRateHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds, gestionnaireIds, metierIds,
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
      const nextPeriod = calculateNextPeriod(periodType, startDate, endDate);
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

    return { historical, projection, currentPeriod };
  }

  /**
   * Récupère l'historique du cycle moyen pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async function getCycleTimeHistory(
    params: KPIHistoryParams
  ): Promise<CycleTimeHistoryResponse> {
    const {
      periodType, startDate, endDate,
      agenceIds, gestionnaireIds, metierIds,
      includeProjection = true,
    } = params;

    const periods = calculateLast4Periods(periodType, startDate, endDate);

    const historical: CycleTimeHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds, gestionnaireIds, metierIds,
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
      const nextPeriod = calculateNextPeriod(periodType, startDate, endDate);
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

    return { historical, projection, currentPeriod };
  }

  /**
   * Récupère l'historique de la marge pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async function getMarginHistory(
    params: KPIHistoryParams
  ): Promise<MarginHistoryResponse> {
    const {
      periodType, startDate, endDate,
      agenceIds, gestionnaireIds, metierIds,
      includeProjection = true,
    } = params;

    const periods = calculateLast4Periods(periodType, startDate, endDate);

    const historical: MarginHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds, gestionnaireIds, metierIds,
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
      const nextPeriod = calculateNextPeriod(periodType, startDate, endDate);
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

    return { historical, projection, currentPeriod };
  }

  return {
    getRevenueHistory,
    getInterventionsHistory,
    getTransformationRateHistory,
    getCycleTimeHistory,
    getMarginHistory,
  };
}
