"use client"

import { useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { catColor, categoryMeta, categoryOf, type ActivityCategory } from "@/lib/monitoring/activity-categories"
import type { ActivityActor, GlobalActivityRow } from "@/types/monitoring"
import { DocPreviewModal, type DocPreviewTarget } from "./DocPreviewModal"

type FeedMode = "group" | "detail"
type FeedFilter = ActivityCategory | "all" | "conn"

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
const catOf = (x: FeedItem): FeedFilter => (isConn(x) ? "conn" : categoryOf(x.action_type))

interface StatusRef {
  label: string
  color: string | null
}

const CHIPS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "create", label: "Créations" },
  { key: "status", label: "Statuts" },
  { key: "finance", label: "Finances" },
  { key: "doc", label: "Documents" },
  { key: "comment", label: "Commentaires" },
  { key: "conn", label: "Connexions" },
]

const PRIORITY: ActivityCategory[] = ["status", "create", "finance", "assign", "doc", "comment", "update", "archive"]

function tint(color: string, a = 0.16): string {
  if (color.startsWith("#")) return `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`
  return color.replace(/\)\s*$/, ` / ${a})`)
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
function dayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
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
      const to =
        resolveStatus(nv.statut_id) ??
        (row.entity_meta && "statut_label" in row.entity_meta
          ? { label: row.entity_meta.statut_label ?? "—", color: row.entity_meta.statut_color ?? null }
          : null)
      return { ...base, text: "Changement de statut", sub: null, from: resolveStatus(ov.statut_id), to }
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
    default: {
      const f = (row.changed_fields ?? []).filter(Boolean)
      return { ...base, text: "Modification", sub: f.length ? `${f.length} champ${f.length > 1 ? "s" : ""}` : null }
    }
  }
}

interface DevActivityFeedProps {
  startDate: Date
  endDate: Date
  userIds: string[]
}

