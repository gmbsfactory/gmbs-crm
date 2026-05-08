import React from "react"
import { getHighlightSegments } from "@/components/search/highlight"

type HighlightedTextProps = {
  text: string
  searchQuery: string
}

/** Renders text with `<span class="search-highlight">` wrapping any matching segments. */
export function HighlightedText({ text, searchQuery }: HighlightedTextProps) {
  const segments = getHighlightSegments(text, searchQuery)
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={segment.isMatch ? "search-highlight" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}
