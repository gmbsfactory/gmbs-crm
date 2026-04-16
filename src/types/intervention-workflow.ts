export interface WorkflowStatus {
  id: string
  key: string
  label: string
  description?: string
  color: string
  icon: string
  isTerminal: boolean
  isInitial: boolean
  isPinned?: boolean
  pinnedOrder?: number
  position: { x: number; y: number }
  metadata: {
    requiresArtisan?: boolean
    requiresFacture?: boolean
    requiresProprietaire?: boolean
    requiresCommentaire?: boolean
    requiresDevisId?: boolean
    autoActions?: AutoAction[]
  }
}

export interface WorkflowTransition {
  id: string
  fromStatusId: string
  toStatusId: string
  label: string
  description?: string
  conditions: TransitionCondition[]
  autoActions?: AutoAction[]
  isActive: boolean
}

export interface TransitionCondition {
  type: "field_required" | "field_equals" | "custom_validation"
  field?: string
  value?: unknown
  message: string
}

export interface AutoAction {
  type: "send_email" | "generate_invoice" | "create_task" | "webhook"
  config: Record<string, unknown>
}

export interface WorkflowConfig {
  id: string
  name: string
  description?: string
  version: string
  isActive: boolean
  statuses: WorkflowStatus[]
  transitions: WorkflowTransition[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowValidationResult {
  canTransition: boolean
  missingRequirements: string[]
  failedConditions: string[]
}

export type WorkflowEntityContext = {
  id?: string
  artisanId?: string | null
  factureId?: string | null
  proprietaireId?: string | null
  commentaire?: string | null
  devisId?: string | null
  idIntervention?: string | null
  // Champs pour validation création
  agenceId?: string | null
  metierId?: string | null
  adresse?: string | null
  contexteIntervention?: string | null
  // Champs pour validation DEVIS_ENVOYE
  nomPrenomFacturation?: string | null
  assignedUserId?: string | null
  // Champs pour validation INTER_EN_COURS
  coutIntervention?: number | null
  coutSST?: number | null
  consigneArtisan?: string | null
  nomPrenomClient?: string | null
  telephoneClient?: string | null
  datePrevue?: string | Date | null
  attachments?: Array<{ kind: string }> | null
  [key: string]: unknown
}
