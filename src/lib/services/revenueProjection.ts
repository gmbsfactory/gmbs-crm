import type {
  RevenueHistoryData,
  InterventionsHistoryData,
  TransformationRateHistoryData,
  CycleTimeHistoryData,
  MarginHistoryData,
} from "@/lib/api/common/types"

/**
 * Interface pour les modèles de projection
 * Permet d'échanger facilement entre différents modèles
 */
export interface RevenueProjectionModel {
  name: string
  calculate(historicalData: RevenueHistoryData[]): number
}

/**
 * Modèle simple : moyenne mobile des 4 derniers mois
 * Architecture extensible pour ajouter régression linéaire, arbre de décision, etc.
 */
export class SimpleAverageModel implements RevenueProjectionModel {
  name = "simple_average"
  
  calculate(historicalData: RevenueHistoryData[]): number {
    if (historicalData.length === 0) return 0
    
    // Filtrer uniquement les données réelles (pas les projections)
    const realData = historicalData.filter(d => !d.isProjection)
    
    if (realData.length === 0) return 0
    
    // Calculer la moyenne
    const sum = realData.reduce((acc, d) => acc + d.revenue, 0)
    return Math.round(sum / realData.length)
  }
}

/**
 * Modèle de régression linéaire simple (pour extension future)
 */
export class LinearRegressionModel implements RevenueProjectionModel {
  name = "linear_regression"
  
  calculate(historicalData: RevenueHistoryData[]): number {
    // Filtrer uniquement les données réelles
    const realData = historicalData.filter(d => !d.isProjection)
    
    if (realData.length < 2) {
      // Pas assez de données pour une régression, utiliser la moyenne
      const simpleModel = new SimpleAverageModel()
      return simpleModel.calculate(historicalData)
    }
    
    // Calculer la régression linéaire simple
    // y = a * x + b
    // où x est l'index de la période (0, 1, 2, 3) et y est le revenue
    
    const n = realData.length
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0
    
    realData.forEach((data, index) => {
      const x = index
      const y = data.revenue
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    })
    
    // Calculer les coefficients de régression
    const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const b = (sumY - a * sumX) / n
    
    // Projection pour la période suivante (x = n)
    const projectedRevenue = a * n + b
    
    return Math.round(Math.max(0, projectedRevenue)) // S'assurer que le résultat est positif
  }
}

/**
 * Factory pour obtenir le modèle de projection
 * Permet de changer facilement de modèle via configuration
 */
export class RevenueProjectionService {
  private static model: RevenueProjectionModel = new SimpleAverageModel()
  
  static setModel(model: RevenueProjectionModel) {
    this.model = model
  }
  
  static getModel(): RevenueProjectionModel {
    return this.model
  }
  
  static calculateProjection(historicalData: RevenueHistoryData[]): number {
    return this.model.calculate(historicalData)
  }

  /**
   * Calcule la projection pour les interventions (demandées et terminées séparément)
   */
  static calculateInterventionsProjection(
    historicalData: InterventionsHistoryData[]
  ): { demandees: number; terminees: number } {
    if (historicalData.length === 0) return { demandees: 0, terminees: 0 }

    const realData = historicalData.filter((d) => !d.isProjection)
    if (realData.length === 0) return { demandees: 0, terminees: 0 }

    const sumDemandees = realData.reduce((acc, d) => acc + d.value.demandees, 0)
    const sumTerminees = realData.reduce((acc, d) => acc + d.value.terminees, 0)

    return {
      demandees: Math.round(sumDemandees / realData.length),
      terminees: Math.round(sumTerminees / realData.length),
    }
  }

  /**
   * Calcule la projection pour le taux de transformation (demandées et terminées séparément)
   */
  static calculateTransformationRateProjection(
    historicalData: TransformationRateHistoryData[]
  ): { demandees: number; terminees: number } {
    if (historicalData.length === 0) return { demandees: 0, terminees: 0 }

    const realData = historicalData.filter((d) => !d.isProjection)
    if (realData.length === 0) return { demandees: 0, terminees: 0 }

    const sumDemandees = realData.reduce((acc, d) => acc + d.value.demandees, 0)
    const sumTerminees = realData.reduce((acc, d) => acc + d.value.terminees, 0)

    return {
      demandees: Math.round(sumDemandees / realData.length),
      terminees: Math.round(sumTerminees / realData.length),
    }
  }

  /**
   * Calcule la projection pour le cycle moyen (moyenne simple en jours)
   */
  static calculateCycleTimeProjection(historicalData: CycleTimeHistoryData[]): number {
    if (historicalData.length === 0) return 0

    const realData = historicalData.filter((d) => !d.isProjection)
    if (realData.length === 0) return 0

    const sum = realData.reduce((acc, d) => acc + d.value, 0)
    return Math.round(sum / realData.length)
  }

  /**
   * Calcule la projection pour la marge (moyenne simple en euros)
   */
  static calculateMarginProjection(historicalData: MarginHistoryData[]): number {
    if (historicalData.length === 0) return 0

    const realData = historicalData.filter((d) => !d.isProjection)
    if (realData.length === 0) return 0

    const sum = realData.reduce((acc, d) => acc + d.value, 0)
    return Math.round(sum / realData.length)
  }
}

