/**
 * Presets de période pour le Monitoring DEV. Logique pure (prend `now` en
 * paramètre) → testable sans mock d'horloge. Placé dans src/lib pour être
 * importable via @/ depuis les pages, composants et hooks (la règle ESLint
 * interdit les imports cross-dossier relatifs).
 */
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns"
import { fr } from "date-fns/locale"

export type FixedPreset =
  | "today"
  | "yesterday"
  | "week"
  | "last7"
  | "month"
  | "last30"

export type PeriodPreset = FixedPreset | "custom"

export interface DateRangeValue {
  from: Date
  to: Date
}

export const PERIOD_PRESETS: { value: FixedPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Cette semaine" },
  { value: "last7", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "last30", label: "30 derniers jours" },
]

/** Calcule la plage [from, to] (bornes inclusives) d'un preset à l'instant `now`. */
export function computePresetRange(preset: FixedPreset, now: Date): DateRangeValue {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) }
    case "yesterday": {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case "week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
  }
}

/** Libellé lisible d'une plage (ex. "1 juin 2026 — 30 juin 2026"). */
export function formatRangeLabel(range: DateRangeValue): string {
  const f = (d: Date) => format(d, "d MMM yyyy", { locale: fr })
  return `${f(range.from)} — ${f(range.to)}`
}
