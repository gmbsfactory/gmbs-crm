"use client"

import * as React from "react"
import { Check, Search } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { getReadableTextColor } from "@/utils/color"

export interface SearchableBadgeOption {
  id: string
  label: string
  color?: string | null
}

export interface SearchableBadgeSelectProps {
  label: string
  value: string
  options: SearchableBadgeOption[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  minWidth?: string
  hideLabel?: boolean
  searchPlaceholder?: string
  emptyText?: string
  onOpenChange?: (open: boolean) => void
  sortAlphabetically?: boolean
  /** Field name for presence tracking (renders data-presence-field on root) */
  presenceFieldName?: string
}

export function SearchableBadgeSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Sélectionner",
  required,
  minWidth = "70px",
  hideLabel = false,
  searchPlaceholder = "Rechercher...",
  emptyText = "Aucun résultat",
  onOpenChange,
  sortAlphabetically = true,
  presenceFieldName,
}: SearchableBadgeSelectProps) {
  const [open, setOpen] = React.useState(false)

  // Notifier le parent du changement d'état d'ouverture pour gérer le focus trap
  React.useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const [search, setSearch] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Trier les options par ordre alphabétique seulement si demandé
  const processedOptions = React.useMemo(() => {
    if (!sortAlphabetically) return options
    return [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  }, [options, sortAlphabetically])

  // Filtrer les options selon la recherche
  const filteredOptions = React.useMemo(() => {
    if (!search) return processedOptions
    return processedOptions.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    )
  }, [processedOptions, search])

  const selectedOption = options.find((o) => o.id === value)
  const selectedColor = selectedOption?.color || "#6b7280"
  const selectedLabel = selectedOption?.label || placeholder

  // Réinitialiser la recherche quand le popover se ferme et focus l'input
  React.useEffect(() => {
    if (open) {
      // Focus l'input quand le popover s'ouvre
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setSearch("")
    }
  }, [open])

  return (
    <div className="flex flex-col gap-0.5" data-presence-field={presenceFieldName}>
      {!hideLabel && (
        <Label className="text-[10px] text-muted-foreground leading-none">
          {label}
          {required && " *"}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls="badge-select-listbox"
            className="inline-flex items-center justify-center rounded-full h-7 px-3 text-xs font-semibold transition-all hover:scale-105 hover:shadow-md cursor-pointer truncate"
            style={{
              backgroundColor: selectedColor,
              color: getReadableTextColor(selectedColor),
              minWidth: minWidth,
              maxWidth: "100%",
            }}
          >
            {selectedLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement
            if (target.closest('[role="combobox"]')) {
              e.preventDefault()
            }
          }}
        >
          {/* Barre de recherche */}
          <div className="flex items-center border-b px-3 py-2 relative z-50">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground relative z-50"
              style={{ pointerEvents: 'auto' }}
            />
          </div>

          {/* Liste des options */}
          <div id="badge-select-listbox" role="listbox" className="max-h-[300px] overflow-y-auto p-2">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.id === value
                const optionColor = option.color || "#6b7280"
                const textColor = getReadableTextColor(optionColor)

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setOpen(false)
                    }}
                    className="w-full mb-1 last:mb-0"
                  >
                    <div
                      className="flex items-center justify-between w-full rounded-full px-3 py-1.5 transition-all hover:scale-105 cursor-pointer"
                      style={{
                        backgroundColor: optionColor,
                        color: textColor,
                      }}
                    >
                      <span className="truncate flex-1 text-left font-medium text-xs">
                        {option.label}
                      </span>
                      {isSelected && (
                        <Check className="ml-2 h-3 w-3 shrink-0" style={{ color: textColor }} />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}