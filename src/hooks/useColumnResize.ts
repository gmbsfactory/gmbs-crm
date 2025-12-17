"use client"

import { useCallback, useEffect, useState } from "react"

export type ColumnWidths = Record<string, number | undefined>

/**
 * Largeurs minimales par colonne (en pixels)
 * Ces valeurs empêchent de réduire les colonnes en-dessous de leur seuil
 */
export const MIN_COLUMN_WIDTHS: Record<string, number> = {
  // Colonnes avec badges colorés - besoin d'espace pour le texte
  statusValue: 100,
  agence: 85,
  metier: 85,
  
  // Colonnes de dates - format dd/mm/yyyy
  dateIntervention: 85,
  datePrevue: 85,
  date: 85,
  due_date: 85,
  
  // Colonnes d'identifiants
  id_inter: 85,
  
  // Colonnes de texte court
  codePostal: 60,
  attribueA: 50,
  
  // Colonnes de texte moyen
  ville: 80,
  artisan: 90,
  coutIntervention: 70,
  understatement: 50,
  
  // Colonnes de texte long
  adresse: 120,
  contexteIntervention: 100,
}

/** Largeur minimale par défaut si la colonne n'est pas dans MIN_COLUMN_WIDTHS */
const DEFAULT_MIN_WIDTH = 50

/** Obtenir la largeur minimale pour une colonne */
export const getMinColumnWidth = (column: string): number => {
  return MIN_COLUMN_WIDTHS[column] ?? DEFAULT_MIN_WIDTH
}

export function useColumnResize(
  columnWidths: ColumnWidths,
  onUpdate: (widths: Record<string, number>) => void,
) {
  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, column: string) => {
      event.preventDefault()
      const width = columnWidths[column] ?? 150
      setActiveColumn(column)
      setStartX(event.clientX)
      setStartWidth(width)
    },
    [columnWidths],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!activeColumn) return
      const delta = event.clientX - startX
      const minWidth = getMinColumnWidth(activeColumn)
      const nextWidth = Math.max(minWidth, startWidth + delta)
      const draft: Record<string, number | undefined> = {
        ...columnWidths,
        [activeColumn]: nextWidth,
      }
      const sanitized: Record<string, number> = {}
      Object.entries(draft).forEach(([key, value]) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          sanitized[key] = value
        }
      })
      onUpdate(sanitized)
    },
    [activeColumn, columnWidths, onUpdate, startWidth, startX],
  )

  const handlePointerUp = useCallback(() => {
    setActiveColumn(null)
  }, [])

  useEffect(() => {
    if (!activeColumn) return
    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)
    return () => {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }
  }, [activeColumn, handlePointerMove, handlePointerUp])

  return {
    activeColumn,
    handlePointerDown,
  }
}

export default useColumnResize
