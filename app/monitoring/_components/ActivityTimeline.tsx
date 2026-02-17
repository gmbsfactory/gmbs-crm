"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Plus,
  Edit,
  ArrowRight,
  MessageSquare,
  FileText,
  DollarSign,
  CreditCard,
  UserPlus,
  Activity,
  Wrench,
  MapPin,
  CalendarOff,
  Archive,
  RotateCcw,
  ChevronRight,
  ExternalLink,
  Eye,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import type { ReferenceData } from "@/lib/reference-api"
import type { RecentAction, InterventionMeta, ArtisanMeta } from "@/hooks/useUserDailyActivity"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityFilter = "all" | "intervention" | "artisan"

interface ActivityTimelineProps {
  actions: RecentAction[]
}

/** Grouped actions on same entity within 1-min window */
interface ActionGroup {
  entity_type: "intervention" | "artisan"
  entity_id: string
  entity_label: string | null
  entity_meta: InterventionMeta | ArtisanMeta | null
  actions: RecentAction[]
  timestamp: string
}

interface ResolvedValue {
  label: string
  color?: string | null
}

interface ActionLine {
  icon: LucideIcon
  text: string
  badge?: { label: string; color?: string | null }
  badgeFrom?: { label: string; color?: string | null }
  link?: string | null
  details?: { label: string; from?: string; to: string }[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fields to never show in UPDATE details */
const IGNORED_FIELDS = new Set([
  "updated_at", "updated_by", "created_by", "created_at",
  "id", "intervention_id", "artisan_id", "actor_user_id",
  "created_by_display", "created_by_code", "created_by_color",
  "content_hash", "derived_sizes", "mime_preferred",
  "currency", "metadata", "request_id", "transaction_id",
  "ip_address", "user_agent", "source",
])

const COST_TYPE_LABELS: Record<string, string> = {
  sst: "Sous-traitant",
  materiel: "Materiel",
  intervention: "Intervention",
  marge: "Marge",
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  acompte_sst: "Acompte SST",
  acompte_client: "Acompte client",
  final: "Solde final",
}

const FIELD_LABELS: Record<string, string> = {
  nom: "Nom",
  prenom: "Prenom",
  telephone: "Telephone",
  telephone2: "Telephone 2",
  email: "Email",
  raison_sociale: "Raison sociale",
  siret: "SIRET",
  iban: "IBAN",
  statut_juridique: "Statut juridique",
  statut_id: "Statut",
  gestionnaire_id: "Gestionnaire",
  adresse_siege_social: "Adresse siege",
  ville_siege_social: "Ville siege",
  code_postal_siege_social: "CP siege",
  adresse_intervention: "Adresse",
  ville_intervention: "Ville",
  code_postal_intervention: "CP",
  is_active: "Actif",
  contexte_intervention: "Contexte",
  date: "Date",
  date_prevue: "Date prevue",
  commentaire: "Commentaire",
  montant_devis: "Montant devis",
  montant_final: "Montant final",
  label: "Libelle",
  amount: "Montant",
  cost_type: "Type de cout",
  payment_type: "Type de paiement",
  is_received: "Recu",
  payment_date: "Date paiement",
  reference: "Reference",
  kind: "Type",
  filename: "Fichier",
  file_size: "Taille",
  content: "Contenu",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return "—"
  const n = Number(value)
  if (isNaN(n)) return String(value)
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s
}

/** Group consecutive actions on same entity within 1-min window */
function groupActions(actions: RecentAction[]): ActionGroup[] {
  const groups: ActionGroup[] = []
  for (const action of actions) {
    const last = groups[groups.length - 1]
    if (last && last.entity_id === action.entity_id) {
      const lastAction = last.actions[last.actions.length - 1]
      const diff = Math.abs(
        new Date(lastAction.occurred_at).getTime() - new Date(action.occurred_at).getTime()
      )
      if (diff < 60_000) {
        last.actions.push(action)
        continue
      }
    }
    groups.push({
      entity_type: action.entity_type,
      entity_id: action.entity_id,
      entity_label: action.entity_label,
      entity_meta: action.entity_meta,
      actions: [action],
      timestamp: action.occurred_at,
    })
  }
  return groups
}

// ---------------------------------------------------------------------------
// Value resolution
// ---------------------------------------------------------------------------

function buildResolver(ref: ReferenceData | null) {
  const userMap = new Map<string, ResolvedValue>()
  const interStatusMap = new Map<string, ResolvedValue>()
  const artisanStatusMap = new Map<string, ResolvedValue>()
  const metierMap = new Map<string, ResolvedValue>()

  if (ref) {
    ;(ref.allUsers ?? ref.users ?? []).forEach((u) => {
      const label = u.code_gestionnaire || [u.firstname, u.lastname].filter(Boolean).join(" ").trim() || u.username
      userMap.set(u.id, { label, color: u.color })
    })
    ref.users?.forEach((u) => {
      if (!userMap.has(u.id)) {
        const label = u.code_gestionnaire || [u.firstname, u.lastname].filter(Boolean).join(" ").trim() || u.username
        userMap.set(u.id, { label, color: u.color })
      }
    })
    ref.interventionStatuses?.forEach((s) => interStatusMap.set(s.id, { label: s.label || s.code, color: s.color }))
    ref.artisanStatuses?.forEach((s) => artisanStatusMap.set(s.id, { label: s.label || s.code, color: s.color }))
    ref.metiers?.forEach((m) => metierMap.set(m.id, { label: m.label || m.code, color: m.color }))
  }

  return {
    resolveUser: (id: unknown) => (typeof id === "string" ? userMap.get(id) : null) ?? null,
    resolveStatus: (id: unknown) => {
      if (typeof id !== "string") return null
      return interStatusMap.get(id) ?? artisanStatusMap.get(id) ?? null
    },
    resolveMetier: (id: unknown) => (typeof id === "string" ? metierMap.get(id) : null) ?? null,
    resolveField: (field: string, value: unknown): string => {
      if (value === null || value === undefined) return "—"
      if (typeof value === "boolean") return value ? "Oui" : "Non"
      const f = field.toLowerCase()
      if (typeof value === "string") {
        if (f === "gestionnaire_id" || f.endsWith("_user_id") || f === "created_by" || f === "updated_by" || f === "author_id") {
          return userMap.get(value)?.label ?? truncate(value, 8)
        }
        if (f === "statut_id" || f === "status_id") {
          return interStatusMap.get(value)?.label ?? artisanStatusMap.get(value)?.label ?? truncate(value, 8)
        }
        if (f === "metier_id") {
          return metierMap.get(value)?.label ?? truncate(value, 8)
        }
      }
      const s = String(value)
      return s.length > 50 ? s.slice(0, 50) + "..." : s
    },
  }
}

// ---------------------------------------------------------------------------
// Action → human-readable line
// ---------------------------------------------------------------------------

type Resolver = ReturnType<typeof buildResolver>

function describeAction(action: RecentAction, resolver: Resolver): ActionLine {
  const nv = action.new_values ?? {}
  const ov = action.old_values ?? {}

  switch (action.action_type) {
    // -- Create --
    case "CREATE":
      return {
        icon: Plus,
        text: action.entity_type === "intervention" ? "Intervention creee" : "Artisan cree",
      }

    // -- Update --
    case "UPDATE": {
      const fields = (action.changed_fields ?? []).filter((f) => !IGNORED_FIELDS.has(f))
      if (fields.length === 0) return { icon: Edit, text: "Modification" }

      const details = fields.map((f) => ({
        label: FIELD_LABELS[f] || f,
        from: ov[f] !== undefined && ov[f] !== null ? resolver.resolveField(f, ov[f]) : undefined,
        to: resolver.resolveField(f, nv[f]),
      }))

      // If only 1 field changed, put it inline
      if (details.length === 1) {
        const d = details[0]
        const text = d.from ? `${d.label} : ${d.from} → ${d.to}` : `${d.label} : ${d.to}`
        return { icon: Edit, text }
      }

      return { icon: Edit, text: `${fields.length} champs modifies`, details }
    }

    // -- Status --
    case "STATUS_CHANGE": {
      const fromStatus = resolver.resolveStatus(ov.statut_id)
      const toStatus = resolver.resolveStatus(nv.statut_id)
      return {
        icon: ArrowRight,
        text: "Statut",
        badgeFrom: fromStatus ? { label: fromStatus.label, color: fromStatus.color } : undefined,
        badge: toStatus ? { label: toStatus.label, color: toStatus.color } : undefined,
      }
    }

    // -- Comment --
    case "COMMENT_ADD": {
      const content = typeof nv.content === "string" ? nv.content : null
      return {
        icon: MessageSquare,
        text: content ? `Commentaire : "${truncate(content, 80)}"` : "Commentaire ajoute",
      }
    }
    case "COMMENT_UPDATE":
      return { icon: MessageSquare, text: "Commentaire modifie" }
    case "COMMENT_DELETE":
      return { icon: MessageSquare, text: "Commentaire supprime" }

    // -- Document --
    case "DOCUMENT_ADD": {
      const filename = (nv.filename as string) || (nv.kind as string) || "document"
      const url = nv.url as string | undefined
      return { icon: FileText, text: `Document "${filename}" ajoute`, link: url }
    }
    case "DOCUMENT_UPDATE": {
      const filename = (nv.filename as string) || (ov.filename as string) || "document"
      const url = (nv.url as string) || (ov.url as string) || undefined
      return { icon: FileText, text: `Document "${filename}" mis a jour`, link: url }
    }
    case "DOCUMENT_DELETE": {
      const filename = (ov.filename as string) || "document"
      return { icon: FileText, text: `Document "${filename}" supprime` }
    }

    // -- Cost --
    case "COST_ADD": {
      const type = COST_TYPE_LABELS[nv.cost_type as string] || (nv.cost_type as string) || ""
      return { icon: DollarSign, text: `Cout ${type} de ${formatCurrency(nv.amount)} ajoute` }
    }
    case "COST_UPDATE": {
      const type = COST_TYPE_LABELS[(nv.cost_type ?? ov.cost_type) as string] || ""
      const fields = action.changed_fields ?? []
      if (fields.includes("amount")) {
        return { icon: DollarSign, text: `Cout ${type} : ${formatCurrency(ov.amount)} → ${formatCurrency(nv.amount)}` }
      }
      return { icon: DollarSign, text: `Cout ${type} modifie` }
    }
    case "COST_DELETE": {
      const type = COST_TYPE_LABELS[ov.cost_type as string] || ""
      return { icon: DollarSign, text: `Cout ${type} de ${formatCurrency(ov.amount)} supprime` }
    }

    // -- Payment --
    case "PAYMENT_ADD": {
      const type = PAYMENT_TYPE_LABELS[nv.payment_type as string] || ""
      return { icon: CreditCard, text: `Paiement ${type} de ${formatCurrency(nv.amount)}` }
    }
    case "PAYMENT_UPDATE": {
      const type = PAYMENT_TYPE_LABELS[(nv.payment_type ?? ov.payment_type) as string] || ""
      const fields = action.changed_fields ?? []
      if (fields.includes("amount")) {
        return { icon: CreditCard, text: `Paiement ${type} : ${formatCurrency(ov.amount)} → ${formatCurrency(nv.amount)}` }
      }
      return { icon: CreditCard, text: `Paiement ${type} modifie` }
    }
    case "PAYMENT_DELETE": {
      const type = PAYMENT_TYPE_LABELS[ov.payment_type as string] || ""
      return { icon: CreditCard, text: `Paiement ${type} de ${formatCurrency(ov.amount)} supprime` }
    }

    // -- Artisan assign --
    case "ARTISAN_ASSIGN":
      return { icon: UserPlus, text: "Artisan assigne" }

    // -- Metier --
    case "METIER_ADD": {
      const metier = resolver.resolveMetier(nv.metier_id)
      return { icon: Wrench, text: `Metier ${metier?.label || ""} ajoute`.trim() }
    }
    case "METIER_REMOVE": {
      const metier = resolver.resolveMetier(ov.metier_id)
      return { icon: Wrench, text: `Metier ${metier?.label || ""} retire`.trim() }
    }

    // -- Zone --
    case "ZONE_ADD":
      return { icon: MapPin, text: `Zone ${(nv.label as string) || (nv.code_postal as string) || ""} ajoutee`.trim() }
    case "ZONE_REMOVE":
      return { icon: MapPin, text: `Zone ${(ov.label as string) || (ov.code_postal as string) || ""} retiree`.trim() }

    // -- Absence --
    case "ABSENCE_ADD":
      return { icon: CalendarOff, text: "Absence ajoutee" }
    case "ABSENCE_UPDATE":
      return { icon: CalendarOff, text: "Absence modifiee" }
    case "ABSENCE_DELETE":
      return { icon: CalendarOff, text: "Absence supprimee" }

    // -- Archive --
    case "ARCHIVE":
      return { icon: Archive, text: "Archive" }
    case "RESTORE":
      return { icon: RotateCcw, text: "Restaure" }

    // -- Fallback --
    default:
      return { icon: Activity, text: action.action_type }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact entity chip — clickable to open modal */
function EntityChip({ group, onOpen }: { group: ActionGroup; onOpen: () => void }) {
  const isInter = group.entity_type === "intervention"
  const meta = group.entity_meta

  let name: string
  if (isInter) {
    const im = meta as InterventionMeta | null
    name = im?.id_inter || group.entity_label || "Intervention"
  } else {
    const am = meta as ArtisanMeta | null
    name = am ? [am.prenom, am.nom].filter(Boolean).join(" ") || group.entity_label || "Artisan" : group.entity_label || "Artisan"
  }

  const statusLabel = isInter
    ? (meta as InterventionMeta | null)?.statut_label
    : (meta as ArtisanMeta | null)?.statut_label
  const statusColor = isInter
    ? (meta as InterventionMeta | null)?.statut_color
    : (meta as ArtisanMeta | null)?.statut_color

  const borderClass = isInter ? "border-blue-500/20 hover:bg-blue-500/8" : "border-emerald-500/20 hover:bg-emerald-500/8"
  const textClass = isInter ? "text-blue-700 dark:text-blue-400" : "text-emerald-700 dark:text-emerald-400"

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0 text-[10px] font-medium transition-colors ${borderClass} ${textClass} group/e`}
    >
      <span className="truncate max-w-[120px]">{name}</span>
      {statusLabel && (
        <span
          className="px-1 rounded text-[9px] leading-relaxed"
          style={{
            backgroundColor: statusColor ? `${statusColor}20` : "hsl(var(--muted))",
            color: statusColor || undefined,
          }}
        >
          {statusLabel}
        </span>
      )}
      <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/e:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

/** Small colored badge for status transitions */
function StatusBadge({ label, color }: { label: string; color?: string | null }) {
  return (
    <span
      className="inline-flex px-1.5 py-0 rounded text-[10px] font-medium leading-relaxed"
      style={{
        backgroundColor: color ? `${color}20` : "hsl(var(--muted))",
        color: color || undefined,
      }}
    >
      {label}
    </span>
  )
}

/** Single action line within a group */
function ActionLineRow({
  line,
  isExpanded,
  onToggle,
}: {
  line: ActionLine
  isExpanded: boolean
  onToggle: () => void
}) {
  const Icon = line.icon
  const hasExpand = (line.details?.length ?? 0) > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => hasExpand && onToggle()}
        className={`flex items-start gap-1.5 w-full text-left py-0.5 ${hasExpand ? "cursor-pointer" : "cursor-default"}`}
      >
        <Icon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-[11px] leading-relaxed flex-1 min-w-0">
          {line.text}
          {/* Status transition badges */}
          {line.badgeFrom && (
            <>
              {" "}<StatusBadge label={line.badgeFrom.label} color={line.badgeFrom.color} />
              <span className="text-muted-foreground mx-0.5">→</span>
            </>
          )}
          {line.badge && !line.badgeFrom && <>{" : "}</>}
          {line.badge && <StatusBadge label={line.badge.label} color={line.badge.color} />}
        </span>
        {/* Document link */}
        {line.link && (
          <a
            href={line.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-700 shrink-0"
          >
            <Eye className="h-2.5 w-2.5" />
            Voir
          </a>
        )}
        {hasExpand && (
          <ChevronRight className={`h-3 w-3 text-muted-foreground shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        )}
      </button>
      {/* Expanded details */}
      {isExpanded && line.details && (
        <div className="ml-[18px] space-y-0 pb-0.5">
          {line.details.map((d, i) => (
            <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-medium">{d.label}</span>
              {" : "}
              {d.from && (
                <><span className="line-through opacity-60">{d.from}</span>{" → "}</>
              )}
              <span className="text-foreground">{d.to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityTimeline({ actions }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<EntityFilter>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()
  const { data: refData } = useReferenceDataQuery()

  const resolver = useMemo(() => buildResolver(refData), [refData])

  const filtered = useMemo(() => {
    if (filter === "all") return actions
    return actions.filter((a) => a.entity_type === filter)
  }, [actions, filter])

  const groups = useMemo(() => groupActions(filtered), [filtered])

  const interventionCount = useMemo(() => actions.filter((a) => a.entity_type === "intervention").length, [actions])
  const artisanCount = useMemo(() => actions.filter((a) => a.entity_type === "artisan").length, [actions])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (actions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center italic">
        Aucune action aujourd&apos;hui
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex gap-1">
        {([
          ["all", `Tout (${actions.length})`],
          ["intervention", `Inter. (${interventionCount})`],
          ["artisan", `Artisan (${artisanCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped timeline */}
      <div className="space-y-0">
        {groups.map((group, gIdx) => {
          const groupKey = `${group.entity_id}-${group.timestamp}-${gIdx}`
          const lines = group.actions.map((a) => describeAction(a, resolver))

          return (
            <div key={groupKey} className="flex gap-2 py-1.5 border-b border-border/40 last:border-0">
              {/* Time */}
              <span className="text-[10px] text-muted-foreground w-[34px] shrink-0 pt-0.5 tabular-nums leading-relaxed">
                {formatTime(group.timestamp)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-0">
                {/* Action lines */}
                {lines.map((line, lIdx) => {
                  const lineKey = `${groupKey}-${lIdx}`
                  return (
                    <ActionLineRow
                      key={lineKey}
                      line={line}
                      isExpanded={expandedIds.has(lineKey)}
                      onToggle={() => toggleExpanded(lineKey)}
                    />
                  )
                })}

                {/* Entity chip */}
                <div className="mt-0.5">
                  <EntityChip
                    group={group}
                    onOpen={() => {
                      if (group.entity_type === "intervention") interventionModal.open(group.entity_id)
                      else artisanModal.open(group.entity_id)
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
