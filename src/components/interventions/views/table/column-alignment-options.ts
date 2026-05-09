import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"

import type { TableColumnAlignment } from "@/types/intervention-views"

export const TABLE_ALIGNMENT_OPTIONS: Array<{
  value: TableColumnAlignment
  icon: typeof AlignLeft
  label: string
}> = [
  { value: "left", icon: AlignLeft, label: "Aligner à gauche" },
  { value: "center", icon: AlignCenter, label: "Centrer" },
  { value: "right", icon: AlignRight, label: "Aligner à droite" },
]

