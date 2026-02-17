"use client"

import { useMemo } from "react"

interface PageStat {
  page_name: string
  total_duration_ms: number
  visit_count: number
}

interface PageSession {
  page_name: string
  started_at: string
  ended_at: string
  duration_ms: number
}

interface ScreenTimeChartProps {
  pages: PageStat[]
  sessions: PageSession[]
  firstSeenAt: string | null
  lastSeenAt: string | null
}

/* ---------- Colour palette ---------- */

const PAGE_COLORS: Record<string, { bg: string; bar: string }> = {
  interventions: { bg: "bg-blue-500", bar: "#3b82f6" },
  artisans: { bg: "bg-emerald-500", bar: "#10b981" },
  comptabilite: { bg: "bg-amber-500", bar: "#f59e0b" },
  dashboard: { bg: "bg-violet-500", bar: "#8b5cf6" },
}
const DEFAULT_COLOR = { bg: "bg-slate-400", bar: "#94a3b8" }

function getColor(page: string) {
  return PAGE_COLORS[page.toLowerCase()] ?? DEFAULT_COLOR
}

/* ---------- Helpers ---------- */

function formatDurationShort(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`
  return `${minutes}min`
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatYLabel(ms: number): string {
  const h = ms / 3600000
  if (h >= 1 && h === Math.floor(h)) return `${h}h`
  const min = ms / 60000
  return `${Math.round(min)}min`
}

/** Compute nice Y-axis ceiling and gridline steps in ms */
function computeYScale(maxMs: number): { ceilMs: number; gridlines: number[] } {
  if (maxMs <= 0) return { ceilMs: 3600000, gridlines: [1800000, 3600000] }

  const candidates = [
    900000, // 15min
    1800000, // 30min
    3600000, // 1h
    7200000, // 2h
    10800000, // 3h
  ]
  let step = candidates[candidates.length - 1]
  for (const c of candidates) {
    if (maxMs <= c * 3) {
      step = c
      break
    }
  }

  const ceil = Math.ceil(maxMs / step) * step
  const lines: number[] = []
  for (let v = step; v <= ceil; v += step) {
    lines.push(v)
  }
  return { ceilMs: ceil, gridlines: lines }
}

/** Build hourly buckets: for each hour, how many ms per page */
function computeHourlyBuckets(
  sessions: PageSession[],
  startHour: number,
  endHour: number,
  refDate: Date
) {
  const buckets = new Map<number, Map<string, number>>()
  for (let h = startHour; h < endHour; h++) {
    buckets.set(h, new Map())
  }

  for (const session of sessions) {
    const sStart = new Date(session.started_at).getTime()
    const sEnd = new Date(session.ended_at).getTime()
    const page = session.page_name.toLowerCase()

    for (let h = startHour; h < endHour; h++) {
      const hourStart = new Date(refDate)
      hourStart.setHours(h, 0, 0, 0)
      const hourEnd = new Date(refDate)
      hourEnd.setHours(h + 1, 0, 0, 0)

      const overlapStart = Math.max(sStart, hourStart.getTime())
      const overlapEnd = Math.min(sEnd, hourEnd.getTime())

      if (overlapEnd > overlapStart) {
        const ms = overlapEnd - overlapStart
        const bucket = buckets.get(h)!
        bucket.set(page, (bucket.get(page) || 0) + ms)
      }
    }
  }

  return buckets
}

/* ---------- Constants ---------- */

const CHART_HEIGHT = 130
const BAR_WIDTH = 7
const BAR_GAP = 2

/* ---------- Component ---------- */

export function ScreenTimeChart({
  pages,
  sessions,
}: ScreenTimeChartProps) {
  const chartData = useMemo(() => {
    if (sessions.length === 0) return null

    // Derive hour range from sessions
    let minTs = Infinity
    let maxTs = -Infinity
    for (const s of sessions) {
      const start = new Date(s.started_at).getTime()
      const end = new Date(s.ended_at).getTime()
      if (start < minTs) minTs = start
      if (end > maxTs) maxTs = end
    }

    const refDate = new Date(minTs)
    const startHour = Math.max(0, new Date(minTs).getHours())
    const endRaw = new Date(maxTs)
    const endHour = Math.min(
      24,
      endRaw.getMinutes() > 0 || endRaw.getSeconds() > 0
        ? endRaw.getHours() + 1
        : Math.max(startHour + 1, endRaw.getHours())
    )

    const buckets = computeHourlyBuckets(sessions, startHour, endHour, refDate)

    // Page order: by total duration DESC
    const pageOrder = pages
      .slice()
      .sort((a, b) => b.total_duration_ms - a.total_duration_ms)
      .map((p) => p.page_name.toLowerCase())

    // Find max total ms in any hour
    let maxHourTotal = 0
    for (const [, pageDurations] of buckets) {
      let total = 0
      for (const ms of pageDurations.values()) total += ms
      if (total > maxHourTotal) maxHourTotal = total
    }

    const { ceilMs, gridlines } = computeYScale(maxHourTotal)

    // Build bar data for each hour
    const bars: { hour: number; segments: { page: string; ms: number }[] }[] =
      []
    for (let h = startHour; h < endHour; h++) {
      const pageDurations = buckets.get(h)!
      const segments: { page: string; ms: number }[] = []
      for (const page of pageOrder) {
        const ms = pageDurations.get(page) || 0
        if (ms > 0) segments.push({ page, ms })
      }
      bars.push({ hour: h, segments })
    }

    // X-axis labels: show every 2-3 hours
    const totalHours = endHour - startHour
    const labelStep = totalHours > 12 ? 3 : totalHours > 6 ? 2 : 1
    const xLabels: number[] = []
    for (let h = startHour; h < endHour; h += labelStep) {
      xLabels.push(h)
    }

    return { startHour, endHour, bars, ceilMs, gridlines, xLabels, pageOrder }
  }, [sessions, pages])

  // Fallback: no sessions but pages exist
  if (!chartData && pages.length > 0) {
    return <FallbackList pages={pages} />
  }

  if (!chartData) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        Aucune session enregistree.
      </p>
    )
  }

  const { bars, ceilMs, gridlines, xLabels, startHour, endHour } = chartData

  // Sorted pages for legend
  const sortedPages = pages
    .slice()
    .sort((a, b) => b.total_duration_ms - a.total_duration_ms)

  return (
    <div className="bg-muted/30 rounded-xl p-4">
      <div className="flex gap-5">
        {/* ---------- Chart area ---------- */}
        <div className="flex-1 min-w-0">
          {/* Chart container with right-side Y-axis */}
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            {/* Gridlines + Y-axis labels (right side) */}
            {/* Baseline at 0 */}
            <div className="absolute left-0 right-0 bottom-0 border-b border-dashed border-muted-foreground/20">
              <span className="absolute -bottom-0.5 -right-8 text-[9px] text-muted-foreground translate-y-1/2">
                0
              </span>
            </div>

            {gridlines.map((ms) => {
              const pct = (ms / ceilMs) * 100
              return (
                <div
                  key={ms}
                  className="absolute left-0 right-0 border-b border-dashed border-muted-foreground/20"
                  style={{ bottom: `${pct}%` }}
                >
                  <span className="absolute -bottom-0.5 -right-8 text-[9px] text-muted-foreground translate-y-1/2 whitespace-nowrap">
                    {formatYLabel(ms)}
                  </span>
                </div>
              )
            })}

            {/* Bars */}
            <div
              className="flex items-end justify-center h-full"
              style={{ gap: BAR_GAP, paddingRight: 32 }}
            >
              {bars.map((bar) => {
                const totalBarMs = bar.segments.reduce(
                  (sum, s) => sum + s.ms,
                  0
                )
                const totalHeightPct = ceilMs > 0 ? (totalBarMs / ceilMs) * 100 : 0

                return (
                  <div
                    key={bar.hour}
                    className="flex flex-col justify-end items-center"
                    style={{ height: "100%", width: BAR_WIDTH }}
                    title={`${String(bar.hour).padStart(2, "0")}h — ${formatDurationShort(totalBarMs)}`}
                  >
                    {totalBarMs > 0 ? (
                      <div
                        className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                        style={{ height: `${totalHeightPct}%` }}
                      >
                        {bar.segments.map((seg, i) => {
                          const segPct =
                            totalBarMs > 0 ? (seg.ms / totalBarMs) * 100 : 0
                          return (
                            <div
                              key={`${seg.page}-${i}`}
                              className="w-full shrink-0"
                              style={{
                                height: `${segPct}%`,
                                minHeight: segPct > 0 ? 1 : 0,
                                backgroundColor: getColor(seg.page).bar,
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <div
                        className="w-full rounded-t-sm bg-muted-foreground/5"
                        style={{ height: 1 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="relative h-5 mt-1.5" style={{ paddingRight: 32 }}>
            {xLabels.map((h) => {
              const totalSpan = endHour - startHour
              const pct =
                totalSpan > 0
                  ? ((h - startHour + 0.5) / totalSpan) * 100
                  : 0
              return (
                <span
                  key={h}
                  className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                >
                  {String(h).padStart(2, "0")} h
                </span>
              )
            })}
          </div>
        </div>

        {/* ---------- Legend (right side) ---------- */}
        <div className="shrink-0 flex flex-col justify-center gap-2.5 min-w-[110px]">
          {sortedPages.map((p) => (
            <div key={p.page_name} className="flex items-start gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-[3px] shrink-0 mt-[3px] ${getColor(p.page_name).bg}`}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate leading-tight text-foreground">
                  {capitalizeFirst(p.page_name)}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {formatDurationShort(p.total_duration_ms)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Fallback ---------- */

function FallbackList({ pages }: { pages: PageStat[] }) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-1.5">
      {pages
        .slice()
        .sort((a, b) => b.total_duration_ms - a.total_duration_ms)
        .map((p) => (
          <div key={p.page_name} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-[3px] shrink-0 ${getColor(p.page_name).bg}`}
            />
            <span className="font-medium min-w-0 truncate">
              {capitalizeFirst(p.page_name)}
            </span>
            <span className="text-muted-foreground ml-auto whitespace-nowrap">
              {formatDurationShort(p.total_duration_ms)}
            </span>
          </div>
        ))}
    </div>
  )
}
