"use client"

import { Controller, type Control } from "react-hook-form"
import { ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getReadableTextColor } from "@/utils/color"

export type MetierOption = {
  id: string
  label: string
  color: string | null
}

type Props = {
  control: Control<any>
  name?: string
  options: MetierOption[]
  required?: boolean
  showRequiredIndicator?: boolean
}

export function MetiersPicker({
  control,
  name = "metiers",
  options,
  required = false,
  showRequiredIndicator = false,
}: Props) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required }}
      render={({ field }) => {
        const selected: string[] = field.value ?? []
        const isFieldEmpty = showRequiredIndicator && selected.length === 0

        const toggleMetier = (id: string) => {
          const next = new Set(selected)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          field.onChange(Array.from(next))
        }

        const selectedLabels = options.filter((option) => selected.includes(option.id))

        return (
          <div className="space-y-1.5">
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-between h-8 text-sm bg-background border-border/80 hover:bg-muted/50",
                      isFieldEmpty && "border-orange-400 focus-visible:ring-orange-400"
                    )}
                  >
                    <span className="truncate text-foreground">
                      {selected.length > 0
                        ? `${selected.length} métier${selected.length > 1 ? "s" : ""}`
                        : "Sélectionner"}
                    </span>
                    <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto bg-popover border-border p-1">
                  {options.length ? (
                    options.map((option) => {
                      const isSelected = selected.includes(option.id)
                      const bgColor = option.color || "#6b7280"
                      const textColor = getReadableTextColor(bgColor)
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors mb-0.5 cursor-pointer",
                            isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:bg-accent/50"
                          )}
                          onClick={() => toggleMetier(option.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              toggleMetier(option.id)
                            }
                          }}
                          tabIndex={0}
                          role="menuitemcheckbox"
                          aria-checked={isSelected}
                        >
                          <span
                            className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold min-w-[80px]"
                            style={{ backgroundColor: bgColor, color: textColor }}
                          >
                            {option.label}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground px-2 py-1.5">
                      Aucun métier
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {isFieldEmpty && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire" />
              )}
            </div>

            {selectedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedLabels.map((option) => {
                  const bgColor = option.color || "#6b7280"
                  const textColor = getReadableTextColor(bgColor)
                  return (
                    <Badge
                      key={option.id}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 h-auto border-0 font-semibold"
                      style={{ backgroundColor: bgColor, color: textColor }}
                    >
                      {option.label}
                      <button
                        type="button"
                        className="ml-1 focus:outline-none opacity-70 hover:opacity-100"
                        style={{ color: textColor }}
                        onClick={() => toggleMetier(option.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
