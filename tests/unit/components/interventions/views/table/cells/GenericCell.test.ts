import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/query-engine", () => ({
  getPropertyValue: (intervention: any, prop: string) => intervention[prop],
}))

vi.mock("@/types/property-schema", () => {
  const schemas: Record<string, any> = {
    createdAt: { type: "date" },
    montant: { type: "number" },
    statusValue: {
      type: "select",
      options: [{ value: "OPEN", label: "Ouvert" }, { value: "CLOSED", label: "Ferme" }],
    },
    tags: {
      type: "multi_select",
      options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Bravo" }],
    },
    isPaid: { type: "checkbox" },
    raw: { type: "text" },
  }
  return {
    getPropertySchema: (prop: string) => schemas[prop],
    getPropertyLabel: (prop: string) => prop,
  }
})

import { renderGenericCell } from "@/components/interventions/views/table/cells/GenericCell"

const make = (overrides: Record<string, unknown>) => ({ id: "1", ...overrides }) as any

describe("renderGenericCell", () => {
  it("returns em-dash when no schema and no value", () => {
    expect(renderGenericCell(make({}), "unknown").content).toBe("—")
  })
  it("stringifies raw value when no schema", () => {
    expect(renderGenericCell(make({ unknown: 42 }), "unknown").content).toBe("42")
  })
  it("formats date values in fr-FR", () => {
    const out = renderGenericCell(make({ createdAt: "2026-05-07T00:00:00Z" }), "createdAt")
    expect(typeof out.content).toBe("string")
    expect(out.content).not.toBe("—")
  })
  it("returns em-dash for invalid dates", () => {
    expect(renderGenericCell(make({ createdAt: "not-a-date" }), "createdAt").content).toBe("—")
  })
  it("returns em-dash for empty date", () => {
    expect(renderGenericCell(make({ createdAt: null }), "createdAt").content).toBe("—")
  })
  it("formats number with fr-FR thousand separator", () => {
    // Intl.NumberFormat uses U+202F (narrow NBSP) as the thousands separator
    expect(renderGenericCell(make({ montant: 1234.5 }), "montant").content).toBe("1 234,5")
  })
  it("renders select option label", () => {
    expect(renderGenericCell(make({ statusValue: "OPEN" }), "statusValue").content).toBe("Ouvert")
  })
  it("falls back to raw value when select option not found", () => {
    expect(renderGenericCell(make({ statusValue: "X" }), "statusValue").content).toBe("X")
  })
  it("joins multi_select labels with comma", () => {
    expect(renderGenericCell(make({ tags: ["a", "b"] }), "tags").content).toBe("Alpha, Bravo")
  })
  it("renders checkbox as Oui/Non", () => {
    expect(renderGenericCell(make({ isPaid: true }), "isPaid").content).toBe("Oui")
    expect(renderGenericCell(make({ isPaid: false }), "isPaid").content).toBe("Non")
  })
})
