// ===== TYPES IA =====
// Types TypeScript pour la couche IA du CRM

/**
 * Actions IA disponibles via raccourcis clavier
 */
export type AIActionType =
  | 'summary'
  | 'next_steps'
  | 'email_artisan'
  | 'email_client'
  | 'find_artisan'
  | 'suggestions'
  | 'stats_insights'
  | 'data_summary'

/**
 * Pages du CRM detectables par le context-detector
 */
export type CRMPage =
  | 'intervention_detail'
  | 'intervention_list'
  | 'artisan_detail'
  | 'artisan_list'
  | 'dashboard'
  | 'admin_dashboard'
  | 'comptabilite'
  | 'settings'
  | 'unknown'

/**
 * Contexte detecte automatiquement sur la page courante
 */
export interface AIPageContext {
  page: CRMPage
  entityId: string | null
  entityType: 'intervention' | 'artisan' | null
  pathname: string
  availableActions: AIActionType[]
  activeViewId?: string
  activeViewTitle?: string
  activeViewLayout?: string // "table" | "cards" | "calendar" | etc.
  appliedFilters?: Array<{
    property: string
    operator: string
    value: unknown
  }>
  filterSummary?: string // Resume textuel des filtres pour le prompt IA
}

/**
 * Donnees anonymisees d'une intervention (safe pour API IA)
 */
export interface AnonymizedIntervention {
  id: string
  id_inter: string | null
  contexte: string | null
  consigne: string | null
  consigne_second_artisan: string | null
  commentaire_agent: string | null
  statut_code: string | null
  statut_label: string | null
  metier_label: string | null
  metier_code: string | null
  code_postal: string | null
  ville: string | null
  date: string | null
  date_prevue: string | null
  date_termine: string | null
  artisan_pseudo: string | null
  gestionnaire_pseudo: string | null
  agence_label: string | null
  cout_intervention: number | null
  cout_sst: number | null
  marge: number | null
}

/**
 * Donnees anonymisees d'un artisan (safe pour API IA)
 */
export interface AnonymizedArtisan {
  id: string
  pseudo: string
  metiers: string[]
  zone_code_postal: string | null
  zone_ville: string | null
  statut: string | null
  nombre_interventions_actives: number | null
  siret: string | null
}

/**
 * Requete envoyee a l'Edge Function ai-contextual-action
 */
export interface AIContextualActionRequest {
  action: AIActionType
  context: AIPageContext
  entity_data?: AnonymizedIntervention | AnonymizedArtisan | null
  extra_params?: Record<string, unknown>
}

/**
 * Reponse de l'Edge Function ai-contextual-action
 */
export interface AIContextualActionResponse {
  success: boolean
  action: AIActionType
  result: {
    content: string
    sections?: AIResultSection[]
    suggested_actions?: AISuggestedAction[]
  }
  cached: boolean
  computed_at: string
  confidence?: number
  error?: string
}

/**
 * Section structuree dans le resultat IA
 */
export interface AIResultSection {
  title: string
  content: string
  type: 'text' | 'list' | 'warning' | 'info'
}

/**
 * Types d'actions executables via les boutons du panneau IA
 */
export type AIActionButtonType =
  | 'change_status'
  | 'assign_artisan'
  | 'navigate_section'
  | 'send_email'
  | 'add_comment'

/**
 * Payload specifique a chaque type d'action IA
 */
export type AIActionPayload =
  | { type: 'change_status'; target_status_code: string; target_status_label: string; requires_comment: boolean }
  | { type: 'assign_artisan'; metier_code?: string; code_postal?: string }
  | { type: 'navigate_section'; section: string }
  | { type: 'send_email'; email_type: 'client' | 'artisan' }
  | { type: 'add_comment' }

/**
 * Action suggeree par l'IA avec payload structure pour execution directe
 */
export interface AISuggestedAction {
  id: string
  label: string
  description: string
  action_type: AIActionButtonType
  payload: AIActionPayload
  priority: 'high' | 'medium' | 'low'
  icon?: string
  status_color?: string
  disabled?: boolean
  disabled_reason?: string
}

/**
 * Etat du hook useContextualAIAction
 */
export interface AIActionState {
  isLoading: boolean
  isOpen: boolean
  result: AIContextualActionResponse | null
  error: string | null
  currentAction: AIActionType | null
  context: AIPageContext | null
}

/**
 * Resume de donnees IA construit a partir des vraies donnees de la periode
 */
export interface AIDataSummary {
  period: {
    label: string       // "Semaine du 10-14 Fev 2026"
    startDate: string
    endDate: string
  }
  interventions: {
    total: number
    byStatus: Record<string, number>
    created: number
    completed: number
  }
  financial: {
    totalRevenue: number
    totalCosts: number
    totalMargin: number
    averageMarginPercent: number
  }
  alerts: string[]      // Points d'attention detectes
}
