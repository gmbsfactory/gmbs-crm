"use client"

import { useState, useMemo } from "react"
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
  ChevronDown,
  ExternalLink,
  type LucideIcon,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import type { RecentAction, InterventionMeta, ArtisanMeta } from "@/hooks/useUserDailyActivity"

type EntityFilter = "all" | "intervention" | "artisan"

interface ActivityTimelineProps {
  actions: RecentAction[]
}

const INTERVENTION_ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  CREATE: { icon: Plus, label: "Creation" },
  UPDATE: { icon: Edit, label: "Modification" },
  STATUS_CHANGE: { icon: ArrowRight, label: "Changement de statut" },
  COMMENT_ADD: { icon: MessageSquare, label: "Commentaire" },
  DOCUMENT_ADD: { icon: FileText, label: "Document ajoute" },
  COST_ADD: { icon: DollarSign, label: "Cout ajoute" },
  COST_UPDATE: { icon: DollarSign, label: "Cout modifie" },
  COST_DELETE: { icon: DollarSign, label: "Cout supprime" },
  PAYMENT_ADD: { icon: CreditCard, label: "Paiement ajoute" },
  PAYMENT_UPDATE: { icon: CreditCard, label: "Paiement modifie" },
  PAYMENT_DELETE: { icon: CreditCard, label: "Paiement supprime" },
  ARTISAN_ASSIGN: { icon: UserPlus, label: "Artisan assigne" },
}

const ARTISAN_ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  CREATE: { icon: Plus, label: "Creation" },
  UPDATE: { icon: Edit, label: "Modification" },
  STATUS_CHANGE: { icon: ArrowRight, label: "Changement de statut" },
  ARCHIVE: { icon: Archive, label: "Archive" },
  RESTORE: { icon: RotateCcw, label: "Restaure" },
  METIER_ADD: { icon: Wrench, label: "Metier ajoute" },
  METIER_REMOVE: { icon: Wrench, label: "Metier retire" },
  ZONE_ADD: { icon: MapPin, label: "Zone ajoutee" },
  ZONE_REMOVE: { icon: MapPin, label: "Zone retiree" },
  ABSENCE_ADD: { icon: CalendarOff, label: "Absence ajoutee" },
  ABSENCE_UPDATE: { icon: CalendarOff, label: "Absence modifiee" },
  ABSENCE_DELETE: { icon: CalendarOff, label: "Absence supprimee" },
  DOCUMENT_ADD: { icon: FileText, label: "Document ajoute" },
  DOCUMENT_UPDATE: { icon: FileText, label: "Document modifie" },
  DOCUMENT_DELETE: { icon: FileText, label: "Document supprime" },
  COMMENT_ADD: { icon: MessageSquare, label: "Commentaire" },
  COMMENT_UPDATE: { icon: MessageSquare, label: "Commentaire modifie" },
  COMMENT_DELETE: { icon: MessageSquare, label: "Commentaire supprime" },
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
  adresse_intervention: "Adresse intervention",
  ville_intervention: "Ville intervention",
  code_postal_intervention: "CP intervention",
  is_active: "Actif",
  contexte_intervention: "Contexte",
  date: "Date",
  date_prevue: "Date prevue",
  commentaire: "Commentaire",
  montant_devis: "Montant devis",
  montant_final: "Montant final",
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "string" && value.length > 60) return value.slice(0, 60) + "..."
  return String(value)
}

