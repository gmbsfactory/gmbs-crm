"use client"

import { useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  ALL_CATEGORIES,
  catColor,
  catTint,
  categoryMeta,
  categoryOf,
  type ActivityCategory,
} from "@/lib/monitoring/activity-categories"
import type { GlobalActivityRow } from "@/types/monitoring"

// ── Types ──────────────────────────────────────────────────────────────────
type FeedFilter = ActivityCategory | "all" | "conn"

interface StatusRef {
  label: string
  color: string | null
}
interface FeedEvent {
  id: string
  ts: number
  time: string
  isConn: boolean
  category: FeedFilter
  glyph: string
  color: string
  text: string
  sub: string | null
  from: StatusRef | null
  to: StatusRef | null
  actorName: string
  actorColor: string
  entityKind: "intervention" | "artisan" | null
  entityId: string | null
  entityLabel: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function fmtEur(v: unknown): string | null {
  const n = Number(v)
  if (!v || Number.isNaN(n)) return null
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
}
/** Fond teinté depuis une couleur hex (#rrggbb, DB) ou hsl(var(--x)) (token). */
function tint(color: string, a = 0.16): string {
  if (color.startsWith("#")) return `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`
  return color.replace(/\)\s*$/, ` / ${a})`)
}

type StatusResolver = (id: unknown) => StatusRef | null

