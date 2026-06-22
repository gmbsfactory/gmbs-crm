"use client"

import { useCallback, useMemo, useState } from "react"
import type { DateRangeValue } from "@/lib/monitoring/period-presets"

export type Granularity = "day" | "week" | "month"

const midnight = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDayLocal = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
/** YYYY-MM-DD en heure locale (pas d'UTC pour éviter le décalage de jour). */
const isoDate = (d: Date): string => {
  const x = midnight(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}
const mondayOf = (d: Date): Date => {
  const t = midnight(d)
  const day = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - day)
  return t
}
const offsetDays = (d: Date): number => Math.round((midnight(new Date()).getTime() - midnight(d).getTime()) / 86_400_000)
const fmtD = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/**
 * Période du Monitoring DEV : granularité (Jour / Semaine / Mois) + ancrage
 * navigable (‹ précédent · picker natif · suivant ›, plafonné à aujourd'hui).
 * Expose un `range:{from,to}` (calé sur l'ancre, borné à aujourd'hui) consommé
 * par tous les hooks de données.
 */
export function usePeriodRange() {
  const [gran, setGran] = useState<Granularity>("day")
  const [anchor, setAnchor] = useState<string | null>(null) // null = aujourd'hui

  const anchorDate = useMemo(
    () => (anchor ? midnight(new Date(`${anchor}T00:00:00`)) : midnight(new Date())),
    [anchor]
  )

  const computed = useMemo(() => {
    const today = midnight(new Date())
    if (gran === "day") {
      const from = anchorDate
      const isToday = isoDate(from) === isoDate(today)
      const yest = new Date(today)
      yest.setDate(today.getDate() - 1)
      const isYest = isoDate(from) === isoDate(yest)
      return {
        range: { from, to: endOfDayLocal(from) } as DateRangeValue,
        label: isToday ? "aujourd'hui" : isYest ? "hier" : fmtD(from),
        pickType: "date" as const,
        pickValue: isoDate(from),
        canNext: !isToday,
      }
    }
    if (gran === "week") {
      const mon = mondayOf(anchorDate)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const end = sun > today ? today : sun
      const th = new Date(mon)
      th.setDate(mon.getDate() + 3)
      const y = th.getFullYear()
      const jan1 = new Date(y, 0, 1)
      const wk = Math.ceil(((th.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
      const atCur = isoDate(mondayOf(today)) === isoDate(mon)
      return {
        range: { from: mon, to: endOfDayLocal(end) } as DateRangeValue,
        label: `sem. ${fmtD(mon)} – ${fmtD(end)}`,
        pickType: "week" as const,
        pickValue: `${y}-W${String(wk).padStart(2, "0")}`,
        canNext: !atCur,
      }
    }
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const lastDom = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
    const end = lastDom > today ? today : lastDom
    const atCur = anchorDate.getFullYear() === today.getFullYear() && anchorDate.getMonth() === today.getMonth()
    return {
      range: { from: first, to: endOfDayLocal(end) } as DateRangeValue,
      label: anchorDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      pickType: "month" as const,
      pickValue: `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}`,
      canNext: !atCur,
    }
  }, [gran, anchorDate])

  const step = useCallback(
    (dir: number) => {
      const a = new Date(anchorDate)
      if (gran === "day") a.setDate(a.getDate() + dir)
      else if (gran === "week") a.setDate(a.getDate() + 7 * dir)
      else a.setMonth(a.getMonth() + dir)
      if (dir > 0 && offsetDays(a) < 0) return // pas au-delà d'aujourd'hui
      setAnchor(isoDate(a))
    },
    [anchorDate, gran]
  )

  const onPick = useCallback(
    (value: string) => {
      if (!value) return
      let d: Date
      if (gran === "week") {
        const m = value.match(/(\d+)-W(\d+)/)
        if (!m) return
        const simple = new Date(+m[1], 0, 1 + (+m[2] - 1) * 7)
        const dow = (simple.getDay() + 6) % 7
        d = new Date(simple)
        d.setDate(simple.getDate() - dow)
      } else if (gran === "month") {
        const m = value.match(/(\d+)-(\d+)/)
        if (!m) return
        d = new Date(+m[1], +m[2] - 1, 1)
      } else {
        d = new Date(`${value}T00:00:00`)
      }
      setAnchor(isoDate(d))
    },
    [gran]
  )

  const changeGran = useCallback((g: Granularity) => setGran(g), [])

  return {
    gran,
    range: computed.range,
    label: computed.label,
    pickType: computed.pickType,
    pickValue: computed.pickValue,
    canNext: computed.canNext,
    setGran: changeGran,
    step,
    onPick,
  }
}
