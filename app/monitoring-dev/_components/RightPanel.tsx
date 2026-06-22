"use client"

import { cn } from "@/lib/utils"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useTopEntities } from "@/hooks/useTopEntities"
import { DevActivityFeed } from "./DevActivityFeed"
import { TopEntitiesPanel } from "./TopEntitiesPanel"
import type { DevFocus, RightView } from "@/types/monitoring"

const tint = (c: string, a = 0.1) =>
  c.startsWith("#") ? `${c}${Math.round(a * 255).toString(16).padStart(2, "0")}` : c.replace(/\)\s*$/, ` / ${a})`)

interface RightPanelProps {
  startDate: Date
  endDate: Date
  /** Scope du flux & dossiers = union (gestionnaires sélectionnés ∪ cartes ouvertes). Vide = toute l'équipe. */
  scopeIds: string[]
  focus: DevFocus | null
  rightView: RightView
  onChangeRightView: (v: RightView) => void
  onClearFocus: () => void
}

export function RightPanel({
  startDate,
  endDate,
  scopeIds,
  focus,
  rightView,
  onChangeRightView,
  onClearFocus,
}: RightPanelProps) {
  const scoped = scopeIds.length ? scopeIds : null
  // Plage + acteurs effectifs : le focus (clic timeline) prime sur la sélection,
  // et s'applique AUSSI bien au flux qu'aux dossiers.
  const effStart = focus ? focus.start : startDate
  const effEnd = focus ? focus.end : endDate
  const effUserIds = focus ? [focus.userId] : scopeIds
  const effScoped = focus ? [focus.userId] : scoped

  const feed = useGlobalActivityFeed({
    startDate: effStart,
    endDate: effEnd,
    userIds: effScoped,
  })
  const feedTotal = feed.data?.pages[0]?.total ?? 0
  const { data: entities } = useTopEntities(effStart, effEnd, 20, effScoped)
  const entitiesCount = entities?.length ?? 0

  const tabs: { key: RightView; label: string; count: number }[] = [
    { key: "feed", label: "Flux d'actions", count: feedTotal },
    { key: "entities", label: "Dossiers actifs", count: entitiesCount },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border p-2.5">
        <div className="flex items-center">
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onChangeRightView(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  rightView === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
        {focus && (
          <button
            type="button"
            onClick={onClearFocus}
            title="Retirer le focus"
            className="inline-flex w-fit items-center gap-2 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold"
            style={{ borderColor: focus.color, background: tint(focus.color, 0.1), color: focus.color }}
          >
            ⌖ {focus.label} · {feedTotal} action{feedTotal > 1 ? "s" : ""} ✕
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {rightView === "feed" ? (
          <DevActivityFeed startDate={effStart} endDate={effEnd} userIds={effUserIds} />
        ) : (
          <TopEntitiesPanel startDate={effStart} endDate={effEnd} userIds={effUserIds} />
        )}
      </div>
    </div>
  )
}
