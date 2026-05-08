import { describe, it, expect } from "vitest"
import { buildTypographyClasses } from "@/components/interventions/views/table/lib/table-style"

describe("buildTypographyClasses", () => {
  it("defaults to md size when style is undefined", () => {
    expect(buildTypographyClasses(undefined)).toBe("text-sm")
  })
  it("maps each text size to the right Tailwind class", () => {
    expect(buildTypographyClasses({ textSize: "xl" })).toBe("text-xl")
    expect(buildTypographyClasses({ textSize: "lg" })).toBe("text-lg")
    expect(buildTypographyClasses({ textSize: "sm" })).toBe("text-xs")
    expect(buildTypographyClasses({ textSize: "xs" })).toBe("text-[0.65rem]")
  })
  it("appends bold and italic modifiers", () => {
    expect(buildTypographyClasses({ textSize: "md", bold: true, italic: true })).toBe(
      "text-sm font-semibold italic",
    )
  })
  it("omits modifiers when false", () => {
    expect(buildTypographyClasses({ textSize: "md", bold: false, italic: false })).toBe("text-sm")
  })
})
