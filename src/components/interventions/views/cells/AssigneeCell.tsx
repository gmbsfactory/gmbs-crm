import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { TableColumnAppearance } from "@/types/intervention-views"
import type { CellRender, CellRendererArgs } from "./types"
import { toSoftColor, makeGradient } from "./types"

export function renderAssigneeCell({ intervention, property, style, themeMode }: CellRendererArgs): CellRender {
  const value = (intervention as any).assignedUserCode ??
    ((intervention as any)[property] == null ? "" : String((intervention as any)[property]))
  if (!value) return { content: "—" }

  const color = (intervention as any).assignedUserColor as string | undefined
  const assignedUserName = (intervention as any).assignedUserName as string | undefined
  const avatarUrl = (intervention as any).assignedUserAvatarUrl as string | undefined

  const nameParts = assignedUserName?.trim().split(/\s+/) ?? []
  const firstname = nameParts[0] ?? value
  const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined

  const appearance: TableColumnAppearance = style?.appearance ?? "solid"

  if (!color || appearance === "none") {
    return {
      content: (
        <GestionnaireBadge
          firstname={firstname}
          lastname={lastname}
          color={color}
          avatarUrl={avatarUrl}
          size="sm"
          showBorder={!!color}
        />
      ),
    }
  }

  if (appearance === "badge") {
    return {
      content: (
        <GestionnaireBadge
          firstname={firstname}
          lastname={lastname}
          color={color}
          avatarUrl={avatarUrl}
          size="sm"
        />
      ),
      cellClassName: "font-medium",
    }
  }

  // solid
  const pastel = toSoftColor(color, themeMode, themeMode === "dark" ? "#1f2937" : "#e2e8f0")
  return {
    content: (
      <GestionnaireBadge
        firstname={firstname}
        lastname={lastname}
        color={color}
        avatarUrl={avatarUrl}
        size="sm"
      />
    ),
    backgroundColor: pastel,
    defaultTextColor: themeMode === "dark" ? "#E5E7EB" : "#111827",
    cellClassName: "font-medium",
    statusGradient: makeGradient(color),
  }
}
