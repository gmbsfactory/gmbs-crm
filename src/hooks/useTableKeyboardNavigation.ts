"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Virtualizer } from "@tanstack/react-virtual"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"

interface UseTableKeyboardNavigationOptions {
  dataset: { id: string }[]
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
  expandedRowId: string | null
  setExpandedRowId: (id: string | null) => void
  onInterventionClick?: (id: string, options?: InterventionModalOpenOptions) => void
  orderedIds: string[]
  enabled?: boolean
  onNextPage?: () => void
  onPreviousPage?: () => void
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function isModalOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]')
}

function isMenuOpen(): boolean {
  return !!document.querySelector("[data-radix-menu-content]")
}

export function useTableKeyboardNavigation({
  dataset,
  rowVirtualizer,
  expandedRowId,
  setExpandedRowId,
  onInterventionClick,
  orderedIds,
  enabled = true,
  onNextPage,
  onPreviousPage,
}: UseTableKeyboardNavigationOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isKeyboardMode, setIsKeyboardMode] = useState(false)
  const highlightedIndexRef = useRef(highlightedIndex)
  highlightedIndexRef.current = highlightedIndex

  // Reset quand le dataset change
  const datasetSignature = `${dataset.length}-${dataset[0]?.id ?? "none"}-${dataset[dataset.length - 1]?.id ?? "none"}`
  const prevSignatureRef = useRef(datasetSignature)
  useEffect(() => {
    if (prevSignatureRef.current !== datasetSignature) {
      prevSignatureRef.current = datasetSignature
      setHighlightedIndex(-1)
      setIsKeyboardMode(false)
    }
  }, [datasetSignature])

  // Sortir du mode clavier au mouvement de souris
  useEffect(() => {
    if (!isKeyboardMode) return
    const onMouseMove = () => setIsKeyboardMode(false)
    window.addEventListener("mousemove", onMouseMove, { once: true })
    return () => window.removeEventListener("mousemove", onMouseMove)
  }, [isKeyboardMode])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isInputFocused() || isModalOpen() || isMenuOpen()) return

      // Shift+←/→ → pagination
      if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault()
        if (e.key === "ArrowRight") onNextPage?.()
        else onPreviousPage?.()
        return
      }

      if (e.shiftKey) return

      const maxIndex = dataset.length - 1
      const current = highlightedIndexRef.current

      switch (e.key) {
        case "ArrowDown": {
          if (maxIndex < 0) return
          e.preventDefault()
          const next = current < 0 ? 0 : Math.min(current + 1, maxIndex)
          setHighlightedIndex(next)
          setIsKeyboardMode(true)
          rowVirtualizer.scrollToIndex(next, { align: "auto" })
          if (expandedRowId !== null) {
            setExpandedRowId(dataset[next]?.id ?? null)
          }
          break
        }
        case "ArrowUp": {
          if (maxIndex < 0) return
          e.preventDefault()
          const prev = current < 0 ? maxIndex : Math.max(current - 1, 0)
          setHighlightedIndex(prev)
          setIsKeyboardMode(true)
          rowVirtualizer.scrollToIndex(prev, { align: "auto" })
          if (expandedRowId !== null) {
            setExpandedRowId(dataset[prev]?.id ?? null)
          }
          break
        }
        case " ": {
          if (current < 0) return
          e.preventDefault()
          const item = dataset[current]
          if (!item) return
          setExpandedRowId(expandedRowId === item.id ? null : item.id)
          break
        }
        case "Enter": {
          if (current < 0) return
          e.preventDefault()
          const item = dataset[current]
          if (!item) return
          onInterventionClick?.(item.id, {
            layoutId: `table-row-${item.id}`,
            orderedIds,
            index: current,
          })
          break
        }
        case "Escape": {
          if (expandedRowId !== null) {
            e.preventDefault()
            setExpandedRowId(null)
          } else if (current >= 0) {
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
    [enabled, dataset, rowVirtualizer, expandedRowId, setExpandedRowId, onInterventionClick, orderedIds, onNextPage, onPreviousPage],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return { highlightedIndex, isKeyboardMode }
}
