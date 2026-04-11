/**
 * Palette de couleurs centralisée pour les statuts d'interventions et d'artisans
 * Basée sur les couleurs définies dans la base de données (seed_essential.sql)
 * 
 * Utilisation :
 * - Dashboard : pour les widgets de statistiques
 * - Page Interventions : pour l'affichage des statuts
 * - Page Artisans : pour l'affichage des statuts
 */

// ========================================
// STATUTS D'INTERVENTIONS
// ========================================

/**
 * Couleurs pour les statuts d'interventions (par label)
 * Utilisé dans le dashboard et la page interventions
 */
export const INTERVENTION_STATUS_COLORS: Record<string, string> = {
  "Demandé": "#3B82F6",           // bleu
  "Devis envoyé": "#8B5CF6",      // violet (DEVIS_ENVOYE)
  "Devis Envoyé": "#8B5CF6",      // violet (variante)
  "Visite technique": "#06B6D4",   // cyan (VISITE_TECHNIQUE)
  "Visite Technique": "#06B6D4",  // cyan (variante)
  "Accepté": "#10B981",           // vert émeraude
  "Inter en cours": "#F59E0B",     // orange/ambre
  "Inter terminée": "#10B981",     // vert (INTER_TERMINEE)
  "Inter Terminée": "#10B981",     // vert (variante)
  "En cours": "#F59E0B",           // orange
  "Terminé": "#10B981",            // vert
  "Check": "#EF4444",              // rouge
  "Annulé": "#EF4444",             // rouge
  "Refusé": "#EF4444",             // rouge
  "Stand-by": "#6B7280",           // gris (STAND_BY)
  "Stand by": "#6B7280",           // gris (variante)
  "SAV": "#EC4899",                // rose
  "Att Acompte": "#F97316",        // orange (ATT_ACOMPTE)
  "Att. acompte": "#F97316",       // variante
  "Potentiel": "#FACC15",           // jaune (POTENTIEL)
}

/**
 * Couleurs pour les statuts d'interventions (par code)
 * Utilisé pour mapper les codes de statut aux couleurs
 */
export const INTERVENTION_STATUS_COLORS_BY_CODE: Record<string, string> = {
  "DEMANDE": "#3B82F6",
  "DEVIS_ENVOYE": "#8B5CF6",
  "VISITE_TECHNIQUE": "#06B6D4",
  "ACCEPTE": "#10B981",
  "INTER_EN_COURS": "#F59E0B",
  "INTER_TERMINEE": "#10B981",
  "ANNULE": "#EF4444",
  "REFUSE": "#EF4444",
  "STAND_BY": "#6B7280",
  "SAV": "#EC4899",
  "ATT_ACOMPTE": "#F97316",
  "POTENTIEL": "#FACC15",
}

// ========================================
// STATUTS D'ARTISANS
// ========================================

/**
 * Couleurs pour les statuts d'artisans (par label)
 * Utilisé dans le dashboard et la page artisans
 */
export const ARTISAN_STATUS_COLORS: Record<string, string> = {
  "Candidat": "#A855F7",           // violet (CANDIDAT)
  "Potentiel": "#FACC15",           // jaune (POTENTIEL)
  "Novice": "#60A5FA",              // bleu clair (NOVICE)
  "Formation": "#38BDF8",           // cyan (FORMATION)
  "Confirmé": "#22C55E",            // vert (CONFIRME) ✓ Confirmé est vert
  "Expert": "#6366F1",              // indigo/violet (EXPERT)
  "One Shot": "#F97316",             // orange (ONE_SHOT)
  "OneShot": "#F97316",              // orange (variante)
  "Inactif": "#EF4444",              // rouge (INACTIF)
  "Archivé": "#6B7280",             // gris (ARCHIVE)
  "Actif": "#22C55E",                // vert (pour compatibilité)
}

/**
 * Couleurs pour les statuts d'artisans (par code)
 */
export const ARTISAN_STATUS_COLORS_BY_CODE: Record<string, string> = {
  "CANDIDAT": "#A855F7",
  "POTENTIEL": "#FACC15",
  "NOVICE": "#60A5FA",
  "FORMATION": "#38BDF8",
  "CONFIRME": "#22C55E",  // ✓ Confirmé est vert
  "EXPERT": "#6366F1",
  "ONE_SHOT": "#F97316",
  "INACTIF": "#EF4444",
  "ARCHIVE": "#6B7280",
}

/**
 * Styles Tailwind complets pour les statuts d'artisans (pour le dashboard)
 * Inclut bg, border, text et hover
 */
