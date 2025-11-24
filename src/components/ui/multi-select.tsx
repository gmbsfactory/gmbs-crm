"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export type Option = {
    label: string
    value: string
}

interface MultiSelectProps {
    options: Option[]
    selected: string[]
    onChange: (selected: string[]) => void
    placeholder?: string
    className?: string
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Sélectionner...",
    className,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined)

    React.useEffect(() => {
        if (open && triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth)
        }
    }, [open])

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item))
    }

    const handleSelect = (optionValue: string) => {
        onChange(
            selected.includes(optionValue)
                ? selected.filter((item) => item !== optionValue)
                : [...selected, optionValue]
        )
        // Ne pas fermer le popover pour permettre la sélection multiple
    }

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-auto min-h-10", className)}
                    type="button"
                    onClick={() => setOpen(!open)}
                >
                    <div className="flex flex-wrap gap-1">
                        {selected.length === 0 && <span className="text-muted-foreground font-normal">{placeholder}</span>}
                        {selected.map((item) => (
                            <Badge
                                variant="secondary"
                                key={item}
                                className="mr-1 mb-1"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnselect(item)
                                }}
                            >
                                {options.find((option) => option.value === item)?.label || item}
                                <button
                                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleUnselect(item)
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleUnselect(item)
                                    }}
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="p-0 z-[10000]" 
                align="start"
                side="bottom"
                style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
                onInteractOutside={(e) => {
                    // Empêcher la fermeture si on clique sur le trigger
                    const target = e.target as HTMLElement
                    if (triggerRef.current?.contains(target)) {
                        e.preventDefault()
                    }
                }}
            >
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Rechercher..." />
                    <CommandEmpty>Aucun résultat.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                        {options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={option.value}
                                onSelect={(currentValue) => {
                                    // Empêcher la fermeture automatique
                                    handleSelect(option.value)
                                }}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleSelect(option.value)
                                }}
                                className="cursor-pointer"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {option.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
