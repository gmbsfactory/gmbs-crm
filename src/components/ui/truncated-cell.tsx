"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type TruncatedCellProps = {
  content: React.ReactNode
  className?: string
  maxWidth?: string
}

export function TruncatedCell({ content, className, maxWidth = "300px" }: TruncatedCellProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const cellRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = cellRef.current
    if (!element) return

    // Vérifier si le contenu déborde
    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth)
    }

    // Vérifier immédiatement après le rendu
    checkOverflow()

    // Le ResizeObserver détectera les changements de taille ultérieurs
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  })

  const contentStr = typeof content === "string" ? content : typeof content === "number" ? String(content) : ""

  useEffect(() => {
    if (typeof document === "undefined") return
    setPortalElement(document.body)
  }, [])

  const updateTooltipPosition = (event: React.MouseEvent) => {
    const offset = 12
    const margin = 16
    const x = Math.min(window.innerWidth - margin, event.clientX + offset)
    const y = Math.min(window.innerHeight - margin, event.clientY + offset)

    setTooltipPos({
      x: Math.max(margin, x),
      y: Math.max(margin, y),
    })
  }

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (!isOverflowing) return
    updateTooltipPosition(event)
  }

  const handleMouseLeave = () => {
    setTooltipPos(null)
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={(event) => {
          if (!isOverflowing || !tooltipPos) return
          updateTooltipPosition(event)
        }}
      >
        <div
          ref={cellRef}
          className={cn("truncate relative", className)}
          style={{ maxWidth }}
        >
          {content}
        </div>
      </div>
      {portalElement && tooltipPos && contentStr
        ? createPortal(
            <div
              className="fixed z-[1000] max-w-sm break-words rounded-md border border-border bg-popover p-3 text-sm font-normal text-popover-foreground shadow-md whitespace-normal pointer-events-none"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              {contentStr}
            </div>,
            portalElement,
          )
        : null}
    </>
  )
}


