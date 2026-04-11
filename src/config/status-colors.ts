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
/**
 * Couleurs par défaut pour les statuts d'interventions (par code)
 * Source de vérité pour les fallbacks — les couleurs réelles viennent de la DB (Settings)
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

/**
 * Couleurs pour les statuts d'interventions (par label)
 * Référence INTERVENTION_STATUS_COLORS_BY_CODE comme source de vérité
 */
export const INTERVENTION_STATUS_COLORS: Record<string, string> = {
  "Demandé": INTERVENTION_STATUS_COLORS_BY_CODE["DEMANDE"],
  "Devis envoyé": INTERVENTION_STATUS_COLORS_BY_CODE["DEVIS_ENVOYE"],
  "Devis Envoyé": INTERVENTION_STATUS_COLORS_BY_CODE["DEVIS_ENVOYE"],
  "Visite technique": INTERVENTION_STATUS_COLORS_BY_CODE["VISITE_TECHNIQUE"],
  "Visite Technique": INTERVENTION_STATUS_COLORS_BY_CODE["VISITE_TECHNIQUE"],
  "Accepté": INTERVENTION_STATUS_COLORS_BY_CODE["ACCEPTE"],
  "Inter en cours": INTERVENTION_STATUS_COLORS_BY_CODE["INTER_EN_COURS"],
  "Inter terminée": INTERVENTION_STATUS_COLORS_BY_CODE["INTER_TERMINEE"],
  "Inter Terminée": INTERVENTION_STATUS_COLORS_BY_CODE["INTER_TERMINEE"],
  "En cours": INTERVENTION_STATUS_COLORS_BY_CODE["INTER_EN_COURS"],
  "Terminé": INTERVENTION_STATUS_COLORS_BY_CODE["INTER_TERMINEE"],
  "Check": INTERVENTION_STATUS_COLORS_BY_CODE["ANNULE"],
  "Annulé": INTERVENTION_STATUS_COLORS_BY_CODE["ANNULE"],
  "Refusé": INTERVENTION_STATUS_COLORS_BY_CODE["REFUSE"],
  "Stand-by": INTERVENTION_STATUS_COLORS_BY_CODE["STAND_BY"],
  "Stand by": INTERVENTION_STATUS_COLORS_BY_CODE["STAND_BY"],
  "SAV": INTERVENTION_STATUS_COLORS_BY_CODE["SAV"],
  "Att Acompte": INTERVENTION_STATUS_COLORS_BY_CODE["ATT_ACOMPTE"],
  "Att. acompte": INTERVENTION_STATUS_COLORS_BY_CODE["ATT_ACOMPTE"],
  "Potentiel": INTERVENTION_STATUS_COLORS_BY_CODE["POTENTIEL"],
}

// ========================================
// STATUTS D'ARTISANS
// ========================================

/**
 * Couleurs pour les statuts d'artisans (par label)
 * Utilisé dans le dashboard et la page artisans
 */
/**
 * Couleurs par défaut pour les statuts d'artisans (par code)
 * Source de vérité pour les fallbacks — les couleurs réelles viennent de la DB (Settings)
 */
export const ARTISAN_STATUS_COLORS_BY_CODE: Record<string, string> = {
  "CANDIDAT": "#A855F7",
  "POTENTIEL": "#FACC15",
  "NOVICE": "#60A5FA",
  "FORMATION": "#38BDF8",
  "CONFIRME": "#22C55E",
  "EXPERT": "#6366F1",
  "ONE_SHOT": "#F97316",
  "INACTIF": "#EF4444",
  "ARCHIVE": "#6B7280",
}

/**
 * Couleurs pour les statuts d'artisans (par label)
 * Référence ARTISAN_STATUS_COLORS_BY_CODE comme source de vérité
 */
export const ARTISAN_STATUS_COLORS: Record<string, string> = {
  "Candidat": ARTISAN_STATUS_COLORS_BY_CODE["CANDIDAT"],
  "Potentiel": ARTISAN_STATUS_COLORS_BY_CODE["POTENTIEL"],
  "Novice": ARTISAN_STATUS_COLORS_BY_CODE["NOVICE"],
  "Formation": ARTISAN_STATUS_COLORS_BY_CODE["FORMATION"],
  "Confirmé": ARTISAN_STATUS_COLORS_BY_CODE["CONFIRME"],
  "Expert": ARTISAN_STATUS_COLORS_BY_CODE["EXPERT"],
  "One Shot": ARTISAN_STATUS_COLORS_BY_CODE["ONE_SHOT"],
  "OneShot": ARTISAN_STATUS_COLORS_BY_CODE["ONE_SHOT"],
  "Inactif": ARTISAN_STATUS_COLORS_BY_CODE["INACTIF"],
  "Archivé": ARTISAN_STATUS_COLORS_BY_CODE["ARCHIVE"],
  "Actif": ARTISAN_STATUS_COLORS_BY_CODE["CONFIRME"],
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
