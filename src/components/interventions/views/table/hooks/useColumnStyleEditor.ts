import { useCallback } from "react"
import { normalizeColumnStyle } from "@/lib/interventions/column-style"
import type {
  TableColumnAlignment,
  TableColumnStyle,
  TableLayoutOptions,
} from "@/types/intervention-views"

type ColumnStyles = NonNullable<TableLayoutOptions["columnStyles"]>
type ColumnAlignments = NonNullable<TableLayoutOptions["columnAlignment"]>

export type UseColumnStyleEditorOptions = {
  columnStyles: ColumnStyles
  columnAlignment: ColumnAlignments
  onLayoutOptionsChange?: (patch: Partial<TableLayoutOptions>) => void
}

const DEFAULT_ALIGNMENT: TableColumnAlignment = "center"

const withoutKey = <T extends Record<string, unknown>>(record: T, key: string): T => {
  const next = { ...record }
  delete (next as Record<string, unknown>)[key]
  return next
}

/**
 * Pure mutation hook for table column style + alignment.
 * Knows nothing about UI state (no panel, no anchors) — only how to compute the
 * next layoutOptions patch and forward it to the parent. Caller may guard with
 * `if (!onLayoutOptionsChange)` upstream; mutators no-op safely if absent.
 */
export const useColumnStyleEditor = ({
  columnStyles,
  columnAlignment,
  onLayoutOptionsChange,
}: UseColumnStyleEditorOptions) => {
  const applyColumnStyle = useCallback(
    (property: string, updater: (prev: TableColumnStyle) => TableColumnStyle) => {
      if (!onLayoutOptionsChange) return
      const current = columnStyles[property] ?? {}
      const normalized = normalizeColumnStyle(property, updater({ ...current }))
      const nextStyles = normalized
        ? { ...columnStyles, [property]: normalized }
        : withoutKey(columnStyles, property)
      onLayoutOptionsChange({ columnStyles: nextStyles })
    },
    [columnStyles, onLayoutOptionsChange],
  )

  const applyColumnAlignment = useCallback(
    (property: string, nextAlignment: TableColumnAlignment) => {
      if (!onLayoutOptionsChange) return
      const explicit = columnAlignment[property]
      const effective = (explicit ?? DEFAULT_ALIGNMENT) as TableColumnAlignment

      // Toggle off when re-selecting the implicit default.
      if (nextAlignment === DEFAULT_ALIGNMENT && explicit === DEFAULT_ALIGNMENT) {
        onLayoutOptionsChange({ columnAlignment: withoutKey(columnAlignment, property) })
        return
      }
      if (effective === nextAlignment && nextAlignment !== DEFAULT_ALIGNMENT) return

      onLayoutOptionsChange({
        columnAlignment: { ...columnAlignment, [property]: nextAlignment },
      })
    },
    [columnAlignment, onLayoutOptionsChange],
  )

  return { applyColumnStyle, applyColumnAlignment }
}
