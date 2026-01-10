/**
 * Utilitaires pour le calcul de la marge dans les interventions
 */

/**
 * Résultat du calcul de marge
 */
export interface MarginResult {
  /** Marge en pourcentage */
  marginPercentage: number
  /** Marge en valeur absolue */
  marginValue: number
  /** Revenus totaux */
  revenue: number
  /** Coûts totaux */
  totalCosts: number
  /** Indique si le calcul est valide (revenus > 0) */
  isValid: boolean
}

/**
 * Calcule la marge pour un artisan principal
 *
 * Formule: marge = ((revenus - coûts) / revenus) * 100
 *
 * @param revenue - Prix de vente de l'intervention (coutIntervention)
 * @param sstCost - Coût SST (coutSST)
 * @param materialCost - Coût matériel (coutMateriel)
 * @returns Résultat du calcul de marge
 *
 * @example
 * ```ts
 * const result = calculatePrimaryArtisanMargin(1000, 600, 100)
 * // result.marginPercentage = 30.0
 * // result.marginValue = 300
 * ```
 */
export function calculatePrimaryArtisanMargin(
  revenue: string | number,
  sstCost: string | number,
  materialCost: string | number
): MarginResult {
  const revenueNum = parseFloat(String(revenue)) || 0
  const sstNum = parseFloat(String(sstCost)) || 0
  const matNum = parseFloat(String(materialCost)) || 0

  const totalCosts = sstNum + matNum
  const marginValue = revenueNum - totalCosts

  if (revenueNum <= 0) {
    return {
      marginPercentage: 0,
      marginValue: 0,
      revenue: revenueNum,
      totalCosts,
      isValid: false,
    }
  }

  const marginPercentage = (marginValue / revenueNum) * 100

  return {
    marginPercentage,
    marginValue,
    revenue: revenueNum,
    totalCosts,
    isValid: true,
  }
}

/**
 * Calcule la marge pour un second artisan
 *
 * Le revenu disponible pour le 2ème artisan est le revenu total
 * moins les coûts du 1er artisan.
 *
 * Formule:
 * - revenuDisponible = revenuTotal - (coûtSST1 + coûtMat1)
 * - marge = revenuDisponible - (coûtSST2 + coûtMat2)
 * - margePct = (marge / revenuDisponible) * 100
 *
 * @param totalRevenue - Prix de vente total de l'intervention
 * @param primarySstCost - Coût SST du 1er artisan
 * @param primaryMaterialCost - Coût matériel du 1er artisan
 * @param secondarySstCost - Coût SST du 2ème artisan
 * @param secondaryMaterialCost - Coût matériel du 2ème artisan
 * @returns Résultat du calcul de marge
 *
 * @example
 * ```ts
 * const result = calculateSecondaryArtisanMargin(1000, 400, 100, 300, 50)
 * // Revenu disponible = 1000 - (400 + 100) = 500
 * // Marge = 500 - (300 + 50) = 150
 * // Marge % = (150 / 500) * 100 = 30.0
 * ```
 */
export function calculateSecondaryArtisanMargin(
  totalRevenue: string | number,
  primarySstCost: string | number,
  primaryMaterialCost: string | number,
  secondarySstCost: string | number,
  secondaryMaterialCost: string | number
): MarginResult {
  const revenueNum = parseFloat(String(totalRevenue)) || 0
  const primarySstNum = parseFloat(String(primarySstCost)) || 0
  const primaryMatNum = parseFloat(String(primaryMaterialCost)) || 0
  const secondarySstNum = parseFloat(String(secondarySstCost)) || 0
  const secondaryMatNum = parseFloat(String(secondaryMaterialCost)) || 0

  // Coûts du 1er artisan
  const primaryCosts = primarySstNum + primaryMatNum

  // Revenu disponible pour le 2ème artisan
  const availableRevenue = revenueNum - primaryCosts

  // Coûts du 2ème artisan
  const secondaryCosts = secondarySstNum + secondaryMatNum

  // Marge du 2ème artisan
  const marginValue = availableRevenue - secondaryCosts

  if (availableRevenue <= 0) {
    return {
      marginPercentage: 0,
      marginValue,
      revenue: availableRevenue,
      totalCosts: secondaryCosts,
      isValid: false,
    }
  }

  const marginPercentage = (marginValue / availableRevenue) * 100

  return {
    marginPercentage,
    marginValue,
    revenue: availableRevenue,
    totalCosts: secondaryCosts,
    isValid: true,
  }
}

/**
 * Formate la marge en pourcentage pour l'affichage
 *
 * @param marginPercentage - Marge en pourcentage
 * @param decimals - Nombre de décimales (par défaut: 1)
 * @returns Chaîne formatée (ex: "30.5 %")
 */
export function formatMarginPercentage(marginPercentage: number, decimals = 1): string {
  return `${marginPercentage.toFixed(decimals)} %`
}

/**
 * Détermine la couleur CSS à utiliser pour afficher la marge
 *
 * @param marginPercentage - Marge en pourcentage
 * @returns Classe CSS Tailwind pour la couleur
 */
export function getMarginColorClass(marginPercentage: number): string {
  return marginPercentage < 0 ? "text-destructive" : "text-green-600"
}
