// ===== CONTEXT DETECTOR =====
// Detecte la page courante, l'entite affichee et les actions IA disponibles.
// Utilise le pathname Next.js pour determiner le contexte.

import type { AIActionType, AIPageContext, CRMPage } from './types'
import type { AIViewContext } from '@/stores/ai-context-store'

/**
 * Actions disponibles par type de page
 */
const ACTIONS_BY_PAGE: Record<CRMPage, AIActionType[]> = {
  intervention_detail: ['summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan', 'suggestions'],
  intervention_list: ['suggestions', 'stats_insights', 'data_summary'],
  artisan_detail: ['summary', 'suggestions'],
  artisan_list: ['suggestions', 'stats_insights'],
  dashboard: ['stats_insights', 'suggestions', 'data_summary'],
  admin_dashboard: ['stats_insights', 'suggestions', 'data_summary'],
  comptabilite: ['stats_insights'],
  settings: [],
  unknown: [],
}

/**
 * Detecte le type de page CRM a partir du pathname
 */
function detectPage(pathname: string): CRMPage {
  // Detail intervention: /interventions/[id] (UUID pattern)
  if (/^\/interventions\/[0-9a-f-]{36}/.test(pathname)) {
    return 'intervention_detail'
  }
  // Liste interventions
  if (pathname === '/interventions' || pathname.startsWith('/interventions?')) {
    return 'intervention_list'
  }
  // Detail artisan: /artisans/[id]
  if (/^\/artisans\/[0-9a-f-]{36}/.test(pathname)) {
    return 'artisan_detail'
  }
  // Liste artisans
  if (pathname === '/artisans' || pathname.startsWith('/artisans?')) {
    return 'artisan_list'
  }
  // Dashboard admin
  if (pathname.startsWith('/admin/dashboard') || pathname.startsWith('/admin/analytics')) {
    return 'admin_dashboard'
  }
  // Dashboard
  if (pathname.startsWith('/dashboard')) {
    return 'dashboard'
  }
  // Comptabilite
  if (pathname.startsWith('/comptabilite')) {
    return 'comptabilite'
  }
  // Settings
  if (pathname.startsWith('/settings')) {
    return 'settings'
  }
  return 'unknown'
}

/**
 * Extrait l'ID d'entite depuis le pathname
 */
function extractEntityId(pathname: string): string | null {
  const uuidMatch = pathname.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
  return uuidMatch ? uuidMatch[1] : null
}

/**
 * Determine le type d'entite d'apres la page
 */
function detectEntityType(page: CRMPage): 'intervention' | 'artisan' | null {
  switch (page) {
    case 'intervention_detail':
    case 'intervention_list':
      return 'intervention'
    case 'artisan_detail':
    case 'artisan_list':
      return 'artisan'
    default:
      return null
  }
}

/**
 * Detecte le contexte complet de la page courante.
 *
 * @param pathname - Le pathname Next.js (depuis usePathname())
 * @returns Le contexte IA de la page courante
 *
 * @example
 * const context = detectContext('/interventions/550e8400-e29b-41d4-a716-446655440000')
 * // { page: 'intervention_detail', entityId: '550e...', entityType: 'intervention', ... }
 */
export function detectContext(pathname: string): AIPageContext {
  const page = detectPage(pathname)
  const entityId = extractEntityId(pathname)
  const entityType = detectEntityType(page)
  const availableActions = ACTIONS_BY_PAGE[page] ?? []

  return {
    page,
    entityId,
    entityType,
    pathname,
    availableActions,
  }
}

/**
 * Verifie si une action IA est disponible dans le contexte courant
 */
export function isActionAvailable(context: AIPageContext, action: AIActionType): boolean {
  return context.availableActions.includes(action)
}

/**
 * Retourne l'action par defaut pour une page donnee (utilisee par Cmd+Shift+A)
 */
export function getDefaultAction(context: AIPageContext): AIActionType | null {
  if (context.availableActions.length === 0) return null
  // Sur une page detail, le resume est l'action par defaut
  if (context.page === 'intervention_detail' || context.page === 'artisan_detail') {
    return 'summary'
  }
  // Sinon, la premiere action disponible
  return context.availableActions[0] ?? null
}

/**
 * Construit un resume textuel des filtres appliques.
 */
function buildFilterSummary(
  filters: Array<{ property: string; operator: string; value: unknown }>,
): string {
  if (filters.length === 0) return 'Aucun filtre'
  return filters
    .map((f) => {
      const val = Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '')
      return `${f.property} ${f.operator} ${val}`
    })
    .join(' | ')
}

/**
 * Enrichit un contexte IA de base avec les informations de vue active
 * provenant du store Zustand.
 *
 * @param baseContext - Le contexte detecte depuis le pathname
 * @param viewContext - Les informations de vue active depuis le store
 * @returns Le contexte enrichi avec la vue et les filtres
 */
export function enrichContextWithView(
  baseContext: AIPageContext,
  viewContext: AIViewContext | null,
): AIPageContext {
  if (!viewContext) return baseContext
  return {
    ...baseContext,
    activeViewId: viewContext.activeViewId,
    activeViewTitle: viewContext.activeViewTitle,
    activeViewLayout: viewContext.activeViewLayout,
    appliedFilters: viewContext.appliedFilters,
    filterSummary: buildFilterSummary(viewContext.appliedFilters),
  }
}