export const ARTISAN_STATUS_STYLES: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  "Candidat": {
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-200 dark:border-purple-800/30",
    text: "text-purple-700 dark:text-purple-300",
    hover: "hover:bg-purple-100 dark:hover:bg-purple-950/40",
  },
  "Potentiel": {
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800/30",
    text: "text-yellow-700 dark:text-yellow-300",
    hover: "hover:bg-yellow-100 dark:hover:bg-yellow-950/40",
  },
  "Novice": {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800/30",
    text: "text-blue-700 dark:text-blue-300",
    hover: "hover:bg-blue-100 dark:hover:bg-blue-950/40",
  },
  "Formation": {
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
    border: "border-cyan-200 dark:border-cyan-800/30",
    text: "text-cyan-700 dark:text-cyan-300",
    hover: "hover:bg-cyan-100 dark:hover:bg-cyan-950/40",
  },
  "Confirmé": {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/30",
    text: "text-green-700 dark:text-green-300",
    hover: "hover:bg-green-100 dark:hover:bg-green-950/40",
  },
  "Expert": {
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-200 dark:border-indigo-800/30",
    text: "text-indigo-700 dark:text-indigo-300",
    hover: "hover:bg-indigo-100 dark:hover:bg-indigo-950/40",
  },
  "One Shot": {
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800/30",
    text: "text-orange-700 dark:text-orange-300",
    hover: "hover:bg-orange-100 dark:hover:bg-orange-950/40",
  },
  "OneShot": {
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800/30",
    text: "text-orange-700 dark:text-orange-300",
    hover: "hover:bg-orange-100 dark:hover:bg-orange-950/40",
  },
  "Inactif": {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800/30",
    text: "text-red-700 dark:text-red-300",
    hover: "hover:bg-red-100 dark:hover:bg-red-950/40",
  },
  "Archivé": {
    bg: "bg-gray-50 dark:bg-gray-950/20",
    border: "border-gray-200 dark:border-gray-800/30",
    text: "text-gray-700 dark:text-gray-300",
    hover: "hover:bg-gray-100 dark:hover:bg-gray-950/40",
  },
  "Actif": {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/30",
    text: "text-green-700 dark:text-green-300",
    hover: "hover:bg-green-100 dark:hover:bg-green-950/40",
  },
}

/**
 * Helper pour obtenir la couleur d'un statut d'intervention
 * @param label - Label du statut (ex: "Demandé", "Inter en cours")
 * @param code - Code du statut (ex: "DEMANDE", "INTER_EN_COURS") - optionnel
 * @returns Couleur hexadécimale ou couleur par défaut
 */
export function getInterventionStatusColor(label?: string | null, code?: string | null): string {
  if (label && INTERVENTION_STATUS_COLORS[label]) {
    return INTERVENTION_STATUS_COLORS[label]
  }
  if (code && INTERVENTION_STATUS_COLORS_BY_CODE[code]) {
    return INTERVENTION_STATUS_COLORS_BY_CODE[code]
  }
  return "#6366F1" // Couleur par défaut (violet)
}

/**
 * Helper pour obtenir la couleur d'un statut d'artisan
 * @param label - Label du statut (ex: "Expert", "Novice", "Confirmé")
 * @param code - Code du statut (ex: "EXPERT", "NOVICE", "CONFIRME") - optionnel
 * @returns Couleur hexadécimale ou couleur par défaut
 */
export function getArtisanStatusColor(label?: string | null, code?: string | null): string {
  if (label && ARTISAN_STATUS_COLORS[label]) {
    return ARTISAN_STATUS_COLORS[label]
  }
  if (code && ARTISAN_STATUS_COLORS_BY_CODE[code]) {
    return ARTISAN_STATUS_COLORS_BY_CODE[code]
  }
  return "#6366F1" // Couleur par défaut (violet)
}

/**
 * Helper pour obtenir les styles Tailwind complets d'un statut d'artisan
 * @param label - Label du statut (ex: "Expert", "Novice", "Confirmé")
 * @returns Styles Tailwind ou styles par défaut
 */
export function getArtisanStatusStyles(label?: string | null): { bg: string; border: string; text: string; hover: string } {
  if (label && ARTISAN_STATUS_STYLES[label]) {
    return ARTISAN_STATUS_STYLES[label]
  }
  return {
    bg: "bg-card",
    border: "border-border",
    text: "text-foreground",
    hover: "hover:bg-muted/50",
  }
}

/**
 * Abréviations pour les statuts d'artisans
 */
export const ARTISAN_STATUS_ABBREVIATIONS: Record<string, string> = {
  // Par label
  "Candidat": "CAN",
  "Potentiel": "POT",
  "Novice": "NOV",
  "Formation": "FOR",
  "Confirmé": "CON",
  "Expert": "EXP",
  "One Shot": "ONE",
  "OneShot": "ONE",
  "Inactif": "INA",
  "Archivé": "ARC",
  "Actif": "ACT",
  // Par code
  "CANDIDAT": "CAN",
  "POTENTIEL": "POT",
  "NOVICE": "NOV",
  "FORMATION": "FOR",
  "CONFIRME": "CON",
  "EXPERT": "EXP",
  "ONE_SHOT": "ONE",
  "INACTIF": "INA",
  "ARCHIVE": "ARC",
}

/**
 * Helper pour obtenir la version réduite d'un statut d'artisan
 * @param label - Label du statut
 * @param abbreviation - Abréviation explicite du statut (si disponible)
 * @returns Abbreviation (3-4 lettres) ou fallback
 */
export function getArtisanStatusAbbreviation(label?: string | null, code?: string | null, abbreviation?: string | null): string {
  if (abbreviation) return abbreviation.toUpperCase()
  if (label && ARTISAN_STATUS_ABBREVIATIONS[label]) {
    return ARTISAN_STATUS_ABBREVIATIONS[label]
  }
  if (code && ARTISAN_STATUS_ABBREVIATIONS[code]) {
    return ARTISAN_STATUS_ABBREVIATIONS[code]
  }

  const base = label || code || ""
  if (base.length <= 3) return base.toUpperCase()
  return base.substring(0, 3).toUpperCase()
}
