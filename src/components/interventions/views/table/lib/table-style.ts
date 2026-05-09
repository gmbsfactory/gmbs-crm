import type { TableColumnStyle, TableColumnTextSize } from "@/types/intervention-views"

const sizeClassMap: Record<TableColumnTextSize, string> = {
  xl: "text-xl",
  lg: "text-lg",
  md: "text-sm",
  sm: "text-xs",
  xs: "text-[0.65rem]",
}

export const buildTypographyClasses = (style: TableColumnStyle | undefined): string => {
  const classes = [sizeClassMap[style?.textSize ?? "md"]]
  if (style?.bold) classes.push("font-semibold")
  if (style?.italic) classes.push("italic")
  return classes.join(" ")
}
