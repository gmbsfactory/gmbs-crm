import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { HighlightedText } from "./HighlightedText"

type TruncatedCellProps = {
  content: ReactNode
  className?: string
  searchQuery?: string
  tooltipText?: string
  /** Force the tooltip to appear even when the content does not visually overflow. */
  alwaysShowTooltip?: boolean
}

const TOOLTIP_OFFSET = 12
const VIEWPORT_MARGIN = 16

/**
 * A truncating cell that lazily measures overflow on hover and renders a
 * portal-based tooltip with the full text. Highlights search matches inline.
 */
export function TruncatedCell({
  content,
  className,
  searchQuery,
  tooltipText,
  alwaysShowTooltip,
}: TruncatedCellProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const cellRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)

  const tooltipString =
    tooltipText ??
    (typeof content === "string"
      ? content
      : typeof content === "number"
        ? String(content)
        : "")

  const displayContent = useMemo(() => {
    if (typeof content === "string" && searchQuery && searchQuery.trim().length > 0) {
      return <HighlightedText text={content} searchQuery={searchQuery} />
    }
    return content
  }, [content, searchQuery])

  useEffect(() => {
    if (typeof document === "undefined") return
    setPortalElement(document.body)
  }, [])

  const updateTooltipPosition = (event: React.MouseEvent) => {
    const x = Math.min(window.innerWidth - VIEWPORT_MARGIN, event.clientX + TOOLTIP_OFFSET)
    const y = Math.min(window.innerHeight - VIEWPORT_MARGIN, event.clientY + TOOLTIP_OFFSET)
    setTooltipPos({
      x: Math.max(VIEWPORT_MARGIN, x),
      y: Math.max(VIEWPORT_MARGIN, y),
    })
  }

  const handleMouseEnter = (event: React.MouseEvent) => {
    const element = cellRef.current
    if (!element) return
    const overflowing = alwaysShowTooltip || element.scrollWidth > element.clientWidth
    setIsOverflowing(overflowing)
    if (overflowing) updateTooltipPosition(event)
  }

  const handleMouseLeave = () => setTooltipPos(null)

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={(event) => {
          if (!isOverflowing) return
          updateTooltipPosition(event)
        }}
      >
        <div ref={cellRef} className={cn("truncate relative", className)}>
          {displayContent}
        </div>
      </div>
      {portalElement && tooltipPos && tooltipString
        ? createPortal(
            <div
              className="fixed z-[1000] max-w-sm break-words rounded-lg border-2 border-border bg-card p-3 text-sm font-normal text-card-foreground shadow-2xl whitespace-normal pointer-events-none"
              style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            >
              {tooltipString}
            </div>,
            portalElement,
          )
        : null}
    </>
  )
}
