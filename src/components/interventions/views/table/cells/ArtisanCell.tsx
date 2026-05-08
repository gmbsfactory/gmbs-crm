import { getReadableTextColor } from "@/utils/color"
import { getArtisanStatusAbbreviation } from "@/config/status-colors"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CellRender, CellRendererArgs } from "./types"

export function renderArtisanCell({ intervention }: Pick<CellRendererArgs, "intervention">): CellRender {
  const artisanName = (intervention as any).artisan as string | null
  if (!artisanName) return { content: "—" }

  const primaryArtisan = (intervention as any).primaryArtisan
  const artisanStatus = primaryArtisan?.status
  const statusColor = artisanStatus?.color || "#6B7280"
  const statusLabel = artisanStatus?.label || "Statut inconnu"
  const statusAbbr = getArtisanStatusAbbreviation(statusLabel, artisanStatus?.code, artisanStatus?.abbreviation)
  const textColor = getReadableTextColor(statusColor)

  return {
    tooltipText: `${artisanName}${artisanStatus ? ` — ${statusLabel}` : ""}`,
    content: (
      <div className="flex items-center gap-2 max-w-full">
        <span className="truncate flex-1">{artisanName}</span>
        {artisanStatus && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold leading-none shrink-0"
                  style={{ backgroundColor: statusColor, color: textColor }}
                >
                  {statusAbbr}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="px-2 py-1">
                <span className="text-xs font-medium">{statusLabel}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    ),
    cellClassName: "font-medium max-w-[200px]",
  }
}
