"use client"

import { useCallback, useMemo, useState } from "react"
import { endOfDay, startOfDay } from "date-fns"
import {
  computePresetRange,
  type DateRangeValue,
  type FixedPreset,
  type PeriodPreset,
} from "@/lib/monitoring/period-presets"

/**
 * État de la période sélectionnée (local). useState plutôt qu'URL params :
 * plus robuste (pas de dépendance à Suspense/useSearchParams) et conforme au
 * pattern du Dashboard.
 */
export function usePeriodRange() {
  const [preset, setPresetState] = useState<PeriodPreset>("week")
  const [custom, setCustom] = useState<DateRangeValue | null>(null)

  const range = useMemo<DateRangeValue>(() => {
    if (preset === "custom" && custom) return custom
    const fixed: FixedPreset = preset === "custom" ? "week" : preset
    return computePresetRange(fixed, new Date())
  }, [preset, custom])

  const setPreset = useCallback((next: FixedPreset) => {
    setPresetState(next)
    setCustom(null)
  }, [])

  const setCustomRange = useCallback((from: Date, to: Date) => {
    setCustom({ from: startOfDay(from), to: endOfDay(to) })
    setPresetState("custom")
  }, [])

  return { preset, range, setPreset, setCustomRange }
}