function describe(row: GlobalActivityRow, resolveStatus: StatusResolver): {
  glyph: string
  color: string
  text: string
  sub: string | null
  from: StatusRef | null
  to: StatusRef | null
} {
  const cat = categoryOf(row.action_type)
  const meta = categoryMeta(cat)
  const nv = (row.new_values ?? {}) as Record<string, unknown>
  const base = { glyph: meta.glyph, color: catColor(cat), from: null as StatusRef | null, to: null as StatusRef | null }

  switch (cat) {
    case "create":
      return { ...base, text: row.entity_type === "intervention" ? "Intervention créée" : "Artisan créé", sub: null }
    case "status": {
      const ov = (row.old_values ?? {}) as Record<string, unknown>
      const from = resolveStatus(ov.statut_id)
      const to =
        resolveStatus(nv.statut_id) ??
        (row.entity_meta && "statut_label" in row.entity_meta
          ? { label: row.entity_meta.statut_label ?? "—", color: row.entity_meta.statut_color ?? null }
          : null)
      return { ...base, text: "Changement de statut", sub: null, from, to }
    }
    case "finance": {
      const isPayment = row.action_type.startsWith("PAYMENT")
      return { ...base, text: isPayment ? "Paiement" : "Coût", sub: fmtEur(nv.amount ?? nv.montant) }
    }
    case "doc":
      return { ...base, text: "Document", sub: (nv.filename as string) ?? null }
    case "comment": {
      const content = (nv.content as string) ?? ""
      return { ...base, text: "Commentaire", sub: content ? `« ${content.slice(0, 60)} »` : null }
    }
    case "assign":
      return { ...base, text: row.action_type === "ARTISAN_UNASSIGN" ? "Artisan désassigné" : "Artisan assigné", sub: null }
    case "archive":
      return { ...base, text: row.action_type === "RESTORE" ? "Restauré" : "Archivé", sub: null }
    default: {
      const fields = (row.changed_fields ?? []).filter(Boolean)
      return { ...base, text: "Modification", sub: fields.length ? `${fields.length} champ${fields.length > 1 ? "s" : ""}` : null }
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────
interface DevActivityFeedProps {
  startDate: Date
  endDate: Date
  userIds: string[]
}

export function DevActivityFeed({ startDate, endDate, userIds }: DevActivityFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all")
  const [query, setQuery] = useState("")

  const scopedIds = userIds.length ? userIds : null
  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000

  const feed = useGlobalActivityFeed({ startDate, endDate, userIds: scopedIds })
  const { data: connections } = useTeamConnections(startDate, endDate, scopedIds, singleDay)
  const { data: refData } = useReferenceDataQuery()
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const resolveStatus = useMemo<StatusResolver>(() => {
    const map = new Map<string, StatusRef>()
    refData?.interventionStatuses?.forEach((s) => map.set(s.id, { label: s.label || s.code, color: s.color }))
    refData?.artisanStatuses?.forEach((s) => map.set(s.id, { label: s.label || s.code, color: s.color }))
    return (id: unknown) => (typeof id === "string" ? map.get(id) ?? null : null)
  }, [refData])

  const events = useMemo<FeedEvent[]>(() => {
    const rows = feed.data?.pages.flatMap((p) => p.items) ?? []
    const out: FeedEvent[] = rows.map((row) => {
      const d = describe(row, resolveStatus)
      return {
        id: row.id,
        ts: new Date(row.occurred_at).getTime(),
        time: fmtTime(row.occurred_at),
        isConn: false,
        category: categoryOf(row.action_type),
        glyph: d.glyph,
        color: d.color,
        text: d.text,
        sub: d.sub,
        from: d.from,
        to: d.to,
        actorName: row.actor?.display ?? row.actor?.code ?? "—",
        actorColor: row.actor?.color ?? "hsl(var(--muted-foreground))",
        entityKind: row.entity_type,
        entityId: row.entity_id,
        entityLabel: row.entity_label,
      }
    })

    // Connexions/déconnexions injectées sur une plage d'un jour
    if (singleDay && connections) {
      for (const c of connections) {
        const day = c.days[0]
        if (!day) continue
        const name = [c.firstname, c.lastname].filter(Boolean).join(" ") || c.code_gestionnaire || "—"
        const color = c.color ?? "hsl(var(--muted-foreground))"
        if (day.first_seen_at) {
          out.push({
            id: `conn-in-${c.user_id}`, ts: new Date(day.first_seen_at).getTime(), time: fmtTime(day.first_seen_at),
            isConn: true, category: "conn", glyph: "●", color: "hsl(var(--success-hsl))", text: "Connexion", sub: null,
            from: null, to: null, actorName: name, actorColor: color, entityKind: null, entityId: null, entityLabel: null,
          })
        }
        if (day.last_seen_at) {
          out.push({
            id: `conn-out-${c.user_id}`, ts: new Date(day.last_seen_at).getTime(), time: fmtTime(day.last_seen_at),
            isConn: true, category: "conn", glyph: "○", color: "hsl(var(--muted-foreground))", text: "Déconnexion", sub: null,
            from: null, to: null, actorName: name, actorColor: color, entityKind: null, entityId: null, entityLabel: null,
          })
        }
      }
    }

    return out.sort((a, b) => b.ts - a.ts)
  }, [feed.data, connections, singleDay, resolveStatus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false
      if (q) {
        const hay = `${e.text} ${e.sub ?? ""} ${e.entityLabel ?? ""} ${e.actorName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [events, filter, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length }
    for (const e of events) c[e.category] = (c[e.category] ?? 0) + 1
    return c
  }, [events])

  const chips: { key: FeedFilter; label: string; color: string }[] = [
    { key: "all", label: "Tout", color: "hsl(var(--primary))" },
    ...ALL_CATEGORIES.map((c) => ({ key: c as FeedFilter, label: categoryMeta(c).label, color: catColor(c) })),
    { key: "conn", label: "Connexions", color: "hsl(var(--success-hsl))" },
  ]

  const total = feed.data?.pages[0]?.total ?? 0

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header + chips + search */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-extrabold">⟟ Flux d&apos;activité</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-xs font-medium outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => {
            const active = filter === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
                  !active && "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
                style={active ? { background: tint(c.color, 0.16), color: c.color, borderColor: tint(c.color, 0.35) } : undefined}
              >
                {c.label}
                <span className="ml-1.5 tabular-nums opacity-60">{counts[c.key] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {feed.isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            Aucun événement ne correspond aux filtres.
          </p>
        ) : (
          <>
            {filtered.map((e) => (
              <div
                key={e.id}
                className="mb-0.5 flex gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/50"
                style={{ borderLeft: `3px solid ${e.isConn ? e.color : "transparent"}` }}
              >
                <span className="shrink-0 pt-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {e.time}
                </span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold"
                  style={{ background: tint(e.color, 0.16), color: e.color }}
                >
                  {e.glyph}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold">{e.text}</span>
                    {e.from && (
                      <>
                        <StatusBadge s={e.from} />
                        <span className="text-[11px] text-muted-foreground">→</span>
                      </>
                    )}
                    {e.to && <StatusBadge s={e.to} />}
                    {e.sub && <span className="font-mono text-[11.5px] font-semibold text-muted-foreground">{e.sub}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: e.actorColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.actorColor }} />
                      {e.actorName}
                    </span>
                    {e.entityKind && e.entityId && (
                      <button
                        type="button"
                        onClick={() =>
                          e.entityKind === "intervention"
                            ? interventionModal.open(e.entityId!)
                            : artisanModal.open(e.entityId!)
                        }
                        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-px font-mono text-[10.5px] font-bold text-muted-foreground hover:bg-muted"
                      >
                        {e.entityKind === "intervention" ? "◳" : "◈"} {e.entityLabel ?? e.entityId.slice(0, 8)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {feed.hasNextPage && (
              <div className="flex justify-center py-3">
                <Button variant="outline" size="sm" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                  {feed.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Charger plus"}
                </Button>
              </div>
            )}
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              {filtered.length} affichés · {total} sur la période
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ s }: { s: StatusRef }) {
  const color = s.color ?? "hsl(var(--muted-foreground))"
  return (
    <span
      className="inline-flex rounded px-1.5 py-px text-[10px] font-bold"
      style={{ background: tint(color, 0.13), color }}
    >
      {s.label}
    </span>
  )
}
