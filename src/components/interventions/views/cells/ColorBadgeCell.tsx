import { getReadableTextColor } from "@/utils/color"
import type { TableColumnAppearance } from "@/types/intervention-views"
import type { CellRender, CellRendererArgs } from "./types"
import { toSoftColor, makeGradient } from "./types"

/**
 * Shared renderer for columns that display a colored badge (agence, metier, understatement).
 */

export function renderUnderstatementCell({ intervention }: Pick<CellRendererArgs, "intervention">): CellRender {
  const value = (intervention as any).understatement ?? (intervention as any).sousStatut
  if (!value) return { content: "—" }

  const textColor = (intervention as any).sousStatutTextColor ?? '#000000'
  const bgColor = (intervention as any).sousStatutBgColor ?? 'transparent'

  return {
    content: (
      <span
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium leading-tight"
        style={{
          color: textColor,
          backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
        }}
      >
        {value}
      </span>
    ),
    cellClassName: "font-medium",
  }
}

export function renderColorBadgeCell(
  label: string | null | undefined,
  color: string | undefined,
  style: CellRendererArgs["style"],
  themeMode: CellRendererArgs["themeMode"],
): CellRender {
  if (!label) return { content: "—" }

  const appearance: TableColumnAppearance = style?.appearance ?? "badge"

  if (!color || appearance === "none") {
    return { content: String(label) }
  }

  if (appearance === "badge") {
    const textColor = style?.textColor ?? getReadableTextColor(color)
    return {
      content: (
        <span
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-0.5 leading-tight text-xs font-semibold"
          style={{ backgroundColor: color, color: textColor }}
        >
          {label}
        </span>
      ),
      cellClassName: "font-medium",
    }
  }

  // solid
  const pastel = toSoftColor(color, themeMode)
  return {
    content: (
      <span className="inline-flex items-center gap-1.5">
        {label}
      </span>
    ),
    backgroundColor: pastel,
    defaultTextColor: themeMode === "dark" ? "#F3F4F6" : "#111827",
    cellClassName: "font-medium",
    statusGradient: makeGradient(color),
  }
}
