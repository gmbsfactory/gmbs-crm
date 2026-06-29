"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { Avatar as UIAvatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useGestionnaires, type Gestionnaire } from "@/hooks/useGestionnaires"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useTeamWeeklyStats, type DailyBreakdown } from "@/hooks/useTeamWeeklyStats"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { useActivityHeatmap } from "@/hooks/useActivityHeatmap"
import { catColor, categoryMeta, categoryOf, pageHex, pageLabel } from "@/lib/monitoring/activity-categories"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { DEFAULT_PRESENCE_SETTINGS, usePresenceSettings, useUpdatePresenceSettings } from "@/hooks/usePresenceSettings"
import type { DevFocus, HeatmapBucket, HeatmapCell, SortKey, TeamConnection } from "@/types/monitoring"
import { GestionnaireExpanded, type ExpandedAction } from "./GestionnaireExpanded"
import { DevSettings } from "./DevSettings"
import { useTimelineTooltip } from "./useTimelineTooltip"

const SORT_LABEL: Record<SortKey, string> = {
  screen: "temps écran",
  actions: "actions",
  created: "créées",
  devis: "devis",
  completed: "terminées",
  retard: "retards",
}

/** Colonnes de stats (en-têtes triables + valeurs alignées par ligne). */
const STAT_COLS: { key: Exclude<SortKey, "screen">; label: string; color: string }[] = [
  { key: "created", label: "Créées", color: "#3B82F6" },
  { key: "devis", label: "Devis", color: "#8B5CF6" },
  { key: "completed", label: "Term.", color: "#10B981" },
  { key: "actions", label: "Actions", color: "hsl(var(--primary))" },
  { key: "retard", label: "Retard", color: "#D97706" },
]
const MUTED_HALF = "hsl(var(--muted-foreground) / 0.5)"

type LiveStatus = "active" | "idle" | "offline"

