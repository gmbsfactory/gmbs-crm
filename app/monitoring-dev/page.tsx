"use client"

import { useMemo } from "react"
import { Activity, ShieldAlert, X } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { useGestionnaires, type Gestionnaire } from "@/hooks/useGestionnaires"
import { Skeleton } from "@/components/ui/skeleton"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ExpandableAvatarGroup } from "@/components/ui/expandable-avatar-group"
import { cn } from "@/lib/utils"

import { usePeriodRange, type Granularity } from "./_lib/usePeriodRange"
import { useDevMonitoringState } from "./_lib/useDevMonitoringState"
import { GestionnaireList } from "./_components/GestionnaireList"
import { RightPanel } from "./_components/RightPanel"

const GRAN_TABS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
]

function getDisplayName(g: Gestionnaire): string {
  return [g.prenom ?? g.firstname, g.name ?? g.lastname].filter(Boolean).join(" ") || g.code_gestionnaire || g.username || "—"
}

export default function MonitoringDevPage() {
  const { hasRole, isLoading: isLoadingPerms } = usePermissions()
  const { gran, range, label: periodLabel, pickType, pickValue, canNext, setGran, step, onPick } = usePeriodRange()
  const granIdx = Math.max(0, GRAN_TABS.findIndex((g) => g.value === gran))
  const presence = usePagePresenceContext()
  const { data: gestionnaires = [] } = useGestionnaires()
  const st = useDevMonitoringState()

  // Scope du flux & dossiers : la sélection avatars PRIME ; sinon, fallback sur les cartes ouvertes.
  // (évite qu'une carte restée dépliée — donc hors liste filtrée — pollue le flux quand on sélectionne un avatar)
  const feedScope = useMemo(
    () => (st.selectedIds.length ? [...st.selectedIds] : [...st.expandedIds]).sort(),
    [st.selectedIds, st.expandedIds]
  )

  const online = presence?.allUsers ?? []
  const scopeOnline = st.selectedIds.length
    ? online.filter((u) => st.selectedIds.includes(u.userId) && !u.isIdle)
    : online.filter((u) => !u.isIdle)

  if (isLoadingPerms) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="flex-1 rounded-lg" />
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

  const selectedGestionnaires = st.selectedIds
    .map((id) => gestionnaires.find((g) => g.id === id))
    .filter((g): g is Gestionnaire => Boolean(g))

  const showLeft = st.maxed !== "right"
  const showRight = st.maxed !== "left"
  const showHandle = !st.maxed
  const leftFlex = st.maxed === "left" ? "1 1 auto" : `0 0 calc(${st.split}% - 8px)`

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ─── Header (une ligne) ─────────────────────────────────────── */}
      <header className="z-[5] flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 shadow-sm">
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <span className="absolute -bottom-1.5 -right-1.5 rounded-[5px] border-2 border-card bg-primary px-1 text-[8px] font-extrabold uppercase tracking-wide text-primary-foreground">
            dev
          </span>
        </div>

        {/* Période : granularité (Jour/Semaine/Mois) + navigation d'ancrage */}
        <div className="flex items-center gap-2">
          <div className="relative flex w-[228px] rounded-[11px] bg-muted p-[3px]">
            <div
              className="absolute bottom-[3px] left-[3px] top-[3px] rounded-[9px] bg-card shadow-sm"
              style={{
                width: "calc((100% - 6px) / 3)",
                transform: `translateX(calc(${granIdx} * 100%))`,
                transition: "transform .28s cubic-bezier(.34,1.3,.5,1)",
              }}
            />
            {GRAN_TABS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGran(g.value)}
                className={cn(
                  "relative z-[1] flex-1 rounded-[9px] px-2 py-1.5 text-[11.5px] font-bold transition-colors",
                  gran === g.value ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex h-9 items-center gap-0.5 rounded-[10px] border border-border bg-card p-[3px]">
            <button
              type="button"
              onClick={() => step(-1)}
              title="Période précédente"
              className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[15px] font-extrabold text-muted-foreground hover:bg-muted"
            >
              ‹
            </button>
            <label className="relative flex h-7 min-w-[128px] cursor-pointer items-center gap-1.5 rounded-[7px] bg-muted/60 px-2.5">
              <span className="text-[12px]">📅</span>
              <span className="whitespace-nowrap text-[12px] font-bold capitalize text-foreground">{periodLabel}</span>
              <input
                type={pickType}
                value={pickValue}
                onChange={(e) => onPick(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={!canNext}
              title="Période suivante"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[7px] text-[15px] font-extrabold",
                canNext ? "cursor-pointer text-muted-foreground hover:bg-muted" : "cursor-not-allowed text-muted-foreground/40"
              )}
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Live */}
        <span className="flex items-center gap-2 rounded-full px-2.5 py-1" style={{ background: "hsl(var(--success-hsl) / 0.12)" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "hsl(var(--success-hsl))" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "hsl(var(--success-hsl))" }} />
          </span>
          <span className="text-[11.5px] font-bold" style={{ color: "hsl(var(--success-hsl))" }}>{scopeOnline.length} en ligne</span>
        </span>

        {/* Notre sélecteur gestionnaire (Dashboard) */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Gestionnaires</span>
          {selectedGestionnaires.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => st.toggleFilter(g.id)}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-1 pr-2 text-xs font-medium text-primary hover:bg-primary/15"
              title="Retirer du filtre"
            >
              <GestionnaireBadge firstname={g.firstname} lastname={g.lastname} prenom={g.prenom} name={g.name} color={g.color} avatarUrl={g.avatar_url} size="xs" />
              <span className="max-w-[110px] truncate">{getDisplayName(g)}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          {gestionnaires.length > st.selectedIds.length && (
            <ExpandableAvatarGroup
              items={gestionnaires
                .filter((g) => !st.selectedIds.includes(g.id))
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
              onAvatarClick={st.toggleFilter}
              showSearch
            />
          )}
        </div>
      </header>

      {/* ─── Body : split redimensionnable ───────────────────────────── */}
      <div ref={st.bodyRef} className="flex min-h-0 flex-1 items-stretch gap-0 p-4">
        {/* Pastille gauche (quand droite maximisée) */}
        {st.maxed === "right" && (
          <button
            type="button"
            onClick={() => { st.setMaxed(null); st.setSplit(20) }}
            className="mr-3 flex w-[42px] shrink-0 flex-col items-center justify-between rounded-lg border border-border bg-card py-3 text-primary shadow-sm hover:bg-muted/50"
            title="Afficher les gestionnaires"
          >
            <span className="text-sm font-extrabold">›</span>
            <span className="text-[12px] font-extrabold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Gestionnaires</span>
            <span className="text-sm font-extrabold">›</span>
          </button>
        )}

        {showLeft && (
          <div className="min-h-0 min-w-0" style={{ flex: leftFlex }}>
            <GestionnaireList
              startDate={range.from}
              endDate={range.to}
              selectedIds={st.selectedIds}
              expandedIds={st.expandedIds}
              sort={st.sort}
              onToggleFilter={st.toggleFilter}
              onToggleExpand={st.toggleExpand}
              onSetSort={st.toggleSort}
              onFocus={st.applyFocus}
            />
          </div>
        )}

        {showHandle && (
          <div onMouseDown={st.startDrag} className="group flex w-4 shrink-0 cursor-col-resize items-center justify-center" title="Glisser pour ajuster · pousser au-delà pour maximiser">
            <div className="h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-primary" />
          </div>
        )}

        {showRight && (
          <div className="min-h-0 min-w-0" style={{ flex: "1 1 auto" }}>
            <RightPanel
              startDate={range.from}
              endDate={range.to}
              scopeIds={feedScope}
              focus={st.focus}
              rightView={st.rightView}
              onChangeRightView={st.setRightView}
              onClearFocus={st.clearFocus}
            />
          </div>
        )}

        {/* Pastille droite (quand gauche maximisée) */}
        {st.maxed === "left" && (
          <button
            type="button"
            onClick={() => { st.setMaxed(null); st.setSplit(80) }}
            className="ml-3 flex w-[42px] shrink-0 flex-col items-center justify-between rounded-lg border border-border bg-card py-3 text-primary shadow-sm hover:bg-muted/50"
            title="Afficher le flux & dossiers"
          >
            <span className="text-sm font-extrabold">‹</span>
            <span className="text-[12px] font-extrabold" style={{ writingMode: "vertical-rl" }}>Flux &amp; dossiers</span>
            <span className="text-sm font-extrabold">‹</span>
          </button>
        )}
      </div>
    </div>
  )
}
