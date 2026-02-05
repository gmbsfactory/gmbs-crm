"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Bell, Calendar, FileText, Plus, X } from "lucide-react"
import { AvatarStatus } from "@/components/layout/avatar-status"
import { usePathname } from "next/navigation"
import Link from "next/link"
import useModal from "@/hooks/useModal"
import { useInterventionReminders } from "@/hooks/useInterventionReminders"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { normalizeReminderIdentifier } from "@/contexts/RemindersContext"
import { useUniversalSearch } from "@/hooks/useUniversalSearch"
import { UniversalSearchResults } from "@/components/search/UniversalSearchResults"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useInterface } from "@/contexts/interface-context"
import { t } from "@/config/domain"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { setPathname } from "@/lib/navigation-tracker"
import { usePermissions } from "@/hooks/usePermissions"
import { usePlatformKey } from "@/hooks/usePlatformKey"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { buildNavigation, type NavItem } from "@/config/navigation"

type ReminderFilter = "all" | "my_reminders" | "mentions"

type DisplayReminder = {
  reminderId: string
  interventionId: string
  note: string | null
  dueDate: string | null
  mentionedUserIds: string[]
  ownerId: string | null
  ownerName: string
  ownerEmail?: string | null
  createdAt: string | null
  isLegacy: boolean
  legacyMentions: string[]
}

