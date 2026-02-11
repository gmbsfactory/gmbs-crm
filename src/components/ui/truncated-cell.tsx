"use client"

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  useLayoutEffect(() => {
    const element = cellRef.current
    if (!element) return

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth)
    }

    checkOverflow()

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

  const showTooltipAtElement = useCallback(() => {
    if (!isOverflowing || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const margin = 16
    setTooltipPos({
      x: Math.max(margin, rect.left),
      y: Math.max(margin, rect.bottom + 4),
    })
  }, [isOverflowing])

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (!isOverflowing) return
    updateTooltipPosition(event)
  }

  const handleMouseLeave = () => {
    if (!isFocused) {
      setTooltipPos(null)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    showTooltipAtElement()
  }

  const handleBlur = () => {
    setIsFocused(false)
    setTooltipPos(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOverflowing) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (tooltipPos) {
        setTooltipPos(null)
      } else {
        showTooltipAtElement()
      }
    }
    if (event.key === "Escape" && tooltipPos) {
      setTooltipPos(null)
    }
  }

  const isTooltipVisible = !!(portalElement && tooltipPos && contentStr)

  return (
    <>
      <div
        ref={containerRef}
        className="relative"
        tabIndex={isOverflowing ? 0 : undefined}
        role={isOverflowing ? "button" : undefined}
        aria-expanded={isOverflowing ? isTooltipVisible : undefined}
        aria-label={isOverflowing && contentStr ? contentStr : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={(event) => {
          if (!isOverflowing || !tooltipPos || isFocused) return
          updateTooltipPosition(event)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        <div
          ref={cellRef}
          className={cn("truncate relative", className)}
          style={{ maxWidth }}
        >
          {content}
        </div>
      </div>
      {isTooltipVisible
        ? createPortal(
            <div
              role="tooltip"
              className="fixed z-[1000] max-w-sm break-words rounded-lg border-2 border-border bg-card p-3 text-sm font-normal text-card-foreground shadow-2xl whitespace-normal pointer-events-none"
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
