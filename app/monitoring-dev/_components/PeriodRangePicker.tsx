"use client"

import { DateRangePicker, type DateRange } from "@/components/interventions/DateRangePicker"
import { cn } from "@/lib/utils"
import { PERIOD_PRESETS, type FixedPreset, type PeriodPreset } from "@/lib/monitoring/period-presets"

interface PeriodRangePickerProps {
  preset: PeriodPreset
  from: Date
  to: Date
  onPreset: (preset: FixedPreset) => void
  onCustom: (from: Date, to: Date) => void
}

/** Presets rapides + sélecteur de plage libre. */
export function PeriodRangePicker({ preset, from, to, onPreset, onCustom }: PeriodRangePickerProps) {
  const value: DateRange = { from, to }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIOD_PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onPreset(p.value)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            preset === p.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}
      <DateRangePicker
        value={value}
        onChange={(next) => {
          if (next.from && next.to) onCustom(next.from, next.to)
        }}
        className={cn("h-8 text-xs", preset === "custom" && "border-primary text-foreground")}
      />
    </div>
  )
}
