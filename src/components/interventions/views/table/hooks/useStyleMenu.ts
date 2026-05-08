import { useCallback, useEffect, useRef, useState } from "react"
import type React from "react"

const PANEL_PADDING = 12
const PANEL_WIDTH = 420
const PANEL_HEIGHT = 120
const PORTAL_MARKER = "data-quick-style-panel"

export type StyleMenuState = { property: string; x: number; y: number } | null

const clampPanelPosition = (clientX: number, clientY: number) => {
  if (typeof window === "undefined") return { x: clientX, y: clientY }
  return {
    x: Math.max(PANEL_PADDING, Math.min(clientX, window.innerWidth - PANEL_WIDTH - PANEL_PADDING)),
    y: Math.max(PANEL_PADDING, Math.min(clientY, window.innerHeight - PANEL_HEIGHT - PANEL_PADDING)),
  }
}

const isInsidePortalChain = (event: MouseEvent | PointerEvent) => {
  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  return path.some(
    (node) => node instanceof HTMLElement && node.hasAttribute(PORTAL_MARKER),
  )
}

/**
 * Owns the floating column style/alignment panel: position, anchor element,
 * outside-click + Escape dismissal, and reset when the active view changes.
 *
 * Pure UI state — does not know about column styles or layout mutation.
 */
export const useStyleMenu = (viewId: string, enabled: boolean = true) => {
  const [styleMenu, setStyleMenu] = useState<StyleMenuState>(null)
  const styleMenuRef = useRef<HTMLDivElement | null>(null)

  const closeStyleMenu = useCallback(() => setStyleMenu(null), [])

  const openStyleMenu = useCallback(
    (event: React.MouseEvent, property: string) => {
      if (!enabled) return
      event.preventDefault()
      event.stopPropagation()
      const { x, y } = clampPanelPosition(event.clientX, event.clientY)
      setStyleMenu({ property, x, y })
    },
    [enabled],
  )

  useEffect(() => {
    if (!styleMenu) return

    const handleDismiss = (event: MouseEvent | PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (styleMenuRef.current?.contains(target)) return
      if (isInsidePortalChain(event)) return
      setStyleMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStyleMenu(null)
    }

    window.addEventListener("pointerdown", handleDismiss)
    window.addEventListener("click", handleDismiss)
    window.addEventListener("contextmenu", handleDismiss)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("pointerdown", handleDismiss)
      window.removeEventListener("click", handleDismiss)
      window.removeEventListener("contextmenu", handleDismiss)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [styleMenu])

  useEffect(() => {
    setStyleMenu(null)
  }, [viewId])

  return { styleMenu, styleMenuRef, openStyleMenu, closeStyleMenu }
}
