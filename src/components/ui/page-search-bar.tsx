"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Active le raccourci Cmd/Ctrl+F pour focus la barre de recherche */
  enableShortcut?: boolean
  /** ID unique pour éviter les conflits entre plusieurs instances */
  shortcutId?: string
  className?: string
}

export function PageSearchBar({
  value,
  onChange,
  placeholder = "Rechercher...",
  enableShortcut = true,
  shortcutId = "default",
  className,
}: PageSearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Détection du système d'exploitation pour le raccourci
  const isMac = React.useMemo(() => {
    if (typeof navigator === "undefined") return false
    return navigator.platform.toUpperCase().includes("MAC")
  }, [])

  // Raccourci Cmd/Ctrl+F pour focus
  React.useEffect(() => {
    if (!enableShortcut) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey
      if (modifier && (e.key === "f" || e.key === "F")) {
        e.preventDefault()
        setIsExpanded(true)
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enableShortcut, isMac])

  // Fermer quand on clique en dehors
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !value
      ) {
        setIsExpanded(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value])

  const handleClear = React.useCallback(() => {
    onChange("")
    inputRef.current?.focus()
  }, [onChange])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (value) {
          onChange("")
        } else {
          setIsExpanded(false)
          inputRef.current?.blur()
        }
      }
    },
    [value, onChange]
  )

  const handleIconClick = React.useCallback(() => {
    setIsExpanded(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  // L'input est toujours étendu quand il y a une valeur ou qu'il est focus
  const showExpanded = isExpanded || isFocused || value.length > 0

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center", className)}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIconClick}
        className="shrink-0"
        aria-label="Rechercher"
      >
        <Search className="h-4 w-4" />
      </Button>
      
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          showExpanded ? "w-[220px] opacity-100 ml-1" : "w-0 opacity-0 ml-0"
        )}
      >
        <div className="relative">
          <Input
            ref={inputRef}
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className="h-10 w-full rounded-full border-0 bg-transparent pl-4 pr-10 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 shadow-[inset_1px_2px_6px_rgba(5,5,5,0.55)] transition-[box-shadow,background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white dark:placeholder:text-white/60"
          />
          {value && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-muted"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Indicateur raccourci clavier */}
      {enableShortcut && !showExpanded && (
        <div className="ml-2 hidden md:flex items-center gap-0.5 text-xs text-muted-foreground">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {isMac ? "⌘" : "Ctrl"}
          </kbd>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            F
          </kbd>
        </div>
      )}
    </div>
  )
}

