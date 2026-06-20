/**
 * Catégorisation et palette du flux d'activité du Monitoring DEV.
 *
 * Toutes les couleurs sont exprimées via des tokens HSL du design system
 * (chart-1..5, primary, success-hsl, warning-hsl, muted-foreground) — aucune
 * couleur en dur, pour survivre aux 4 thèmes × 2 modes. Logique pure → testable.
 */

export type ActivityCategory =
  | "create"
  | "status"
  | "finance"
  | "doc"
  | "comment"
  | "update"
  | "assign"
  | "archive"

interface CategoryMeta {
  label: string
  glyph: string
  /** Nom du token HSL (triplet) — consommé via hsl(var(<token>)). */
  token: string
}

const CATEGORIES: Record<ActivityCategory, CategoryMeta> = {
  create: { label: "Créations", glyph: "+", token: "--success-hsl" },
  status: { label: "Statuts", glyph: "⇄", token: "--primary" },
  finance: { label: "Finances", glyph: "€", token: "--warning-hsl" },
  doc: { label: "Documents", glyph: "▣", token: "--chart-4" },
  comment: { label: "Commentaires", glyph: "❝", token: "--muted-foreground" },
  update: { label: "Modifications", glyph: "✎", token: "--chart-1" },
  assign: { label: "Affectations", glyph: "⊕", token: "--chart-5" },
  archive: { label: "Archives", glyph: "▦", token: "--muted-foreground" },
}

const ACTION_CATEGORY: Record<string, ActivityCategory> = {
  CREATE: "create",
  STATUS_CHANGE: "status",
  COST_ADD: "finance",
  COST_UPDATE: "finance",
  COST_DELETE: "finance",
  PAYMENT_ADD: "finance",
  PAYMENT_UPDATE: "finance",
  PAYMENT_DELETE: "finance",
  DOCUMENT_ADD: "doc",
  DOCUMENT_UPDATE: "doc",
  DOCUMENT_DELETE: "doc",
  COMMENT_ADD: "comment",
  COMMENT_UPDATE: "comment",
  COMMENT_DELETE: "comment",
  ARTISAN_ASSIGN: "assign",
  ARTISAN_UNASSIGN: "assign",
  ARTISAN_UPDATE: "assign",
  METIER_ADD: "update",
  METIER_REMOVE: "update",
  ZONE_ADD: "update",
  ZONE_REMOVE: "update",
  ABSENCE_ADD: "update",
  ABSENCE_UPDATE: "update",
  ABSENCE_DELETE: "update",
  UPDATE: "update",
  ARCHIVE: "archive",
  RESTORE: "archive",
}

export const ALL_CATEGORIES = Object.keys(CATEGORIES) as ActivityCategory[]

export function categoryOf(actionType: string): ActivityCategory {
  return ACTION_CATEGORY[actionType] ?? "update"
}

export function categoryMeta(c: ActivityCategory): CategoryMeta {
  return CATEGORIES[c]
}

/** Couleur pleine d'une catégorie. */
export function catColor(c: ActivityCategory): string {
  return `hsl(var(${CATEGORIES[c].token}))`
}

/** Teinte (fond) d'une catégorie. */
export function catTint(c: ActivityCategory, alpha = 0.14): string {
  return `hsl(var(${CATEGORIES[c].token}) / ${alpha})`
}

/** Liste des action_types couverts par une catégorie (filtre serveur). */
export function actionTypesForCategory(c: ActivityCategory): string[] {
  return Object.entries(ACTION_CATEGORY)
    .filter(([, cat]) => cat === c)
    .map(([action]) => action)
}

// ---------------------------------------------------------------------------
// Palette « par page » (présence)
// ---------------------------------------------------------------------------

const PAGES: Record<string, { label: string; token: string }> = {
  dashboard: { label: "Dashboard", token: "--chart-4" },
  interventions: { label: "Interventions", token: "--chart-3" },
  artisans: { label: "Artisans", token: "--chart-1" },
  comptabilite: { label: "Comptabilité", token: "--chart-2" },
  monitoring: { label: "Suivi", token: "--chart-5" },
  "monitoring-dev": { label: "Monitoring Dev", token: "--chart-5" },
  settings: { label: "Paramètres", token: "--muted-foreground" },
}

export function pageLabel(page: string | null): string {
  return PAGES[page ?? ""]?.label ?? page ?? "Autre"
}

export function pageColor(page: string | null): string {
  const token = PAGES[page ?? ""]?.token ?? "--muted-foreground"
  return `hsl(var(${token}))`
}

export function pageTint(page: string | null, alpha = 0.14): string {
  const token = PAGES[page ?? ""]?.token ?? "--muted-foreground"
  return `hsl(var(${token}) / ${alpha})`
}
