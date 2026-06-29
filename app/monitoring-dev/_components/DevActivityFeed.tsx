"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { useBatchResolver } from "@/hooks/useBatchResolver"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar as UIAvatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { catColor, categoryMeta, categoryOf, type ActivityCategory } from "@/lib/monitoring/activity-categories"
import { getFieldLabel } from "@/components/shared/history/HistoryEntry"
import type { HistoryValueResolver } from "@/components/shared/history/types"
import type { ActivityActor, GlobalActivityRow } from "@/types/monitoring"
import { DocPreviewContent, type DocPreviewTarget } from "./DocPreviewModal"
import { useFeedValueResolver, DiffValue, IGNORED_DIFF_FIELDS } from "./feedDiff"

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
const COST_TYPE_LABEL: Record<string, string> = { sst: "SST", materiel: "Matériel", intervention: "Intervention", marge: "Marge" }
const PAYMENT_TYPE_LABEL: Record<string, string> = { acompte_sst: "Acompte SST", acompte_client: "Acompte client", final: "Solde" }

/** Priorité de catégorie : détermine l'accent d'une carte groupée. */
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

/**
 * Mapping des événements de présence vers les briques du flux. Le flux ne montre que
 * 3 types métier : Connexion (portail), Déconnexion (logout OU inactivité >1h), Reconnexion
 * (retour après >1h). Le reste — ouverture de session sans portail, inactivité, fermeture
 * d'onglet — est masqué (retourne null) : la timeline le capture déjà.
 */
function describePresence(row: GlobalActivityRow): Pick<Brick, "accent" | "glyph" | "label" | "sub" | "connDir"> | null {
  const nv = (row.new_values ?? {}) as Record<string, unknown>
  const reason = typeof nv.reason === "string" ? nv.reason : null
  switch (row.action_type) {
    case "AUTH_LOGIN":
      return { accent: "#22C55E", glyph: "●", label: "Connexion", sub: "Portail auth", connDir: "in" }
    case "PRESENCE_RESUME":
      // Reconnexion seulement si on revient d'un offline (>1h). Masque les PRESENCE_RESUME
      // historiques émis à tort au retour d'une simple inactivité (previous_state ≠ offline).
      if (nv.previous_state !== "offline") return null
      return { accent: "#22C55E", glyph: "↻", label: "Reconnexion", sub: "Reprise après +1 h", connDir: "in" }
    case "PRESENCE_END":
      if (reason === "offline_threshold")
        return { accent: "#94A3B8", glyph: "○", label: "Déconnexion", sub: "Inactivité prolongée (+1 h)", connDir: "out" }
      if (reason === "logout")
        return { accent: "#94A3B8", glyph: "○", label: "Déconnexion", sub: "Déconnexion volontaire", connDir: "out" }
      return null // fermeture d'onglet ou autre → masqué
    // PRESENCE_START (ouverture sans portail) et IDLE_START (inactivité) → masqués
    default:
      return null
  }
}

interface ActorInfo {
  userId: string
  initials: string
  color: string | null
  name: string
  avatarUrl: string | null
}
type UserMap = Map<string, { firstname: string | null; lastname: string | null; color: string | null; avatar_url: string | null }>
function actorInfoOf(item: FeedItem, userMap: UserMap): ActorInfo {
  const actor = item.actor
  const userId = actor?.user_id ?? "?"
  const u = userMap.get(userId)
  const name = u ? [u.firstname, u.lastname].filter(Boolean).join(" ") || actor?.display || "—" : actor?.display || "—"
  // Avatar réel (couleur + photo) résolu depuis la source live settings/team ; repli sur
  // le snapshot dénormalisé de l'audit log (actor.*) pour les acteurs introuvables (ex. archivés).
  return { userId, initials: initialsOf(name), color: u?.color ?? actor?.color ?? null, name, avatarUrl: u?.avatar_url ?? null }
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
      return { ...base, text: "Statut", sub: null, from: resolveStatus(fromKey), to: resolveStatus(toKey) }
    }
    case "finance":
      return { ...base, text: row.action_type.startsWith("PAYMENT") ? "Paiement" : "Coût", sub: null }
    case "doc":
      return { ...base, text: "Document", sub: (nv.filename as string) ?? null, isDoc: true }
    case "comment": {
      const c = (nv.content as string) ?? ""
      return { ...base, text: "Commentaire", sub: c ? `« ${c.slice(0, 60)} »` : null }
    }
    case "assign":
      return { ...base, text: "Artisan", sub: null }
    case "archive":
      return { ...base, text: row.action_type === "RESTORE" ? "Restauré" : "Archivé", sub: null }
    case "email":
      return { ...base, text: "Email envoyé", sub: (nv.recipient_email as string) ?? null }
    default:
      return { ...base, text: "Modification", sub: null }
  }
}

