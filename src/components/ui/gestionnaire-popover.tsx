"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { cn } from "@/lib/utils"

export interface SelectableUser {
  id: string
  firstname?: string
  lastname?: string
  color?: string | null
  avatar_url?: string | null
  code_gestionnaire?: string
  username?: string
  status?: string
}

interface GestionnairePopoverProps {
  trigger: React.ReactNode
  users: SelectableUser[]
  currentUserId: string | null | undefined
  onSelect: (userId: string) => void
  /** Callback ouverture/fermeture — utile pour pauser un FocusTrap parent */
  onOpenChange?: (isOpen: boolean) => void
  contentClassName?: string
  triggerProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export function GestionnairePopover({
  trigger,
  users,
  currentUserId,
  onSelect,
  onOpenChange,
  contentClassName,
  triggerProps,
}: GestionnairePopoverProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const isSearching = searchQuery.trim().length > 0

  const filteredUsers = useMemo(() => {
    if (!isSearching) return users
    const q = searchQuery.toLowerCase()
    return users.filter((user) => {
      const name = [user.firstname, user.lastname].filter(Boolean).join(" ").toLowerCase()
      const code = (user.code_gestionnaire || "").toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [users, searchQuery, isSearching])

  // "Non attribué" n'apparaît que quand aucune recherche active
  const showUnassigned = !isSearching

  const handleSelect = useCallback(
    (userId: string) => {
      onSelect(userId)
      setOpen(false)
    },
    [onSelect]
  )

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    onOpenChange?.(v)
    if (!v) {
      setSearchQuery("")
    }
  }, [onOpenChange])

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const getButtons = useCallback(() =>
    listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLButtonElement>("button[data-item]"))
      : [],
    []
  )

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      getButtons()[0]?.focus()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }, [getButtons])

  const handleItemKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    itemIndex: number,
    onEnter: () => void
  ) => {
    e.stopPropagation()
    const buttons = getButtons()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      buttons[itemIndex + 1]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (itemIndex === 0) {
        inputRef.current?.focus()
      } else {
        buttons[itemIndex - 1]?.focus()
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      onEnter()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }, [getButtons])

  // Index des boutons dans le DOM : 0 = Non attribué (si visible), puis utilisateurs
  let buttonIndex = 0

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" {...triggerProps}>
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-64 p-2 z-[100]", contentClassName)}
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Attribuer à</p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-7 h-7 text-xs"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleInputKeyDown}
            />
          </div>
          <div ref={listRef} className="space-y-0.5 max-h-56 overflow-y-auto">
            {/* "Non attribué" — masqué pendant la recherche */}
            {showUnassigned && (() => {
              const idx = buttonIndex++
              const isSelected = !currentUserId
              return (
                <button
                  key="__unassigned__"
                  data-item
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors outline-none focus:bg-muted focus:ring-1 focus:ring-ring",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                  )}
                  onClick={(e) => { e.stopPropagation(); handleSelect("") }}
                  onKeyDown={(e) => handleItemKeyDown(e, idx, () => handleSelect(""))}
                >
                  <GestionnaireBadge firstname="?" color="#9ca3af" size="sm" showBorder={false} />
                  <span className="text-xs truncate flex-1 italic text-muted-foreground">Non attribué</span>
                </button>
              )
            })()}

            {/* Liste utilisateurs */}
            {filteredUsers.map((user) => {
              const idx = buttonIndex++
              const isSelected = user.id === currentUserId
              const isArchived = "status" in user && user.status === "archived"
              const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username || ""
              const label = user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName
              return (
                <button
                  key={user.id}
                  data-item
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors outline-none focus:bg-muted focus:ring-1 focus:ring-ring",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                    isArchived && "opacity-60"
                  )}
                  onClick={(e) => { e.stopPropagation(); handleSelect(user.id) }}
                  onKeyDown={(e) => handleItemKeyDown(e, idx, () => handleSelect(user.id))}
                >
                  <GestionnaireBadge
                    firstname={user.firstname}
                    lastname={user.lastname}
                    color={user.color}
                    avatarUrl={user.avatar_url}
                    size="sm"
                    showBorder={false}
                  />
                  <span className="text-xs truncate flex-1">{label}</span>
                </button>
              )
            })}

            {filteredUsers.length === 0 && isSearching && (
              <p className="text-xs text-muted-foreground px-2 py-1">Aucun résultat</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
