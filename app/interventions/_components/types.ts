/**
 * Shared types for intervention page sub-components.
 *
 * These types are used across multiple _components files and cannot
 * import from `../_lib/` due to ESLint restrictions on `../` imports.
 * External types are imported via `@/` alias.
 */

import type { ComponentType } from "react"

import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"
import type {
  InterventionViewDefinition,
  LayoutOptions,
  TableLayoutOptions,
  TableRowDensity,
  ViewFilter,
  ViewLayout,
} from "@/types/intervention-views"
import type { WorkflowConfig } from "@/types/intervention-workflow"
import type { ModalDisplayMode } from "@/types/modal-display"
import type { DateRange, SortDir, SortField } from "@/components/interventions/FiltersBar"

// ---------------------------------------------------------------------------
// Normalized intervention type used throughout the page
// ---------------------------------------------------------------------------
export type NormalizedIntervention = InterventionEntity & {
  datePrevue: string | null
  isCheck: boolean
}

// ---------------------------------------------------------------------------
// Props for InterventionsPlusMenu
// ---------------------------------------------------------------------------
export interface InterventionsPlusMenuProps {
  activeView: InterventionViewDefinition | null
  activeTableLayoutOptions: TableLayoutOptions | undefined
  activeRowDensity: TableRowDensity
  showStatusFilter: boolean
  preferredMode: ModalDisplayMode
  isAdmin: boolean
  handleCreateView: (layout: ViewLayout) => void
  handleLayoutOptionsPatch: (options: Partial<LayoutOptions>) => void
  updateViewConfig: (id: string, patch: Partial<InterventionViewDefinition>) => void
  updateLayoutOptions: (id: string, options: Partial<LayoutOptions>) => void
  setPreferredMode: (mode: ModalDisplayMode) => void
  setColumnConfigViewId: (id: string | null) => void
  router: { push: (url: string) => void }
}

// ---------------------------------------------------------------------------
// Props for InterventionsStatusFilter
// ---------------------------------------------------------------------------
export interface InterventionsStatusFilterProps {
  showStatusFilter: boolean
  selectedStatuses: InterventionStatusValue[]
  displayedStatuses: InterventionStatusValue[]
  isCheckFilterActive: boolean
  workflowConfig: WorkflowConfig
  getCountByStatus: (status: InterventionStatusValue | null) => number
  getCheckCount: () => number
  handleSelectStatus: (status: InterventionStatusValue | null) => void
  updateFilterForProperty: (property: string, filter: ViewFilter | null) => void
}

// ---------------------------------------------------------------------------
// Props for InterventionsViewRenderer
// ---------------------------------------------------------------------------
export interface InterventionsViewRendererProps {
  activeView: InterventionViewDefinition | null
  viewInterventions: NormalizedIntervention[]
  filteredInterventions: NormalizedIntervention[]
  loading: boolean
  error: string | null
  search: string
  page: number
  effectiveTotalCount: number
  effectiveTotalPages: number
  activeViewColor: string | null
  selectedStatuses: InterventionStatusValue[]
  displayedStatuses: InterventionStatusValue[]
  normalizedInterventions: NormalizedIntervention[]
  loadDistinctValues: (property: string) => Promise<string[]>
  handleNavigateToDetail: (id: string, options?: InterventionModalOpenOptions) => void
  handleLayoutOptionsPatch: (options: Partial<LayoutOptions>) => void
  updateFilterForProperty: (property: string, filter: ViewFilter | null) => void
  handleGoToPage: (page: number) => void
  handleNextPage: () => void
  handlePreviousPage: () => void
  handleStatusChange: (id: string, status: InterventionStatusValue) => Promise<void>
  handleSelectStatus: (status: InterventionStatusValue | null) => void
  getCountByStatus: (status: InterventionStatusValue | null) => number
}

// Re-export types that are frequently used
export type {
  InterventionEntity,
  InterventionStatusValue,
  InterventionModalOpenOptions,
  InterventionViewDefinition,
  LayoutOptions,
  ModalDisplayMode,
  TableLayoutOptions,
  TableRowDensity,
  ViewFilter,
  ViewLayout,
  WorkflowConfig,
  DateRange,
  SortDir,
  SortField,
}
