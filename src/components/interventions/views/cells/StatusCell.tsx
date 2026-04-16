import { cn } from "@/lib/utils"
import { isCheckStatus } from "@/lib/interventions/checkStatus"
import { getStatusDisplay } from "@/lib/interventions/status-display"
import { getStatusDisplayLabel } from "@/lib/interventions/deposit-helpers"
import { getReadableTextColor } from "@/utils/color"
import type { InterventionPayment } from "@/lib/api/common/types"
import type { TableColumnAppearance } from "@/types/intervention-views"
import type { CellRender, CellRendererArgs } from "./types"
import { toSoftColor, makeGradient } from "./types"

export function renderStatusCell({ intervention, style, themeMode }: Omit<CellRendererArgs, "property">): CellRender {
  const value = (intervention as any).statusValue ?? (intervention as any).status?.code
  if (!value) return { content: "—" }

  const statusInfo = (intervention as any).status as { code?: string; color?: string; label?: string } | undefined
  const statusCode = (statusInfo?.code ?? value ?? "") as string

  const statusDisplay = getStatusDisplay(statusCode, {
    statusFromDb: statusInfo ? {
      code: statusInfo.code ?? statusCode,
      label: statusInfo.label ?? String(value),
      color: statusInfo.color ?? null,
    } : undefined,
  })

  const payments = (intervention as any).payments as Array<{ payment_type?: string; is_received?: boolean; payment_date?: string | null }> | undefined
  const sstPayment = payments?.find(p => p.payment_type === 'acompte_sst') as InterventionPayment | undefined
  const clientPayment = payments?.find(p => p.payment_type === 'acompte_client') as InterventionPayment | undefined

  const baseLabel = statusDisplay.label
  const statusLabelWithDeposit = getStatusDisplayLabel(statusCode, baseLabel, sstPayment, clientPayment)

  const datePrevue = (intervention as any).date_prevue ?? (intervention as any).datePrevue ?? null
  const isCheck = isCheckStatus(statusCode, datePrevue)

  const displayLabel = isCheck ? "CHECK" : statusLabelWithDeposit
  const displayColor = isCheck ? "#EF4444" : statusDisplay.color
  const appearance: TableColumnAppearance = style?.appearance ?? "solid"
  const statusIcon = !isCheck ? statusDisplay.icon : null

  if (appearance === "none") {
    return {
      content: isCheck ? (
        <span className="check-status-badge inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold text-white bg-red-500">
          CHECK
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {statusIcon}
          {displayLabel}
        </span>
      ),
    }
  }

  if (appearance === "badge") {
    const textColor = style?.textColor ?? getReadableTextColor(displayColor)
    return {
      content: (
        <span
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-0.5 leading-tight",
            isCheck && "check-status-badge"
          )}
          style={{ backgroundColor: displayColor, color: textColor }}
        >
          {statusIcon}
          {displayLabel}
        </span>
      ),
      cellClassName: "font-medium",
    }
  }

  // solid
  const pastel = toSoftColor(displayColor, themeMode)
  return {
    content: isCheck ? (
      <span className="check-status-badge inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold text-white bg-red-500">
        CHECK
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        {statusIcon}
        {displayLabel}
      </span>
    ),
    backgroundColor: isCheck ? "#FEE2E2" : pastel,
    defaultTextColor: themeMode === "dark" ? "#F3F4F6" : "#111827",
    cellClassName: "font-medium",
    statusGradient: isCheck ? makeGradient("#EF4444") : makeGradient(statusDisplay.color),
  }
}
