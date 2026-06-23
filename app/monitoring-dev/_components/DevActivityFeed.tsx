"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { catColor, categoryMeta, categoryOf, type ActivityCategory } from "@/lib/monitoring/activity-categories"
import type { ActivityActor, GlobalActivityRow } from "@/types/monitoring"
import { DocPreviewContent, type DocPreviewTarget } from "./DocPreviewModal"
import { useFeedValueResolver, FeedDiffRows } from "./feedDiff"

type FeedMode = "group" | "detail"
type CatFilter = ActivityCategory | "all" | "conn"
type EKind = "all" | "inter" | "artisan" | "other"

/** Événement synthétique de connexion / déconnexion (dérivé de get_team_connections). */
interface ConnRow {
  __conn: true
  id: string
  dir: "in" | "out"
  occurred_at: string
  userId: string
  actor: ActivityActor
}
type FeedItem = GlobalActivityRow | ConnRow
const isConn = (x: FeedItem): x is ConnRow => (x as ConnRow).__conn === true
const catOf = (x: FeedItem): CatFilter => (isConn(x) ? "conn" : categoryOf(x.action_type))
function ekindOf(x: FeedItem): EKind {
  if (isConn(x) || !x.entity_label) return "other"
  if (x.entity_type === "intervention") return "inter"
  if (x.entity_type === "artisan") return "artisan"
  return "other"
}
type OpenDocPreview = DocPreviewTarget & { rowId: string }

interface StatusRef {
  label: string
  color: string | null
}

const CHIPS: { key: CatFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "create", label: "Créations" },
  { key: "status", label: "Statuts" },
  { key: "finance", label: "Finances" },
  { key: "doc", label: "Documents" },
  { key: "comment", label: "Commentaires" },
  { key: "email", label: "Emails" },
  { key: "archive", label: "Archives" },
  { key: "conn", label: "Connexions" },
]
const EKINDS: { key: EKind; label: string; hint: string }[] = [
  { key: "all", label: "Tout", hint: "Tous les événements" },
  { key: "inter", label: "Interventions", hint: "Modifications de fiches interventions" },
  { key: "artisan", label: "Artisans", hint: "Modifications de fiches artisans" },
  { key: "other", label: "Autre", hint: "Connexions et autres événements" },
]
const WINDOWS: { min: number; label: string }[] = [
  { min: 5, label: "5 minutes" },
  { min: 15, label: "15 minutes" },
  { min: 30, label: "30 minutes" },
  { min: 60, label: "1 heure" },
  { min: 1440, label: "Journée entière" },
]
/** Priorité de catégorie : détermine l'action « tête » et l'accent d'une carte groupée. */
const PRIORITY: ActivityCategory[] = ["status", "create", "finance", "assign", "doc", "comment", "email", "update", "archive"]
const prioRank = (cat: ActivityCategory) => {
  const i = PRIORITY.indexOf(cat)
  return i < 0 ? 50 : i
}

