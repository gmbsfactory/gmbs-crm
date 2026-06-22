"use client"

import { cn } from "@/lib/utils"
import { PAGE_LIST, pageHex } from "@/lib/monitoring/activity-categories"

const SMOOTH_OPTIONS: { v: number; label: string }[] = [
  { v: 0, label: "Aucun" },
  { v: 3, label: "3 min" },
  { v: 5, label: "5 min" },
  { v: 10, label: "10 min" },
  { v: 15, label: "15 min" },
]

interface DevSettingsProps {
  pageColors: Record<string, string>
  setPageColor: (page: string, color: string) => void
  tlMode: "fixed" | "auto"
  setTlMode: (m: "fixed" | "auto") => void
  tlStart: number
  tlEnd: number
  setTlStart: (n: number) => void
  setTlEnd: (n: number) => void
  smooth: number
  setSmooth: (n: number) => void
}

/** Contenu du popover ⚙ : couleur des barres par page + plage horaire + lissage. */
export function DevSettings({ pageColors, setPageColor, tlMode, setTlMode, tlStart, tlEnd, setTlStart, setTlEnd, smooth, setSmooth }: DevSettingsProps) {
  return (
    <div className="w-[300px] space-y-3.5">
      <div>
        <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Couleur des barres par page
        </p>
        <div className="space-y-1.5">
          {PAGE_LIST.map((p) => {
            const cur = pageColors[p.key] ?? pageHex(p.key)
            return (
              <label key={p.key} className="flex cursor-pointer items-center gap-2.5">
                <span
                  className="relative h-[22px] w-[22px] shrink-0 rounded-md"
                  style={{ background: cur, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}
                >
                  <input
                    type="color"
                    value={cur}
                    onChange={(e) => setPageColor(p.key, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </span>
                <span className="flex-1 text-[12px] font-medium">{p.label}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">{cur}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Plage horaire de la timeline
        </p>
        <div className="mb-2 flex gap-0.5 rounded-lg bg-muted p-0.5">
          <button type="button" onClick={() => setTlMode("fixed")} className={cn("flex-1 rounded-md py-1 text-[11px] font-bold", tlMode === "fixed" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
            Fixe
          </button>
          <button type="button" onClick={() => setTlMode("auto")} className={cn("flex-1 rounded-md py-1 text-[11px] font-bold", tlMode === "auto" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
            Auto
          </button>
        </div>
        {tlMode === "auto" ? (
          <p className="text-[10.5px] leading-snug text-muted-foreground">
            S&apos;ajuste à la 1ʳᵉ connexion et à la dernière déconnexion de la période.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <span className="text-muted-foreground">de</span>
            <select value={tlStart} onChange={(e) => setTlStart(+e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-xs">
              {Array.from({ length: 9 }, (_, i) => 5 + i).map((h) => (
                <option key={h} value={h}>{h}h</option>
              ))}
            </select>
            <span className="text-muted-foreground">à</span>
            <select value={tlEnd} onChange={(e) => setTlEnd(+e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-xs">
              {Array.from({ length: 9 }, (_, i) => 15 + i).map((h) => (
                <option key={h} value={h}>{h}h</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Lissage des micro-coupures
        </p>
        <div className="mb-2 flex gap-0.5 rounded-lg bg-muted p-0.5">
          {SMOOTH_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setSmooth(o.v)}
              className={cn(
                "flex-1 rounded-md py-1 text-[11px] font-bold",
                smooth === o.v ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          Fusionne les coupures plus courtes que ce seuil (changements de page). Au-delà = veille / inactivité réelle, affichée en hachuré et déduite du temps écran.
        </p>
      </div>
    </div>
  )
}
