"use client"

import { useMemo, useRef } from "react"
import { pageHex, pageLabel } from "@/lib/monitoring/activity-categories"
import { toParisDateStr } from "@/lib/monitoring/local-date"
import { smoothSessions, totalInactivityMs } from "@/lib/monitoring/session-smoothing"
import type { DevFocus, HeatmapBucket, HeatmapCell, TeamConnection } from "@/types/monitoring"
import type { TipData } from "./useTimelineTooltip"

const pad = (n: number) => String(n).padStart(2, "0")
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
function minutesOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function fmtDur(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}
function fmtShort(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m > 0 ? pad(m) : ""}` : `${m}m`
}
function dayLabelShort(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  const today = new Date()
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === y.toDateString()) return "Hier"
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}
function isTodayDate(date: string): boolean {
  return new Date(`${date}T00:00:00`).toDateString() === new Date().toDateString()
}

/** Axe horaire adaptatif (pas 15/30/60/120 min selon l'amplitude) + trame de fond. */
function mkAxis(rds: number, rde: number) {
  const span = Math.max(1, rde - rds)
  const step = span <= 120 ? 15 : span <= 240 ? 30 : span <= 480 ? 60 : 120
  const ticks: { left: string; label: string }[] = []
  let t = Math.ceil(rds / step) * step
  for (; t <= rde + 0.5; t += step) {
    const label = t % 60 === 0 ? `${pad(t / 60)}h` : hhmm(t)
    ticks.push({ left: `${(((t - rds) / span) * 100).toFixed(2)}%`, label })
  }
  const gp = ((step / span) * 100).toFixed(3)
  const grid = `repeating-linear-gradient(to right, transparent 0, transparent calc(${gp}% - 1px), hsl(var(--border) / .55) calc(${gp}% - 1px), hsl(var(--border) / .55) ${gp}%)`
  return { ticks, grid }
}

export interface ExpandedAction {
  occurredAt: string
  color: string
  label: string
}

interface GestionnaireExpandedProps {
  connection: TeamConnection | undefined
  actions: ExpandedAction[]
  heatmapCells: HeatmapCell[]
  bucket: HeatmapBucket
  isLoading?: boolean
  userId: string
  userName: string
  userColor: string | null
  /** Statut temps réel : pour afficher « en cours » + le repère « maintenant ». */
  isOnline?: boolean
  onFocus: (f: DevFocus) => void
  axisStart?: number
  axisEnd?: number
  pageColors?: Record<string, string>
  /** Seuil de lissage des micro-coupures (ms). Au-delà = inactivité ; >= 1h = déconnexion. */
  smoothMs?: number
  /** Plage de zoom active (en minutes) pour ce gestionnaire, ou null. */
  zoom?: { ds: number; de: number } | null
  onSetZoom?: (dsMin: number, deMin: number) => void
  onClearZoom?: () => void
  showTip?: (e: { clientX: number; clientY: number }, d: TipData) => void
  hideTip?: () => void
}

export function GestionnaireExpanded({
  connection,
  actions,
  heatmapCells,
  bucket,
  isLoading,
  userId,
  userName,
  userColor,
  isOnline,
  onFocus,
  axisStart = 6,
  axisEnd = 22,
  pageColors,
  smoothMs = 5 * 60_000,
  zoom = null,
  onSetZoom,
  onClearZoom,
  showTip,
  hideTip,
}: GestionnaireExpandedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const days = useMemo(() => connection?.days ?? [], [connection])

  const axS = axisStart
  const axE = Math.max(axisStart + 1, axisEnd)
  const tlDs = axS * 60
  const tlDe = axE * 60
  const rds = zoom ? Math.max(tlDs, zoom.ds) : tlDs
  const rde = zoom ? Math.min(tlDe, zoom.de) : tlDe
  const span = Math.max(1, rde - rds)
  const lp = (min: number) => Math.max(0, Math.min(100, ((min - rds) / span) * 100))
  const ax = useMemo(() => mkAxis(rds, rde), [rds, rde])
  const pc = (page: string) => pageColors?.[page] ?? pageHex(page)

  const actionsByDate = useMemo(() => {
    const map = new Map<string, ExpandedAction[]>()
    for (const a of actions) {
      const key = toParisDateStr(new Date(a.occurredAt))
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    }
    return map
  }, [actions])

  const focusColor = userColor ?? "hsl(var(--primary))"
  const focusFor = (date: string, hour: number | null) => {
    const start = hour != null ? new Date(`${date}T${pad(hour)}:00:00`) : new Date(`${date}T00:00:00`)
    const end = hour != null ? new Date(start.getTime() + 3_600_000) : new Date(`${date}T23:59:59.999`)
    const label = `${userName} · ${dayLabelShort(date)}${hour != null ? ` · ${pad(hour)}h` : ""}`
    onFocus({ userId, label, color: focusColor, start, end })
  }

  // ─── zoom par glisser (sélection sur les barres) ───
  const startZoomDrag = (e: React.MouseEvent) => {
    if (!onSetZoom) return
    const strip = e.currentTarget as HTMLElement
    const sels = containerRef.current
      ? Array.from(containerRef.current.querySelectorAll<HTMLElement>(".mdev-zoomsel"))
      : []
    const rect = strip.getBoundingClientRect()
    const frac = (cx: number) => Math.max(0, Math.min(1, (cx - rect.left) / rect.width))
    const f0 = frac(e.clientX)
    let moved = false
    const toMin = (f: number) => rds + f * span
    const snap = (m: number) => Math.round(m / 15) * 15
    const show = (a: number, b: number) =>
      sels.forEach((s) => {
        s.style.display = "block"
        s.style.left = `${a * 100}%`
        s.style.width = `${(b - a) * 100}%`
      })
    show(f0, f0)
    const move = (ev: MouseEvent) => {
      const f1 = frac(ev.clientX)
      if (Math.abs(f1 - f0) > 0.006) moved = true
      show(Math.min(f0, f1), Math.max(f0, f1))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
      document.body.style.userSelect = ""
      sels.forEach((s) => { s.style.display = "none" })
      if (!moved) return
      const f1 = frac(ev.clientX)
      const a = snap(toMin(Math.min(f0, f1)))
      const b = snap(toMin(Math.max(f0, f1)))
      if (b - a < 15) return
      onSetZoom(a, b)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
    document.body.style.userSelect = "none"
  }

  // ─── heatmap (jour unique) : plage horaire complète (non zoomée) ───
  const singleDay = bucket === "hour"
  const heatHours = useMemo(() => {
    const out: number[] = []
    for (let h = axS; h < axE; h++) out.push(h)
    return out
  }, [axS, axE])
  const heatByHour = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of heatmapCells) {
      const h = parseInt(c.bucket, 10)
      m.set(h, (m.get(h) ?? 0) + c.count)
    }
    return m
  }, [heatmapCells])
  const heatMax = useMemo(() => Math.max(1, ...heatHours.map((h) => heatByHour.get(h) ?? 0)), [heatHours, heatByHour])
  const heatDate = days[0]?.date ?? null
  const zoomLabel = zoom ? `${hhmm(rds)} → ${hhmm(rde)}` : ""

  return (
    <div ref={containerRef} className="mt-2 flex flex-col gap-2 border-t border-dashed border-border pt-3">
      {/* axe horaire (zoomable au glisser) */}
      <div className="flex items-center gap-2.5">
        <div className="flex w-[96px] shrink-0 items-center">
          {zoom && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClearZoom?.() }}
              title="Quitter le zoom (Échap)"
              className="inline-flex items-center gap-1 rounded-md border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[9px] font-extrabold text-primary"
            >
              ⊗ {zoomLabel}
            </button>
          )}
        </div>
        <div onMouseDown={startZoomDrag} className="relative h-4 flex-1 cursor-crosshair" title="Glisser sur les horaires pour zoomer">
          <div className="mdev-zoomsel pointer-events-none absolute -top-0.5 bottom-0 z-[6] hidden border-x-2 border-primary" style={{ background: "hsl(var(--primary) / 0.14)" }} />
          {ax.ticks.map((t, i) => (
            <span key={i} className="pointer-events-none absolute top-0.5 -translate-x-1/2 font-mono text-[9px] font-semibold text-muted-foreground" style={{ left: t.left }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="flex w-[96px] shrink-0 items-center justify-end gap-1.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
          <span className="min-w-[28px] text-center">actions</span>
          <span className="min-w-[38px] text-right">écran</span>
        </div>
      </div>

      {isLoading && days.length === 0 ? (
        <p className="py-3 text-center text-[11px] italic text-muted-foreground">Chargement…</p>
      ) : days.length === 0 ? (
        <p className="py-3 text-center text-[11px] italic text-muted-foreground">Aucune session sur la période.</p>
      ) : (
        days.map((d) => {
          const allDayTicks = actionsByDate.get(d.date) ?? []
          const dayTicks = allDayTicks.filter((t) => {
            const m = minutesOf(t.occurredAt)
            return m >= rds && m <= rde
          })
          const live = isTodayDate(d.date) && !!isOnline
          const { segs, inactivities, breaks } = smoothSessions(d.sessions, smoothMs)
          const inactCount = inactivities.length
          const breakCount = breaks.length
          const idleMs = totalInactivityMs(inactivities)
          const firstMin = d.first_seen_at ? minutesOf(d.first_seen_at) : null
          const lastMin = d.last_seen_at ? minutesOf(d.last_seen_at) : null
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
          // Connexion/déconnexion multiples : une paire par session (séparées par les déconnexions >= 1h)
          const connMins = [firstMin, ...breaks.map((b) => minutesOf(b.end))].filter((m): m is number => m != null)
          const discMinsAll = [...breaks.map((b) => minutesOf(b.start)), lastMin].filter((m): m is number => m != null)
          // en live, la dernière déconnexion (fin de journée) est remplacée par le repère « maintenant »
          const discMins = discMinsAll.filter((_, idx) => !(live && idx === discMinsAll.length - 1))
          const windowLabel = zoom
            ? `zoom ${hhmm(rds)}–${hhmm(rde)}`
            : `${fmtTime(d.first_seen_at)} → ${live ? "en cours" : fmtTime(d.last_seen_at)}${breakCount > 0 ? ` · ${breakCount + 1} sessions` : ""}`
          return (
            <div key={d.date} className="flex items-center gap-2.5">
              <div className="flex w-[96px] shrink-0 flex-col overflow-hidden">
                <span className="truncate text-[11px] font-bold capitalize">{dayLabelShort(d.date)}</span>
                <span className="truncate font-mono text-[9px] text-muted-foreground">{windowLabel}</span>
              </div>
              <div
                onMouseDown={startZoomDrag}
                className="relative h-[26px] min-w-0 flex-1 cursor-crosshair overflow-hidden rounded-md"
                style={{ background: "hsl(var(--muted) / 0.3)" }}
              >
                <div className="mdev-zoomsel pointer-events-none absolute inset-y-0 z-[5] hidden border-x-2 border-primary" style={{ background: "hsl(var(--primary) / 0.2)" }} />
                {/* segments d'écran */}
                {segs.map((s, i) => {
                  const a = Math.max(minutesOf(s.started_at), rds)
                  const b = Math.min(minutesOf(s.ended_at), rde)
                  if (b <= a) return null
                  const left = lp(a)
                  const w = lp(b) - left
                  const segMs = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
                  return (
                    <div
                      key={`s${i}`}
                      onMouseEnter={(e) => showTip?.(e, { text: pageLabel(s.page_name), sub: `${fmtTime(s.started_at)} – ${fmtTime(s.ended_at)}  ·  ${fmtDur(segMs)}`, tag: "temps écran", tagColor: pc(s.page_name) })}
                      onMouseLeave={() => hideTip?.()}
                      className="absolute bottom-[3px] top-[3px] flex items-center justify-center overflow-hidden rounded-sm px-1"
                      style={{ left: `${left}%`, width: `${w}%`, minWidth: "2px", background: pc(s.page_name) }}
                    >
                      {w >= 8.5 && (
                        <span className="truncate text-[9px] font-bold text-white" style={{ textShadow: "0 1px 1px rgba(0,0,0,.25)" }}>
                          {pageLabel(s.page_name).slice(0, 4)} {fmtShort(segMs)}
                        </span>
                      )}
                    </div>
                  )
                })}
                {/* inactivité (veille) hachurée 45° */}
                {inactivities.map((p, i) => {
                  const a = Math.max(minutesOf(p.start), rds)
                  const b = Math.min(minutesOf(p.end), rde)
                  if (b <= a) return null
                  const left = lp(a)
                  const w = lp(b) - left
                  return (
                    <div
                      key={`i${i}`}
                      onMouseEnter={(e) => showTip?.(e, { time: `${fmtTime(p.start)} – ${fmtTime(p.end)}`, text: `Inactif ${fmtDur(p.durationMs)}`, sub: p.durationMs >= 1_800_000 ? "absence prolongée" : "veille écran", tag: "inactivité", tagColor: "rgba(148,163,184,.5)" })}
                      onMouseLeave={() => hideTip?.()}
                      className="absolute bottom-[3px] top-[3px] z-[1] rounded-sm"
                      style={{
                        left: `${left}%`,
                        width: `${w}%`,
                        minWidth: "2px",
                        backgroundColor: "hsl(var(--muted) / 0.25)",
                        backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / .28) 0, hsl(var(--muted-foreground) / .28) 1.5px, transparent 1.5px, transparent 5px)",
                      }}
                    />
                  )
                })}
                {/* déconnexion timeline (≥ 1h) : matérialisée par les marqueurs + « N sessions » (pas de bande) */}
                {/* tics d'action cliquables */}
                {dayTicks.map((t, i) => (
                  <button
                    key={`t${i}`}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); focusFor(d.date, Math.floor(minutesOf(t.occurredAt) / 60)) }}
                    onMouseEnter={(e) => showTip?.(e, { time: fmtTime(t.occurredAt), text: t.label })}
                    onMouseLeave={() => hideTip?.()}
                    className="absolute bottom-[1px] top-[1px] z-[2] w-0.5 -translate-x-1/2 cursor-pointer rounded-sm hover:w-1"
                    style={{ left: `${lp(minutesOf(t.occurredAt))}%`, background: t.color }}
                  />
                ))}
                {/* marqueurs connexion (vert) / déconnexion (gris) / maintenant (pointillé) */}
                {connMins.filter((m) => m >= rds && m <= rde).map((m, i) => (
                  <div key={`cm${i}`} title={`Connexion ${hhmm(m)}`} className="absolute -bottom-px -top-px z-[3] w-0 border-l-2" style={{ left: `${lp(m)}%`, borderColor: "#22C55E" }} />
                ))}
                {discMins.filter((m) => m >= rds && m <= rde).map((m, i) => (
                  <div key={`dm${i}`} title={`Déconnexion ${hhmm(m)}`} className="absolute -bottom-px -top-px z-[3] w-0 border-l-2" style={{ left: `${lp(m)}%`, borderColor: "#94A3B8" }} />
                ))}
                {live && nowMin >= rds && nowMin <= rde && (
                  <div title="Maintenant" className="absolute -bottom-px -top-px z-[3] w-0 border-l-[1.5px] border-dashed" style={{ left: `${lp(nowMin)}%`, borderColor: "hsl(var(--primary))" }} />
                )}
              </div>
              <div className="flex w-[96px] shrink-0 flex-col items-end gap-0.5">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); focusFor(d.date, null) }}
                    title="Voir ces actions dans le flux"
                    className="min-w-[28px] rounded-md bg-primary/10 px-1.5 py-1 text-center text-[12px] font-extrabold tabular-nums text-primary hover:bg-primary/20"
                  >
                    {allDayTicks.length}
                  </button>
                  <span className="min-w-[38px] text-right text-[11px] font-extrabold tabular-nums">{fmtDur(d.total_screen_time_ms)}</span>
                </div>
                {inactCount > 0 && (
                  <span
                    title={`${inactCount} période${inactCount > 1 ? "s" : ""} d'inactivité · ${fmtDur(idleMs)} au total`}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[8.5px] font-bold text-muted-foreground"
                  >
                    <span
                      className="h-[7px] w-[14px] rounded-sm"
                      style={{
                        backgroundColor: "hsl(var(--muted) / 0.4)",
                        backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / .45) 0, hsl(var(--muted-foreground) / .45) 1px, transparent 1px, transparent 3px)",
                      }}
                    />
                    {fmtShort(idleMs)} inactif
                  </span>
                )}
              </div>
            </div>
          )
        })
      )}

      {singleDay && heatDate && (
        <div className="mt-1 flex flex-col gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Actions · par heure{" "}
            <span className="font-medium normal-case tracking-normal">— clic sur une heure = filtre le flux</span>
          </span>
          <div className="flex items-center gap-2.5">
            <div className="w-[96px] shrink-0" />
            <div className="flex flex-1 gap-1">
              {heatHours.map((h) => {
                const v = heatByHour.get(h) ?? 0
                const ratio = v / heatMax
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={v === 0}
                    onClick={(e) => { e.stopPropagation(); focusFor(heatDate, h) }}
                    title={`${pad(h)}h · ${v} action${v > 1 ? "s" : ""}`}
                    className="flex h-[21px] flex-1 items-center justify-center rounded text-[9px] font-extrabold tabular-nums enabled:cursor-pointer"
                    style={{
                      background: v === 0 ? "hsl(var(--muted) / 0.4)" : `hsl(var(--primary) / ${(0.16 + 0.62 * ratio).toFixed(2)})`,
                      color: v === 0 ? "hsl(var(--muted-foreground) / 0.55)" : ratio > 0.5 ? "#fff" : "hsl(var(--primary))",
                    }}
                  >
                    {v || ""}
                  </button>
                )
              })}
            </div>
            <div className="w-[96px] shrink-0" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-[96px] shrink-0" />
            <div className="flex flex-1 gap-1">
              {heatHours.map((h) => (
                <span key={h} className="flex-1 text-center font-mono text-[8px] text-muted-foreground">
                  {pad(h)}
                </span>
              ))}
            </div>
            <div className="w-[96px] shrink-0" />
          </div>
        </div>
      )}
    </div>
  )
}
