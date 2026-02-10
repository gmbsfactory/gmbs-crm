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
    const popoverContentRef = React.useRef<HTMLDivElement>(null)
    const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined)
    const isSelectingRef = React.useRef(false)

    React.useEffect(() => {
        if (open && triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth)
        }
    }, [open])

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item))
    }

    const handleSelect = React.useCallback((optionValue: string) => {
        console.log("handleSelect called", optionValue)
        isSelectingRef.current = true
        onChange(
            selected.includes(optionValue)
                ? selected.filter((item) => item !== optionValue)
                : [...selected, optionValue]
        )
        // Réinitialiser le flag après un court délai pour permettre la mise à jour
        // Utiliser requestAnimationFrame pour s'assurer que le state est mis à jour
        setTimeout(() => {
            isSelectingRef.current = false
        }, 100)
    }, [selected, onChange])

    const handleOpenChange = React.useCallback((newOpen: boolean) => {
        console.log("handleOpenChange called", { newOpen, isSelecting: isSelectingRef.current })
        // Empêcher la fermeture si on est en train de sélectionner
        // Cela empêche cmdk de fermer automatiquement le popover lors de la sélection
        if (!newOpen && isSelectingRef.current) {
            console.log("Preventing close because selecting")
            return
        }
        setOpen(newOpen)
    }, [])

    return (
        <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
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
                ref={popoverContentRef}
                className="p-1 z-[10000]" 
                align="start"
                side="bottom"
                style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement
                    // Empêcher la fermeture si on clique sur le trigger
                    if (triggerRef.current?.contains(target)) {
                        e.preventDefault()
                        return
                    }
                    // Permettre la fermeture normale pour les autres clics extérieurs
                    // Ne pas bloquer les interactions à l'intérieur du popover
                }}
            >
                <div className="max-h-64 overflow-auto">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            role="option"
                            aria-selected={selected.includes(option.value)}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                console.log("Simple div onClick triggered", option.value)
                                handleSelect(option.value)
                            }}
                            onMouseDown={(e) => {
                                console.log("Simple div onMouseDown triggered", option.value)
                            }}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--glass-bg-light)] hover:text-foreground",
                                selected.includes(option.value) && "bg-[var(--glass-bg-medium)] text-foreground"
                            )}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {option.label}
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
