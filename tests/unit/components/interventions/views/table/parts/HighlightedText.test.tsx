import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { HighlightedText } from "@/components/interventions/views/table/parts/HighlightedText"

vi.mock("@/components/search/highlight", () => ({
  getHighlightSegments: (text: string, query: string) => {
    if (!query) return [{ text, isMatch: false }]
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return [{ text, isMatch: false }]
    return [
      { text: text.slice(0, idx), isMatch: false },
      { text: text.slice(idx, idx + query.length), isMatch: true },
      { text: text.slice(idx + query.length), isMatch: false },
    ].filter((s) => s.text.length > 0)
  },
}))

describe("HighlightedText", () => {
  it("wraps matching segments with .search-highlight", () => {
    const { container } = render(<HighlightedText text="hello world" searchQuery="world" />)
    const highlighted = container.querySelector(".search-highlight")
    expect(highlighted?.textContent).toBe("world")
  })

  it("renders plain text when no match", () => {
    const { container } = render(<HighlightedText text="hello" searchQuery="zzz" />)
    expect(container.querySelector(".search-highlight")).toBeNull()
    expect(container.textContent).toBe("hello")
  })
})
