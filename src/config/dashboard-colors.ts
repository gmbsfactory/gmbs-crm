/**
 * Palette de couleurs centralisée pour le Dashboard Admin
 * Basée sur une palette cohérente avec metier-colors.ts
 *
 * Utilisation :
 * - Admin Dashboard : pour les KPIs, graphiques, indicateurs
 * - Funnel Chart : pour les étapes de conversion
 * - Top Artisans : pour les visualisations
 * - Cycle Times : pour les métriques temporelles
 */

// ========================================
// COULEURS DES ÉTAPES DU FUNNEL
// ========================================

/**
 * Couleurs pour les étapes du funnel de conversion
 * Ordre: DEMANDE → DEVIS_ENVOYE → ACCEPTE → EN_COURS → TERMINEE
 */
export const FUNNEL_COLORS = {
  DEMANDE: "#3B82F6",           // Bleu - Première étape (forte visibilité)
  DEVIS_ENVOYE: "#06B6D4",      // Cyan - Deuxième étape
  ACCEPTE: "#10B981",           // Vert - Acceptation (positif)
  EN_COURS: "#F59E0B",          // Orange - En cours (attention)
  TERMINEE: "#22C55E",          // Vert clair - Terminée (succès)
} as const

/**
 * Tableau de couleurs pour le funnel (pour itération)
 */
export const FUNNEL_COLORS_ARRAY = [
  FUNNEL_COLORS.DEMANDE,
  FUNNEL_COLORS.DEVIS_ENVOYE,
  FUNNEL_COLORS.ACCEPTE,
  FUNNEL_COLORS.EN_COURS,
  FUNNEL_COLORS.TERMINEE,
] as const

// ========================================
// COULEURS DES KPIs PRINCIPAUX
// ========================================

/**
 * Couleurs pour les KPIs du dashboard
 */
export const KPI_COLORS = {
  // KPIs volume
  interventions: "#3B82F6",     // Bleu
  demandes: "#06B6D4",          // Cyan
  devis: "#8B5CF6",             // Violet
  valides: "#10B981",           // Vert
  terminees: "#22C55E",         // Vert clair

  // KPIs financiers
  chiffreAffaires: "#10B981",   // Vert (positif)
  couts: "#EF4444",             // Rouge (négatif)
  marge: "#8B5CF6",             // Violet (métrique dérivée)

  // KPIs temporels
  cycleTime: "#F59E0B",         // Orange (temps)
  delai: "#F97316",             // Orange foncé (délai)

  // KPIs taux
  tauxTransformation: "#6366F1", // Indigo (pourcentage)
  tauxMarge: "#A855F7",          // Violet foncé (pourcentage)
  conversion: "#14B8A6",         // Teal (pourcentage)
} as const

// ========================================
// COULEURS DES GRAPHIQUES
// ========================================

/**
 * Palette pour les graphiques multi-séries (sparklines, breakdowns)
 */
export const CHART_COLORS = [
  "#3B82F6", // Bleu
  "#10B981", // Vert
  "#F59E0B", // Orange
  "#8B5CF6", // Violet
  "#EF4444", // Rouge
  "#06B6D4", // Cyan
  "#EC4899", // Rose
  "#84CC16", // Lime
  "#6366F1", // Indigo
  "#14B8A6", // Teal
] as const

/**
 * Couleurs pour les sparklines (graphiques miniatures)
 */
export const SPARKLINE_COLORS = {
  primary: "#3B82F6",           // Bleu - Ligne principale
  secondary: "#10B981",         // Vert - Ligne secondaire
  area: "rgba(59, 130, 246, 0.1)", // Bleu transparent - Zone sous la courbe
  grid: "#E5E7EB",              // Gris clair - Grille
} as const

// ========================================
// COULEURS DES INDICATEURS DE TENDANCE
// ========================================

/**
 * Couleurs pour les indicateurs de variation (delta)
 */
export const TREND_COLORS = {
  positive: "#10B981",          // Vert - Tendance positive
  negative: "#EF4444",          // Rouge - Tendance négative
  neutral: "#6B7280",           // Gris - Tendance neutre
  positiveLight: "rgba(16, 185, 129, 0.1)", // Vert transparent
  negativeLight: "rgba(239, 68, 68, 0.1)",  // Rouge transparent
} as const

// ========================================
// COULEURS DES STATUTS
// ========================================

/**
 * Couleurs pour les statuts d'intervention
 */
export const STATUS_COLORS: Record<string, string> = {
  // Statuts principaux
  DEMANDE: "#3B82F6",           // Bleu
  DEVIS_ENVOYE: "#06B6D4",      // Cyan
  ACCEPTE: "#10B981",           // Vert
  EN_COURS: "#F59E0B",          // Orange
  INTER_EN_COURS: "#F59E0B",    // Orange (variante)
  TERMINEE: "#22C55E",          // Vert clair
  INTER_TERMINEE: "#22C55E",    // Vert clair (variante)
  TERMINE: "#22C55E",           // Vert clair (variante 2)

  // Statuts secondaires
  ATT_ACOMPTE: "#F97316",       // Orange foncé
  ANNULEE: "#EF4444",           // Rouge
  REFUSEE: "#DC2626",           // Rouge foncé
  EN_ATTENTE: "#FBBF24",        // Jaune

  // Fallback
  DEFAULT: "#6B7280",           // Gris
}