export function DevActivityFeed({ startDate, endDate, userIds }: DevActivityFeedProps) {
  const [mode, setMode] = useState<FeedMode>("group")
  const [filter, setFilter] = useState<FeedFilter>("all")
  const [query, setQuery] = useState("")
  const [openTx, setOpenTx] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<DocPreviewTarget | null>(null)

  const feed = useGlobalActivityFeed({ startDate, endDate, userIds: userIds.length ? userIds : null })
  const { data: refData } = useReferenceDataQuery()
  const { data: connections } = useTeamConnections(startDate, endDate, userIds.length ? userIds : null, true)
  const presence = usePagePresenceContext()
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000

  const resolveStatus = useMemo(() => {
    const map = new Map<string, StatusRef>()
    refData?.interventionStatuses?.forEach((s) => map.set(s.id, { label: s.label || s.code, color: s.color }))
    refData?.artisanStatuses?.forEach((s) => map.set(s.id, { label: s.label || s.code, color: s.color }))
    return (id: unknown) => (typeof id === "string" ? map.get(id) ?? null : null)
  }, [refData])

  const userMap = useMemo(() => {
    const map = new Map<string, { firstname: string | null; lastname: string | null; color: string | null; avatar_url: string | null }>()
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

  // Fusion audit + connexions, triées du plus récent au plus ancien
  const allEvents = useMemo<FeedItem[]>(() => {
    const merged: FeedItem[] = [...auditItems, ...connEvents]
    merged.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    return merged
  }, [auditItems, connEvents])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allEvents.length }
    for (const it of allEvents) {
      const cat = catOf(it)
      c[cat] = (c[cat] ?? 0) + 1
    }
    return c
  }, [allEvents])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allEvents.filter((it) => {
      if (filter !== "all" && catOf(it) !== filter) return false
      if (q) {
        const hay = isConn(it)
          ? `connexion déconnexion ${it.actor.display ?? ""} ${it.actor.code ?? ""}`.toLowerCase()
          : `${it.action_type} ${it.entity_label ?? ""} ${it.actor?.display ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allEvents, filter, query])

  // Regroupement par transaction (entité + acteur + minute) ; les connexions restent isolées
  const moments = useMemo(() => {
    const out: { txKey: string; events: FeedItem[] }[] = []
    for (const e of filtered) {
      if (isConn(e)) {
        out.push({ txKey: e.id, events: [e] })
        continue
      }
      const txKey = `${e.entity_id}::${e.actor?.user_id ?? "?"}::${Math.floor(new Date(e.occurred_at).getTime() / 60000)}`
      const last = out[out.length - 1]
      if (last && last.txKey === txKey && last.events.length && !isConn(last.events[0])) last.events.push(e)
      else out.push({ txKey, events: [e] })
    }
    return out
  }, [filtered])

  const toggleTx = (k: string) =>
    setOpenTx((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const openEntity = (row: GlobalActivityRow) => {
    if (row.entity_type === "intervention") interventionModal.open(row.entity_id)
    else artisanModal.open(row.entity_id)
  }
  const openDoc = (row: GlobalActivityRow) =>
    setPreview({
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      filename: (row.new_values as Record<string, unknown> | null)?.filename as string | null ?? null,
    })

  // Contenu inline d'une action : badges de statut OU glyphe + texte + sous-texte.
  // `withDoc` ajoute le bouton « ⊙ voir » en ligne (sous-actions repliées).
  const renderInline = (row: GlobalActivityRow, minor = false, withDoc = false) => {
    const d = describe(row, resolveStatus)
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {d.from || d.to ? (
          <>
            {d.from && <StatusBadge s={d.from} small={minor} />}
            {d.from && d.to && <span className="text-[11px] text-muted-foreground">→</span>}
            {d.to && <StatusBadge s={d.to} small={minor} />}
          </>
        ) : (
          <>
            <span
              className={cn("flex shrink-0 items-center justify-center rounded font-extrabold", minor ? "h-[18px] w-[18px] text-[10px]" : "h-[22px] w-[22px] text-[12px]")}
              style={{ background: tint(d.color, 0.16), color: d.color }}
            >
              {d.glyph}
            </span>
            <span className={cn("font-semibold", minor ? "text-[11.5px]" : "text-[12.5px]")}>{d.text}</span>
          </>
        )}
        {d.sub && <span className="font-mono text-[11.5px] font-semibold text-muted-foreground">{d.sub}</span>}
        {withDoc && d.isDoc && (
          <button
            type="button"
            onClick={() => openDoc(row)}
            title="Prévisualiser le document"
            className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary hover:bg-primary/20"
          >
            ⊙ voir
          </button>
        )}
      </div>
    )
  }
  // Colonne « œil » (aperçu document) de la ligne principale.
  const renderDocCol = (row: GlobalActivityRow) => {
    if (categoryOf(row.action_type) !== "doc") return null
    return (
      <button
        type="button"
        onClick={() => openDoc(row)}
        title="Prévisualiser le document"
        className="flex h-7 w-7 items-center justify-center rounded-lg border text-[14px]"
        style={{ color: "#0EA5E9", background: tint("#0EA5E9", 0.08), borderColor: tint("#0EA5E9", 0.2) }}
      >
        ⊙
      </button>
    )
  }
  // Colonne « dossier » (ouverture du modal réel) de la ligne principale.
  // Intervention : on affiche l'ID inter (et non la référence agence), avec un
  // ID provisoire INT-<uuid> en repli quand id_inter est nul. Artisan : libellé.
  const renderEntityCol = (row: GlobalActivityRow) => {
    const isInter = row.entity_type === "intervention"
    const idInter = isInter ? (row.entity_meta as { id_inter?: string | null } | null)?.id_inter : null
    const label = isInter
      ? idInter || row.entity_label || `INT-${row.entity_id.slice(0, 8)}`
      : row.entity_label
    if (!label) return null
    const c = isInter ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"
    return (
      <button
        type="button"
        onClick={() => openEntity(row)}
        title="Ouvrir le dossier"
        className="inline-flex max-w-full items-center gap-1 truncate rounded border px-2 py-[3px] font-mono text-[10.5px] font-bold"
        style={{ background: tint(c, 0.12), color: c, borderColor: tint(c, 0.3) }}
      >
        {isInter ? "◳" : "◈"} {label}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Contrôles : mode + chips + recherche */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            <button type="button" onClick={() => setMode("group")} className={cn("rounded-md px-2.5 py-1 text-[11px] font-bold", mode === "group" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>⊟ Groupé</button>
            <button type="button" onClick={() => setMode("detail")} className={cn("rounded-md px-2.5 py-1 text-[11px] font-bold", mode === "detail" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>≡ Détaillé</button>
          </div>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-xs font-medium outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIPS.map((c) => {
            const active = filter === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors", !active && "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted")}
                style={active ? { background: "hsl(var(--primary) / 0.16)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.35)" } : undefined}
              >
                {c.label}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[c.key] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lignes */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {feed.isLoading ? (
          <div className="space-y-1.5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : moments.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-muted-foreground">Aucun événement ne correspond aux filtres.</p>
        ) : (
          <>
            {moments.slice(0, 120).map((mo) => {
              const head = mo.events[0]
              if (isConn(head)) return <ConnFeedRow key={mo.txKey} row={head} userMap={userMap} singleDay={singleDay} />
              const rows = mo.events as GlobalActivityRow[]
              const grouped = mode === "group" && rows.length > 1
              const headIdx = grouped ? rows.reduce((best, e, i, arr) => {
                const r = PRIORITY.indexOf(categoryOf(e.action_type))
                const rb = PRIORITY.indexOf(categoryOf(arr[best].action_type))
                return (r < 0 ? 99 : r) < (rb < 0 ? 99 : rb) ? i : best
              }, 0) : 0
              const headRow = rows[headIdx]
              const minors = grouped ? rows.filter((_, i) => i !== headIdx) : []
              const u = headRow.actor?.user_id ? userMap.get(headRow.actor.user_id) : undefined
              const avColor = u?.color ?? headRow.actor?.color ?? null
              const avName = u ? [u.firstname, u.lastname].filter(Boolean).join(" ") : headRow.actor?.display ?? "—"
              const accent = catColor(categoryOf(headRow.action_type))
              const open = openTx.has(mo.txKey)
              return (
                <div key={mo.txKey} className="mb-0.5 flex items-stretch rounded-lg hover:bg-muted/40">
                  <div className="my-[7px] w-[3px] shrink-0 rounded-full" style={{ background: accent }} />
                  <div className="relative flex w-[74px] shrink-0 items-center gap-1.5 py-1.5 pl-2 pr-1">
                    <div className="absolute bottom-0 left-[54px] top-0 w-0.5 -translate-x-1/2 bg-border" />
                    <div className="z-[1] flex w-[28px] flex-col items-end">
                      {!singleDay && <span className="text-[8px] font-bold capitalize text-muted-foreground">{dayShort(headRow.occurred_at)}</span>}
                      <span className="font-mono text-[9.5px] font-semibold tabular-nums text-muted-foreground">{fmtTime(headRow.occurred_at).slice(0, 5)}</span>
                    </div>
                    <span className="relative z-[1] rounded-full" style={{ boxShadow: "0 0 0 3px hsl(var(--card))" }}>
                      <GestionnaireBadge firstname={u?.firstname ?? avName} lastname={u?.lastname} color={avColor} avatarUrl={u?.avatar_url} size="xs" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 py-2 pl-1 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">{renderInline(headRow)}</div>
                      <div className="flex w-[30px] shrink-0 items-center justify-center">{renderDocCol(headRow)}</div>
                      <div className="flex w-[96px] shrink-0 items-center justify-end">{renderEntityCol(headRow)}</div>
                    </div>
                    {minors.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleTx(mo.txKey)}
                          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground hover:bg-muted"
                        >
                          +{minors.length} autre{minors.length > 1 ? "s" : ""} modification{minors.length > 1 ? "s" : ""}
                          <span className={cn("transition-transform", open && "rotate-180")}>⌄</span>
                        </button>
                        {open && (
                          <div className="mt-0.5 flex flex-col gap-1 border-l-2 border-border pl-2">
                            {minors.map((m) => (
                              <div key={m.id}>{renderInline(m, true, true)}</div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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

      <DocPreviewModal target={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function ConnFeedRow({
  row,
  userMap,
  singleDay,
}: {
  row: ConnRow
  userMap: Map<string, { firstname: string | null; lastname: string | null; color: string | null; avatar_url: string | null }>
  singleDay: boolean
}) {
  const isIn = row.dir === "in"
  const accent = isIn ? "#22C55E" : "#94A3B8"
  const u = userMap.get(row.userId)
  const avColor = u?.color ?? row.actor.color ?? null
  const avName = u ? [u.firstname, u.lastname].filter(Boolean).join(" ") : row.actor.display ?? "—"
  return (
    <div className="mb-0.5 flex items-stretch rounded-lg" style={{ background: isIn ? "rgba(34,197,94,.05)" : "hsl(var(--muted) / 0.3)" }}>
      <div className="my-[7px] w-[3px] shrink-0 rounded-full" style={{ background: accent }} />
      <div className="relative flex w-[74px] shrink-0 items-center gap-1.5 py-1.5 pl-2 pr-1">
        <div className="absolute bottom-0 left-[54px] top-0 w-0.5 -translate-x-1/2 bg-border" />
        <div className="z-[1] flex w-[28px] flex-col items-end">
          {!singleDay && <span className="text-[8px] font-bold capitalize text-muted-foreground">{dayShort(row.occurred_at)}</span>}
          <span className="font-mono text-[9.5px] font-semibold tabular-nums text-muted-foreground">{fmtTime(row.occurred_at).slice(0, 5)}</span>
        </div>
        <span className="relative z-[1] rounded-full" style={{ boxShadow: "0 0 0 3px hsl(var(--card))" }}>
          <GestionnaireBadge firstname={u?.firstname ?? avName} lastname={u?.lastname} color={avColor} avatarUrl={u?.avatar_url} size="xs" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-1 pr-2">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[12px] font-extrabold" style={{ background: tint(accent, 0.16), color: accent }}>
          {isIn ? "●" : "○"}
        </span>
        <span className="text-[12.5px] font-semibold">{isIn ? "Connexion" : "Déconnexion"}</span>
        <span className="font-mono text-[11.5px] font-semibold text-muted-foreground">{isIn ? "Session ouverte" : "Session fermée"}</span>
      </div>
    </div>
  )
}

function StatusBadge({ s, small }: { s: StatusRef; small?: boolean }) {
  const color = s.color ?? "hsl(var(--muted-foreground))"
  return (
    <span
      className={cn("inline-flex rounded font-bold", small ? "px-1.5 py-px text-[9.5px]" : "px-2 py-0.5 text-[11px]")}
      style={{ background: tint(color, 0.13), color }}
    >
      {s.label}
    </span>
  )
}
