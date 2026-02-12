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
 * Action suggeree par l'IA
 */
export interface AISuggestedAction {
  label: string
  description: string
  action_type: 'navigate' | 'copy' | 'email' | 'status_change'
  payload?: Record<string, unknown>
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
