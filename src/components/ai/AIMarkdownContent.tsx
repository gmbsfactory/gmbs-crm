"use client"

import React from "react"

/**
 * Composant de rendu markdown simplifie pour les reponses IA.
 * Utilise un parsing leger sans dependance externe supplementaire.
 * Partage entre AIAssistantDialog et AISidePanel.
 */
export function AIMarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactElement[] = []
  let listItems: string[] = []
  let orderedListItems: string[] = []
  let listKey = 0

  const flushUnorderedList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc pl-4 space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{formatInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const flushOrderedList = () => {
    if (orderedListItems.length > 0) {
      elements.push(
        <ol key={`ol-${listKey++}`} className="list-decimal pl-4 space-y-1 my-2">
          {orderedListItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{formatInlineMarkdown(item)}</li>
          ))}
        </ol>
      )
      orderedListItems = []
    }
  }

  for (const line of lines) {
    // H2
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      flushUnorderedList()
      flushOrderedList()
      elements.push(
        <h3 key={`h-${listKey++}`} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">
          {h2Match[1]}
        </h3>
      )
      continue
    }

    // H3
    const h3Match = line.match(/^###\s+(.+)/)
    if (h3Match) {
      flushUnorderedList()
      flushOrderedList()
      elements.push(
        <h4 key={`h3-${listKey++}`} className="text-sm font-medium mt-3 mb-1 text-foreground">
          {h3Match[1]}
        </h4>
      )
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      flushOrderedList()
      listItems.push(ulMatch[1])
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      flushUnorderedList()
      orderedListItems.push(olMatch[1])
      continue
    }

    const trimmed = line.trim()
    if (trimmed === '') {
      flushUnorderedList()
      flushOrderedList()
      continue
    }

    // Regular paragraph
    flushUnorderedList()
    flushOrderedList()
    elements.push(
      <p key={`p-${listKey++}`} className="text-sm leading-relaxed my-1">
        {formatInlineMarkdown(trimmed)}
      </p>
    )
  }

  flushUnorderedList()
  flushOrderedList()

  return <>{elements}</>
}

/**
 * Format inline markdown: **bold**, *italic*, `code`
 */
export function formatInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Code
    const codeMatch = remaining.match(/`(.+?)`/)

    const match = [boldMatch, codeMatch]
      .filter(Boolean)
      .sort((a, b) => (a!.index ?? 0) - (b!.index ?? 0))[0]

    if (!match || match.index === undefined) {
      parts.push(remaining)
      break
    }

    // Text before match
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index))
    }

    if (match === boldMatch) {
      parts.push(<strong key={key++}>{match[1]}</strong>)
    } else if (match === codeMatch) {
      parts.push(
        <code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs">{match[1]}</code>
      )
    }

    remaining = remaining.slice(match.index + match[0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}
