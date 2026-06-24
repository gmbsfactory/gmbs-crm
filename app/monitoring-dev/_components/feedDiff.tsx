"use client"

import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { useBatchResolver } from "@/hooks/useBatchResolver"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { HistoryValueResolver } from "@/components/shared/history/types"
import { getFieldLabel, isUuid, renderValue } from "@/components/shared/history/HistoryEntry"
import type { GlobalActivityRow } from "@/types/monitoring"

// ── Résolveur de valeurs (id → libellé + couleur) calqué sur le modal historique.

function collectIds(items: GlobalActivityRow[], fields: string[]): string[] {
  const set = new Set<string>()
  for (const it of items) {
    for (const bag of [it.old_values, it.new_values]) {
      if (!bag) continue
      const rec = bag as Record<string, unknown>
      for (const f of fields) {
        const v = rec[f]
        if (typeof v === "string" && isUuid(v)) set.add(v)
      }
    }
  }
  return Array.from(set)
}

export function useFeedValueResolver(items: GlobalActivityRow[]): HistoryValueResolver {
  const { data: refData } = useReferenceDataQuery()

  const ownerIds = useMemo(() => collectIds(items, ["owner_id"]), [items])
  const tenantIds = useMemo(() => collectIds(items, ["tenant_id", "client_id"]), [items])
  const { map: ownerMap } = useBatchResolver({
    ids: ownerIds, table: "owner", select: "id, owner_firstname, owner_lastname, plain_nom_facturation",
    buildLabel: (r: Record<string, unknown>) => ({
      label: (r.plain_nom_facturation as string) || [r.owner_firstname, r.owner_lastname].filter(Boolean).join(" ") || "Propriétaire",
    }),
  })
  const { map: tenantMap } = useBatchResolver({
    ids: tenantIds, table: "tenants", select: "id, firstname, lastname, plain_nom_client",
    buildLabel: (r: Record<string, unknown>) => ({
      label: (r.plain_nom_client as string) || [r.firstname, r.lastname].filter(Boolean).join(" ") || "Locataire",
    }),
  })

  return useMemo<HistoryValueResolver>(() => {
    const byId = (list: Array<{ id: string; label?: string; code?: string; color?: string | null }> | undefined) => {
      const m = new Map<string, { label: string; color?: string | null }>()
      list?.forEach((x) => m.set(x.id, { label: x.label || x.code || "", color: x.color ?? null }))
      return m
    }
    const byCode = (list: Array<{ code?: string; label?: string; color?: string | null }> | undefined) => {
      const m = new Map<string, { label: string; color?: string | null }>()
      list?.forEach((x) => { if (x.code) m.set(x.code, { label: x.label || x.code, color: x.color ?? null }) })
      return m
    }
    const statusById = byId(refData?.interventionStatuses)
    const statusByCode = byCode(refData?.interventionStatuses)
    const agencyById = byId(refData?.agencies)
    const agencyByCode = byCode(refData?.agencies)
    const metierById = byId(refData?.metiers)
    const userById = new Map<string, { label: string; color?: string | null }>()
    ;(refData?.users ?? []).forEach((u) => {
      const label = u.code_gestionnaire || [u.firstname, u.lastname].filter(Boolean).join(" ").trim() || u.username
      if (label) userById.set(u.id, { label, color: u.color ?? null })
    })

    return (field, value) => {
      if (!value || typeof value !== "string") return null
      const f = field.toLowerCase()
      if (f === "status_id" || f === "statut_id") return statusById.get(value) ?? null
      if (f === "status_code" || f === "statut_code") return statusByCode.get(value) ?? null
      if (f === "agence_id" || f === "agency_id") return agencyById.get(value) ?? null
      if (f === "agence_code" || f === "agency_code") return agencyByCode.get(value) ?? null
      if (f === "metier_id" || f === "metier_second_artisan_id") return metierById.get(value) ?? null
      if (f === "owner_id") return ownerMap[value] ?? null
      if (f === "tenant_id" || f === "client_id") return tenantMap[value] ?? null
      if (f.endsWith("_user_id") || f === "assigned_user_id" || f === "created_by" || f === "updated_by") return userById.get(value) ?? null
      return null
    }
  }, [refData, ownerMap, tenantMap])
}

// ── Rendu des lignes de diff (champ par champ : libellé · ancien → nouveau).

// Champs techniques/dérivés (index plein-texte…) : jamais une modif lisible → exclus du diff.
export const IGNORED_DIFF_FIELDS = new Set(["search_vector", "fts", "tsv"])
const MAX_VALUE_CHARS = 50

/** Valeur de diff : badge résolu tel quel, sinon texte tronqué à 50 car. (+ tooltip complet au survol). */
export function DiffValue({ field, value, resolver, kind }: { field: string; value: unknown; resolver: HistoryValueResolver; kind: "old" | "new" }) {
  const { node, isBadge } = renderValue(field, value, resolver)
  if (isBadge) return <span className="shrink-0">{node}</span>
  const cls = cn(
    "min-w-0 break-words",
    kind === "old" ? "text-muted-foreground/70 line-through decoration-muted-foreground/40" : "font-semibold text-foreground",
  )
  const full = typeof node === "string" && node.length ? node : "—"
  if (full.length <= MAX_VALUE_CHARS) return <span className={cls}>{full}</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cls}>{`${full.slice(0, MAX_VALUE_CHARS)}…`}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[340px] whitespace-pre-wrap break-words text-[11px] font-normal">
        {full}
      </TooltipContent>
    </Tooltip>
  )
}

export function FeedDiffRows({ row, resolver }: { row: GlobalActivityRow; resolver: HistoryValueResolver }) {
  const fields = (row.changed_fields ?? []).filter((f): f is string => Boolean(f) && !IGNORED_DIFF_FIELDS.has(f.toLowerCase()))
  if (fields.length === 0) return null
  const oldV = (row.old_values ?? {}) as Record<string, unknown>
  const newV = (row.new_values ?? {}) as Record<string, unknown>
  return (
    <div className="mt-1 flex flex-col gap-1">
      {fields.map((field) => (
        <div key={field} className="flex items-start gap-2 text-[11px]">
          <span className="w-[88px] shrink-0 truncate font-semibold text-muted-foreground">{getFieldLabel(field)}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <DiffValue field={field} value={oldV[field]} resolver={resolver} kind="old" />
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            <DiffValue field={field} value={newV[field]} resolver={resolver} kind="new" />
          </div>
        </div>
      ))}
    </div>
  )
}
