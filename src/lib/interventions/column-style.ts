import type { TableColumnAppearance, TableColumnStyle, TableColumnTextSize } from "@/types/intervention-views"

export const STYLE_ELIGIBLE_COLUMNS = new Set(["statusValue", "attribueA", "agence", "metier"])

export const TABLE_TEXT_SIZE_VALUES: TableColumnTextSize[] = ["xl", "lg", "md", "sm", "xs"]

export const TABLE_TEXT_SIZE_OPTIONS: Array<{ value: TableColumnTextSize; label: string }> = [
  { value: "xl", label: "XL" },
  { value: "lg", label: "L" },
  { value: "md", label: "M" },
  { value: "sm", label: "S" },
  { value: "xs", label: "XS" },
]

export const TABLE_APPEARANCE_OPTIONS: Array<{ value: TableColumnAppearance; label: string }> = [
  { value: "none", label: "Sans couleur" },
  { value: "solid", label: "Case colorée" },
  { value: "badge", label: "Bouton coloré" },
]

export const normalizeColumnStyle = (
  columnKey: string,
  style: TableColumnStyle | undefined,
): TableColumnStyle | undefined => {
  if (!style) return undefined

  const normalized: TableColumnStyle = {}

  // Sauvegarder l'apparence si la colonne est éligible
  // "solid" est la valeur par défaut mais doit être sauvegardée si explicitement définie
  if (STYLE_ELIGIBLE_COLUMNS.has(columnKey) && style.appearance) {
    normalized.appearance = style.appearance
  }

  if (style.textSize && style.textSize !== "md" && TABLE_TEXT_SIZE_VALUES.includes(style.textSize)) {
    normalized.textSize = style.textSize
  }

  if (style.bold) {
    normalized.bold = true
  }

  if (style.italic) {
    normalized.italic = true
  }

  if (style.textColor) {
    normalized.textColor = style.textColor
  }

  return Object.keys(normalized).length ? normalized : undefined
}

