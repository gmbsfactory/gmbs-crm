"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseSimpleTableNavigationOptions {
  /** Nombre total de lignes affichées */
  rowCount: number
  /** Callback quand Enter est pressé sur la ligne sélectionnée (reçoit l'index) */
  onEnter?: (index: number) => void
  /** Désactiver le hook */
  enabled?: boolean
  /** Sélecteur CSS du conteneur scrollable (par défaut cherche le parent overflow-auto) */
  tableContainerSelector?: string
}

function shouldIgnoreEvent(): boolean {
  const el = document.activeElement
  if (el) {
    const tag = el.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
    if ((el as HTMLElement).isContentEditable) return true
  }
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true
  if (document.querySelector("[data-radix-menu-content]")) return true
  return false
}

export function useSimpleTableNavigation({
  rowCount,
  onEnter,
  enabled = true,
  tableContainerSelector,
}: UseSimpleTableNavigationOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isKeyboardMode, setIsKeyboardMode] = useState(false)
  const highlightedIndexRef = useRef(highlightedIndex)
  highlightedIndexRef.current = highlightedIndex

  // Reset quand le nombre de lignes change
  const prevRowCountRef = useRef(rowCount)
  useEffect(() => {
    if (prevRowCountRef.current !== rowCount) {
      prevRowCountRef.current = rowCount
      setHighlightedIndex(-1)
      setIsKeyboardMode(false)
    }
  }, [rowCount])

  // Sortir du mode clavier au mouvement de souris
  useEffect(() => {
    if (!isKeyboardMode) return
    const onMouseMove = () => setIsKeyboardMode(false)
    window.addEventListener("mousemove", onMouseMove, { once: true })
    return () => window.removeEventListener("mousemove", onMouseMove)
  }, [isKeyboardMode])

  const scrollToRow = useCallback(
    (index: number) => {
      const row = document.querySelector(`tr[data-kb-row="${index}"]`) as HTMLElement | null
      if (row) {
        row.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || rowCount === 0) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (shouldIgnoreEvent()) return

      const maxIndex = rowCount - 1
      const current = highlightedIndexRef.current

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          const next = current < 0 ? 0 : Math.min(current + 1, maxIndex)
          setHighlightedIndex(next)
          setIsKeyboardMode(true)
          scrollToRow(next)
          break
        }
        case "ArrowUp": {
          e.preventDefault()
          const prev = current < 0 ? maxIndex : Math.max(current - 1, 0)
          setHighlightedIndex(prev)
          setIsKeyboardMode(true)
          scrollToRow(prev)
          break
        }
        case "Enter": {
          if (current < 0) return
          e.preventDefault()
          onEnter?.(current)
          break
        }
        case "Escape": {
          if (current >= 0) {
            e.preventDefault()
            setHighlightedIndex(-1)
            setIsKeyboardMode(false)
          }
          break
        }
        default:
          return
      }
    },
    [enabled, rowCount, onEnter, scrollToRow],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return { highlightedIndex, isKeyboardMode }
}
