"use client"

export interface KpiItem {
  label: string
  value: string
  sub: string
  /** Couleur de la barre d'accent (token CSS, ex. hsl(var(--success-hsl))). */
  accent: string
  /** Couleur du chiffre (défaut : foreground). */
  valueColor?: string
}

/** Bandeau de 5 cartes KPI (style mockup : barre d'accent + gros chiffre). */
export function KpiBand({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((k) => (
        <div
          key={k.label}
          className="relative flex flex-col justify-center overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
        >
          <span className="absolute bottom-0 left-0 top-0 w-1" style={{ background: k.accent }} />
          <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
            {k.label}
          </span>
          <span
            className="mt-0.5 text-[26px] font-extrabold leading-none tabular-nums text-foreground"
            style={k.valueColor ? { color: k.valueColor } : undefined}
          >
            {k.value}
          </span>
          <span className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{k.sub}</span>
        </div>
      ))}
    </div>
  )
}
