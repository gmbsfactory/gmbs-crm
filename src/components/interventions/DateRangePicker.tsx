"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type DateRange = { from: Date | null; to: Date | null }

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange
  onChange: (next: DateRange) => void
  className?: string
}) {
  const label = React.useMemo(() => {
    const { from, to } = value
    if (from && to) return `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`
    if (from) return `${format(from, "dd/MM/yyyy")} – …`
    if (to) return `… – ${format(to, "dd/MM/yyyy")}`
    return "Filtrer par dates"
  }, [value])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date-range"
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-10 transition-[opacity,transform,shadow] duration-150 ease-out",
            !value?.from && !value?.to && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[680px] p-4 shadow-lg rounded-2xl border transition-[opacity,transform,shadow] duration-150 ease-out" 
        align="start"
        data-range-complete={value.from !== null && value.to !== null}
      >
        <Calendar
          mode="range"
          selected={{ from: value.from ?? undefined, to: value.to ?? undefined }}
          onSelect={(range) => onChange({ from: range?.from ?? null, to: range?.to ?? null })}
          numberOfMonths={2}
          locale={fr}
          className="mx-auto"
          classNames={{
            months: "flex flex-row gap-8",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-base font-semibold",
            nav: "space-x-1 flex items-center",
            nav_button: "h-8 w-8 rounded-md text-foreground/70 hover:bg-muted p-0",
            nav_button_previous: "absolute -left-1",
            nav_button_next: "absolute -right-1",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-foreground font-semibold rounded-md w-10 text-[0.85rem]",
            row: "flex w-full mt-2",
            cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: cn(
              "h-10 w-10 p-0 font-medium aria-selected:opacity-100",
              "transition-all duration-200 ease-out"
            ),
            // Style shadcn/ui amélioré pour les plages de dates
            range_start: "bg-primary text-primary-foreground rounded-l-md font-bold shadow-md",
            range_middle: "bg-primary/35 text-primary-foreground rounded-none",
            range_end: "bg-primary text-primary-foreground rounded-r-md font-bold shadow-md",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold shadow-lg",
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "text-muted-foreground opacity-40",
            day_disabled: "text-muted-foreground opacity-40",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
