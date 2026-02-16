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
    // Champs pour DEMANDE
    agence?: boolean
    metier?: boolean
    adresse?: boolean
    contexte?: boolean
    // Champs pour DEVIS_ENVOYE
    nomPrenomFacturation?: boolean
    assignedUser?: boolean
    // Nouveaux champs pour INTER_EN_COURS
    coutIntervention?: boolean
    coutSST?: boolean
    consigneArtisan?: boolean
    nomPrenomClient?: boolean
    telephoneClient?: boolean
    datePrevue?: boolean
    // Nouveau champ pour INTER_TERMINEE
    factureGmbsFile?: boolean
  }
  autoActions?: string[]
  restrictions?: {
    cannotTransitionTo?: InterventionStatusValue[]
  }
}

export const WORKFLOW_RULES: Record<InterventionStatusValue, WorkflowRule> = {
  DEMANDE: {
    isInitial: true,
    requirements: { agence: true, metier: true, adresse: true, contexte: true },
    autoActions: [],
  },
  DEVIS_ENVOYE: {
    requirements: {
      devisId: true,
      nomPrenomFacturation: true,
      assignedUser: true,
    },
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
    requirements: {
      artisan: true,
      coutIntervention: true,
      coutSST: true,
      consigneArtisan: true,
      nomPrenomClient: true,
      telephoneClient: true,
      datePrevue: true,
    },
    autoActions: [],
  },
  INTER_TERMINEE: {
    requirements: { artisan: true, facture: true, proprietaire: true, factureGmbsFile: true },
    autoActions: ["generate_invoice_if_missing"],
  },
  SAV: {
    requirements: { commentaire: true },
    autoActions: [],
  },
  ATT_ACOMPTE: {
    requirements: { devisId: true, artisan: true },
    autoActions: [],
  },
  POTENTIEL: {
    isInitial: true,
    requirements: {},
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
    key: "ARTISAN_REQUIRED_FOR_STATUS",
    statuses: ["VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE", "ATT_ACOMPTE"],
    message: "Un artisan principal doit être assigné pour ce statut",
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
    key: "INTER_TERMINEE_GMBS_INVOICE_REQUIRED",
    to: "INTER_TERMINEE",
    message: "Un fichier facture GMBS doit être uploadé pour finaliser l'intervention",
    blockTransition: true,
    validate: (context) => {
      // Vérifier que les attachments existent et contiennent au moins une facture GMBS
      const attachments = context.attachments as Array<{ kind: string }> | undefined
      if (!attachments || !Array.isArray(attachments)) return false
      return attachments.some(att => att.kind === 'facturesGMBS')
    },
  },
  {
    key: "COMMENTAIRE_REQUIS",
    statuses: ["REFUSE", "ANNULE", "STAND_BY", "SAV"],
    message: "Un commentaire est obligatoire pour ce statut",
    blockTransition: true,
    validate: (context) => Boolean(context.commentaire && context.commentaire.toString().trim().length > 0),
  },
  // === NOUVELLES RÈGLES DE VALIDATION ===
  // Règles pour DEVIS_ENVOYE
  {
    key: "DEVIS_ENVOYE_NOM_FACTURATION",
    to: "DEVIS_ENVOYE",
    message: "Le nom/prénom de facturation (propriétaire) doit être renseigné pour passer à Devis envoyé",
    blockTransition: true,
    validate: (context) => {
      if (!context.nomPrenomFacturation) return false
      return String(context.nomPrenomFacturation).trim().length > 0
    },
  },
  {
    key: "DEVIS_ENVOYE_ASSIGNED_USER",
    to: "DEVIS_ENVOYE",
    message: "L'intervention doit être assignée à un gestionnaire pour passer à Devis envoyé",
    blockTransition: true,
    validate: (context) => Boolean(context.assignedUserId),
  },
  // Règles pour INTER_EN_COURS
  {
    key: "INTER_EN_COURS_COUT_INTERVENTION",
    to: "INTER_EN_COURS",
    message: "Le coût d'intervention doit être renseigné pour passer en cours",
    blockTransition: true,
    validate: (context) => {
      if (context.coutIntervention === undefined || context.coutIntervention === null) return false
      return Number(context.coutIntervention) > 0
    },
  },
  {
    key: "INTER_EN_COURS_COUT_SST",
    to: "INTER_EN_COURS",
    message: "Le coût SST doit être renseigné pour passer en cours",
    blockTransition: true,
    validate: (context) => {
      if (context.coutSST === undefined || context.coutSST === null) return false
      return Number(context.coutSST) > 0
    },
  },
  {
    key: "INTER_EN_COURS_CONSIGNE_ARTISAN",
    to: "INTER_EN_COURS",
    message: "La consigne pour l'artisan doit être renseignée pour passer en cours",
    blockTransition: true,
    validate: (context) => {
      if (!context.consigneArtisan) return false
      return String(context.consigneArtisan).trim().length > 0
    },
  },
  {
    key: "INTER_EN_COURS_NOM_CLIENT",
    to: "INTER_EN_COURS",
    message: "Le nom/prénom du client doit être renseigné pour passer en cours",
    blockTransition: true,
    validate: (context) => {
      if (!context.nomPrenomClient) return false
      return String(context.nomPrenomClient).trim().length > 0
    },
  },
  {
    key: "INTER_EN_COURS_TELEPHONE_CLIENT",
    to: "INTER_EN_COURS",
    message: "Le téléphone du client doit être renseigné pour passer en cours",
    blockTransition: true,
    validate: (context) => {
      if (!context.telephoneClient) return false
      return String(context.telephoneClient).trim().length > 0
    },
  },
  {
    key: "INTER_EN_COURS_DATE_PREVUE",
    to: "INTER_EN_COURS",
    message: "La date prévue doit être renseignée pour passer en cours",
    blockTransition: true,
    validate: (context) => Boolean(context.datePrevue),
  },
  // === RÈGLES POUR DEMANDE (cascadent via getCumulativeEntryRules) ===
  {
    key: "DEMANDE_AGENCE_REQUIRED",
    to: "DEMANDE",
    message: "L'agence doit être renseignée",
    blockTransition: true,
    validate: (context) => Boolean(context.agenceId),
  },
  {
    key: "DEMANDE_METIER_REQUIRED",
    to: "DEMANDE",
    message: "Le métier doit être renseigné",
    blockTransition: true,
    validate: (context) => Boolean(context.metierId),
  },
  {
    key: "DEMANDE_ADRESSE_REQUIRED",
    to: "DEMANDE",
    message: "L'adresse doit être renseignée",
    blockTransition: true,
    validate: (context) => Boolean(context.adresse && String(context.adresse).trim().length > 0),
  },
  {
    key: "DEMANDE_CONTEXTE_REQUIRED",
    to: "DEMANDE",
    message: "Le contexte d'intervention doit être renseigné",
    blockTransition: true,
    validate: (context) => Boolean(context.contexteIntervention && String(context.contexteIntervention).trim().length > 0),
  },
  // === RÈGLE POUR ACCEPTE (cascade vers INTER_EN_COURS, INTER_TERMINEE) ===
  {
    key: "ACCEPTE_DEVIS_REQUIRED",
    to: "ACCEPTE",
    message: "Un document devis doit être présent pour passer à Accepté",
    blockTransition: true,
    validate: (context) => Boolean(context.devisId),
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
