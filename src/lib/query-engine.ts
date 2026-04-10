import { compareDateValues, isBetween, toDate } from "./date-utils"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { ViewFilter, ViewSort } from "@/types/intervention-views"

export function runQuery(
  interventions: InterventionEntity[],
  filters: ViewFilter[],
  sorts: ViewSort[],
): InterventionEntity[] {
  const filtered = applyFilters(interventions, filters)
  if (!sorts.length) {
    return filtered
  }

  return [...filtered].sort((a, b) => compareWithSorts(a, b, sorts))
}

function applyFilters(
  interventions: InterventionEntity[],
  filters: ViewFilter[],
): InterventionEntity[] {
  if (!filters.length) return interventions
  return interventions.filter((intervention) =>
    filters.every((filter) => {
      const value = getPropertyValue(intervention, filter.property)
      return evaluateFilter(value, filter.operator, filter.value)
    }),
  )
}

function isNullish(v: unknown): boolean {
  return v === null || v === undefined || v === ""
}

function compareWithSorts(a: InterventionEntity, b: InterventionEntity, sorts: ViewSort[]) {
  for (const sort of sorts) {
    const aValue = getPropertyValue(a, sort.property)
    const bValue = getPropertyValue(b, sort.property)
    // Nullish values always sort last, regardless of direction
    const aN = isNullish(aValue)
    const bN = isNullish(bValue)
    if (aN && bN) continue
    if (aN) return 1
    if (bN) return -1
    const comparison = compareValues(aValue, bValue)
    if (comparison !== 0) {
      return sort.direction === "asc" ? comparison : -comparison
    }
  }
  return 0
}

export function getPropertyValue(intervention: InterventionEntity, property: string): unknown {
  if (!property) return null
  const segments = property.split(".")
  let current: unknown = intervention
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return null
    }
  }
  return current
}

function evaluateFilter(value: unknown, operator: ViewFilter["operator"], filterValue: ViewFilter["value"]): boolean {
  switch (operator) {
    case "eq":
      return looseEqual(value, filterValue)
    case "neq":
      return !looseEqual(value, filterValue)
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase())
    case "not_contains":
      return !String(value ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase())
    case "gt":
      return Number(value ?? 0) > Number(filterValue ?? 0)
    case "gte":
      return Number(value ?? 0) >= Number(filterValue ?? 0)
    case "lt":
      return Number(value ?? 0) < Number(filterValue ?? 0)
    case "lte":
      return Number(value ?? 0) <= Number(filterValue ?? 0)
    case "in":
      if (!Array.isArray(filterValue)) return false
      if (Array.isArray(value)) {
        return value.some((entry) => filterValue.some((item) => looseEqual(entry, item)))
      }
      return filterValue.some((item) => looseEqual(value, item))
    case "not_in":
      if (!Array.isArray(filterValue)) return true
      if (Array.isArray(value)) {
        return !value.some((entry) => filterValue.some((item) => looseEqual(entry, item)))
      }
      return !filterValue.some((item) => looseEqual(value, item))
    case "is_empty":
      return value == null || value === ""
    case "is_not_empty":
      return !(value == null || value === "")
    case "between":
      if (filterValue && typeof filterValue === "object" && !Array.isArray(filterValue)) {
        const { from, to } = filterValue as { from?: unknown; to?: unknown }
        return isBetween(value, from, to)
      }
      if (Array.isArray(filterValue)) {
        return isBetween(value, filterValue[0], filterValue[1])
      }
      return true
    default:
      return true
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Date || b instanceof Date) {
    const da = toDate(a)
    const db = toDate(b)
    if (!da && !db) return true
    if (!da || !db) return false
    return da.getTime() === db.getTime()
  }
  if (typeof a === "string" || typeof b === "string") {
    return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase()
  }
  return a == b
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0

  const aDate = toDate(a)
  const bDate = toDate(b)
  if (aDate || bDate) {
    return compareDateValues(a, b)
  }

  if (typeof a === "number" || typeof b === "number") {
    return Number(a) - Number(b)
  }

  const aString = String(a).toLocaleLowerCase()
  const bString = String(b).toLocaleLowerCase()
  if (aString === bString) return 0
  return aString > bString ? 1 : -1
}
