"use client"

import React from "react"
import { getHighlightSegments } from "@/components/search/highlight"

interface HighlightedTextProps {
  text: string
  searchQuery: string
}

/** Renders text with search-term highlighting */
export function HighlightedText({ text, searchQuery }: HighlightedTextProps) {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return <>{text}</>
  }
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
