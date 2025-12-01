import type { InterventionStatusValue } from "@/types/interventions"
import type { AutoAction, WorkflowEntityContext } from "@/types/intervention-workflow"

export type WorkflowRule = {
  isInitial?: boolean
  isTerminal?: boolean
  requirements: {
    artisan?: boolean
    facture?: boolean
    proprietaire?: boolean
    commentaire?: boolean
    devisId?: boolean
  }
  autoActions?: string[]
  restrictions?: {
    cannotTransitionTo?: InterventionStatusValue[]
  }
}

export const WORKFLOW_RULES: Record<InterventionStatusValue, WorkflowRule> = {
  DEMANDE: {
    isInitial: true,
    requirements: {},
    autoActions: [],
  },
  DEVIS_ENVOYE: {
    requirements: { devisId: true },
    autoActions: ["send_email_devis"],
    restrictions: {},
  },
  VISITE_TECHNIQUE: {
    requirements: { artisan: true },
    autoActions: [],
  },
  REFUSE: {
    isTerminal: true,
    requirements: { commentaire: true },
    autoActions: [],
  },
  ANNULE: {
    isTerminal: true,
    requirements: { commentaire: true },
    autoActions: [],
  },
  STAND_BY: {
    requirements: { commentaire: true },
    autoActions: [],
  },
  ACCEPTE: {
    requirements: { devisId: true },
    autoActions: [],
  },
  INTER_EN_COURS: {
    requirements: { artisan: true },
    autoActions: [],
  },
  INTER_TERMINEE: {
    requirements: { artisan: true, facture: true, proprietaire: true },
    autoActions: ["generate_invoice_if_missing"],
  },
  SAV: {
    requirements: { commentaire: true },
    autoActions: [],
  },
  ATT_ACOMPTE: {
    requirements: { devisId: true },
    autoActions: [],
  },
}

export type AuthorizedTransition = {
  from: InterventionStatusValue
  to: InterventionStatusValue
  trigger: string
}

export const AUTHORIZED_TRANSITIONS: AuthorizedTransition[] = [
  { from: "DEMANDE", to: "DEVIS_ENVOYE", trigger: "Envoi devis" },
  { from: "DEMANDE", to: "VISITE_TECHNIQUE", trigger: "Visite technique" },
  { from: "DEMANDE", to: "REFUSE", trigger: "Refus" },
  { from: "DEMANDE", to: "ANNULE", trigger: "Annulation" },
  { from: "DEVIS_ENVOYE", to: "ACCEPTE", trigger: "Acceptation devis" },
  { from: "DEVIS_ENVOYE", to: "REFUSE", trigger: "Refus devis" },
  { from: "DEVIS_ENVOYE", to: "STAND_BY", trigger: "Mise en attente" },
  { from: "ACCEPTE", to: "INTER_EN_COURS", trigger: "Début intervention" },
  { from: "ACCEPTE", to: "STAND_BY", trigger: "Mise en attente" },
  { from: "ACCEPTE", to: "ANNULE", trigger: "Annulation" },
  { from: "ACCEPTE", to: "INTER_TERMINEE", trigger: "Clôture express" },
  { from: "INTER_EN_COURS", to: "INTER_TERMINEE", trigger: "Fin intervention" },
  { from: "INTER_EN_COURS", to: "SAV", trigger: "Passage SAV" },
  { from: "INTER_EN_COURS", to: "STAND_BY", trigger: "Mise en attente" },
  { from: "INTER_EN_COURS", to: "VISITE_TECHNIQUE", trigger: "Nouvelle visite" },
  { from: "VISITE_TECHNIQUE", to: "ACCEPTE", trigger: "Acceptation après visite" },
  { from: "VISITE_TECHNIQUE", to: "REFUSE", trigger: "Refus après visite" },
  { from: "VISITE_TECHNIQUE", to: "STAND_BY", trigger: "Mise en attente" },
  { from: "INTER_TERMINEE", to: "SAV", trigger: "Ouverture SAV" },
  { from: "STAND_BY", to: "ACCEPTE", trigger: "Reprise" },
  { from: "STAND_BY", to: "INTER_EN_COURS", trigger: "Reprise intervention" },
  { from: "STAND_BY", to: "ANNULE", trigger: "Annulation" },
  { from: "SAV", to: "INTER_TERMINEE", trigger: "Résolution SAV" },
]

type ValidationRule = {
  key: string
  from?: InterventionStatusValue
  to?: InterventionStatusValue
  statuses?: InterventionStatusValue[]
  message: string
  blockTransition: boolean
  validate: (context: WorkflowEntityContext) => boolean
}

export const VALIDATION_RULES: ValidationRule[] = [
  {
    key: "DEVIS_ENVOYE_TO_ACCEPTE",
    from: "DEVIS_ENVOYE",
    to: "ACCEPTE",
    message: "Un ID de devis doit être renseigné pour accepter le devis",
    blockTransition: true,
    validate: (context) => {
      if (!context.devisId) return false
      return String(context.devisId).trim().length > 0
    },
  },
  {
    key: "INTERVENTION_ID_REQUIRED",
    statuses: ["DEVIS_ENVOYE", "VISITE_TECHNIQUE", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE", "STAND_BY"],
    message: 'Un ID intervention définitif (sans la chaîne "AUTO") est requis pour ce statut',
    blockTransition: true,
    validate: (context) => {
      if (!context.idIntervention) return false
      const value = String(context.idIntervention).trim()
      if (!value) return false
      return !value.toLowerCase().includes("auto")
    },
  },
  {
    key: "INTER_EN_COURS_WITHOUT_ARTISAN",
    to: "INTER_EN_COURS",
    message: "Un artisan doit être assigné pour passer en cours",
    blockTransition: true,
    validate: (context) => Boolean(context.artisanId),
  },
  {
    key: "INTER_TERMINEE_INCOMPLETE",
    to: "INTER_TERMINEE",
    message: "Facture et propriétaire requis pour finaliser l'intervention",
    blockTransition: true,
    validate: (context) => Boolean(context.factureId) && Boolean(context.proprietaireId),
  },
  {
    key: "COMMENTAIRE_REQUIS",
    statuses: ["REFUSE", "ANNULE", "STAND_BY", "SAV"],
    message: "Un commentaire est obligatoire pour ce statut",
    blockTransition: true,
    validate: (context) => Boolean(context.commentaire && context.commentaire.toString().trim().length > 0),
  },
]

export const AUTO_ACTIONS: Record<string, AutoAction> = {
  send_email_devis: {
    type: "send_email",
    config: {
      template: "devis_template",
      recipient: "intervention.client.email",
      attachments: ["devis_pdf"],
    },
  },
  generate_invoice_if_missing: {
    type: "generate_invoice",
    config: {
      autoGenerate: true,
      template: "facture_template",
    },
  },
}
