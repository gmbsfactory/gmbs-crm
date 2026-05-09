import { getPropertyValue } from "@/lib/query-engine"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { TableColumnStyle } from "@/types/intervention-views"
import type { CellRender, ThemeMode } from "./types"
import { renderStatusCell } from "./StatusCell"
import { renderAssigneeCell } from "./AssigneeCell"
import { renderUnderstatementCell, renderColorBadgeCell } from "./ColorBadgeCell"
import { renderArtisanCell } from "./ArtisanCell"
import { renderGenericCell } from "./GenericCell"

export const renderCell = (
  intervention: InterventionEntity,
  property: string,
  style: TableColumnStyle | undefined,
  themeMode: ThemeMode,
): CellRender => {
  if (property === "statusValue") return renderStatusCell({ intervention, style, themeMode })
  if (property === "attribueA") return renderAssigneeCell({ intervention, property, style, themeMode })
  if (property === "understatement") return renderUnderstatementCell({ intervention })
  if (property === "agence") {
    const fallback = getPropertyValue(intervention, property)
    return renderColorBadgeCell(
      intervention.agenceLabel ?? (fallback == null ? null : String(fallback)),
      intervention.agenceColor ?? undefined,
      style,
      themeMode,
    )
  }
  if (property === "metier") {
    const fallback = getPropertyValue(intervention, property)
    return renderColorBadgeCell(
      intervention.metierLabel ?? (fallback == null ? null : String(fallback)),
      intervention.metierColor ?? undefined,
      style,
      themeMode,
    )
  }
  if (property === "artisan") return renderArtisanCell({ intervention })

  return renderGenericCell(intervention, property)
}