// ── La brique : l'unité atomique du flux (1 champ modifié, 1 coût, 1 statut, 1 doc, 1 connexion…).
type BVal =
  | { t: "status"; ref: StatusRef }
  | { t: "field"; field: string; value: unknown }
  | { t: "text"; text: string }

interface Brick {
  key: string
  occurredAt: string
  actor: ActorInfo
  cat: ActivityCategory | "conn"
  accent: string
  glyph: string
  label: string
  before: BVal | null
  after: BVal | null
  sub: string | null
  entityRow: GlobalActivityRow | null
  isDoc: boolean
  isConn: boolean
  connDir: "in" | "out" | null
  roleTag: string | null
  artisanId: string | null
  artisanName: string | null
  entityType: string | null
  entityId: string | null
  ekind: EKind
  catFilter: CatFilter
  hay: string
}

/** Éclate un événement d'audit en briques atomiques (un UPDATE → 1 brique par champ). */
function toBricks(
  item: FeedItem,
  resolveStatus: (id: unknown) => StatusRef | null,
  userMap: UserMap,
  artisanName: (id: string | null | undefined) => string | null,
  costLabel: (id: string | null | undefined) => string | null,
): Brick[] {
  const actor = actorInfoOf(item, userMap)
  const occurredAt = item.occurred_at
  if (isConn(item)) {
    return [{
      key: item.id, occurredAt, actor, cat: "conn", accent: item.dir === "in" ? "#22C55E" : "#94A3B8",
      glyph: item.dir === "in" ? "●" : "○", label: item.dir === "in" ? "Connexion" : "Déconnexion",
      before: null, after: null, sub: item.dir === "in" ? "Session ouverte" : "Session fermée",
      entityRow: null, isDoc: false, isConn: true, connDir: item.dir,
      roleTag: null, artisanId: null, artisanName: null,
      entityType: null, entityId: null, ekind: "other", catFilter: "conn",
      hay: `connexion déconnexion ${actor.name}`.toLowerCase(),
    }]
  }
  const row = item
  if (row.entity_type === "presence") {
    const d = describePresence(row)
    if (!d) return [] // PRESENCE_START / IDLE_START / fermeture d'onglet → hors flux
    return [{
      key: row.id,
      occurredAt,
      actor,
      cat: "conn",
      accent: d.accent,
      glyph: d.glyph,
      label: d.label,
      before: null,
      after: null,
      sub: d.sub,
      entityRow: null,
      isDoc: false,
      isConn: true,
      connDir: d.connDir,
      roleTag: null,
      artisanId: null,
      artisanName: null,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ekind: "other",
      catFilter: "conn",
      hay: `${row.action_type} ${d.label} ${d.sub ?? ""} ${actor.name}`.toLowerCase(),
    }]
  }
  const cat = categoryOf(row.action_type)
  const accent = catColor(cat)
  const glyph = categoryMeta(cat).glyph
  const nv = (row.new_values ?? {}) as Record<string, unknown>
  const ov = (row.old_values ?? {}) as Record<string, unknown>
  const ekind = ekindOf(row)
  const hay = `${row.action_type} ${row.entity_label ?? ""} ${actor.name}`.toLowerCase()
  const base = {
    occurredAt, actor, cat, accent, entityRow: row, isConn: false as const, connDir: null,
    roleTag: null as string | null, artisanId: null as string | null, artisanName: null as string | null,
    entityType: row.entity_type, entityId: row.entity_id, ekind, catFilter: cat as CatFilter,
  }

  // UPDATE → une brique par champ modifié (hors champs techniques)
  if (cat === "update") {
    const fields = (row.changed_fields ?? []).filter((f): f is string => Boolean(f) && !IGNORED_DIFF_FIELDS.has(f.toLowerCase()))
    if (fields.length === 0) {
      return [{ ...base, key: row.id, glyph, label: "Modification", before: null, after: null, sub: null, isDoc: false, hay }]
    }
    return fields.map((f) => ({
      ...base,
      key: `${row.id}#${f}`,
      glyph,
      label: getFieldLabel(f),
      before: { t: "field", field: f, value: ov[f] } as BVal,
      after: { t: "field", field: f, value: nv[f] } as BVal,
      sub: null,
      isDoc: false,
      hay: `${hay} ${getFieldLabel(f).toLowerCase()}`,
    }))
  }

  // Événements sémantiques → une brique chacun (enrichie)
  const d = describe(row, resolveStatus)
  let label = d.text
  let before: BVal | null = d.from ? { t: "status", ref: d.from } : null
  let after: BVal | null = d.to ? { t: "status", ref: d.to } : null
  let sub: string | null = d.sub
  let roleTag: string | null = null
  let artisanId: string | null = null
  let artisanNm: string | null = null

  if (cat === "finance") {
    if (row.action_type.startsWith("PAYMENT")) {
      const pt = nv.payment_type as string | undefined
      label = pt && PAYMENT_TYPE_LABEL[pt] ? `Paiement ${PAYMENT_TYPE_LABEL[pt]}` : "Paiement"
    } else {
      // cost_type est dans le payload pour ADD/DELETE ; pour UPDATE (diff = {amount}) on le
      // résout via la ligne intervention_costs (related_entity_id, exposé par la migration 99050).
      const ct = (nv.cost_type ?? ov.cost_type) as string | undefined
      const ord = nv.artisan_order ?? ov.artisan_order
      let typeLabel = ct && COST_TYPE_LABEL[ct] ? COST_TYPE_LABEL[ct] + (ord === 1 || ord === 2 ? ` (Art. ${ord})` : "") : ""
      if (!typeLabel) typeLabel = costLabel(row.related_entity_id) ?? ""
      label = typeLabel ? `Coût ${typeLabel}` : "Coût"
    }
    const oldAmt = fmtEur(ov.amount ?? ov.montant)
    const newAmt = fmtEur(nv.amount ?? nv.montant)
    before = oldAmt ? { t: "text", text: oldAmt } : null
    after = newAmt ? { t: "text", text: newAmt } : null
    sub = null
  } else if (cat === "assign") {
    label = row.action_type === "ARTISAN_UNASSIGN" ? "Artisan retiré" : "Artisan assigné"
    const role = (nv.role ?? ov.role) as string | undefined
    const isPrimary = (nv.is_primary ?? ov.is_primary) as boolean | undefined
    roleTag = role === "primary" || isPrimary === true ? "SST 1" : role === "secondary" ? "SST 2" : null
    artisanId = ((nv.artisan_id ?? ov.artisan_id) as string | undefined) ?? null
    artisanNm = artisanName(artisanId)
    before = null
    after = null
    sub = null
  } else if (cat === "email") {
    const et = nv.email_type as string | undefined
    label = et === "devis" ? "Email devis" : et === "intervention" ? "Email intervention" : "Email envoyé"
    sub = (nv.recipient_email as string) ?? null
    artisanId = (nv.artisan_id as string | undefined) ?? null
    artisanNm = artisanName(artisanId)
    before = null
    after = null
  }

  return [{ ...base, key: row.id, glyph: d.glyph, label, before, after, sub, isDoc: d.isDoc, roleTag, artisanId, artisanName: artisanNm, hay }]
}