const STATUS_TOKEN: Record<LiveStatus, string> = { active: "--success-hsl", idle: "--warning-hsl", offline: "--muted-foreground" }
const statusColor = (s: LiveStatus) => `hsl(var(${STATUS_TOKEN[s]}))`
const statusTint = (s: LiveStatus, a = 0.18) => `hsl(var(${STATUS_TOKEN[s]}) / ${a})`
const STATUS_ORDER: Record<LiveStatus, number> = { active: 0, idle: 1, offline: 2 }

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "?"
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function fmtDur(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}
function fmtShort(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}` : `${m}m`
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function minutesOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
function isLate(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() >= 600 // à partir de 10h00
}

interface Segment {
  page: string
  pct: number
  ms: number
}
function aggregateSegments(days: DailyBreakdown[] | undefined): { segs: Segment[]; total: number } {
  if (!days?.length) return { segs: [], total: 0 }
  const byPage: Record<string, number> = {}
  for (const d of days) for (const p of d.pages) byPage[p.page] = (byPage[p.page] ?? 0) + p.duration_ms
  const total = Object.values(byPage).reduce((a, b) => a + b, 0)
  const segs = Object.entries(byPage)
    .sort((a, b) => b[1] - a[1])
    .map(([page, ms]) => ({ page, ms, pct: total > 0 ? (ms / total) * 100 : 0 }))
  return { segs, total }
}

interface Row {
  userId: string
  name: string
  code: string | null
  initials: string
  color: string | null
  avatarUrl: string | null
  status: LiveStatus
  online: boolean
  statusTag: string
  headLine: string
  screen: string
  screenMs: number
  created: number
  devis: number
  completed: number
  actions: number
  retards: number
  segs: Segment[]
  hasBar: boolean
  // ── présence live (temps réel, depuis presence.allUsers) ──
  livePage: string | null
  liveInterventionId: string | null
  liveInterventionLabel: string | null
  liveArtisanId: string | null
  liveArtisanLabel: string | null
  sortVal: number
}

interface GestionnaireListProps {
  startDate: Date
  endDate: Date
  selectedIds: string[]
  expandedIds: string[]
  sort: SortKey
  onToggleFilter: (userId: string) => void
  onToggleExpand: (userId: string) => void
  onSetSort: (key: SortKey) => void
  onFocus: (focus: DevFocus) => void
}

export function GestionnaireList({
  startDate,
  endDate,
  selectedIds,
  expandedIds,
  sort,
  onToggleFilter,
  onToggleExpand,
  onSetSort,
  onFocus,
}: GestionnaireListProps) {
  const presence = usePagePresenceContext()
  const online = useMemo(() => presence?.allUsers ?? [], [presence?.allUsers])
  // Avatars réels (couleur + photo) depuis la source live settings/team, indexés par userId.
  const { data: gestionnaires } = useGestionnaires()
  const gestById = useMemo(() => {
    const m = new Map<string, Gestionnaire>()
    for (const g of gestionnaires ?? []) m.set(g.id, g)
    return m
  }, [gestionnaires])
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()
  const { data: stats } = useTeamWeeklyStats(startDate, endDate)

  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000
  const bucket: HeatmapBucket = singleDay ? "hour" : "day"
  const expEnabled = expandedIds.length > 0
  // Clé de requête stable quel que soit l'ordre d'ouverture des cartes
  const expIds = useMemo(() => [...expandedIds].sort(), [expandedIds])

  const { data: connections, isLoading: loadingConn } = useTeamConnections(
    startDate,
    endDate,
    expEnabled ? expIds : null,
    expEnabled
  )
  const { data: heatmap } = useActivityHeatmap(
    startDate,
    endDate,
    bucket,
    expEnabled ? expIds : null,
    expEnabled
  )
  const expFeed = useGlobalActivityFeed({
    startDate,
    endDate,
    userIds: expEnabled ? expIds : null,
    enabled: expEnabled,
  })
  // Données des cartes dépliées, indexées par gestionnaire (plusieurs cartes ouvrables)
  const connByUser = useMemo(() => {
    const m = new Map<string, TeamConnection>()
    for (const c of connections ?? []) m.set(c.user_id, c)
    return m
  }, [connections])
  const heatByUser = useMemo(() => {
    const m = new Map<string, HeatmapCell[]>()
    for (const c of heatmap ?? []) {
      const arr = m.get(c.user_id) ?? []
      arr.push(c)
      m.set(c.user_id, arr)
    }
    return m
  }, [heatmap])
  const actionsByUser = useMemo(() => {
    const m = new Map<string, ExpandedAction[]>()
    const items = expFeed.data?.pages.flatMap((p) => p.items) ?? []
    for (const r of items) {
      const uid = r.actor?.user_id
      if (!uid) continue
      const cat = categoryOf(r.action_type)
      const label = r.entity_label ? `${categoryMeta(cat).label} · ${r.entity_label}` : categoryMeta(cat).label
      const arr = m.get(uid) ?? []
      arr.push({ occurredAt: r.occurred_at, color: catColor(cat), label })
      m.set(uid, arr)
    }
    return m
  }, [expFeed.data])

  // ⚙ Réglages : couleurs des barres par page + plage horaire + lissage
  const [pageColors, setPageColors] = useState<Record<string, string>>({})
  const [tlMode, setTlMode] = useState<"fixed" | "auto">("fixed")
  const [tlStart, setTlStart] = useState(8)
  const [tlEnd, setTlEnd] = useState(20)
  const [smooth, setSmooth] = useState(5) // seuil de lissage (minutes)
  const { data: presenceSettings = DEFAULT_PRESENCE_SETTINGS } = usePresenceSettings()
  const updatePresenceSettings = useUpdatePresenceSettings()
  const pc = (page: string) => pageColors[page] ?? pageHex(page)

  // Zoom de la timeline dépliée (glisser sur les barres) + tooltip flottant
  const [zoom, setZoom] = useState<{ userId: string; ds: number; de: number } | null>(null)
  const { node: tipNode, showTip, hideTip } = useTimelineTooltip()
  useEffect(() => {
    // ferme le zoom si la carte concernée n'est plus dépliée
    setZoom((z) => (z && !expandedIds.includes(z.userId) ? null : z))
  }, [expandedIds])
  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [zoom])
  const [axisStart, axisEnd] = useMemo<[number, number]>(() => {
    if (tlMode === "auto") {
      let mn = 24 * 60
      let mx = 0
      for (const c of connections ?? []) {
        for (const d of c.days) {
          for (const s of d.sessions) {
            mn = Math.min(mn, minutesOf(s.started_at))
            mx = Math.max(mx, minutesOf(s.ended_at))
          }
        }
      }
      if (mn >= mx) return [8, 20]
      return [Math.max(0, Math.floor(mn / 60)), Math.min(24, Math.ceil(mx / 60))]
    }
    return [tlStart, tlEnd]
  }, [tlMode, tlStart, tlEnd, connections])

  const rows = useMemo<Row[]>(() => {
    const onlineById = new Map(online.map((u) => [u.userId, u]))
    const statById = new Map((stats ?? []).map((s) => [s.user_id, s]))
    const ids = new Set<string>([...statById.keys(), ...onlineById.keys()])

    return Array.from(ids).map((id): Row => {
      const u = onlineById.get(id)
      const s = statById.get(id)
      const g = gestById.get(id)
      const status: LiveStatus = u ? (u.presenceState ?? (u.isIdle ? "idle" : "active")) : "offline"
      const name = u?.name || [s?.firstname, s?.lastname].filter(Boolean).join(" ") || s?.code_gestionnaire || "—"
      const { segs, total } = aggregateSegments(s?.daily_breakdown)
      const daysActive = s?.days_active ?? 0
      const firstSeen = s?.daily_breakdown?.[0]?.first_seen_at ?? null
      const headLine = singleDay
        ? firstSeen
          ? `${fmtTime(firstSeen)}${status !== "offline" ? " → en cours" : ""}`
          : "pas de session"
        : `${daysActive} jour${daysActive > 1 ? "s" : ""} actif${daysActive > 1 ? "s" : ""} · ${fmtDur(s?.avg_daily_screen_time_ms ?? 0)}/j`
      const retards = (s?.daily_breakdown ?? []).filter((d) => isLate(d.first_seen_at)).length
      const screenMs = s?.total_screen_time_ms ?? 0
      const created = s?.interventions_created ?? 0
      const devis = s?.devis_sent ?? 0
      const completed = s?.interventions_completed ?? 0
      const actions = s?.total_actions ?? 0
      const sortVal = ({ screen: screenMs, actions, created, devis, completed, retard: retards } as Record<SortKey, number>)[sort] ?? screenMs
      return {
        userId: id,
        name,
        code: s?.code_gestionnaire ?? null,
        initials: initialsOf(name),
        color: g?.color ?? u?.color ?? s?.color ?? null,
        avatarUrl: g?.avatar_url ?? u?.avatarUrl ?? s?.avatar_url ?? null,
        status,
        online: status !== "offline",
        statusTag: singleDay ? (status === "active" ? "actif" : status === "idle" ? "idle" : "offline") : `${daysActive}j`,
        headLine,
        screen: fmtDur(screenMs),
        screenMs,
        created,
        devis,
        completed,
        actions,
        retards,
        segs,
        hasBar: total > 0,
        livePage: u?.currentPage ?? null,
        liveInterventionId: u?.activeInterventionId ?? null,
        liveInterventionLabel: u?.activeInterventionLabel ?? null,
        liveArtisanId: u?.activeArtisanId ?? null,
        liveArtisanLabel: u?.activeArtisanLabel ?? null,
        sortVal,
      }
    })
  }, [online, stats, gestById, sort, singleDay])

  const ordered = useMemo(() => {
    // On affiche toujours tout le monde ; la sélection ne fait que surligner + déplier.
    const sorted = [...rows].sort((a, b) => b.sortVal - a.sortVal)
    return { onlineRows: sorted.filter((r) => r.online), offlineRows: sorted.filter((r) => !r.online) }
  }, [rows])

  const totals = useMemo(() => {
    const scope = selectedIds.length ? rows.filter((r) => selectedIds.includes(r.userId)) : rows
    const sum = (k: keyof Row) => scope.reduce((a, r) => a + (r[k] as number), 0)
    return {
      created: sum("created"),
      devis: sum("devis"),
      completed: sum("completed"),
      actions: sum("actions"),
      retard: sum("retards"),
      online: scope.filter((r) => r.status === "active").length,
      idle: scope.filter((r) => r.status === "idle").length,
      offline: scope.filter((r) => r.status === "offline").length,
    }
  }, [rows, selectedIds])
  const onlineText = `${totals.online} en ligne · ${totals.idle} inactif${totals.idle > 1 ? "s" : ""} · ${totals.offline} hors ligne`

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header : titre + « en ligne » + en-têtes de colonnes triables */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border py-2.5">
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold">Gestionnaires</span>
            <span
              title="Tri actif (clic sur une colonne · re-clic = temps écran)"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted/70 px-2 py-0.5 text-[9.5px] font-bold text-muted-foreground"
            >
              tri ↓ {SORT_LABEL[sort]}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Réglages d'affichage" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3.5">
                <DevSettings
                  pageColors={pageColors}
                  setPageColor={(p, c) => setPageColors((prev) => ({ ...prev, [p]: c }))}
                  tlMode={tlMode}
                  setTlMode={setTlMode}
                  tlStart={tlStart}
                  tlEnd={tlEnd}
                  setTlStart={setTlStart}
                  setTlEnd={setTlEnd}
                  smooth={smooth}
                  setSmooth={setSmooth}
                  presenceIdleMinutes={presenceSettings.idleAfterMinutes}
                  presenceOfflineMinutes={presenceSettings.offlineAfterMinutes}
                  savingPresenceSettings={updatePresenceSettings.isPending}
                  setPresenceThresholds={async (idleMinutes, offlineMinutes) => {
                    await updatePresenceSettings.mutateAsync({
                      idleAfterMinutes: idleMinutes,
                      offlineAfterMinutes: offlineMinutes,
                    })
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <span className="whitespace-nowrap text-[10.5px] font-medium text-muted-foreground">{onlineText}</span>
        </div>
        {/* en-têtes de colonnes (alignées avec les lignes gestionnaire) */}
        <div className="flex items-end gap-2.5 pl-3 pr-[25px]">
          <span className="min-w-0 flex-1 text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">Détail / gestionnaire</span>
          <div className="flex shrink-0 items-end gap-1">
            {STAT_COLS.map((c) => {
              const active = sort === c.key
              return (
                <button key={c.key} type="button" onClick={() => onSetSort(c.key)} title={`Trier par ${c.label.toLowerCase()}`} className="flex w-[33px] flex-col items-center gap-px">
                  <span className="whitespace-nowrap text-[8px] font-extrabold uppercase tracking-[0.03em]" style={{ color: active ? c.color : "hsl(var(--muted-foreground))" }}>
                    {c.label} {active ? "↓" : ""}
                  </span>
                  <span className="text-[13px] font-extrabold tabular-nums" style={{ color: c.color }}>{totals[c.key].toLocaleString("fr-FR")}</span>
                </button>
              )
            })}
            <button type="button" onClick={() => onSetSort("screen")} title="Trier par temps écran" className="flex w-[42px] flex-col items-end gap-px">
              <span className="whitespace-nowrap text-[8px] font-extrabold uppercase tracking-[0.03em]" style={{ color: sort === "screen" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>Écran ↓</span>
            </button>
            <span className="w-[14px] shrink-0" />
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm italic text-muted-foreground">Aucune activité sur la période.</p>
        )}
        {(["online", "offline"] as const).map((grp) => {
          const list = grp === "online" ? ordered.onlineRows : ordered.offlineRows
          if (!list.length) return null
          return (
            <div key={grp} className={cn("flex flex-col gap-2", grp === "offline" && "mt-2")}>
              <div className="flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: grp === "online" ? "hsl(var(--success-hsl))" : "hsl(var(--muted-foreground))" }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {grp === "online" ? "En ligne" : "Hors ligne"} · {list.length}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {list.map((u) => {
                const dot = statusColor(u.status)
                const avatarColor = u.color || "hsl(var(--primary))"
                const inFilter = selectedIds.includes(u.userId)
                const expanded = expandedIds.includes(u.userId)
                return (
                  <div
                    key={u.userId}
                    className={cn(
                      "rounded-lg border transition-colors",
                      expanded || inFilter ? "border-primary/40 bg-primary/[0.04]" : "border-border"
                    )}
                  >
                    <button type="button" onClick={() => onToggleExpand(u.userId)} className="flex w-full flex-col gap-2.5 p-3 text-left">
                      <div className="flex items-center gap-2.5">
                        {/* Avatar = filtre */}
                        <span
                          role="button"
                          tabIndex={0}
                          title="Filtrer le flux sur ce gestionnaire"
                          onClick={(e) => { e.stopPropagation(); onToggleFilter(u.userId) }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggleFilter(u.userId) } }}
                          className="relative shrink-0 cursor-pointer"
                        >
                          <UIAvatar
                            className="h-9 w-9"
                            style={{ background: avatarColor, boxShadow: inFilter ? `0 0 0 2.5px hsl(var(--primary)), 0 0 0 4.5px hsl(var(--card))` : "none" }}
                          >
                            {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} className="object-cover" />}
                            <AvatarFallback className="text-[12.5px] font-extrabold uppercase text-white" style={{ background: avatarColor }}>
                              {u.initials}
                            </AvatarFallback>
                          </UIAvatar>
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card" style={{ background: dot }} />
                          {inFilter && (
                            <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-primary text-[8px] font-extrabold text-primary-foreground">✓</span>
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-bold">{u.name}</span>
                            <span className="shrink-0 rounded-full px-1.5 py-px text-[8.5px] font-extrabold uppercase tracking-wide" style={{ background: statusTint(u.status), color: dot }}>
                              {u.statusTag}
                            </span>
                          </div>
                          {u.online ? (
                            <div className="mt-0.5 flex min-w-0 items-center gap-1">
                              {/* page actuelle (présence temps réel — comme Suivi v1) */}
                              <span
                                title="Page actuelle"
                                className="inline-flex max-w-[120px] shrink-0 items-center gap-1 overflow-hidden rounded-full px-1.5 py-px text-[9.5px] font-bold"
                                style={{ background: `${pc(u.livePage ?? "")}22`, color: pc(u.livePage ?? "") }}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: pc(u.livePage ?? "") }} />
                                <span className="truncate">{pageLabel(u.livePage)}</span>
                              </span>
                              {/* entité ouverte (intervention / artisan) + ouverture */}
                              {(() => {
                                const interId = u.liveInterventionId
                                const artId = u.liveArtisanId
                                if (!interId && !artId) return null
                                const isInter = Boolean(interId)
                                const entColor = isInter ? "#3B82F6" : "#8B5CF6"
                                // Libellé : ID inter / n° associé quand dispo, sinon mot générique
                                const entLabel = isInter
                                  ? (u.liveInterventionLabel || "Intervention")
                                  : (u.liveArtisanLabel || "Artisan")
                                const openEntity = (e: React.MouseEvent | React.KeyboardEvent) => {
                                  e.stopPropagation()
                                  if (isInter) interventionModal.open(interId!, { allowInactive: true })
                                  else artisanModal.open(artId!)
                                }
                                return (
                                  <>
                                    <span title={`Entité ouverte · ${entLabel}`} className="inline-flex min-w-0 items-center gap-0.5 overflow-hidden font-mono text-[9.5px] font-bold" style={{ color: entColor }}>
                                      <span className="shrink-0">{isInter ? "◳" : "◈"}</span>
                                      <span className="truncate">{entLabel}</span>
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      title={isInter ? `Ouvrir l'intervention${u.liveInterventionLabel ? " " + u.liveInterventionLabel : ""}` : `Ouvrir l'artisan${u.liveArtisanLabel ? " " + u.liveArtisanLabel : ""}`}
                                      onClick={openEntity}
                                      onKeyDown={(e) => { if (e.key === "Enter") openEntity(e) }}
                                      className="flex h-[18px] w-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] bg-primary/10 text-primary hover:bg-primary/20"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </span>
                                  </>
                                )
                              })()}
                            </div>
                          ) : (
                            <span className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{u.headLine}</span>
                          )}
                        </div>
                        {/* colonnes de stats alignées sur les en-têtes */}
                        <div className="flex shrink-0 items-center gap-1">
                          <span title="Interventions créées" className="w-[33px] text-center text-[13px] font-extrabold tabular-nums" style={{ color: u.created > 0 ? "#3B82F6" : MUTED_HALF }}>{u.created}</span>
                          <span title="Devis envoyés" className="w-[33px] text-center text-[13px] font-extrabold tabular-nums" style={{ color: u.devis > 0 ? "#8B5CF6" : MUTED_HALF }}>{u.devis}</span>
                          <span title="Interventions terminées" className="w-[33px] text-center text-[13px] font-extrabold tabular-nums" style={{ color: u.completed > 0 ? "#10B981" : MUTED_HALF }}>{u.completed}</span>
                          <span title="Actions totales" className="w-[33px] text-center text-[13px] font-extrabold tabular-nums" style={{ color: u.actions > 0 ? "hsl(var(--foreground))" : MUTED_HALF }}>{u.actions}</span>
                          <span title="Retards · connexions à partir de 10h" className="w-[33px] text-center text-[13px] font-extrabold tabular-nums" style={{ color: u.retards > 0 ? "#D97706" : MUTED_HALF }}>{u.retards}</span>
                          <span className="w-[42px] text-right text-[15px] font-extrabold leading-none tabular-nums">{u.screen}</span>
                          <span className={cn("w-[14px] shrink-0 text-center text-[12px] text-muted-foreground transition-transform", expanded && "rotate-180")}>⌄</span>
                        </div>
                      </div>

                      {/* barre repliée libellée (épaisse) */}
                      {u.hasBar ? (
                        <div className="flex h-7 overflow-hidden rounded-md bg-muted/50">
                          {u.segs.map((seg) => (
                            <div
                              key={seg.page}
                              title={`${pageLabel(seg.page)} · ${fmtDur(seg.ms)} (${Math.round(seg.pct)}%)`}
                              className="flex items-center justify-center overflow-hidden px-1.5"
                              style={{ width: `${seg.pct}%`, minWidth: "3px", background: pc(seg.page) }}
                            >
                              {seg.pct >= 16 && (
                                <span className="truncate text-[10px] font-bold text-white" style={{ textShadow: "0 1px 1px rgba(0,0,0,.22)" }}>
                                  {pageLabel(seg.page)} · {fmtShort(seg.ms)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-7 items-center justify-center rounded-md bg-muted/50 text-[11px] font-medium text-muted-foreground">
                          Aucune activité sur la période
                        </div>
                      )}
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3">
                        <GestionnaireExpanded
                          connection={connByUser.get(u.userId)}
                          actions={actionsByUser.get(u.userId) ?? []}
                          heatmapCells={heatByUser.get(u.userId) ?? []}
                          bucket={bucket}
                          isLoading={loadingConn}
                          userId={u.userId}
                          userName={u.name}
                          userColor={u.color}
                          isOnline={u.online}
                          onFocus={onFocus}
                          axisStart={axisStart}
                          axisEnd={axisEnd}
                          pageColors={pageColors}
                          smoothMs={smooth * 60_000}
                          zoom={zoom && zoom.userId === u.userId ? { ds: zoom.ds, de: zoom.de } : null}
                          onSetZoom={(ds, de) => setZoom({ userId: u.userId, ds, de })}
                          onClearZoom={() => setZoom(null)}
                          showTip={showTip}
                          hideTip={hideTip}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {tipNode}
    </div>
  )
}
