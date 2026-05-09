import { getPropertyValue } from "@/lib/query-engine"
import { getPropertySchema } from "@/types/property-schema"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { CellRender } from "./types"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" })

export const renderGenericCell = (
  intervention: InterventionEntity,
  property: string,
): CellRender => {
  const schema = getPropertySchema(property)
  const value = getPropertyValue(intervention, property)

  if (!schema) {
    return { content: value == null || value === "" ? "—" : String(value) }
  }

  switch (schema.type) {
    case "date": {
      if (!value) return { content: "—" }
      const date = new Date(String(value))
      return { content: Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date) }
    }
    case "number": {
      if (typeof value !== "number") return { content: value == null ? "—" : String(value) }
      return { content: numberFormatter.format(value) }
    }
    case "select":
    case "multi_select": {
      if (!value) return { content: "—" }
      if (schema.type === "multi_select" && Array.isArray(value)) {
        return {
          content: value
            .map((item) => schema.options?.find((option) => option.value === item)?.label ?? String(item))
            .join(", "),
        }
      }
      const option = schema.options?.find((option) => option.value === value)
      return { content: option?.label ?? String(value) }
    }
    case "checkbox":
      return { content: value ? "Oui" : "Non" }
    default:
      return { content: value == null || value === "" ? "—" : String(value) }
  }
}