interface CatChip {
  cat: ActivityCategory
  glyph: string
  color: string
  label: string
}
type FeedRow =
  | { kind: "sep"; key: string; label: string }
  | { kind: "brick"; key: string; brick: Brick }
  | { kind: "card"; key: string; bricks: Brick[]; accent: string; count: number; actors: (ActorInfo & { count: number })[]; catChips: CatChip[]; head: Brick }

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
  const { data: gestionnaires } = useGestionnaires()
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

  // Avatars réels (couleur + photo) depuis la source live settings/team — pas le snapshot d'audit.
  const userMap = useMemo<UserMap>(() => {
    const map: UserMap = new Map()
    for (const g of gestionnaires ?? []) {
      map.set(g.id, {
        firstname: g.firstname ?? g.prenom ?? null,
        lastname: g.lastname ?? g.name ?? null,
        color: g.color,
        avatar_url: g.avatar_url ?? null,
      })
    }
    return map
  }, [gestionnaires])

  // Connexions / déconnexions dérivées des sessions réelles
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
  const hasPresenceEvents = useMemo(() => auditItems.some((item) => item.entity_type === "presence"), [auditItems])
  const valueResolver = useFeedValueResolver(auditItems)

  // Résolution des noms d'artisans (affectations + emails) — artisan_id est dans new/old_values
  const artisanIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of auditItems) {
      if (!(r.action_type.startsWith("ARTISAN") || r.action_type === "EMAIL_SENT")) continue
      const nv = (r.new_values ?? {}) as Record<string, unknown>
      const ov = (r.old_values ?? {}) as Record<string, unknown>
      const id = (nv.artisan_id ?? ov.artisan_id) as string | undefined
      if (id) s.add(id)
    }
    return [...s]
  }, [auditItems])
  const { map: artisanMap } = useBatchResolver({
    ids: artisanIds,
    table: "artisans",
    select: "id, plain_nom, raison_sociale",
    buildLabel: (r: Record<string, unknown>) => ({ label: (r.plain_nom as string) || (r.raison_sociale as string) || "Artisan" }),
  })
  const artisanName = useCallback((id: string | null | undefined) => (id ? artisanMap[id]?.label ?? null : null), [artisanMap])

  // Type de coût (COST_UPDATE ne porte que {amount}) → résolu via la ligne intervention_costs
  const costIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of auditItems) if (r.action_type === "COST_UPDATE" && r.related_entity_id) s.add(r.related_entity_id)
    return [...s]
  }, [auditItems])
  const { map: costMap } = useBatchResolver({
    ids: costIds,
    table: "intervention_costs",
    select: "id, cost_type, artisan_order",
    buildLabel: (r: Record<string, unknown>) => {
      const ct = r.cost_type as string
      const ord = r.artisan_order
      return { label: (COST_TYPE_LABEL[ct] ?? "") + (ord === 1 || ord === 2 ? ` (Art. ${ord})` : "") }
    },
  })
  const costLabel = useCallback((id: string | null | undefined) => (id ? costMap[id]?.label || null : null), [costMap])

  // Événements fusionnés (audit + connexions) → briques atomiques, triées du plus récent au plus ancien
  const allBricks = useMemo<Brick[]>(() => {
    const merged: FeedItem[] = hasPresenceEvents ? [...auditItems] : [...auditItems, ...connEvents]
    merged.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    return merged.flatMap((e) => toBricks(e, resolveStatus, userMap, artisanName, costLabel))
  }, [auditItems, connEvents, hasPresenceEvents, resolveStatus, userMap, artisanName, costLabel])

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? allBricks.filter((b) => b.hay.includes(q)) : allBricks
  }, [allBricks, query])

  const ekindCounts = useMemo(() => {
    const c: Record<EKind, number> = { all: searched.length, inter: 0, artisan: 0, other: 0 }
    for (const b of searched) c[b.ekind]++
    return c
  }, [searched])

  const afterEkind = useMemo(() => (ekind === "all" ? searched : searched.filter((b) => b.ekind === ekind)), [searched, ekind])

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: afterEkind.length }
    for (const b of afterEkind) c[b.catFilter] = (c[b.catFilter] ?? 0) + 1
    return c
  }, [afterEkind])

  const filtered = useMemo(
    () => (filter === "all" ? afterEkind : afterEkind.filter((b) => b.catFilter === filter)),
    [afterEkind, filter],
  )

  // Lignes du flux : séparateurs collants + cartes (groupé, par dossier+fenêtre) / briques à plat (détaillé)
  const feedRows = useMemo<FeedRow[]>(() => {
    const moments: { key: string; bricks: Brick[] }[] = []
    if (mode === "group") {
      const open = new Map<string, { m: { key: string; bricks: Brick[] }; lastMin: number }>()
      for (const b of filtered) {
        if (b.isConn || !b.entityId) {
          moments.push({ key: `s-${b.key}`, bricks: [b] })
          continue
        }
        const k = `${b.entityType}:${b.entityId}:${dayOffOf(b.occurredAt)}`
        const bMin = absMin(b.occurredAt)
        const g = open.get(k)
        const gap = g ? g.lastMin - bMin : Infinity
        if (g && gap >= 0 && gap <= winMin) {
          g.m.bricks.push(b)
          g.lastMin = bMin
        } else {
          const m = { key: `w-${k}-${b.key}`, bricks: [b] }
          open.set(k, { m, lastMin: bMin })
          moments.push(m)
        }
      }
    } else {
      for (const b of filtered) moments.push({ key: b.key, bricks: [b] })
    }

    const rows: FeedRow[] = []
    let curSec: string | null = null
    const pushSep = (iso: string) => {
      const s = sectionOf(iso, singleDay)
      if (s.key !== curSec) {
        curSec = s.key
        rows.push({ kind: "sep", key: `sep-${s.key}-${rows.length}`, label: s.label })
      }
    }
    for (const mo of moments.slice(0, 200)) {
      const head = mo.bricks[0]
      if (mode === "group" && !head.isConn) {
        pushSep(head.occurredAt)
        const bricks = mo.bricks
        // acteurs distincts (ordre d'apparition) + nb de modifs
        const actCount = new Map<string, number>()
        const ordered: string[] = []
        for (const b of bricks) {
          if (!actCount.has(b.actor.userId)) ordered.push(b.actor.userId)
          actCount.set(b.actor.userId, (actCount.get(b.actor.userId) ?? 0) + 1)
        }
        const actors = ordered.map((uid) => {
          const bb = bricks.find((b) => b.actor.userId === uid)!
          return { ...bb.actor, count: actCount.get(uid) ?? 0 }
        })
        // chips de catégories distinctes (ordre de priorité)
        const seen = new Set<string>()
        const catChips: CatChip[] = []
        for (const b of [...bricks].sort((a, z) => prioRank(a.cat as ActivityCategory) - prioRank(z.cat as ActivityCategory))) {
          if (b.cat === "conn" || seen.has(b.cat)) continue
          seen.add(b.cat)
          const m = categoryMeta(b.cat)
          catChips.push({ cat: b.cat, glyph: m.glyph, color: catColor(b.cat), label: m.label })
        }
        rows.push({ kind: "card", key: mo.key, bricks, accent: catChips[0]?.color ?? head.accent, count: bricks.length, actors, catChips, head })
      } else {
        for (const b of mo.bricks) {
          pushSep(b.occurredAt)
          rows.push({ kind: "brick", key: b.key, brick: b })
        }
      }
    }
    return rows
  }, [filtered, mode, winMin, singleDay])

  // Séparateurs collants : la puce épinglée fond dans la suivante, les puces derrière sont masquées (réplique V3)
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
        pill.style.opacity = "0"
        pill.style.transform = "scale(.55)"
      } else if (i === pinnedIdx) {
        const next = anchors[i + 1]
        const p = next ? ease(1 - (next.offsetTop - top - PIN) / TH) : 0
        pill.style.transformOrigin = "center bottom"
        pill.style.opacity = String(1 - p)
        pill.style.transform = `scale(${(1 - 0.42 * p).toFixed(3)}) translateY(${(7 * p).toFixed(1)}px)`
      } else {
        pill.style.opacity = "1"
        pill.style.transform = "none"
      }
    }
  }, [])

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
    else if (row.entity_type === "artisan") artisanModal.open(row.entity_id)
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
    if (row.entity_type === "artisan") return row.entity_label
    return null
  }

  const renderDocButton = (row: GlobalActivityRow) => {
    const open = preview?.rowId === row.id
    return (
      <Popover open={open} onOpenChange={(o) => setPreview(o ? buildDocTarget(row) : null)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Prévisualiser le document"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary hover:bg-primary/20"
          >
            ⊙ Aperçu
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

  const renderEntityButton = (row: GlobalActivityRow | null) => {
    if (!row) return null
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
        className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-extrabold"
        style={{ background: tint(c, 0.12), color: c, borderColor: tint(c, 0.3) }}
      >
        <span className="shrink-0">{isInter ? "◳" : "◈"}</span>
        <span className="truncate">{label}</span>
        <span className="shrink-0">↗</span>
      </button>
    )
  }

  const renderArtisanButton = (artisanId: string, name: string | null) => {
    const c = "hsl(var(--chart-1))"
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          artisanModal.open(artisanId)
        }}
        title="Ouvrir l'artisan"
        className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-extrabold"
        style={{ background: tint(c, 0.12), color: c, borderColor: tint(c, 0.3) }}
      >
        <span className="shrink-0">◈</span>
        <span className="truncate">{name || "Artisan"}</span>
        <span className="shrink-0">↗</span>
      </button>
    )
  }

  // Rendu inline d'une brique : glyphe · libellé · (rôle) · avant → après · sous-texte · (doc / artisan)
  const renderBrickInline = (b: Brick) => (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-extrabold"
        style={{ background: tint(b.accent, 0.16), color: b.accent }}
      >
        {b.glyph}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-foreground">{b.label}</span>
      {b.roleTag && <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[9.5px] font-bold text-muted-foreground">{b.roleTag}</span>}
      {b.before && <BrickValue v={b.before} resolver={valueResolver} strike />}
      {b.before && b.after && <span className="shrink-0 text-[11px] text-muted-foreground">→</span>}
      {b.after && <BrickValue v={b.after} resolver={valueResolver} />}
      {b.sub && <span className="min-w-0 break-words font-mono text-[11px] font-semibold text-muted-foreground">{b.sub}</span>}
      {b.isDoc && b.entityRow && renderDocButton(b.entityRow)}
      {b.artisanId && renderArtisanButton(b.artisanId, b.artisanName)}
    </div>
  )

  const filtActive = ekind !== "all" || mode !== "group" || winMin !== 15
  const ekindLabel = EKINDS.find((e) => e.key === ekind)?.label ?? "Tout"
  const winLabel = WINDOWS.find((w) => w.min === winMin)?.label ?? `${winMin} min`

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        {/* Contrôles : ⚙ Filtres + recherche, puis chips de catégorie */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold",
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
                      Fusionne les modifications d&apos;une même fiche dans cet intervalle. « Journée entière » regroupe tout le dossier du jour.
                    </p>
                  </MenuSection>
                )}
              </PopoverContent>
            </Popover>
            <div className="relative min-w-[120px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
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
        <div ref={feedScrollRef} onScroll={syncSecPill} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-2.5 pb-2.5 pt-1.5">
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
                      <div data-sec-anchor className="h-0 overflow-hidden" />
                      <div data-sec className="pointer-events-none sticky top-1.5 z-[9] my-2 flex justify-center">
                        <span className="pointer-events-auto inline-flex items-center rounded-full border border-border bg-card px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground shadow-sm will-change-[transform,opacity]">
                          {row.label}
                        </span>
                      </div>
                    </Fragment>
                  )
                }
                if (row.kind === "brick") {
                  const b = row.brick
                  if (b.isConn) return <ConnBrick key={row.key} brick={b} />
                  return (
                    <div key={row.key} className="mb-1.5 flex items-stretch gap-2.5">
                      <Rail iso={b.occurredAt} />
                      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="w-[3px] shrink-0" style={{ background: b.accent }} />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                          <Avatar actor={b.actor} />
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(b.occurredAt)}</span>
                          <div className="min-w-0 flex-1">{renderBrickInline(b)}</div>
                          {renderEntityButton(b.entityRow)}
                        </div>
                      </div>
                    </div>
                  )
                }
                // Carte groupée (dossier + fenêtre)
                const open = openTx.has(row.key)
                return (
                  <div key={row.key} className="mb-1.5 flex items-stretch gap-2.5">
                    <Rail iso={row.head.occurredAt} />
                    <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="w-[3px] shrink-0" style={{ background: row.accent }} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2" onClick={() => toggleTx(row.key)}>
                          {/* pile d'avatars distincts + overflow +N */}
                          <div className="flex shrink-0 items-center pl-2">
                            {row.actors.slice(0, 3).map((a) => (
                              <Avatar key={a.userId} actor={a} size={26} className="-ml-2 ring-2 ring-card" />
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
                                      <Avatar actor={a} size={20} />
                                      <span className="flex-1 truncate text-[11px] font-semibold">{a.name}</span>
                                      <span className="shrink-0 text-[9.5px] font-bold text-muted-foreground">{a.count} modif{a.count > 1 ? "s" : ""}</span>
                                    </div>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <span title={`${row.count} modification${row.count > 1 ? "s" : ""}`} className="flex h-4 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-muted/80 px-1.5 text-[10px] font-extrabold tabular-nums text-muted-foreground">
                            {row.count}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(row.head.occurredAt)}</span>
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {row.catChips.map((c) => (
                              <span key={c.cat} title={c.label} className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-[10px] font-extrabold" style={{ background: tint(c.color, 0.1), color: c.color }}>
                                <span className="text-[11px]">{c.glyph}</span>
                                {c.label}
                              </span>
                            ))}
                          </div>
                          <span className="ml-auto flex shrink-0 items-center gap-1.5">
                            {renderEntityButton(row.head.entityRow)}
                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                          </span>
                        </div>
                        {open && (
                          <div className="flex flex-col border-t border-border bg-muted/30">
                            {row.bricks.map((b, i) => (
                              <div key={b.key} className={cn("flex items-start gap-2 px-3 py-2", i < row.bricks.length - 1 && "border-b border-border")}>
                                <span className="w-[52px] shrink-0 pt-0.5 font-mono text-[10px] font-bold text-muted-foreground">{fmtTimeSec(b.occurredAt)}</span>
                                <Avatar actor={b.actor} size={18} />
                                <div className="min-w-0 flex-1">{renderBrickInline(b)}</div>
                              </div>
                            ))}
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
              <p className="py-2 text-center text-[11px] text-muted-foreground">{filtered.length} modification(s) affichée(s)</p>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

/** Rail timeline : l'heure sur une ligne verticale. */
function Rail({ iso }: { iso: string }) {
  return (
    <div className="relative flex w-11 shrink-0 flex-col items-center pt-3">
      <div className="absolute -bottom-1.5 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-border" />
      <span className="relative z-[1] bg-card px-0.5 font-mono text-[11px] font-extrabold text-foreground">{fmtTime(iso)}</span>
    </div>
  )
}
/** Avatar acteur : photo de profil réelle (settings/team), couleur + initiales en repli. */
function Avatar({ actor, size = 26, className }: { actor: ActorInfo; size?: number; className?: string }) {
  const bg = actor.color ?? "hsl(var(--muted-foreground))"
  return (
    <UIAvatar
      title={actor.name}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size, background: bg }}
    >
      {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt={actor.name} className="object-cover" />}
      <AvatarFallback
        className="font-extrabold uppercase text-white"
        style={{ background: bg, fontSize: size <= 18 ? "7.5px" : "9.5px" }}
      >
        {actor.initials}
      </AvatarFallback>
    </UIAvatar>
  )
}

/** Valeur d'une brique : badge de statut, valeur de champ résolue (tronquée + tooltip), ou texte. */
function BrickValue({ v, resolver, strike }: { v: BVal; resolver: HistoryValueResolver; strike?: boolean }) {
  if (v.t === "status") return <StatusBadge s={v.ref} small />
  if (v.t === "field") return <DiffValue field={v.field} value={v.value} resolver={resolver} kind={strike ? "old" : "new"} />
  return (
    <span className={cn("min-w-0 break-words text-[12px]", strike ? "text-muted-foreground/70 line-through" : "font-semibold text-foreground")}>{v.text}</span>
  )
}

/** Ligne de connexion / déconnexion (design distinct : chip à gauche · avatar à droite). */
function ConnBrick({ brick }: { brick: Brick }) {
  const accent = brick.accent
  return (
    <div className="mb-1.5 flex items-stretch gap-2.5">
      <Rail iso={brick.occurredAt} />
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="w-[3px] shrink-0" style={{ background: accent }} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2" style={{ background: tint(accent, 0.04) }}>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 text-[10.5px] font-extrabold" style={{ background: tint(accent, 0.1), color: accent }}>
            <span className="text-[11px]">{brick.glyph}</span>
            {brick.label}
          </span>
          {brick.sub && <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-semibold text-muted-foreground">{brick.sub}</span>}
          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{relTime(brick.occurredAt)}</span>
          <Avatar actor={brick.actor} />
        </div>
      </div>
    </div>
  )
}

/** Une section repliable du menu ⚙ Filtres. */
function MenuSection({ label, value, children }: { label: string; value: string; children: ReactNode }) {
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

function StatusBadge({ s, small }: { s: StatusRef; small?: boolean }) {
  const color = s.color ?? "hsl(var(--muted-foreground))"
  return (
    <span className={cn("inline-flex shrink-0 rounded font-bold", small ? "px-1.5 py-px text-[9.5px]" : "px-2 py-0.5 text-[11px]")} style={{ background: tint(color, 0.13), color }}>
      {s.label}
    </span>
  )
}
