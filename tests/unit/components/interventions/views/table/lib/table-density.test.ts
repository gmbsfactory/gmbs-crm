import { describe, it, expect } from "vitest"
import { getRowHeight } from "@/components/interventions/views/table/lib/table-density"

describe("getRowHeight", () => {
  it("returns 37 for ultra-dense", () => {
    expect(getRowHeight("ultra-dense")).toBe(37)
  })
  it("returns 40 for dense", () => {
    expect(getRowHeight("dense")).toBe(40)
  })
  it("returns 48 for default", () => {
    expect(getRowHeight("default")).toBe(48)
  })
  it("falls back to 40 for an unknown density", () => {
    expect(getRowHeight("unknown" as never)).toBe(40)
  })
})
