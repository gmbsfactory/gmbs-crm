import type { LucideIcon } from "lucide-react"
import {
  ArchiveIcon,
  BadgeCheck,
  ClipboardList,
  Clock,
  FileSignature,
  Hammer,
  Loader2,
  PauseCircle,
  ShieldAlert,
  UserSearch,
  XCircle,
} from "lucide-react"

import { AUTHORIZED_TRANSITIONS, AUTO_ACTIONS, WORKFLOW_RULES } from "@/config/workflow-rules"
import type { AutoAction, WorkflowConfig } from "@/types/intervention-workflow"

export type InterventionStatusKey =
  | "DEMANDE"
  | "DEVIS_ENVOYE"
  | "VISITE_TECHNIQUE"
  | "REFUSE"
  | "ANNULE"
  | "STAND_BY"
  | "ACCEPTE"
  | "INTER_EN_COURS"
  | "INTER_TERMINEE"
  | "SAV"
  | "ATT_ACOMPTE"

export type InterventionStatusConfig = {
  value: InterventionStatusKey
  label: string
  description?: string
  color: string
  hexColor: string
  icon: LucideIcon
}

export const INTERVENTION_STATUS_ORDER: InterventionStatusKey[] = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "SAV",
  "STAND_BY",
  "ATT_ACOMPTE",
  "REFUSE",
  "ANNULE",
]

export const INTERVENTION_STATUS: Record<InterventionStatusKey, InterventionStatusConfig> = {
  DEMANDE: {
    value: "DEMANDE",
    label: "Demandé",
    description: "Intervention créée",
    color: "bg-blue-500",
    hexColor: "#3B82F6",
    icon: ClipboardList,
  },
  DEVIS_ENVOYE: {
    value: "DEVIS_ENVOYE",
    label: "Devis envoyé",
    description: "Devis transmis au client",
    color: "bg-indigo-500",
    hexColor: "#6366F1",
    icon: FileSignature,
  },
  VISITE_TECHNIQUE: {
    value: "VISITE_TECHNIQUE",
    label: "Visite technique",
    description: "Diagnostic terrain planifié",
    color: "bg-teal-500",
    hexColor: "#14B8A6",
    icon: UserSearch,
  },
  REFUSE: {
    value: "REFUSE",
    label: "Refusé",
    description: "Intervention refusée",
    color: "bg-rose-500",
    hexColor: "#EC4899",
    icon: XCircle,
  },
  ANNULE: {
    value: "ANNULE",
    label: "Annulé",
    description: "Intervention annulée",
    color: "bg-slate-500",
    hexColor: "#64748B",
    icon: ArchiveIcon,
  },
  STAND_BY: {
    value: "STAND_BY",
    label: "Stand-by",
    description: "Mise en attente",
    color: "bg-amber-500",
    hexColor: "#F59E0B",
    icon: PauseCircle,
  },
  ACCEPTE: {
    value: "ACCEPTE",
    label: "Accepté",
    description: "Client OK, préparation intervention",
    color: "bg-emerald-500",
    hexColor: "#10B981",
    icon: BadgeCheck,
  },
  INTER_EN_COURS: {
    value: "INTER_EN_COURS",
    label: "Inter en cours",
    description: "Intervention en réalisation",
    color: "bg-purple-500",
    hexColor: "#A855F7",
    icon: Loader2,
  },
  INTER_TERMINEE: {
    value: "INTER_TERMINEE",
    label: "Inter terminée",
    description: "Travaux terminés",
    color: "bg-sky-500",
    hexColor: "#0EA5E9",
    icon: ShieldAlert,
  },
  SAV: {
    value: "SAV",
    label: "SAV",
    description: "Service après-vente",
    color: "bg-orange-500",
    hexColor: "#F97316",
    icon: Hammer,
  },
  ATT_ACOMPTE: {
    value: "ATT_ACOMPTE",
    label: "Att Acompte",
    description: "En attente d'acompte",
    color: "bg-orange-600",
    hexColor: "#EA580C",
    icon: Clock,
  },
}

export const isTerminalStatus = (status: InterventionStatusKey) => status === "REFUSE" || status === "ANNULE"

const STATUS_KEYS: InterventionStatusKey[] = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "SAV",
  "STAND_BY",
  "ATT_ACOMPTE",
  "REFUSE",
  "ANNULE",
]

const STATUS_POSITIONS: Record<InterventionStatusKey, { x: number; y: number }> = {
  DEMANDE: { x: 1, y: 1 },
  DEVIS_ENVOYE: { x: 2, y: 1 },
  VISITE_TECHNIQUE: { x: 3, y: 1 },
  ACCEPTE: { x: 4, y: 1 },
  INTER_EN_COURS: { x: 5, y: 1 },
  INTER_TERMINEE: { x: 6, y: 1 },
  SAV: { x: 7, y: 1 },
  STAND_BY: { x: 4, y: 2 },
  ATT_ACOMPTE: { x: 5, y: 2 },
  REFUSE: { x: 2, y: 3 },
  ANNULE: { x: 3, y: 3 },
}

const statusId = (key: InterventionStatusKey) => `status-${key.toLowerCase().replace(/_/g, "-")}`

const cloneAutoAction = (action: AutoAction): AutoAction => JSON.parse(JSON.stringify(action)) as AutoAction

const PINNED_DEFAULT_STATUSES: InterventionStatusKey[] = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
]

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  id: "default-workflow",
  name: "Workflow interventions",
  description: "Workflow standard des statuts d'interventions",
  version: "1.0.0",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  statuses: STATUS_KEYS.map((key) => {
    const rule = WORKFLOW_RULES[key]
    const isPinned = PINNED_DEFAULT_STATUSES.includes(key)
    return {
      id: statusId(key),
      key,
      label: INTERVENTION_STATUS[key].label,
      description: INTERVENTION_STATUS[key].description,
      color: INTERVENTION_STATUS[key].hexColor,
      icon: INTERVENTION_STATUS[key].icon.name,
      isTerminal: Boolean(rule?.isTerminal),
      isInitial: Boolean(rule?.isInitial),
      position: STATUS_POSITIONS[key] ?? { x: 1, y: 1 },
      isPinned,
      pinnedOrder: isPinned ? PINNED_DEFAULT_STATUSES.indexOf(key) : undefined,
      metadata: {
        requiresArtisan: Boolean(rule?.requirements?.artisan),
        requiresFacture: Boolean(rule?.requirements?.facture),
        requiresProprietaire: Boolean(rule?.requirements?.proprietaire),
        requiresCommentaire: Boolean(rule?.requirements?.commentaire),
        requiresDevisId: Boolean(rule?.requirements?.devisId),
        autoActions: (rule?.autoActions ?? [])
          .map((actionKey) => (AUTO_ACTIONS[actionKey] ? cloneAutoAction(AUTO_ACTIONS[actionKey]) : null))
          .filter(Boolean) as AutoAction[],
      },
    }
  }),
  transitions: AUTHORIZED_TRANSITIONS.map((transition, index) => ({
    id: `transition-${index}`,
    fromStatusId: statusId(transition.from),
    toStatusId: statusId(transition.to),
    label: transition.trigger,
    description: undefined,
    conditions: [],
    autoActions: [],
    isActive: true,
  })),
}

export const SCROLL_CONFIG = {
  OVERSCAN: 15,
  SHOW_POSITION_THRESHOLD: 200,
  CLIENT_FILTER_WARNING_THRESHOLD: 50000,
  LARGE_DATASET_THRESHOLD: 10000,
} as const

export type ScrollConfig = typeof SCROLL_CONFIG
