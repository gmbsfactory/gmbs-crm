export const FALLBACK_STATUS_COLOR = "#4B5563"

export function normalizeHex(hex?: string | null): string {
  if (!hex) return FALLBACK_STATUS_COLOR
  let value = hex.trim()
  if (!value.startsWith("#")) {
    value = `#${value}`
  }
  if (value.length === 4) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    value = `#${r}${r}${g}${g}${b}${b}`
  }
  if (value.length !== 7) {
    return FALLBACK_STATUS_COLOR
  }
  return value.toUpperCase()
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

export function hexToRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return `rgba(75, 85, 99, ${alpha})`
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

export function computeBadgeStyle(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    backgroundColor: hexToRgba(normalized, 0.15),
    border: `1px solid ${hexToRgba(normalized, 0.35)}`,
    color: normalized,
  }
}
