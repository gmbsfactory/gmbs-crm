/**
 * Returns a readable text color (dark or light) for a given background hex color,
 * based on perceived luminance.
 */
export function getReadableTextColor(
  bgColor: string | null | undefined,
  fallback = "#1f2937",
): string {
  if (!bgColor) return fallback
  const hex = bgColor.replace("#", "")
  if (hex.length !== 6) return fallback
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#1f2937" : "#ffffff"
}
