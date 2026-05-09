import type { TableRowDensity } from "@/types/intervention-views"

export const getRowHeight = (density: TableRowDensity): number => {
  switch (density) {
    case "ultra-dense":
      // Inclut le badge/pill (~24px de hauteur) + padding + bordure
      return 37
    case "dense":
      return 40
    case "default":
      return 48
    default:
      return 40
  }
}
