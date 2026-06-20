"use client"

import { useCallback, useMemo, useState } from "react"
import { Activity, ShieldAlert, X } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { useCrmRealtime } from "@/hooks/useCrmRealtime"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useTeamWeeklyStats } from "@/hooks/useTeamWeeklyStats"
import { useGestionnaires, type Gestionnaire } from "@/hooks/useGestionnaires"
import { Skeleton } from "@/components/ui/skeleton"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ExpandableAvatarGroup } from "@/components/ui/expandable-avatar-group"
import { RealtimeStatusDot } from "@/components/monitoring/RealtimeStatusDot"
import { cn } from "@/lib/utils"

import { usePeriodRange } from "./_lib/usePeriodRange"
import { formatRangeLabel } from "@/lib/monitoring/period-presets"
import { PeriodRangePicker } from "./_components/PeriodRangePicker"
import { KpiBand, type KpiItem } from "./_components/KpiBand"
import { LivePanel } from "./_components/LivePanel"
import { DevActivityFeed } from "./_components/DevActivityFeed"
import { TimelineView } from "./_components/TimelineView"
import { PulseView } from "./_components/PulseView"

type Variant = "control" | "timeline" | "pulse"

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "control", label: "Centre de contrôle" },
  { key: "timeline", label: "Timeline" },
  { key: "pulse", label: "Pulse" },
]

const frInt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)

function getDisplayName(g: Gestionnaire): string {
  return (
    [g.prenom ?? g.firstname, g.name ?? g.lastname].filter(Boolean).join(" ") ||
    g.code_gestionnaire ||
    g.username ||
    "—"
  )
}

export default function MonitoringDevPage() {
  const { hasRole, isLoading: isLoadingPerms } = usePermissions()
  const { preset, range, setPreset, setCustomRange } = usePeriodRange()
  const { connectionStatus } = useCrmRealtime()
  const presence = usePagePresenceContext()
  const { data: gestionnaires = [] } = useGestionnaires()

  const [variant, setVariant] = useState<Variant>("control")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleGestionnaire = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const scopedIds = selectedIds.length ? selectedIds : null

  const online = presence?.allUsers ?? []
  const activeCount = online.filter((u) => !u.isIdle).length
  const idleCount = online.filter((u) => u.isIdle).length

  const feed = useGlobalActivityFeed({ startDate: range.from, endDate: range.to, userIds: scopedIds })
  const feedTotal = feed.data?.pages[0]?.total ?? 0

  const { data: weekly } = useTeamWeeklyStats(range.from, range.to)
  const totals = useMemo(() => {
    const list = selectedIds.length
      ? (weekly ?? []).filter((m) => selectedIds.includes(m.user_id))
      : weekly ?? []
    return list.reduce(
      (acc, m) => ({
        created: acc.created + m.interventions_created,
        devis: acc.devis + m.devis_sent,
        completed: acc.completed + m.interventions_completed,
      }),
      { created: 0, devis: 0, completed: 0 }
    )
  }, [weekly, selectedIds])

  const kpis: KpiItem[] = [
    {
      label: "En ligne",
      value: String(activeCount),
      sub: idleCount > 0 ? `${idleCount} inactif${idleCount > 1 ? "s" : ""}` : "tous actifs",
      accent: "hsl(var(--success-hsl))",
      valueColor: "hsl(var(--success-hsl))",
    },
    { label: "Actions", value: frInt(feedTotal), sub: "sur la période", accent: "hsl(var(--primary))" },
    { label: "Créées", value: String(totals.created), sub: "interventions", accent: "hsl(var(--chart-4))", valueColor: "hsl(var(--chart-4))" },
    { label: "Devis", value: String(totals.devis), sub: "envoyés", accent: "hsl(var(--chart-1))", valueColor: "hsl(var(--chart-1))" },
    { label: "Terminées", value: String(totals.completed), sub: "+ acceptées", accent: "hsl(var(--chart-2))", valueColor: "hsl(var(--chart-2))" },
  ]

  if (isLoadingPerms) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    )
  }

  if (!hasRole("dev")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 opacity-40" />
        <p className="text-sm">Page réservée aux développeurs.</p>
      </div>
    )
  }

  const selectedGestionnaires = selectedIds
    .map((id) => gestionnaires.find((g) => g.id === id))
    .filter((g): g is Gestionnaire => Boolean(g))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ─── Header strip ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
            <Activity className="h-[21px] w-[21px]" />
          </div>
          <span className="absolute -bottom-1 -right-1.5 rounded-[5px] border-2 border-card bg-primary px-1 text-[8.5px] font-extrabold uppercase leading-tight tracking-wide text-primary-foreground">
            dev
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold leading-tight">Monitoring Dev</h1>
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              réservé développeurs
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            Activité complète du CRM · présence, audit, sessions
          </p>
        </div>

        <span className="flex items-center gap-2 rounded-full px-2.5 py-1" style={{ background: "hsl(var(--success-hsl) / 0.12)" }}>
          <RealtimeStatusDot status={connectionStatus} />
        </span>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {VARIANTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariant(v.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                variant === v.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* ─── Control bar ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Période</span>
        <PeriodRangePicker preset={preset} from={range.from} to={range.to} onPreset={setPreset} onCustom={setCustomRange} />
        <span className="hidden text-xs font-medium text-muted-foreground md:inline">{formatRangeLabel(range)}</span>
        <div className="flex-1" />

        {selectedGestionnaires.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedGestionnaires.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGestionnaire(g.id)}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-1 pr-2 text-xs font-medium text-primary hover:bg-primary/15"
                title="Retirer du filtre"
              >
                <GestionnaireBadge
                  firstname={g.firstname}
                  lastname={g.lastname}
                  prenom={g.prenom}
                  name={g.name}
                  color={g.color}
                  avatarUrl={g.avatar_url}
                  size="xs"
                />
                <span className="max-w-[120px] truncate">{getDisplayName(g)}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        {gestionnaires.length > selectedIds.length && (
          <ExpandableAvatarGroup
            items={gestionnaires
              .filter((g) => !selectedIds.includes(g.id))
              .map((g) => ({
                id: g.id,
                firstname: g.firstname,
                lastname: g.lastname,
                prenom: g.prenom,
                name: g.name,
                color: g.color,
                avatarUrl: g.avatar_url,
                searchText: `${getDisplayName(g)} ${g.code_gestionnaire ?? ""}`.trim(),
              }))}
            maxVisible={8}
            avatarSize="sm"
            onAvatarClick={toggleGestionnaire}
            showSearch
          />
        )}
      </div>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {variant === "control" && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <KpiBand items={kpis} />
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[40fr_60fr]">
              <div className="min-h-0">
                <LivePanel startDate={range.from} endDate={range.to} onToggleUser={toggleGestionnaire} selectedIds={selectedIds} />
              </div>
              <div className="min-h-0">
                <DevActivityFeed startDate={range.from} endDate={range.to} userIds={selectedIds} />
              </div>
            </div>
          </div>
        )}

        {variant === "timeline" && (
          <TimelineView startDate={range.from} endDate={range.to} userIds={selectedIds} onToggleUser={toggleGestionnaire} selectedIds={selectedIds} />
        )}

        {variant === "pulse" && (
          <PulseView startDate={range.from} endDate={range.to} userIds={selectedIds} onToggleUser={toggleGestionnaire} selectedIds={selectedIds} />
        )}
      </div>
    </div>
  )
}
