import type { ReactNode } from "react"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { TableColumnStyle } from "@/types/intervention-views"

export type CellRender = {
  content: ReactNode
  tooltipText?: string
  backgroundColor?: string
  defaultTextColor?: string
  cellClassName?: string
  statusGradient?: string
}

export type CellRendererArgs = {
  intervention: InterventionEntity
  property: string
  style: TableColumnStyle | undefined
  themeMode: "light" | "dark"
}

/**
 * Converts a hex color to a soft/pastel version for cell backgrounds.
 */
export const toSoftColor = (hex: string | undefined, mode: "light" | "dark", fallback = "#cbd5f5") => {
  if (!hex) return fallback
  const sanitized = hex.replace("#", "")
  if (sanitized.length !== 6) return fallback
  const numeric = Number.parseInt(sanitized, 16)
  const r = (numeric >> 16) & 255
  const g = (numeric >> 8) & 255
  const b = numeric & 255
  const mixTarget = mode === "dark" ? 0 : 255
  const factor = mode === "dark" ? 0.45 : 0.7
  const mixChannel = (channel: number) => Math.round(channel + (mixTarget - channel) * factor)
  return `rgb(${mixChannel(r)}, ${mixChannel(g)}, ${mixChannel(b)})`
}

export const makeGradient = (color: string) =>
  `linear-gradient(
    to bottom,
    color-mix(in oklab, ${color}, white 20%) 0%,
    ${color} 50%,
    color-mix(in oklab, ${color}, black 20%) 100%
  )`