// ========================================
// COULEURS DES AGENCES
// ========================================

/**
 * Palette pour les agences (utilise CHART_COLORS)
 */
export const AGENCY_COLORS = CHART_COLORS

// ========================================
// COULEURS DES GESTIONNAIRES
// ========================================

/**
 * Palette pour les gestionnaires (utilise CHART_COLORS)
 */
export const GESTIONNAIRE_COLORS = CHART_COLORS

// ========================================
// HELPERS
// ========================================

/**
 * Obtient la couleur d'un statut
 * @param statusCode - Code du statut (ex: "DEMANDE", "TERMINEE")
 * @returns Couleur hexadécimale
 */
export function getStatusColor(statusCode: string): string {
  return STATUS_COLORS[statusCode] || STATUS_COLORS.DEFAULT
}

/**
 * Obtient la couleur d'une tendance (delta)
 * @param value - Valeur numérique
 * @param inverse - Si true, inverse la logique (négatif = bon)
 * @returns Couleur hexadécimale
 */
export function getTrendColor(value: number, inverse: boolean = false): string {
  if (value === 0) return TREND_COLORS.neutral

  const isPositive = value > 0
  const shouldBeGreen = inverse ? !isPositive : isPositive

  return shouldBeGreen ? TREND_COLORS.positive : TREND_COLORS.negative
}

/**
 * Obtient une couleur de la palette pour un index donné (rotation cyclique)
 * @param index - Index de l'élément
 * @param palette - Palette à utiliser (par défaut: CHART_COLORS)
 * @returns Couleur hexadécimale
 */
export function getColorByIndex(
  index: number,
  palette: readonly string[] = CHART_COLORS
): string {
  return palette[index % palette.length]
}

/**
 * Obtient la couleur d'une étape du funnel
 * @param statusCode - Code du statut (ex: "DEMANDE", "TERMINEE")
 * @returns Couleur hexadécimale
 */
export function getFunnelColor(statusCode: string): string {
  // Normalisation des variantes de statuts
  const normalizedCode = statusCode
    .replace('INTER_', '')
    .replace('TERMINE', 'TERMINEE')

  return FUNNEL_COLORS[normalizedCode as keyof typeof FUNNEL_COLORS] || CHART_COLORS[0]
}

// ========================================
// EXPORTS
// ========================================

// ========================================
// COULEURS DES GOULOTS D'ÉTRANGLEMENT
// ========================================

/**
 * Couleurs pour les taux de conversion (bottleneck analysis)
 */
export const CONVERSION_COLORS = {
  excellent: "#10B981",   // ≥85% - Vert
  warning: "#F59E0B",     // 70-84% - Jaune
  concerning: "#F97316",  // 50-69% - Orange
  critical: "#EF4444",    // <50% - Rouge
  neutral: "#6B7280",     // Pas de taux (première étape)
} as const

/**
 * Seuils pour les taux de conversion
 */
export const CONVERSION_THRESHOLDS = {
  excellent: 85,
  warning: 70,
  concerning: 50,
} as const

/**
 * Obtient la couleur selon le taux de conversion
 * @param rate - Taux de conversion en pourcentage (0-100)
 * @returns Couleur hexadécimale
 */
export function getConversionRateColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return CONVERSION_COLORS.neutral

  if (rate >= CONVERSION_THRESHOLDS.excellent) return CONVERSION_COLORS.excellent
  if (rate >= CONVERSION_THRESHOLDS.warning) return CONVERSION_COLORS.warning
  if (rate >= CONVERSION_THRESHOLDS.concerning) return CONVERSION_COLORS.concerning
  return CONVERSION_COLORS.critical
}

/**
 * Détermine si un taux de conversion est critique (goulot)
 * @param rate - Taux de conversion en pourcentage (0-100)
 * @returns true si critique
 */
export function isCriticalConversionRate(rate: number | null | undefined): boolean {
  return rate !== null && rate !== undefined && rate < CONVERSION_THRESHOLDS.warning
}

/**
 * Trouve l'index du goulot d'étranglement (plus bas taux de conversion)
 * @param steps - Array d'étapes avec conversionRate
 * @returns Index du goulot, ou -1 si aucun
 */
export function findBottleneckIndex(
  steps: Array<{ conversionRate?: number | null }>
): number {
  let lowestRate = 100
  let lowestIndex = -1

  steps.forEach((step, idx) => {
    if (step.conversionRate !== null && step.conversionRate !== undefined) {
      if (step.conversionRate < lowestRate) {
        lowestRate = step.conversionRate
        lowestIndex = idx
      }
    }
  })

  return lowestIndex
}

// ========================================
// EXPORTS
// ========================================

export type FunnelColorKey = keyof typeof FUNNEL_COLORS
export type KPIColorKey = keyof typeof KPI_COLORS
export type StatusColorKey = keyof typeof STATUS_COLORS
export type ConversionColorKey = keyof typeof CONVERSION_COLORS
