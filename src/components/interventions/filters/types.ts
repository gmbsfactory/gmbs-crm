import type { ViewFilter } from "@/types/intervention-views"
import type { PropertySchema } from "@/types/property-schema"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { InterventionQueryParams } from "@/lib/api/v2/common/types"

export interface ColumnFilterProps {
  property: string
  schema: PropertySchema
  activeFilter?: ViewFilter
  interventions: InterventionEntity[]
  loadDistinctValues?: (property: string) => Promise<string[]>
  onFilterChange: (property: string, filter: ViewFilter | null) => void
  baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>
}

export interface FilterOption {
  key: string
  value: unknown
  label: string
  count?: number
}

export interface DatePreset {
  label: string
  getValue: () => { from: Date; to: Date }
}

