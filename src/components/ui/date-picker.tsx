"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
  date: Date | null;
  onDateChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  popoverContainer?: HTMLElement | null;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Sélectionner une date...",
  disabled = false,
  clearable = true,
  className,
  popoverContainer,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (!date) return placeholder;
    return format(date, "dd MMMM yyyy", { locale: fr });
  }, [date, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {label}
          </span>
          {date && clearable ? (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onDateChange(null);
                setOpen(false);
              }}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" container={popoverContainer}>
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={(selectedDate) => {
            onDateChange(selectedDate ?? null);
            if (selectedDate) {
              setOpen(false);
            }
          }}
          initialFocus
          locale={fr}
          classNames={{
            month: "space-y-4",
            caption_label: "text-sm font-medium",
            nav_button: "h-8 w-8 rounded-md text-foreground/70 hover:bg-muted p-0",
            table: "w-full border-collapse",
            head_cell: "text-foreground font-semibold w-9 text-[0.8rem]",
            row: "w-full mt-2 flex",
            cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:z-20",
            day: "h-9 w-9 p-0 font-medium aria-selected:opacity-100 transition-all duration-200",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary font-bold rounded-full shadow-lg scale-105",
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "text-muted-foreground opacity-40",
            day_disabled: "text-muted-foreground opacity-40",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