export default function Topbar() {
  const pathname = usePathname()
  const { open: openModal } = useModal()
  const artisanModal = useArtisanModal()
  const { sidebarEnabled } = useInterface()
  const [logoHovered, setLogoHovered] = React.useState(false)
  const { data: currentUser } = useCurrentUser()
  const { modifierSymbol, isModifierPressed } = usePlatformKey()
  const { can, canAccessPage } = usePermissions()

  const canReadInterventions = can("read_interventions")
  const canReadArtisans = can("read_artisans")
  const canWriteInterventions = can("write_interventions")
  const canWriteArtisans = can("write_artisans")

  const navigation = buildNavigation(can, canAccessPage)
  const {
    reminders,
    reminderRecords,
    reminderNotes,
    reminderMentions,
    reminderDueDates,
    refreshReminders,
    removeReminder,
  } = useInterventionReminders()
  const [reminderFilter, setReminderFilter] = React.useState<ReminderFilter>("all")
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [currentUserIdentifiers, setCurrentUserIdentifiers] = React.useState<string[]>([])
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Tracker les changements de navigation pour permettre le rechargement automatique
  React.useEffect(() => {
    if (pathname) {
      setPathname(pathname)
    }
  }, [pathname])

  React.useEffect(() => {
    refreshReminders()
  }, [refreshReminders])

  const allReminders = React.useMemo<DisplayReminder[]>(() => {
    const remote = Array.from(reminderRecords.entries()).map(([interventionId, reminder]) => {
      const ownerNameParts = [reminder.user?.firstname, reminder.user?.lastname].filter(Boolean)
      const ownerName = ownerNameParts.length > 0
        ? ownerNameParts.join(" ")
        : reminder.user?.email ?? "Utilisateur"

      return {
        reminderId: reminder.id,
        interventionId,
        note: reminder.note ?? null,
        dueDate: reminder.due_date ?? null,
        mentionedUserIds: reminder.mentioned_user_ids ?? [],
        ownerId: reminder.user_id ?? null,
        ownerName,
        ownerEmail: reminder.user?.email ?? null,
        createdAt: reminder.created_at ?? null,
        isLegacy: false,
        legacyMentions: [],
      } satisfies DisplayReminder
    })

    const legacy = Array.from(reminders)
      .filter((interventionId) => !reminderRecords.has(interventionId))
      .map((interventionId) => {
        return {
          reminderId: `legacy-${interventionId}`,
          interventionId,
          note: reminderNotes.get(interventionId) ?? null,
          dueDate: reminderDueDates.get(interventionId) ?? null,
          mentionedUserIds: [],
          ownerId: currentUserId,
          ownerName: "Vous",
          ownerEmail: undefined,
          createdAt: null,
          isLegacy: true,
          legacyMentions: reminderMentions.get(interventionId) ?? [],
        } satisfies DisplayReminder
      })

    const combined = [...remote, ...legacy]
    combined.sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
      return bTime - aTime
    })
    return combined
  }, [reminderRecords, reminders, reminderNotes, reminderDueDates, reminderMentions, currentUserId])

  const allRemindersCount = allReminders.length

  const myRemindersCount = React.useMemo(() => {
    return allReminders.filter((reminder) => {
      if (reminder.isLegacy) return true
      if (!currentUserId) return false
      return reminder.ownerId === currentUserId
    }).length
  }, [allReminders, currentUserId])

  const mentionsCount = React.useMemo(() => {
    return allReminders.filter((reminder) => {
      if (reminder.isLegacy) {
        if (currentUserIdentifiers.length === 0) return false
        return reminder.legacyMentions.some((mention) => currentUserIdentifiers.includes(mention))
      }
      if (!currentUserId) return false
      return reminder.mentionedUserIds.includes(currentUserId) && reminder.ownerId !== currentUserId
    }).length
  }, [allReminders, currentUserId, currentUserIdentifiers])

  const filteredReminders = React.useMemo(() => {
    switch (reminderFilter) {
      case "my_reminders":
        return allReminders.filter((reminder) => {
          if (reminder.isLegacy) return true
          if (!currentUserId) return false
          return reminder.ownerId === currentUserId
        })
      case "mentions":
        return allReminders.filter((reminder) => {
          if (reminder.isLegacy) {
            if (currentUserIdentifiers.length === 0) return false
            return reminder.legacyMentions.some((mention) => currentUserIdentifiers.includes(mention))
          }
          if (!currentUserId) return false
          return reminder.mentionedUserIds.includes(currentUserId) && reminder.ownerId !== currentUserId
        })
      default:
        return allReminders
    }
  }, [allReminders, reminderFilter, currentUserId, currentUserIdentifiers])

  const openEntityModal = React.useCallback(
    (id: string, type: "intervention" | "artisan") => {
      openModal(id, { content: type })
    },
    [openModal],
  )

  const handleOpenReminder = React.useCallback(
    (interventionId: string) => {
      openEntityModal(interventionId, "intervention")
    },
    [openEntityModal],
  )

  const handleDeleteReminder = React.useCallback(
    async (interventionId: string) => {
      await removeReminder(interventionId)
      await refreshReminders()
    },
    [refreshReminders, removeReminder],
  )

  // Page title from route
  const title = React.useMemo(() => {
    if (!pathname) return ""
    const seg = pathname.split("/").filter(Boolean)[0] || "dashboard"
    const map: Record<string, string> = {
      dashboard: "Dashboard",
      interventions: "Interventions",
      artisans: "Artisans",
      settings: "Settings",
    }
    return map[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
  }, [pathname])
  // Synchroniser les identifiers de rappel avec useCurrentUser (au lieu d'un fetch direct)
  React.useEffect(() => {
    if (!currentUser) {
      setCurrentUserId(null)
      setCurrentUserIdentifiers([])
      return
    }
    
    const identifiers = new Set<string>()
    if (currentUser.code_gestionnaire) {
      identifiers.add(normalizeReminderIdentifier(currentUser.code_gestionnaire))
    }
    if (currentUser.username) {
      identifiers.add(normalizeReminderIdentifier(currentUser.username))
    }
    if (currentUser.email) {
      const local = String(currentUser.email).split("@")[0]
      if (local) {
        identifiers.add(normalizeReminderIdentifier(local))
      }
    }
    setCurrentUserId(currentUser.id ?? null)
    setCurrentUserIdentifiers(Array.from(identifiers))
  }, [currentUser])

  // Show New Intervention button on Interventions page
  const isInterventions = pathname?.startsWith("/interventions")
  const showNewInterventionBtn = isInterventions && canWriteInterventions
  
  // Show New Artisan button on Artisans page
  const isArtisans = pathname?.startsWith("/artisans")
  const showNewArtisanBtn = isArtisans && canWriteArtisans

  // Show dashboard navigation buttons on Dashboard page
  const isDashboard = pathname === "/dashboard"

  // Search reveal on hover; pin on click
  const [searchPinned, setSearchPinned] = React.useState(false)
  const [searchHovering, setSearchHovering] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null)
  const [resultsVisible, setResultsVisible] = React.useState(false)
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: universalResults,
    isSearching: isUniversalSearching,
    error: universalSearchError,
    clearSearch,
    loadMore: loadMoreResults,
    isLoadingMore: isLoadingMoreResults,
  } = useUniversalSearch()
  const searchOpen = searchPinned || searchHovering
  const trimmedSearchQuery = React.useMemo(() => searchQuery.trim(), [searchQuery])
  const shouldShowDropdown =
    searchOpen &&
    resultsVisible &&
    (trimmedSearchQuery.length >= 2 ||
      isUniversalSearching ||
      Boolean(universalResults) ||
      Boolean(universalSearchError))

  const handleSearchInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setSearchQuery(value)
      // Dès qu'on tape, on épingle la recherche pour qu'elle reste dépliée
      setSearchPinned(true)
      setSearchHovering(true)
      if (value.trim().length >= 2) {
        setResultsVisible(true)
      } else {
        setResultsVisible(false)
      }
    },
    [setSearchQuery],
  )

  const handleSearchFocus = React.useCallback(() => {
    // Épingler à la mise au focus pour garder l'entrée ouverte pendant la saisie
    setSearchPinned(true)
    setSearchHovering(true)
    if (trimmedSearchQuery.length >= 2) {
      setResultsVisible(true)
    }
  }, [trimmedSearchQuery])

  const onSearchIconClick = React.useCallback(() => {
    setSearchPinned((pinned) => {
      const next = !pinned
      if (next) {
        setSearchHovering(true)
        if (trimmedSearchQuery.length >= 2) {
          setResultsVisible(true)
        }
        requestAnimationFrame(() => searchInputRef.current?.focus())
      } else {
        setResultsVisible(false)
        clearSearch()
      }
      return next
    })
  }, [clearSearch, trimmedSearchQuery])

  const onSearchBlur = React.useCallback(() => {
    if (!searchPinned) setSearchHovering(false)
  }, [searchPinned])

  const onEsc = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        clearSearch()
        setResultsVisible(false)
        if (searchPinned) setSearchPinned(false)
        setSearchHovering(false)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [clearSearch, searchPinned],
  )

  React.useEffect(() => {
    if (!searchOpen) {
      setResultsVisible(false)
    }
  }, [searchOpen])

  React.useEffect(() => {
    if (trimmedSearchQuery.length >= 2 && searchOpen) {
      setResultsVisible(true)
    }
  }, [trimmedSearchQuery, searchOpen])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!searchContainerRef.current) return
      if (searchContainerRef.current.contains(event.target as Node)) return
      // Fermer complètement la recherche au clic extérieur
      setResultsVisible(false)
      setSearchPinned(false)
      setSearchHovering(false)
      clearSearch()
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [clearSearch])

  // Cmd/Ctrl+K opens extended search and focuses input
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModifierPressed(e) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setSearchPinned(true)
        setSearchHovering(true)
        if (trimmedSearchQuery.length >= 2) {
          setResultsVisible(true)
        }
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [trimmedSearchQuery, isModifierPressed])

  const handleSearchItemClick = React.useCallback(
    (id: string, type: "artisan" | "intervention") => {
      // Close search dropdown
      setResultsVisible(false)
      setSearchPinned(false)
      setSearchHovering(false)
      clearSearch()

      openEntityModal(id, type)
    },
    [clearSearch, openEntityModal],
  )

  const handleCloseSearch = React.useCallback(() => {
    setResultsVisible(false)
    setSearchPinned(false)
    setSearchHovering(false)
    clearSearch()
  }, [clearSearch])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 liquid-glass-topbar-blue">
      <div className="flex h-16 items-center px-4 relative">
        {/* Left: Logo + boutons d'ajout */}
        <div className="flex items-center gap-2">
          <div 
            className="relative flex items-center"
            onMouseEnter={() => !sidebarEnabled && setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
          >
            <Link href="/dashboard" className="cursor-pointer">
              <div className="relative w-[100px] h-[100px] z-[60] -bottom-4">
                <Image
                  src="/gmbs-logo.svg"
                  alt="GMBS Logo"
                  width={100}
                  height={100}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            {/* Menu de navigation au hover quand sidebar désactivée */}
            <AnimatePresence>
              {!sidebarEnabled && logoHovered && (
                <motion.div 
                  className="fixed top-16 left-4 mt-2 w-[75px] z-[70]"
                  initial={{ opacity: 0, scale: 0.8, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    duration: 0.3
                  }}
                  onMouseEnter={() => setLogoHovered(true)}
                  onMouseLeave={() => setLogoHovered(false)}
                >
                  <nav className="flex flex-col space-y-1 py-4">
                    {navigation.map((item, idx) => {
                      if (item.type === "spacer") {
                        return <div key={`sp-${idx}`} className="h-0" aria-hidden="true" />
                      }
                      const isActive = pathname === item.href
                      const Icon = item.icon
                      return (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{
                            delay: idx * 0.05,
                            type: "spring",
                            stiffness: 300,
                            damping: 25
                          }}
                        >
                          <Link 
                            href={item.href} 
                            className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                            onClick={() => setLogoHovered(false)}
                          >
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                              <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                  "w-full justify-center",
                                  isActive && "bg-secondary"
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                              </Button>
                            </motion.div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {showNewInterventionBtn ? (
            <Button
              size="sm"
              onClick={() => openModal("new", { content: "new-intervention" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle intervention
            </Button>
          ) : null}
          {showNewArtisanBtn ? (
            <Button
              size="sm"
              onClick={() => artisanModal.openNew()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvel artisan
            </Button>
          ) : null}
          {isDashboard ? (
            <>
              {canReadInterventions && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Button size="sm" asChild>
                      <Link href="/interventions">Voir les {t("deals")}</Link>
                    </Button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {canWriteInterventions && (
                      <ContextMenuItem onClick={() => openModal("new", { content: "new-intervention" })} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nouvelle intervention
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              )}
              {canReadArtisans && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/artisans">Voir les {t("contacts")}</Link>
                    </Button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {canWriteArtisans && (
                      <ContextMenuItem onClick={() => artisanModal.openNew()} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nouvel artisan
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              )}
            </>
          ) : null}
        </div>

        {/* Center: Titre centré */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <div className="text-2xl font-semibold tracking-tight select-none">{title}</div>
        </div>

        {/* Right: search (hover reveal) + notifications + avatar */}
        <div className="flex items-center gap-3 ml-auto">
          <div
            ref={searchContainerRef}
            className="relative flex items-center"
            onMouseEnter={() => setSearchHovering(true)}
            onMouseLeave={() => !searchPinned && setSearchHovering(false)}
          >
            <Button variant="ghost" size="icon" onClick={onSearchIconClick} aria-label={`Rechercher (${modifierSymbol}K)`}>
              <Search className="h-4 w-4" />
            </Button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                searchOpen ? "w-[190px] opacity-100 ml-1" : "w-0 opacity-0 ml-0",
              )}
            >
              <Input
                autoComplete="off"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={handleSearchFocus}
                onBlur={onSearchBlur}
                onKeyDown={onEsc}
                aria-expanded={shouldShowDropdown}
                ref={searchInputRef}
                className="h-10 w-full rounded-full border-0 bg-transparent px-5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 shadow-[inset_1px_2px_6px_rgba(5,5,5,0.55)] transition-[box-shadow,background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white dark:placeholder:text-white/60"
              />
            </div>
            {/* Indicateur raccourci clavier ⌘K ou Ctrl+K */}
            {!searchOpen && (
              <div className="ml-1 hidden md:flex items-center gap-0.5 text-xs text-muted-foreground">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {modifierSymbol}
                </kbd>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  K
                </kbd>
              </div>
            )}
            {shouldShowDropdown ? (
              <UniversalSearchResults
                results={universalResults}
                isSearching={isUniversalSearching}
                error={universalSearchError}
                query={searchQuery}
                onItemClick={handleSearchItemClick}
                onClose={handleCloseSearch}
                onLoadMore={loadMoreResults}
                isLoadingMore={isLoadingMoreResults}
              />
            ) : null}
          </div>
          {isMounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {allRemindersCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                      {allRemindersCount > 99 ? "99+" : allRemindersCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96">
              <div className="flex gap-1 border-b p-2">
                <Button
                  variant={reminderFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setReminderFilter("all")}
                >
                  Tous ({allRemindersCount})
                </Button>
                <Button
                  variant={reminderFilter === "my_reminders" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setReminderFilter("my_reminders")}
                >
                  Mes rappels ({myRemindersCount})
                </Button>
                <Button
                  variant={reminderFilter === "mentions" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setReminderFilter("mentions")}
                >
                  Mentions ({mentionsCount})
                </Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {filteredReminders.map((reminder) => {
                  const shortId = reminder.interventionId.slice(0, 8)
                  const mentionCount = reminder.isLegacy
                    ? reminder.legacyMentions.length
                    : reminder.mentionedUserIds.length
                  const isMention = reminder.isLegacy
                    ? reminder.legacyMentions.some((mention) => currentUserIdentifiers.includes(mention))
                    : currentUserId
                      ? reminder.mentionedUserIds.includes(currentUserId) && reminder.ownerId !== currentUserId
                      : false
                  const dueDateLabel = reminder.dueDate
                    ? new Date(reminder.dueDate).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : null

                  return (
                    <div
                      key={reminder.reminderId}
                      className={cn(
                        "cursor-pointer border-b p-3 transition-colors hover:bg-muted/50",
                        isMention && "bg-primary/5",
                      )}
                      onClick={() => handleOpenReminder(reminder.interventionId)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                            <span>Intervention #{shortId}</span>
                            {isMention && (
                              <Badge
                                variant="outline"
                                className="px-2 py-0 text-[10px] font-medium uppercase tracking-wide text-primary border-primary/40 bg-primary/10"
                              >
                                Mention
                              </Badge>
                            )}
                          </div>
                          {reminder.note && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span className="line-clamp-2 break-words">{reminder.note}</span>
                            </div>
                          )}
                          {dueDateLabel && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{dueDateLabel}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Par {reminder.ownerName}</span>
                            {mentionCount > 0 && <span>• {mentionCount} mention(s)</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDeleteReminder(reminder.interventionId)
                          }}
                          aria-label="Supprimer le rappel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {filteredReminders.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Aucun rappel
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative" disabled>
              <Bell className="h-4 w-4" />
            </Button>
          )}
          {isMounted ? <AvatarStatus /> : (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}