function tint(color: string, a = 0.16): string {
  if (color.startsWith("#")) return `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`
  return color.replace(/\)\s*$/, ` / ${a})`)
}
function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "?"
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function fmtTimeSec(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function dayOffOf(iso: string): number {
  return Math.round((startOfDay(Date.now()) - startOfDay(new Date(iso).getTime())) / 86_400_000)
}
const absMin = (iso: string) => Math.floor(new Date(iso).getTime() / 60_000)
function relTime(iso: string): string {
  const dayOff = dayOffOf(iso)
  if (dayOff === 0) {
    const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
    if (mins < 60) return `il y a ${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `il y a ${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`
  }
  if (dayOff === 1) return "hier"
  return `il y a ${dayOff} j`
}
/** Section du flux : par heure en vue jour, par jour en vue semaine/mois. */
function sectionOf(iso: string, singleDay: boolean): { key: string; label: string } {
  const d = new Date(iso)
  if (singleDay) {
    const h = d.getHours()
    return { key: `h${h}`, label: `${String(h).padStart(2, "0")} h` }
  }
  const dayOff = dayOffOf(iso)
  if (dayOff === 0) return { key: "d0", label: "Aujourd'hui" }
  if (dayOff === 1) return { key: "d1", label: "Hier" }
  return { key: `d${dayOff}`, label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" }) }
}
function fmtEur(v: unknown): string | null {
  const n = Number(v)
  if (!v || Number.isNaN(n)) return null
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
}

interface Described {
  cat: ActivityCategory
  glyph: string
  color: string
  text: string
  sub: string | null
  from: StatusRef | null
  to: StatusRef | null
  isDoc: boolean
}
function describe(row: GlobalActivityRow, resolveStatus: (id: unknown) => StatusRef | null): Described {
  const cat = categoryOf(row.action_type)
  const meta = categoryMeta(cat)
  const nv = (row.new_values ?? {}) as Record<string, unknown>
  const ov = (row.old_values ?? {}) as Record<string, unknown>
  const base = { cat, glyph: meta.glyph, color: catColor(cat), from: null as StatusRef | null, to: null as StatusRef | null, isDoc: false }
  switch (cat) {
    case "create":
      return { ...base, text: row.entity_type === "intervention" ? "Intervention créée" : "Artisan créé", sub: null }
    case "status": {
      const fromKey = ov.status_code ?? ov.statut_code ?? ov.status_id ?? ov.statut_id
      const toKey = nv.status_code ?? nv.statut_code ?? nv.status_id ?? nv.statut_id
      return { ...base, text: "Changement de statut", sub: null, from: resolveStatus(fromKey), to: resolveStatus(toKey) }
    }
    case "finance":
      return { ...base, text: row.action_type.startsWith("PAYMENT") ? "Paiement" : "Coût", sub: fmtEur(nv.amount ?? nv.montant) }
    case "doc":
      return { ...base, text: "Document", sub: (nv.filename as string) ?? null, isDoc: true }
    case "comment": {
      const c = (nv.content as string) ?? ""
      return { ...base, text: "Commentaire", sub: c ? `« ${c.slice(0, 60)} »` : null }
    }
    case "assign":
      return { ...base, text: row.action_type === "ARTISAN_UNASSIGN" ? "Artisan désassigné" : "Artisan assigné", sub: null }
    case "archive":
      return { ...base, text: row.action_type === "RESTORE" ? "Restauré" : "Archivé", sub: null }
    case "email":
      return { ...base, text: "Email envoyé", sub: (nv.recipient_email as string) ?? null }
    default: {
      const f = (row.changed_fields ?? []).filter(Boolean)
      return { ...base, text: "Modification", sub: f.length ? `${f.length} champ${f.length > 1 ? "s" : ""}` : null }
    }
  }
}

interface ActorInfo {
  userId: string
  initials: string
  color: string | null
  name: string
}
type UserMap = Map<string, { firstname: string | null; lastname: string | null; color: string | null; avatar_url: string | null }>
function actorInfoOf(item: FeedItem, userMap: UserMap): ActorInfo {
  const actor: ActivityActor | undefined = isConn(item) ? item.actor : item.actor
  const userId = actor?.user_id ?? "?"
  const u = userMap.get(userId)
  const name = u ? [u.firstname, u.lastname].filter(Boolean).join(" ") || actor?.display || "—" : actor?.display || "—"
  return { userId, initials: initialsOf(name), color: u?.color ?? actor?.color ?? null, name }
}

interface CatChip {
  cat: ActivityCategory
  glyph: string
  color: string
  label: string
  isDoc: boolean
  docRow: GlobalActivityRow | null
}
interface CardData {
  kind: "card"
  key: string
  head: GlobalActivityRow
  events: GlobalActivityRow[]
  accent: string
  count: number
  actors: (ActorInfo & { count: number })[]
  catChips: CatChip[]
}
type FeedRow =
  | { kind: "sep"; key: string; label: string }
  | { kind: "line"; key: string; item: FeedItem }
  | CardData

interface DevActivityFeedProps {
  startDate: Date
  endDate: Date
  userIds: string[]
}

export function DevActivityFeed({ startDate, endDate, userIds }: DevActivityFeedProps) {
  const [mode, setMode] = useState<FeedMode>("group")
  const [winMin, setWinMin] = useState(15)
  const [ekind, setEkind] = useState<EKind>("all")
  const [filter, setFilter] = useState<CatFilter>("all")
  const [query, setQuery] = useState("")
  const [openTx, setOpenTx] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<OpenDocPreview | null>(null)
  const feedScrollRef = useRef<HTMLDivElement>(null)

  const feed = useGlobalActivityFeed({ startDate, endDate, userIds: userIds.length ? userIds : null })
  const { data: refData } = useReferenceDataQuery()
  const { data: connections } = useTeamConnections(startDate, endDate, userIds.length ? userIds : null, true)
  const presence = usePagePresenceContext()
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000

  const resolveStatus = useMemo(() => {
    const map = new Map<string, StatusRef>()
    const add = (s: { id?: string | null; code?: string | null; label?: string | null; color?: string | null }) => {
      const value = { label: s.label || s.code || "—", color: s.color ?? null }
      if (s.id) map.set(s.id, value)
      if (s.code) map.set(s.code, value)
    }
    refData?.interventionStatuses?.forEach(add)
    refData?.artisanStatuses?.forEach(add)
    return (id: unknown) => (typeof id === "string" ? map.get(id) ?? null : null)
  }, [refData])

  const userMap = useMemo<UserMap>(() => {
    const map: UserMap = new Map()
    const list = refData?.allUsers ?? refData?.users ?? []
    for (const u of list) map.set(u.id, { firstname: u.firstname, lastname: u.lastname, color: u.color, avatar_url: u.avatar_url ?? null })
    return map
  }, [refData])

  // Événements de connexion / déconnexion dérivés des sessions réelles
  const onlineIds = useMemo(() => new Set((presence?.allUsers ?? []).map((u) => u.userId)), [presence?.allUsers])
  const connEvents = useMemo<ConnRow[]>(() => {
    const out: ConnRow[] = []
    const today = new Date().toDateString()
    for (const c of connections ?? []) {
      const actor: ActivityActor = {
        user_id: c.user_id,
        display: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.code_gestionnaire,
        code: c.code_gestionnaire,
        color: c.color,
      }
      for (const d of c.days) {
        const isToday = new Date(`${d.date}T00:00:00`).toDateString() === today
        if (d.first_seen_at) out.push({ __conn: true, id: `ci-${c.user_id}-${d.date}`, dir: "in", occurred_at: d.first_seen_at, userId: c.user_id, actor })
        const stillOnline = isToday && onlineIds.has(c.user_id)
        if (d.last_seen_at && !stillOnline) out.push({ __conn: true, id: `co-${c.user_id}-${d.date}`, dir: "out", occurred_at: d.last_seen_at, userId: c.user_id, actor })
      }
    }
    return out
  }, [connections, onlineIds])

  const auditItems = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])
  const total = feed.data?.pages[0]?.total ?? 0
  const valueResolver = useFeedValueResolver(auditItems)
  const showDiff = (r: GlobalActivityRow) => categoryOf(r.action_type) === "update" && (r.changed_fields?.length ?? 0) > 0

  // Fusion audit + connexions, triées du plus récent au plus ancien
  const allEvents = useMemo<FeedItem[]>(() => {
    const merged: FeedItem[] = [...auditItems, ...connEvents]
    merged.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    return merged
  }, [auditItems, connEvents])

  // Recherche d'abord (commune aux deux compteurs)
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allEvents
    return allEvents.filter((it) => {
      const hay = isConn(it)
        ? `connexion déconnexion ${it.actor.display ?? ""} ${it.actor.code ?? ""}`
        : `${it.action_type} ${it.entity_label ?? ""} ${it.actor?.display ?? ""}`
      return hay.toLowerCase().includes(q)
    })
  }, [allEvents, query])

  const ekindCounts = useMemo(() => {
    const c: Record<EKind, number> = { all: searched.length, inter: 0, artisan: 0, other: 0 }
    for (const it of searched) c[ekindOf(it)]++
    return c
  }, [searched])

  const afterEkind = useMemo(() => (ekind === "all" ? searched : searched.filter((it) => ekindOf(it) === ekind)), [searched, ekind])

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: afterEkind.length }
    for (const it of afterEkind) {
      const k = catOf(it)
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [afterEkind])

  const filtered = useMemo(
    () => (filter === "all" ? afterEkind : afterEkind.filter((it) => catOf(it) === filter)),
    [afterEkind, filter],
  )

  // Construction des lignes du flux : séparateurs collants + cartes groupées (par dossier + fenêtre) / lignes
  const feedRows = useMemo<FeedRow[]>(() => {
    // 1. Moments = regroupement (vue groupée) par dossier dans la fenêtre temporelle ; connexions isolées.
    const moments: { key: string; events: FeedItem[] }[] = []
    if (mode === "group") {
      const open = new Map<string, { m: { key: string; events: FeedItem[] }; lastMin: number }>()
      for (const e of filtered) {
        if (isConn(e) || !e.entity_label) {
          moments.push({ key: `s-${e.id}`, events: [e] })
          continue
        }
        const k = `${e.entity_type}:${e.entity_id}:${dayOffOf(e.occurred_at)}`
        const eMin = absMin(e.occurred_at)
        const g = open.get(k)
        const gap = g ? g.lastMin - eMin : Infinity
        if (g && gap >= 0 && gap <= winMin) {
          g.m.events.push(e)
          g.lastMin = eMin
        } else {
          const m = { key: `w-${k}-${e.id}`, events: [e] as FeedItem[] }
          open.set(k, { m, lastMin: eMin })
          moments.push(m)
        }
      }
    } else {
      for (const e of filtered) moments.push({ key: `e-${e.id}`, events: [e] })
    }

    // 2. Lignes : séparateur quand la section change, puis carte (groupé) / ligne (détaillé).
    const rows: FeedRow[] = []
    let curSec: string | null = null
    const pushSep = (iso: string) => {
      const s = sectionOf(iso, singleDay)
      if (s.key !== curSec) {
        curSec = s.key
        rows.push({ kind: "sep", key: `sep-${s.key}-${rows.length}`, label: s.label })
      }
    }
    for (const mo of moments.slice(0, 120)) {
      const headItem = mo.events[0]
      // Carte uniquement pour des actions d'audit (pas les connexions) en vue groupée.
      if (mode === "group" && !isConn(headItem)) {
        pushSep(headItem.occurred_at)
        const events = mo.events as GlobalActivityRow[]
        const desc = [...events].sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime() || prioRank(categoryOf(a.action_type)) - prioRank(categoryOf(b.action_type)),
        )
        const byPrio = [...events].sort((a, b) => prioRank(categoryOf(a.action_type)) - prioRank(categoryOf(b.action_type)))
        // Acteurs distincts (ordre d'apparition) + nombre d'actions
        const actCount = new Map<string, number>()
        const ordered: string[] = []
        for (const e of desc) {
          const uid = e.actor?.user_id ?? "?"
          if (!actCount.has(uid)) ordered.push(uid)
          actCount.set(uid, (actCount.get(uid) ?? 0) + 1)
        }
        const actors = ordered.map((uid) => {
          const info = actorInfoOf(events.find((e) => (e.actor?.user_id ?? "?") === uid)!, userMap)
          return { ...info, count: actCount.get(uid) ?? 0 }
        })
        // Chips de catégories distinctes (ordre de priorité)
        const seen = new Set<ActivityCategory>()
        const catChips: CatChip[] = []
        for (const e of byPrio) {
          const cat = categoryOf(e.action_type)
          if (seen.has(cat)) continue
          seen.add(cat)
          const meta = categoryMeta(cat)
          catChips.push({ cat, glyph: meta.glyph, color: catColor(cat), label: meta.label, isDoc: cat === "doc", docRow: cat === "doc" ? e : null })
        }
        rows.push({
          kind: "card",
          key: mo.key,
          head: desc[0],
          events: desc,
          accent: catColor(categoryOf(byPrio[0].action_type)),
          count: events.length,
          actors,
          catChips,
        })
      } else {
        for (const e of mo.events) {
          pushSep(e.occurred_at)
          rows.push({ kind: "line", key: `line-${e.id}`, item: e })
        }
      }
    }
    return rows
  }, [filtered, mode, winMin, singleDay, userMap])

  // Séparateurs collants : la puce épinglée (sortante) fond dans la suivante qui monte,
  // et les puces empilées derrière sont masquées (sinon les ombres se cumulent). Réplique V3.
  const syncSecPill = useCallback(() => {
    const sc = feedScrollRef.current
    if (!sc) return
    const anchors = sc.querySelectorAll<HTMLElement>("[data-sec-anchor]")
    const chips = sc.querySelectorAll<HTMLElement>("[data-sec]")
    const top = sc.scrollTop
    const PIN = 6
    const TH = 52
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    let pinnedIdx = -1
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i].offsetTop - top <= PIN) pinnedIdx = i
      else break
    }
    for (let i = 0; i < chips.length; i++) {
      const pill = chips[i].firstElementChild as HTMLElement | null
      if (!pill) continue
      if (i < pinnedIdx) {
        // empilée derrière → masquée (pas d'ombre cumulée)
        pill.style.opacity = "0"
        pill.style.transform = "scale(.55)"
      } else if (i === pinnedIdx) {
        // épinglée (sortante) : fusionne dans la suivante qui monte
        const next = anchors[i + 1]
        const p = next ? ease(1 - (next.offsetTop - top - PIN) / TH) : 0
        pill.style.transformOrigin = "center bottom"
        pill.style.opacity = String(1 - p)
        pill.style.transform = `scale(${(1 - 0.42 * p).toFixed(3)}) translateY(${(7 * p).toFixed(1)}px)`
      } else {
        // dans le flux
        pill.style.opacity = "1"
        pill.style.transform = "none"
      }
    }
  }, [])

  // Recalage initial + à chaque changement du flux (nouvelles sections)
  useEffect(() => {
    const id = requestAnimationFrame(syncSecPill)
    return () => cancelAnimationFrame(id)
  }, [feedRows, syncSecPill])

  const toggleTx = (k: string) =>
    setOpenTx((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const openEntity = (row: GlobalActivityRow) => {
    if (row.entity_type === "intervention") interventionModal.open(row.entity_id, { allowInactive: true, origin: "monitoring-dev" })
    else artisanModal.open(row.entity_id)
  }
  const buildDocTarget = (row: GlobalActivityRow): OpenDocPreview => {
    const nv = (row.new_values ?? {}) as Record<string, unknown>
    return {
      rowId: row.id,
      url: (nv.url as string | null) ?? null,
      mimeType: (nv.mime_type as string | null) ?? null,
      filename: (nv.filename as string | null) ?? null,
      entityLabel: row.entity_label,
      entityType: row.entity_type,
      entityId: row.entity_id,
    }
  }
  const entityLabelOf = (row: GlobalActivityRow): string | null => {
    if (row.entity_type === "intervention") {
      const idInter = (row.entity_meta as { id_inter?: string | null } | null)?.id_inter
      return idInter || row.entity_label || `INT-${row.entity_id.slice(0, 8)}`
    }
    return row.entity_label
  }

  const renderDocButton = (row: GlobalActivityRow, variant: "icon" | "inline") => {
    const open = preview?.rowId === row.id
    return (
      <Popover open={open} onOpenChange={(o) => setPreview(o ? buildDocTarget(row) : null)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Prévisualiser le document"
            onClick={(e) => e.stopPropagation()}
            className={
              variant === "inline"
                ? "inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary hover:bg-primary/20"
                : "flex h-6 w-6 items-center justify-center rounded-lg border text-[13px]"
            }
            style={variant === "icon" ? { color: "#0EA5E9", background: tint("#0EA5E9", 0.08), borderColor: tint("#0EA5E9", 0.2) } : undefined}
          >
            {variant === "inline" ? "⊙ Aperçu" : "⊙"}
          </button>
        </PopoverTrigger>
        {open && preview && (
          <PopoverContent className="w-auto p-1.5" side="left" align="center">
            <DocPreviewContent target={preview} onClose={() => setPreview(null)} />
          </PopoverContent>
        )}
      </Popover>
    )
  }

  const renderEntityButton = (row: GlobalActivityRow) => {
    const label = entityLabelOf(row)
    if (!label) return null
    const isInter = row.entity_type === "intervention"
    const c = isInter ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openEntity(row)
        }}
        title="Ouvrir le dossier"
        className="inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-extrabold"
        style={{ background: tint(c, 0.12), color: c, borderColor: tint(c, 0.3) }}
      >
        {isInter ? "◳" : "◈"} {label} ↗
      </button>
    )
  }

  // Action « inline » : badges de statut, OU glyphe + texte + sous-texte (+ bouton doc optionnel).
  const renderAction = (row: GlobalActivityRow, { minor = false, withDoc = false }: { minor?: boolean; withDoc?: boolean } = {}) => {
    const d = describe(row, resolveStatus)
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn("flex shrink-0 items-center justify-center rounded font-extrabold", minor ? "h-[18px] w-[18px] text-[10px]" : "h-5 w-5 text-[11px]")}
          style={{ background: tint(d.color, 0.16), color: d.color }}
        >
          {d.glyph}
        </span>
        <span className={cn("font-semibold", minor ? "text-[11.5px]" : "text-[12px]")}>{d.text}</span>
        {(d.from || d.to) && (
          <>
            {d.from && <StatusBadge s={d.from} small />}
            {d.from && d.to && <span className="text-[11px] text-muted-foreground">→</span>}
            {d.to && <StatusBadge s={d.to} small />}
          </>
        )}
        {d.sub && <span className="truncate font-mono text-[11px] font-semibold text-muted-foreground">{d.sub}</span>}
        {withDoc && d.isDoc && renderDocButton(row, "inline")}
      </div>
    )
  }

  const filtActive = ekind !== "all" || mode !== "group" || winMin !== 15
  const ekindLabel = EKINDS.find((e) => e.key === ekind)?.label ?? "Tout"
  const winLabel = WINDOWS.find((w) => w.min === winMin)?.label ?? `${winMin} min`

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Contrôles : ⚙ Filtres (Affichage · Type · Fenêtre) + recherche, puis chips de catégorie */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold",
                    filtActive ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted/60",
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtres
                  {filtActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[270px] p-2">
                <MenuSection label="Affichage" value={mode === "group" ? "Groupé" : "Détaillé"}>
                  {([["group", "⊟ Groupé"], ["detail", "≡ Détaillé"]] as const).map(([k, l]) => (
                    <MenuOption key={k} label={l} active={mode === k} onClick={() => setMode(k)} />
                  ))}
                </MenuSection>
                <MenuSection label="Type d'événement" value={ekindLabel}>
                  {EKINDS.map((e) => (
                    <MenuOption key={e.key} label={e.label} count={ekindCounts[e.key]} title={e.hint} active={ekind === e.key} onClick={() => setEkind(e.key)} />
                  ))}
                </MenuSection>
                {mode === "group" && (
                  <MenuSection label="Fenêtre de regroupement" value={winLabel}>
                    {WINDOWS.map((w) => (
                      <MenuOption key={w.min} label={w.label} active={winMin === w.min} onClick={() => setWinMin(w.min)} />
                    ))}
                    <p className="px-2 pt-1.5 text-[9.5px] font-medium leading-snug text-muted-foreground">
                      Fusionne les actions consécutives d&apos;une même fiche dans cet intervalle. « Journée entière » regroupe tout le dossier du jour.
                    </p>
                  </MenuSection>
                )}
              </PopoverContent>
            </Popover>
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
            {CHIPS.map((c) => {
              const active = filter === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors", !active && "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted")}
                  style={active ? { background: "hsl(var(--primary) / 0.16)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.35)" } : undefined}
                >
                  {c.label}
                  <span className="ml-1.5 tabular-nums opacity-60">{catCounts[c.key] ?? 0}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Flux */}
        <div ref={feedScrollRef} onScroll={syncSecPill} className="relative min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5 pt-1.5">
          {feed.isLoading ? (
            <div className="space-y-1.5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : feedRows.length === 0 ? (
            <p className="py-10 text-center text-sm italic text-muted-foreground">Aucun événement ne correspond aux filtres.</p>
          ) : (
            <>
              {feedRows.map((row) => {
                if (row.kind === "sep") {
                  return (
                    <Fragment key={row.key}>
                      {/* ancre : position stable (non collante) pour mesurer l'épinglage */}
                      <div data-sec-anchor className="h-0 overflow-hidden" />
                      <div data-sec className="pointer-events-none sticky top-1.5 z-[9] my-2 flex justify-center">
                        <span className="pointer-events-auto inline-flex items-center rounded-full border border-border bg-card px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground shadow-sm will-change-[transform,opacity]">
                          {row.label}
                        </span>
                      </div>
                    </Fragment>
                  )
                }
                if (row.kind === "line") {
                  if (isConn(row.item)) return <ConnFeedRow key={row.key} row={row.item} userMap={userMap} />
                  const e = row.item
                  const a = actorInfoOf(e, userMap)
                  const isDoc = categoryOf(e.action_type) === "doc"
                  return (
                    <div key={row.key} className="mb-1.5 flex items-stretch gap-2.5">
                      <div className="relative flex w-11 shrink-0 flex-col items-center pt-3">
                        <div className="absolute -bottom-1.5 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-border" />
                        <span className="relative z-[1] bg-card px-0.5 font-mono text-[11px] font-extrabold text-foreground">{fmtTime(e.occurred_at)}</span>
                      </div>
                      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="w-[3px] shrink-0" style={{ background: catColor(categoryOf(e.action_type)) }} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span title={a.name} className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white" style={{ background: a.color ?? "hsl(var(--muted-foreground))" }}>
                              {a.initials}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(e.occurred_at)}</span>
                            <div className="min-w-0 flex-1">{renderAction(e)}</div>
                            {isDoc && renderDocButton(e, "icon")}
                            {renderEntityButton(e)}
                          </div>
                          {showDiff(e) && <FeedDiffRows row={e} resolver={valueResolver} />}
                        </div>
                      </div>
                    </div>
                  )
                }
                // Carte groupée
                const open = openTx.has(row.key)
                return (
                  <div key={row.key} className="mb-1.5 flex items-stretch gap-2.5">
                    {/* rail timeline */}
                    <div className="relative flex w-11 shrink-0 flex-col items-center pt-2.5">
                      <div className="absolute -bottom-1.5 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-border" />
                      <span className="relative z-[1] bg-card px-0.5 font-mono text-[11px] font-extrabold text-foreground">{fmtTime(row.head.occurred_at)}</span>
                    </div>
                    {/* carte */}
                    <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="w-[3px] shrink-0" style={{ background: row.accent }} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex cursor-pointer flex-col gap-1.5 px-3 py-2" onClick={() => toggleTx(row.key)}>
                          <div className="flex items-center gap-2">
                            {/* pile d'avatars + overflow */}
                            <div className="flex shrink-0 items-center pl-2">
                              {row.actors.slice(0, 3).map((a) => (
                                <span
                                  key={a.userId}
                                  title={a.name}
                                  className="-ml-2 flex h-[26px] w-[26px] items-center justify-center rounded-full text-[9.5px] font-extrabold text-white ring-2 ring-card"
                                  style={{ background: a.color ?? "hsl(var(--muted-foreground))" }}
                                >
                                  {a.initials}
                                </span>
                              ))}
                              {row.actors.length > 3 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="-ml-2 flex h-[26px] w-[26px] cursor-default items-center justify-center rounded-full bg-muted text-[9.5px] font-extrabold text-muted-foreground ring-2 ring-card">
                                      +{row.actors.length - 3}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="w-[190px] p-1.5">
                                    <p className="px-1.5 pb-1 text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Gestionnaires intervenus</p>
                                    {row.actors.map((a) => (
                                      <div key={a.userId} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-extrabold text-white" style={{ background: a.color ?? "hsl(var(--muted-foreground))" }}>
                                          {a.initials}
                                        </span>
                                        <span className="flex-1 truncate text-[11px] font-semibold">{a.name}</span>
                                        <span className="shrink-0 text-[9.5px] font-bold text-muted-foreground">{a.count} action{a.count > 1 ? "s" : ""}</span>
                                      </div>
                                    ))}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <span title={row.count > 1 ? `${row.count} actions` : "1 action"} className="flex h-4 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-muted/80 px-1.5 text-[10px] font-extrabold tabular-nums text-muted-foreground">
                              {row.count}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(row.head.occurred_at)}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {row.catChips.map((c) => (
                                <span key={c.cat} title={c.label} className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-[10px] font-extrabold" style={{ background: tint(c.color, 0.1), color: c.color }}>
                                  <span className="text-[11px]">{c.glyph}</span>
                                  {c.label}
                                </span>
                              ))}
                            </div>
                            <div className="flex-1" />
                            {renderEntityButton(row.head)}
                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                          </div>
                        </div>
                        {/* détail complet : qui · quand · avant → après */}
                        {open && (
                          <div className="flex flex-col border-t border-border bg-muted/30">
                            {row.events.map((e, i) => {
                              const a = actorInfoOf(e, userMap)
                              return (
                                <div key={e.id} className={cn("flex flex-col gap-1 px-3 py-2", i < row.events.length - 1 && "border-b border-border")}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-[52px] shrink-0 font-mono text-[10px] font-bold text-muted-foreground">{fmtTimeSec(e.occurred_at)}</span>
                                    <span title={a.name} className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-extrabold text-white" style={{ background: a.color ?? "hsl(var(--muted-foreground))" }}>
                                      {a.initials}
                                    </span>
                                    <div className="min-w-0 flex-1">{renderAction(e, { minor: true, withDoc: true })}</div>
                                  </div>
                                  {showDiff(e) && (
                                    <div className="pl-[78px]">
                                      <FeedDiffRows row={e} resolver={valueResolver} />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {feed.hasNextPage && (
                <div className="flex justify-center py-3">
                  <Button variant="outline" size="sm" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                    {feed.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Charger plus"}
                  </Button>
                </div>
              )}
              <p className="py-2 text-center text-[11px] text-muted-foreground">{filtered.length} affichés · {total} action(s) sur la période</p>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

/** Une section repliable du menu ⚙ Filtres. */
function MenuSection({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-1.5 last:border-0">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-[10px] font-semibold text-muted-foreground">{value}</span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}
function MenuOption({ label, count, title, active, onClick }: { label: string; count?: number; title?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] font-bold hover:bg-muted/60", active ? "text-primary" : "text-foreground")}
    >
      <span className="flex-1">{label}</span>
      {typeof count === "number" && <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{count}</span>}
      {active && <span className="font-extrabold text-primary">✓</span>}
    </button>
  )
}

function ConnFeedRow({ row, userMap }: { row: ConnRow; userMap: UserMap }) {
  const isIn = row.dir === "in"
  const accent = isIn ? "#22C55E" : "#94A3B8"
  const u = userMap.get(row.userId)
  const name = u ? [u.firstname, u.lastname].filter(Boolean).join(" ") || row.actor.display || "—" : row.actor.display || "—"
  const color = u?.color ?? row.actor.color ?? null
  return (
    <div className="mb-1.5 flex items-stretch gap-2.5">
      <div className="relative flex w-11 shrink-0 flex-col items-center pt-3">
        <div className="absolute -bottom-1.5 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-border" />
        <span className="relative z-[1] bg-card px-0.5 font-mono text-[11px] font-extrabold text-foreground">{fmtTime(row.occurred_at)}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xl border border-border px-3 py-2 shadow-sm" style={{ background: isIn ? "rgba(34,197,94,.05)" : "hsl(var(--muted) / 0.3)" }}>
        <div className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: accent }} />
        <span title={name} className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white" style={{ background: color ?? "hsl(var(--muted-foreground))" }}>
          {initialsOf(name)}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(row.occurred_at)}</span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-extrabold" style={{ background: tint(accent, 0.16), color: accent }}>
          {isIn ? "●" : "○"}
        </span>
        <span className="text-[12px] font-semibold">{isIn ? "Connexion" : "Déconnexion"}</span>
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{isIn ? "Session ouverte" : "Session fermée"}</span>
      </div>
    </div>
  )
}

function StatusBadge({ s, small }: { s: StatusRef; small?: boolean }) {
  const color = s.color ?? "hsl(var(--muted-foreground))"
  return (
    <span className={cn("inline-flex rounded font-bold", small ? "px-1.5 py-px text-[9.5px]" : "px-2 py-0.5 text-[11px]")} style={{ background: tint(color, 0.13), color }}>
      {s.label}
    </span>
  )
}
