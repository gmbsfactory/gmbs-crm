"use client"

import { useCallback, useRef, useState } from "react"
import type { DevFocus, Maxed, RightView, SortKey } from "@/types/monitoring"

export type { DevFocus, Maxed, RightView, SortKey } from "@/types/monitoring"

/**
 * État partagé du Monitoring DEV (remonté pour relier les clics de la timeline
 * gauche au flux de droite) + logique du split redimensionnable / maximize.
 */
export function useDevMonitoringState() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>("screen")
  const [rightView, setRightView] = useState<RightView>("feed")
  const [search, setSearch] = useState("")
  const [focus, setFocus] = useState<DevFocus | null>(null)
  const [split, setSplit] = useState(50)
  const [maxed, setMaxed] = useState<Maxed>(null)

  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Sélection avatar = surligne + déplie la carte (et purge un focus résiduel
  // pour que le filtre prenne effet immédiatement sur le flux & les dossiers).
  const toggleFilter = useCallback(
    (id: string) => {
      const willSelect = !selectedIds.includes(id)
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      setExpandedIds((prev) =>
        willSelect ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
      )
      setFocus(null)
    },
    [selectedIds]
  )

  // Clic sur le corps de la carte = (dé)plier seulement, et purge le focus.
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setFocus(null)
  }, [])

  const applyFocus = useCallback((f: DevFocus) => {
    setFocus(f)
    setRightView("feed")
  }, [])

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => (prev === key ? "screen" : key))
  }, [])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const move = (ev: MouseEvent) => {
      const el = bodyRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const pct = ((ev.clientX - r.left) / r.width) * 100
      if (pct > 78) {
        setMaxed("left")
        return
      }
      if (pct < 22) {
        setMaxed("right")
        return
      }
      setMaxed(null)
      // gauche ∈ [25,75] % → le panneau droit (flux) peut descendre jusqu'à 25 %
      setSplit(Math.round(Math.max(25, Math.min(75, pct))))
    }
    const up = () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
    document.body.style.userSelect = "none"
  }, [])

  return {
    selectedIds,
    expandedIds,
    sort,
    rightView,
    search,
    focus,
    split,
    maxed,
    bodyRef,
    setSelectedIds,
    toggleFilter,
    toggleExpand,
    applyFocus,
    clearFocus: useCallback(() => setFocus(null), []),
    toggleSort,
    setRightView,
    setSearch,
    setMaxed,
    setSplit,
    startDrag,
  }
}