/** Mini card for an intervention entity */
function InterventionCard({ meta, label, onOpen }: {
  meta: InterventionMeta | null
  label: string | null
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="flex items-center gap-2.5 rounded-md border bg-blue-500/5 border-blue-500/20 px-3 py-1.5 text-left transition-colors hover:bg-blue-500/10 w-full group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 truncate">
            {meta?.id_inter || label || "Intervention"}
          </span>
          {meta?.statut_label && (
            <Badge
              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
              style={{
                backgroundColor: meta.statut_color ? `${meta.statut_color}20` : undefined,
                color: meta.statut_color || undefined,
                borderColor: meta.statut_color ? `${meta.statut_color}40` : undefined,
              }}
            >
              {meta.statut_label}
            </Badge>
          )}
        </div>
        {meta?.date && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(meta.date).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

/** Mini card for an artisan entity */
function ArtisanCard({ meta, label, onOpen }: {
  meta: ArtisanMeta | null
  label: string | null
  onOpen: () => void
}) {
  const displayName = meta
    ? [meta.prenom, meta.nom].filter(Boolean).join(" ") || label
    : label

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="flex items-center gap-2.5 rounded-md border bg-violet-500/5 border-violet-500/20 px-3 py-1.5 text-left transition-colors hover:bg-violet-500/10 w-full group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 truncate">
            {displayName || "Artisan"}
          </span>
          {meta?.statut_label && (
            <Badge
              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
              style={{
                backgroundColor: meta.statut_color ? `${meta.statut_color}20` : undefined,
                color: meta.statut_color || undefined,
                borderColor: meta.statut_color ? `${meta.statut_color}40` : undefined,
              }}
            >
              {meta.statut_label}
            </Badge>
          )}
        </div>
        {meta?.raison_sociale && (
          <span className="text-[10px] text-muted-foreground truncate block">
            {meta.raison_sociale}
          </span>
        )}
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

/** Expanded detail: changed fields with old → new values */
function ActionDetail({ action }: { action: RecentAction }) {
  const fields = action.changed_fields
  if (!fields?.length && !action.old_values && !action.new_values) {
    return null
  }

  const displayFields = fields?.length ? fields : Object.keys(action.new_values ?? {})

  return (
    <div className="mt-2 space-y-1 pl-10 pr-2">
      {displayFields.map((field) => {
        const oldVal = action.old_values?.[field]
        const newVal = action.new_values?.[field]
        const fieldLabel = FIELD_LABELS[field] || field

        return (
          <div key={field} className="flex items-baseline gap-1.5 text-[11px]">
            <span className="text-muted-foreground font-medium shrink-0">{fieldLabel} :</span>
            {oldVal !== undefined && (
              <>
                <span className="text-red-500/80 line-through truncate max-w-[120px]">
                  {formatFieldValue(oldVal)}
                </span>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]">
              {formatFieldValue(newVal)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ActivityTimeline({ actions }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<EntityFilter>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const filtered = useMemo(() => {
    if (filter === "all") return actions
    return actions.filter((a) => a.entity_type === filter)
  }, [actions, filter])

  const interventionCount = useMemo(() => actions.filter((a) => a.entity_type === "intervention").length, [actions])
  const artisanCount = useMemo(() => actions.filter((a) => a.entity_type === "artisan").length, [actions])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucune action aujourd&apos;hui
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-1.5">
        {([
          ["all", `Tout (${actions.length})`],
          ["intervention", `Inter. (${interventionCount})`],
          ["artisan", `Artisan (${artisanCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Actions list */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-1.5 pr-3">
          {filtered.map((action, index) => {
            const configMap = action.entity_type === "artisan"
              ? ARTISAN_ACTION_CONFIG
              : INTERVENTION_ACTION_CONFIG
            const config = configMap[action.action_type] ?? {
              icon: Activity,
              label: action.action_type,
            }
            const Icon = config.icon
            const actionKey = `${action.entity_id}-${action.occurred_at}-${index}`
            const isExpanded = expandedIds.has(actionKey)
            const hasDetail = (action.changed_fields?.length ?? 0) > 0 || action.old_values || action.new_values

            return (
              <div
                key={actionKey}
                className="rounded-lg border bg-card transition-colors"
              >
                {/* Action header — clickable to expand */}
                <button
                  type="button"
                  onClick={() => hasDetail && toggleExpanded(actionKey)}
                  className={`flex items-start gap-3 px-3 py-2.5 w-full text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium leading-tight">
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {formatTime(action.occurred_at)}
                      </span>
                      {hasDetail && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </button>

                {/* Entity mini-card */}
                <div className="px-3 pb-2.5 pl-[52px]">
                  {action.entity_type === "intervention" ? (
                    <InterventionCard
                      meta={action.entity_meta as InterventionMeta | null}
                      label={action.entity_label}
                      onOpen={() => interventionModal.open(action.entity_id)}
                    />
                  ) : (
                    <ArtisanCard
                      meta={action.entity_meta as ArtisanMeta | null}
                      label={action.entity_label}
                      onOpen={() => artisanModal.open(action.entity_id)}
                    />
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && <ActionDetail action={action} />}
                {isExpanded && <div className="h-2" />}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
