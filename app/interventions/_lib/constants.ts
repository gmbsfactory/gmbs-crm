/**
 * Constants used by the intervention page and its sub-components.
 * All imports use `@/` paths (pointing to `src/`).
 */

import type { ComponentType } from "react"

import {
  CalendarRange,
  GanttChart,
  KanbanSquare,
  LayoutGrid,
  SquareStack,
  Table,
} from "lucide-react"

import type { InterventionStatusValue } from "@/types/interventions"
import type { ViewLayout, TableRowDensity } from "@/types/intervention-views"
import type { SortField } from "@/components/interventions/FiltersBar"
import type { WorkflowConfig } from "@/types/intervention-workflow"
import { WORKFLOW_EVENT_KEY } from "@/hooks/useWorkflowConfig"

// ---------------------------------------------------------------------------
// View ↔ Status code mapping (for dynamic tab colors)
// ---------------------------------------------------------------------------
export const VIEW_TO_STATUS_CODE: Record<string, string> = {
  "mes-demandes": "DEMANDE",
  "ma-liste-en-cours": "INTER_EN_COURS",
  "mes-visites-technique": "VISITE_TECHNIQUE",
  "ma-liste-accepte": "ACCEPTE",
  "ma-liste-att-acompte": "ATT_ACOMPTE",
  "ma-liste-a-check": "A_CHECK",
}

// ---------------------------------------------------------------------------
// View layout labels / icons / creation options
// ---------------------------------------------------------------------------
export const VIEW_LAYOUT_LABELS: Record<ViewLayout, string> = {
  table: "Tableau",
  cards: "Cartes",
  gallery: "Galerie",
  kanban: "Kanban",
  calendar: "Calendrier",
  timeline: "Chronologie",
}

export const VISIBLE_VIEW_LAYOUTS: ViewLayout[] = ["table", "cards", "calendar"]

export const VIEW_LAYOUT_ICONS: Record<ViewLayout, ComponentType<{ className?: string }>> = {
  table: Table,
  cards: SquareStack,
  gallery: LayoutGrid,
  kanban: KanbanSquare,
  calendar: CalendarRange,
  timeline: GanttChart,
}

export const CREATABLE_VIEW_LAYOUTS: ViewLayout[] = ["table"]

export const NEW_VIEW_MENU_CHOICES: Array<{
  layout: ViewLayout
  label: string
  Icon: ComponentType<{ className?: string }>
}> = CREATABLE_VIEW_LAYOUTS.map((layout) => ({
  layout,
  label: VIEW_LAYOUT_LABELS[layout],
  Icon: VIEW_LAYOUT_ICONS[layout],
}))

// ---------------------------------------------------------------------------
// Row density options (table view)
// ---------------------------------------------------------------------------
export const ROW_DENSITY_OPTIONS: Array<{ value: TableRowDensity; label: string }> = [
  { value: "default", label: "Standard" },
  { value: "dense", label: "Dense" },
  { value: "ultra-dense", label: "Ultra-dense" },
]

// ---------------------------------------------------------------------------
// Default status pipeline
// ---------------------------------------------------------------------------
export const DEFAULT_STATUS_VALUES: InterventionStatusValue[] = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "SAV",
  "STAND_BY",
  "REFUSE",
  "ANNULE",
  "ATT_ACOMPTE",
]

// ---------------------------------------------------------------------------
// Sort mapping
// ---------------------------------------------------------------------------
export const SORT_FIELD_TO_PROPERTY: Record<SortField, string> = {
  cree: "date",
  echeance: "dateIntervention",
  marge: "marge",
}

export const PROPERTY_TO_SORT_FIELD: Record<string, SortField> = Object.entries(
  SORT_FIELD_TO_PROPERTY,
).reduce(
  (acc, [field, property]) => {
    acc[property] = field as SortField
    return acc
  },
  {} as Record<string, SortField>,
)

// ---------------------------------------------------------------------------
// Managed filter keys
// ---------------------------------------------------------------------------
export const managedFilterKeys = {
  status: "statusValue",
  user: "attribueA",
  date: "dateIntervention",
} as const

// ---------------------------------------------------------------------------
// Workflow persistence key
// ---------------------------------------------------------------------------
export const WORKFLOW_STORAGE_KEY = "crm:interventions:workflow-config"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const toISODate = (date: Date | null) => (date ? date.toISOString() : undefined)

export const notifyWorkflowUpdate = (workflow: WorkflowConfig) => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<WorkflowConfig>(WORKFLOW_EVENT_KEY, { detail: workflow }))
}
