import { describe, it, expect, afterEach } from "vitest"
import { resolveThemeMode } from "@/components/interventions/views/table/lib/table-theme"

describe("resolveThemeMode", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark")
  })

  it("returns 'light' by default", () => {
    expect(resolveThemeMode()).toBe("light")
  })

  it("returns 'dark' when the html element has the 'dark' class", () => {
    document.documentElement.classList.add("dark")
    expect(resolveThemeMode()).toBe("dark")
  })
})
