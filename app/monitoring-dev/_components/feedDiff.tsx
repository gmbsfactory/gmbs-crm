"use client"

import { useMemo } from "react"
import { format, isValid, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getPropertyLabel } from "@/types/property-schema"
import { useBatchResolver } from "@/hooks/useBatchResolver"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import type { HistoryValueResolver } from "@/components/shared/history/types"
import type { GlobalActivityRow } from "@/types/monitoring"

// ── Helpers de formatage, repris de src/components/shared/history/HistoryEntry.tsx
//    (mêmes libellés/valeurs que l'historique d'intervention, pour la parité).

const FIELD_LABELS: Record<string, string> = {
  id_inter: "Référence",
  adresse: "Adresse",
  code_postal: "Code postal",
  ville: "Ville",
  contexte_intervention: "Contexte",
  consigne_intervention: "Consigne",
  agence_id: "Agence",
  metier_id: "Métier",
  assigned_user_id: "Assigné à",
  created_by: "Créé par",
  updated_by: "Mis à jour par",
  owner_id: "Propriétaire",
  tenant_id: "Locataire",
  client_id: "Locataire",
  status_id: "Statut",
  statut_id: "Statut",
  status_code: "Statut",
  date_prevue: "Date prévue",
  date_termine: "Date terminée",
  is_active: "Actif",
  reference_agence: "Référence agence",
  commentaire_agent: "Commentaire agent",
  consigne_second_artisan: "Consigne 2ème artisan",
  metier_second_artisan_id: "Métier 2ème artisan",
  sous_statut_text: "Sous-statut",
  adresse_complete: "Adresse",
}

const ABBREVIATIONS: Record<string, string> = { id: "ID", sst: "SST", tva: "TVA", ht: "HT", ca: "CA", tel: "Tel", sms: "SMS" }
const truncate = (v: string, max = 100) => (v.length <= max ? v : `${v.slice(0, max - 3)}…`)
const toTitleCase = (v: string) =>
  v.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ")
    .map((p) => (ABBREVIATIONS[p.toLowerCase()] ? ABBREVIATIONS[p.toLowerCase()] : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ")
const toCamelCase = (v: string) => {
  const parts = v.split("_")
  if (parts.length === 1) return v
  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("")
}
function getFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const schemaLabel = getPropertyLabel(field)
  if (schemaLabel !== field) return schemaLabel
  const camelLabel = getPropertyLabel(toCamelCase(field))
  if (camelLabel !== toCamelCase(field)) return camelLabel
  return toTitleCase(field)
}
const safeParseDate = (v: string | null | undefined) => {
  if (!v) return null
  const p = parseISO(v)
  if (isValid(p)) return p
  const f = new Date(v)
  return Number.isNaN(f.getTime()) ? null : f
}
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const fmtCurrency = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
function formatValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return field && /amount|cost|cout|marge/i.test(field) ? fmtCurrency(value) : new Intl.NumberFormat("fr-FR").format(value)
  if (typeof value === "string") {
    const t = value.trim()
    if (!t) return "—"
    if (field === "id_inter") return t
    const d = safeParseDate(t)
    if (d && /t/i.test(t)) return format(d, "dd/MM/yyyy HH:mm", { locale: fr })
    if (isUuid(t)) return `${t.slice(0, 8)}…${t.slice(-4)}`
    return truncate(t, 150)
  }
  if (Array.isArray(value)) return value.map((i) => formatValue(i, field)).join(", ")
  if (typeof value === "object") { try { return truncate(JSON.stringify(value), 150) } catch { return "—" } }
  return String(value)
}
function renderValue(field: string, value: unknown, resolver?: HistoryValueResolver) {
  const resolved = resolver?.(field, value) ?? null
  if (resolved?.color) {
    return (
      <Badge variant="outline" className="border-transparent text-[9px] text-white" style={{ backgroundColor: resolved.color }}>
        {resolved.label}
      </Badge>
    )
  }
  return <span>{resolved?.label ?? formatValue(value, field)}</span>
}

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

export function FeedDiffRows({ row, resolver }: { row: GlobalActivityRow; resolver: HistoryValueResolver }) {
  const fields = (row.changed_fields ?? []).filter(Boolean)
  if (fields.length === 0) return null
  const oldV = (row.old_values ?? {}) as Record<string, unknown>
  const newV = (row.new_values ?? {}) as Record<string, unknown>
  return (
    <div className="mt-1 flex flex-col gap-1">
      {fields.map((field) => (
        <div key={field} className="flex items-center gap-2 text-[11px]">
          <span className="w-[88px] shrink-0 truncate font-semibold text-muted-foreground">{getFieldLabel(field)}</span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-muted-foreground/70 line-through decoration-muted-foreground/40">{renderValue(field, oldV[field], resolver)}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            <span className="truncate font-semibold text-foreground">{renderValue(field, newV[field], resolver)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
