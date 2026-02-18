"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format, isThisMonth, isThisWeek, isToday, isValid, isYesterday, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Clock, Filter, History, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useArtisanHistory, type ArtisanHistoryItem } from "@/hooks/useArtisanHistory"
import { useBatchResolver } from "@/hooks/useBatchResolver"
import { HistoryEntry } from "@/components/shared/history/HistoryEntry"
import type { HistoryValueResolver } from "@/components/shared/history/types"

type DateFilter = "all" | "today" | "week" | "month"
type ActionFilter =
  | "all"
  | "creation"
  | "updates"
  | "status"
  | "metiers"
  | "zones"
  | "absences"
  | "documents"
  | "comments"

const ACTION_FILTER_MAP: Record<ActionFilter, string[]> = {
  all: [],
  creation: ["CREATE"],
  updates: ["UPDATE", "ARCHIVE", "RESTORE"],
  status: ["STATUS_CHANGE"],
  metiers: ["METIER_ADD", "METIER_REMOVE"],
  zones: ["ZONE_ADD", "ZONE_REMOVE"],
  absences: ["ABSENCE_ADD", "ABSENCE_UPDATE", "ABSENCE_DELETE"],
  documents: ["DOCUMENT_ADD", "DOCUMENT_UPDATE", "DOCUMENT_DELETE"],
  comments: ["COMMENT_ADD", "COMMENT_UPDATE", "COMMENT_DELETE"],
}

const ACTION_FILTER_LABELS: Record<ActionFilter, string> = {
  all: "Toutes les actions",
  creation: "Création",
  updates: "Modifications",
  status: "Changements de statut",
  metiers: "Métiers",
  zones: "Zones",
  absences: "Absences",
  documents: "Documents",
  comments: "Commentaires",
}

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: "Toute la période",
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
}

const safeParseDate = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = parseISO(value)
  if (isValid(parsed)) return parsed
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const getGroupLabel = (date: Date) => {
  if (isToday(date)) return "Aujourd'hui"
  if (isYesterday(date)) return "Hier"
  return format(date, "EEEE d MMMM yyyy", { locale: fr })
}

const matchesCurrentUser = (item: ArtisanHistoryItem, currentUser: ReturnType<typeof useCurrentUser>["data"]) => {
  if (!currentUser) return false
  const actorCode = item.actor_code?.toLowerCase()
  const userCode = currentUser.code_gestionnaire?.toLowerCase()
  if (actorCode && userCode) {
    return actorCode === userCode
  }
  const actorDisplay = item.actor_display?.toLowerCase() || ""
  const fullName = [currentUser.firstname, currentUser.lastname]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const username = currentUser.username?.toLowerCase()
  const email = currentUser.email?.toLowerCase()
  return (
    (fullName && actorDisplay.includes(fullName)) ||
    (username && actorDisplay.includes(username)) ||
    (email && actorDisplay.includes(email))
  )
}

const collectIdsFromItems = (
  items: ArtisanHistoryItem[],
  keys: string[]
) => {
  const ids = new Set<string>()
  items.forEach((item) => {
    const oldValues = (item.old_values ?? {}) as Record<string, unknown>
    const newValues = (item.new_values ?? {}) as Record<string, unknown>
    keys.forEach((key) => {
      const oldValue = oldValues[key]
      const newValue = newValues[key]
      if (typeof oldValue === "string" && oldValue.trim()) {
        ids.add(oldValue)
      }
      if (typeof newValue === "string" && newValue.trim()) {
        ids.add(newValue)
      }
    })
  })
  return Array.from(ids)
}

interface ArtisanHistoryPanelProps {
  artisanId: string
  isOpen: boolean
  onClose: () => void
}

