import { useMemo, type CSSProperties } from "react"
import {
  TABLE_STATUS_BORDER_WIDTHS,
  TABLE_SHADOW_INTENSITIES,
  type TableLayoutOptions,
  type TableStatusBorderSize,
  type TableShadowIntensity,
  type TableRowDisplayMode,
  type TableRowDensity,
} from "@/types/intervention-views"
import { getRowHeight } from "@/components/interventions/views/table/lib/table-density"

export type TableAppearance = {
  columnWidths: Record<string, number>
  columnStyles: NonNullable<TableLayoutOptions["columnStyles"]>
  columnAlignment: NonNullable<TableLayoutOptions["columnAlignment"]>
  statusBorderSize: TableStatusBorderSize
  statusBorderWidth: number
  statusBorderWidthPx: string
  statusBorderEnabled: boolean
  coloredShadow: boolean
  shadowIntensity: TableShadowIntensity
  shadowValues: typeof TABLE_SHADOW_INTENSITIES[TableShadowIntensity]
  rowDisplayMode: TableRowDisplayMode
  useAccentColor: boolean
  rowDensity: TableRowDensity
  densityTableClass: string
  densityHeaderClass: string | undefined
  densityCellClass: string
  rowHeight: number
  tableInlineStyle: CSSProperties & Record<string, string | number>
}

export const useTableAppearance = (
  tableLayoutOptions: TableLayoutOptions,
): TableAppearance => {
  const columnWidths = (tableLayoutOptions.columnWidths ?? {}) as Record<string, number>

  const columnStyles = useMemo(
    () => tableLayoutOptions.columnStyles ?? {},
    [tableLayoutOptions.columnStyles],
  )
  const columnAlignment = useMemo(
    () => tableLayoutOptions.columnAlignment ?? {},
    [tableLayoutOptions.columnAlignment],
  )

  const statusBorderSize = (tableLayoutOptions.statusBorderSize ?? "m") as TableStatusBorderSize
  const statusBorderWidth =
    TABLE_STATUS_BORDER_WIDTHS[statusBorderSize] ?? TABLE_STATUS_BORDER_WIDTHS.m
  const statusBorderWidthPx = `${statusBorderWidth}px`
  const statusBorderEnabled = tableLayoutOptions.showStatusBorder ?? false

  const coloredShadow = tableLayoutOptions.coloredShadow ?? false
  const shadowIntensity = (tableLayoutOptions.shadowIntensity ?? "normal") as TableShadowIntensity
  const shadowValues = TABLE_SHADOW_INTENSITIES[shadowIntensity]

  const rowDisplayMode = (tableLayoutOptions.rowDisplayMode ?? "stripes") as TableRowDisplayMode
  const useAccentColor = tableLayoutOptions.useAccentColor ?? false
  const rowDensity = (tableLayoutOptions.rowDensity ??
    (tableLayoutOptions.dense ? "dense" : "default")) as TableRowDensity

  const densityTableClass = rowDensity === "ultra-dense" ? "text-xs" : "text-sm"
  const densityHeaderClass =
    rowDensity === "ultra-dense"
      ? "!h-8 !py-1.5 !pl-2.5 !pr-2.5"
      : rowDensity === "dense"
        ? "!h-10 !py-2 !pl-3 !pr-3"
        : undefined
  const densityCellClass =
    rowDensity === "ultra-dense"
      ? "!py-1.5 !pl-2.5 !pr-2.5"
      : rowDensity === "dense"
        ? "!py-2 !pl-3 !pr-3"
        : "py-3"
  const rowHeight = getRowHeight(rowDensity)

  const tableInlineStyle = useMemo<CSSProperties & Record<string, string | number>>(
    () => ({
      ...(statusBorderEnabled ? { "--table-status-border-width": statusBorderWidthPx } : {}),
      ...(coloredShadow
        ? {
            "--shadow-intensity-strong": `${shadowValues.strong}%`,
            "--shadow-intensity-soft": `${shadowValues.soft}%`,
          }
        : {}),
      ...(rowDisplayMode === "gradient" ? { "--use-gradient-mode": "1" } : {}),
      ...(useAccentColor ? { "--use-accent-color": "1" } : {}),
    }),
    [
      statusBorderEnabled,
      statusBorderWidthPx,
      coloredShadow,
      shadowValues,
      rowDisplayMode,
      useAccentColor,
    ],
  )

  return {
    columnWidths,
    columnStyles,
    columnAlignment,
    statusBorderSize,
    statusBorderWidth,
    statusBorderWidthPx,
    statusBorderEnabled,
    coloredShadow,
    shadowIntensity,
    shadowValues,
    rowDisplayMode,
    useAccentColor,
    rowDensity,
    densityTableClass,
    densityHeaderClass,
    densityCellClass,
    rowHeight,
    tableInlineStyle,
  }
}
