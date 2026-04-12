"use client"

import { useCallback, useEffect, useState } from "react"

interface UsePanelResizeParams {
  storageKey: string | null
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

/**
 * Gère le redimensionnement d'un panneau avec persistance localStorage.
 * Différent de useColumnResize qui gère les colonnes de tableau.
 */
export function usePanelResize({
  storageKey,
  defaultWidth = 320,
  minWidth = 250,
  maxWidth = 600,
}: UsePanelResizeParams) {
  const [width, setWidth] = useState(defaultWidth)

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!storageKey) {
      setWidth(defaultWidth)
      return
    }

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = Number.parseFloat(saved)
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setWidth(parsed)
          return
        }
      }
      setWidth(defaultWidth)
    } catch (error) {
      console.warn("Erreur lors du chargement de la largeur du panneau:", error)
      setWidth(defaultWidth)
    }
  }, [storageKey, defaultWidth, minWidth, maxWidth])

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const startWidth = width

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const diff = startX - currentX // Inversé car on redimensionne depuis la gauche
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff))
      setWidth(newWidth)
      if (!storageKey || typeof window === "undefined") return
      try {
        localStorage.setItem(storageKey, String(newWidth))
      } catch (error) {
        console.warn("Erreur lors de la sauvegarde de la largeur du panneau:", error)
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleMouseMove, { passive: false })
    document.addEventListener('touchend', handleMouseUp)
  }, [width, storageKey, minWidth, maxWidth])

  return {
    width,
    handleResizeStart,
  }
}
