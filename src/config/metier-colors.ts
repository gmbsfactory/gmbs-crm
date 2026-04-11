/**
 * Palette de couleurs centralisée pour les métiers
 * Basée sur une palette cohérente et accessible
 * 
 * Utilisation :
 * - Dashboard : pour les widgets de statistiques
 * - HoverCard : pour l'affichage des métiers dans les tooltips
 * - Page Interventions : pour l'affichage des métiers
 */

// ========================================
// COULEURS PAR CODE DE MÉTIER
// ========================================

/**
 * Couleurs pour les métiers (par code)
 * Utilisé pour mapper les codes de métier aux couleurs
 */
export const METIER_COLORS: Record<string, string> = {
  "PLOMBERIE": "#3B82F6",        // bleu
  "ELECTRICITE": "#F59E0B",      // orange/ambre
  "CHAUFFAGE": "#EF4444",        // rouge
  "CLIMATISATION": "#06B6D4",    // cyan
  "PEINTURE": "#8B5CF6",         // violet
  "MENUISERIE": "#10B981",       // vert
  "MENUISIER": "#10B981",        // vert (alias legacy)
  "SERRURERIE": "#F97316",       // orange foncé
  "VITRERIE": "#EC4899",         // rose
  "JARDINAGE": "#22C55E",        // vert clair
  "BRICOLAGE": "#6366F1",        // indigo
  "AUTRES": "#6B7280",           // gris
  "CAMION": "#84CC16",           // vert lime
  "ELECTROMENAGER": "#FBBF24",   // jaune
  "ENTRETIEN_GENERAL": "#14B8A6", // teal
  "MULTI-SERVICE": "#A855F7",     // violet foncé
  "MENAGE": "#FB7185",           // rose clair
  "NETTOYAGE": "#34D399",        // vert émeraude
  "NUISIBLE": "#F87171",         // rouge clair
  "RDF": "#60A5FA",              // bleu clair
  "RENOVATION": "#C084FC",       // violet clair
  "VOLET-STORE": "#818CF8",      // indigo clair
}

/**
 * Couleurs pour les métiers (par label)
 * Utilisé pour mapper les labels de métier aux couleurs (fallback)
 */
export const METIER_COLORS_BY_LABEL: Record<string, string> = {
  "Plomberie": METIER_COLORS["PLOMBERIE"],
  "Électricité": METIER_COLORS["ELECTRICITE"],
  "Electricite": METIER_COLORS["ELECTRICITE"],
  "Chauffage": METIER_COLORS["CHAUFFAGE"],
  "Climatisation": METIER_COLORS["CLIMATISATION"],
  "Peinture": METIER_COLORS["PEINTURE"],
  "Menuiserie": METIER_COLORS["MENUISERIE"],
  "Menuisier": METIER_COLORS["MENUISIER"],
  "Serrurerie": METIER_COLORS["SERRURERIE"],
  "Vitrerie": METIER_COLORS["VITRERIE"],
  "Jardinage": METIER_COLORS["JARDINAGE"],
  "Bricolage": METIER_COLORS["BRICOLAGE"],
  "Autres": METIER_COLORS["AUTRES"],
  "Camion": METIER_COLORS["CAMION"],
  "Électroménager": METIER_COLORS["ELECTROMENAGER"],
  "Electroménager": METIER_COLORS["ELECTROMENAGER"],
  "Entretien général": METIER_COLORS["ENTRETIEN_GENERAL"],
  "Multi-Service": METIER_COLORS["MULTI-SERVICE"],
  "Ménage": METIER_COLORS["MENAGE"],
  "Menage": METIER_COLORS["MENAGE"],
  "Nettoyage": METIER_COLORS["NETTOYAGE"],
  "Nuisible": METIER_COLORS["NUISIBLE"],
  "RDF": METIER_COLORS["RDF"],
  "Rénovation": METIER_COLORS["RENOVATION"],
  "Renovation": METIER_COLORS["RENOVATION"],
  "Volet/Store": METIER_COLORS["VOLET-STORE"],
}

/**
 * Helper pour obtenir la couleur d'un métier
 * @param code - Code du métier (ex: "PLOMBERIE", "ELECTRICITE") - optionnel
 * @param label - Label du métier (ex: "Plomberie", "Électricité") - optionnel
 * @returns Couleur hexadécimale ou couleur par défaut
 */
export function getMetierColor(code?: string | null, label?: string | null): string {
  // Priorité 1 : chercher par code
  if (code && METIER_COLORS[code]) {
    return METIER_COLORS[code]
  }
  
  // Priorité 2 : chercher par label
  if (label && METIER_COLORS_BY_LABEL[label]) {
    return METIER_COLORS_BY_LABEL[label]
  }
  
  // Priorité 3 : chercher par label en majuscules (fallback)
  if (label) {
    const upperLabel = label.toUpperCase()
    if (METIER_COLORS[upperLabel]) {
      return METIER_COLORS[upperLabel]
    }
  }
  
  // Couleur par défaut
  return "#6366F1" // Indigo par défaut
}