export function ArtisanHistoryPanel({ artisanId, isOpen, onClose }: ArtisanHistoryPanelProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all")
  const [actorFilter, setActorFilter] = useState<"all" | "me">("all")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const { data: currentUser } = useCurrentUser({ enabled: isOpen })
  const { data: referenceData } = useReferenceDataQuery()
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useArtisanHistory(artisanId, { limit: 40, enabled: isOpen })

  useEffect(() => {
    if (isOpen) {
      void refetch()
    }
  }, [isOpen, refetch])

  useEffect(() => {
    if (!isOpen || !hasNextPage || isFetchingNextPage) return
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || isFetchingNextPage) return
        void fetchNextPage()
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [isOpen, hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages]
  )

  // Resolve zone IDs from audit log entries
  const zoneIds = useMemo(() => collectIdsFromItems(items, ["zone_id"]), [items])
  const { map: zoneMap } = useBatchResolver({
    ids: zoneIds,
    table: "zones",
    select: "id, code, label",
    buildLabel: (zone: { id: string; code?: string | null; label?: string | null }) => ({
      label: zone.label || zone.code || zone.id,
    }),
    enabled: isOpen,
  })

  const userMap = useMemo(() => {
    const map = new Map<string, { label: string; color?: string | null }>()
    referenceData?.users.forEach((user) => {
      const displayName =
        user.code_gestionnaire ||
        [user.firstname, user.lastname].filter(Boolean).join(" ").trim() ||
        user.username
      if (displayName) {
        map.set(user.id, { label: displayName, color: user.color ?? null })
      }
    })
    return map
  }, [referenceData?.users])

  const metierMap = useMemo(() => {
    const map = new Map<string, { label: string; color?: string | null }>()
    referenceData?.metiers.forEach((metier) => {
      map.set(metier.id, { label: metier.label || metier.code, color: metier.color ?? null })
    })
    return map
  }, [referenceData?.metiers])

  const artisanStatusById = useMemo(() => {
    const map = new Map<string, { label: string; color?: string | null }>()
    referenceData?.artisanStatuses.forEach((status) => {
      map.set(status.id, { label: status.label || status.code, color: status.color ?? null })
    })
    return map
  }, [referenceData?.artisanStatuses])

  const valueResolver: HistoryValueResolver = useMemo(
    () => (field, value) => {
      if (!value || typeof value !== "string") return null
      const normalized = field.toLowerCase()

      if (normalized === "statut_id" || normalized === "status_id") {
        return artisanStatusById.get(value) ?? null
      }

      if (normalized === "metier_id") {
        return metierMap.get(value) ?? null
      }

      if (normalized === "zone_id") {
        return zoneMap[value] ?? null
      }

      if (
        normalized.endsWith("_user_id") ||
        normalized === "created_by" ||
        normalized === "updated_by" ||
        normalized === "changed_by" ||
        normalized === "author_id"
      ) {
        return userMap.get(value) ?? null
      }

      return null
    },
    [artisanStatusById, metierMap, zoneMap, userMap]
  )

  const filteredItems = useMemo(() => {
    let result = items

    if (dateFilter !== "all") {
      result = result.filter((item) => {
        const date = safeParseDate(item.occurred_at)
        if (!date) return false
        if (dateFilter === "today") return isToday(date)
        if (dateFilter === "week") return isThisWeek(date, { weekStartsOn: 1 })
        if (dateFilter === "month") return isThisMonth(date)
        return true
      })
    }

    if (actionFilter !== "all") {
      const allowed = ACTION_FILTER_MAP[actionFilter]
      result = result.filter((item) => allowed.includes(item.action_type.toUpperCase()))
    }

    if (actorFilter === "me") {
      result = result.filter((item) => matchesCurrentUser(item, currentUser))
    }

    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter((item) => {
        const haystack = [
          item.action_label,
          item.action_type,
          item.actor_display,
          item.actor_code,
          ...(item.changed_fields ?? []),
          JSON.stringify(item.new_values ?? {}),
          JSON.stringify(item.old_values ?? {}),
        ]
          .join(" ")
          .toLowerCase()
        return haystack.includes(query)
      })
    }

    return result
  }, [items, dateFilter, actionFilter, actorFilter, search, currentUser])

  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; date: Date; label: string; items: ArtisanHistoryItem[] }
    >()
    filteredItems.forEach((item) => {
      const date = safeParseDate(item.occurred_at)
      if (!date) return
      const key = format(date, "yyyy-MM-dd")
      if (!groups.has(key)) {
        groups.set(key, { key, date, label: getGroupLabel(date), items: [] })
      }
      groups.get(key)?.items.push(item)
    })
    return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [filteredItems])

  const hasActiveFilters = dateFilter !== "all" || actionFilter !== "all" || actorFilter !== "me" || search.trim() !== ""

  const clearFilters = () => {
    setDateFilter("all")
    setActionFilter("all")
    setActorFilter("all")
    setSearch("")
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName="!z-[110]"
        className="history-panel !z-[120] flex h-full w-[440px] max-w-[94vw] flex-col p-0 sm:w-[500px] sm:max-w-[540px]"
      >
        {/* Header */}
        <div className="history-panel-header">
          <div className="flex items-center gap-3">
            <div className="history-panel-icon-container">
              <History className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="history-panel-title">Historique des actions</SheetTitle>
              <p className="history-panel-subtitle">
                {items.length > 0
                  ? `${items.length} action${items.length > 1 ? "s" : ""} enregistrée${items.length > 1 ? "s" : ""}`
                  : "Toutes les modifications de cet artisan"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "history-panel-action-btn",
                showFilters && "history-panel-action-btn--active"
              )}
              aria-label="Filtrer"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="history-panel-close-btn"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div
          className={cn(
            "history-panel-filters",
            showFilters ? "history-panel-filters--open" : "history-panel-filters--closed"
          )}
        >
          <div className="history-panel-filters-inner">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher dans l'historique..."
                className="history-panel-search-input"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="grid grid-cols-3 gap-2">
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger className="history-panel-select">
                  <Clock className="mr-1.5 h-3 w-3 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DATE_FILTER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as ActionFilter)}>
                <SelectTrigger className="history-panel-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_FILTER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={actorFilter} onValueChange={(value) => setActorFilter(value as "all" | "me")}>
                <SelectTrigger className="history-panel-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Tous les acteurs</SelectItem>
                  <SelectItem value="me" className="text-xs">Mes actions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <X className="h-3 w-3" />
                Effacer les filtres
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 history-panel-scroll">
          <div className="history-panel-content">
            {isLoading ? (
              <div className="history-panel-loading">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Chargement de l&apos;historique...</span>
              </div>
            ) : error ? (
              <div className="history-panel-error">
                <div className="history-panel-error-icon">!</div>
                <div>
                  <p className="font-medium">Erreur de chargement</p>
                  <p className="text-xs opacity-80">{(error as Error).message}</p>
                </div>
              </div>
            ) : groupedItems.length === 0 ? (
              <div className="history-panel-empty">
                <div className="history-panel-empty-icon">
                  <History className="h-6 w-6" />
                </div>
                <p className="font-medium">Aucun historique</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Aucun résultat pour les filtres sélectionnés"
                    : "Les modifications apparaîtront ici"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedItems.map((group) => (
                  <div key={group.key} className="history-group">
                    <div className="history-group-header">
                      <div className="history-group-line" />
                      <span className="history-group-label">{group.label}</span>
                      <div className="history-group-line" />
                    </div>
                    <div className="history-group-items">
                      {group.items.map((item, index) => (
                        <HistoryEntry
                          key={item.id}
                          item={item}
                          isFirst={index === 0}
                          isLast={index === group.items.length - 1}
                          valueResolver={valueResolver}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div ref={loadMoreRef} className="h-1" />

            {hasNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="history-panel-load-more"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    "Charger plus"
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer stats */}
        {items.length > 0 && (
          <div className="history-panel-footer">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filteredItems.length === items.length
                  ? `${items.length} action${items.length > 1 ? "s" : ""}`
                  : `${filteredItems.length} sur ${items.length} action${items.length > 1 ? "s" : ""}`}
              </span>
              {hasNextPage && <span className="text-primary">Plus d&apos;actions disponibles</span>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
