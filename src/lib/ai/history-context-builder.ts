// ===== COLLECTEUR DE CONTEXTE D'HISTORIQUE IA =====
// Transforme l'historique brut d'une intervention en un resume structure
// pour enrichir les prompts IA avec du contexte reel.

import type { InterventionHistoryItem } from "@/hooks/useInterventionHistory"

// ---------- Types ----------

export interface InterventionHistoryContext {
  totalActions: number
  statusChanges: Array<{
    from: string
    to: string
    actor: string
    date: string
  }>
  artisanChanges: Array<{
    type: "assign" | "unassign" | "update"
    actor: string
    date: string
  }>
  costChanges: Array<{
    type: "add" | "update" | "delete"
    oldAmount?: number
    newAmount?: number
    date: string
  }>
  recentComments: Array<{
    content: string
    actor: string
    date: string
  }>
  metrics: {
    daysInCurrentStatus: number
    daysSinceCreation: number
    daysSinceLastAction: number
    totalStatusChanges: number
    totalCostChanges: number
  }
  alerts: string[]
}

// ---------- Helpers ----------

const MAX_ENTRIES_PER_CATEGORY = 20

/** Nombre de jours entre deux dates (arrondi). */
function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime())
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/** Formate une date ISO en representation courte (JJ/MM/AAAA HH:MM). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/** Extrait un nombre depuis une valeur inconnue. */
function toNumber(val: unknown): number | undefined {
  if (val == null) return undefined
  const n = Number(val)
  return Number.isFinite(n) ? n : undefined
}

/** Retourne une chaine ou un fallback. */
function toStr(val: unknown, fallback: string = "Inconnu"): string {
  if (typeof val === "string" && val.length > 0) return val
  return fallback
}

// ---------- Action type matchers ----------

const STATUS_CHANGE_TYPES = new Set(["STATUS_CHANGE"])
const ARTISAN_ASSIGN_TYPES = new Set(["ARTISAN_ASSIGN", "ARTISAN_REASSIGN"])
const ARTISAN_UNASSIGN_TYPES = new Set(["ARTISAN_UNASSIGN"])
const ARTISAN_UPDATE_TYPES = new Set(["ARTISAN_UPDATE"])
const COST_ADD_TYPES = new Set(["COST_ADD"])
const COST_UPDATE_TYPES = new Set(["COST_UPDATE"])
const COST_DELETE_TYPES = new Set(["COST_DELETE"])
const COMMENT_ADD_TYPES = new Set(["COMMENT_ADD"])

// ---------- Builder ----------

/**
 * Construit un contexte d'historique structure a partir des entrees brutes.
 *
 * @param history   - Entrees de l'audit log (via `useInterventionHistory`)
 * @param intervention - Donnees courantes de l'intervention (pour les metriques)
 * @returns Un objet `InterventionHistoryContext` pret a etre serialise pour le prompt IA
 */
export function buildHistoryContext(
  history: InterventionHistoryItem[],
  intervention: {
    created_at: string
    statut_id?: string | null
    cout_intervention?: number | null
    cout_sst?: number | null
    marge?: number | null
  },
): InterventionHistoryContext {
  const now = new Date()

  // Trier par date descendante (le plus recent en premier)
  const sorted = [...history].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  )

  // --- Extraire les changements de statut ---
  const statusChanges: InterventionHistoryContext["statusChanges"] = []
  for (const item of sorted) {
    if (!STATUS_CHANGE_TYPES.has(item.action_type)) continue
    if (statusChanges.length >= MAX_ENTRIES_PER_CATEGORY) break
    statusChanges.push({
      from: toStr(item.old_values?.["statut_label"] ?? item.old_values?.["statut_code"]),
      to: toStr(item.new_values?.["statut_label"] ?? item.new_values?.["statut_code"]),
      actor: toStr(item.actor_display),
      date: formatDate(item.occurred_at),
    })
  }

  // --- Extraire les changements d'artisan ---
  const artisanChanges: InterventionHistoryContext["artisanChanges"] = []
  for (const item of sorted) {
    let type: "assign" | "unassign" | "update" | null = null
    if (ARTISAN_ASSIGN_TYPES.has(item.action_type)) type = "assign"
    else if (ARTISAN_UNASSIGN_TYPES.has(item.action_type)) type = "unassign"
    else if (ARTISAN_UPDATE_TYPES.has(item.action_type)) type = "update"
    if (!type) continue
    if (artisanChanges.length >= MAX_ENTRIES_PER_CATEGORY) break
    artisanChanges.push({
      type,
      actor: toStr(item.actor_display),
      date: formatDate(item.occurred_at),
    })
  }

  // --- Extraire les changements de couts ---
  const costChanges: InterventionHistoryContext["costChanges"] = []
  for (const item of sorted) {
    let type: "add" | "update" | "delete" | null = null
    if (COST_ADD_TYPES.has(item.action_type)) type = "add"
    else if (COST_UPDATE_TYPES.has(item.action_type)) type = "update"
    else if (COST_DELETE_TYPES.has(item.action_type)) type = "delete"
    if (!type) continue
    if (costChanges.length >= MAX_ENTRIES_PER_CATEGORY) break
    costChanges.push({
      type,
      oldAmount: toNumber(item.old_values?.["montant"] ?? item.old_values?.["cout_intervention"]),
      newAmount: toNumber(item.new_values?.["montant"] ?? item.new_values?.["cout_intervention"]),
      date: formatDate(item.occurred_at),
    })
  }

  // --- Extraire les commentaires recents ---
  const recentComments: InterventionHistoryContext["recentComments"] = []
  for (const item of sorted) {
    if (!COMMENT_ADD_TYPES.has(item.action_type)) continue
    if (recentComments.length >= MAX_ENTRIES_PER_CATEGORY) break
    const content = toStr(
      item.new_values?.["contenu"] ?? item.new_values?.["content"] ?? item.action_label,
      "",
    )
    if (!content) continue
    recentComments.push({
      content: content.length > 200 ? `${content.slice(0, 200)}...` : content,
      actor: toStr(item.actor_display),
      date: formatDate(item.occurred_at),
    })
  }

  // --- Calculer les metriques ---
  const createdAt = new Date(intervention.created_at)

  // Date du dernier changement de statut
  const lastStatusChange = sorted.find((i) => STATUS_CHANGE_TYPES.has(i.action_type))
  const daysInCurrentStatus = lastStatusChange
    ? daysBetween(new Date(lastStatusChange.occurred_at), now)
    : daysBetween(createdAt, now)

  const daysSinceCreation = daysBetween(createdAt, now)

  const lastAction = sorted[0]
  const daysSinceLastAction = lastAction
    ? daysBetween(new Date(lastAction.occurred_at), now)
    : daysSinceCreation

  const metrics: InterventionHistoryContext["metrics"] = {
    daysInCurrentStatus,
    daysSinceCreation,
    daysSinceLastAction,
    totalStatusChanges: statusChanges.length,
    totalCostChanges: costChanges.length,
  }

  // --- Generer les alertes ---
  const alerts = buildAlerts(metrics, intervention, artisanChanges, statusChanges)

  return {
    totalActions: history.length,
    statusChanges,
    artisanChanges,
    costChanges,
    recentComments,
    metrics,
    alerts,
  }
}

// ---------- Alertes ----------

function buildAlerts(
  metrics: InterventionHistoryContext["metrics"],
  intervention: {
    cout_intervention?: number | null
    cout_sst?: number | null
    marge?: number | null
  },
  artisanChanges: InterventionHistoryContext["artisanChanges"],
  statusChanges: InterventionHistoryContext["statusChanges"],
): string[] {
  const alerts: string[] = []

  // Intervention inactive depuis > 7 jours
  if (metrics.daysSinceLastAction > 7) {
    alerts.push(
      `Aucune activite depuis ${metrics.daysSinceLastAction} jours`,
    )
  }

  // Marge negative
  if (intervention.marge != null && intervention.marge < 0) {
    alerts.push(`Marge negative (${intervention.marge} EUR)`)
  }

  // Marge tres basse (< 5% du cout intervention)
  if (
    intervention.marge != null &&
    intervention.marge >= 0 &&
    intervention.cout_intervention != null &&
    intervention.cout_intervention > 0
  ) {
    const margePercent = (intervention.marge / intervention.cout_intervention) * 100
    if (margePercent < 5) {
      alerts.push(
        `Marge tres basse (${margePercent.toFixed(1)}% du cout intervention)`,
      )
    }
  }

  // Pas d'artisan assigne (aucune assignation, ou derniere action est un unassign)
  const hasAssignment = artisanChanges.some((c) => c.type === "assign")
  const lastArtisanAction = artisanChanges[0]
  if (!hasAssignment || lastArtisanAction?.type === "unassign") {
    alerts.push("Aucun artisan assigne actuellement")
  }

  // Changements de statut frequents (ping-pong : > 4 changements)
  if (statusChanges.length > 4) {
    alerts.push(
      `Nombreux changements de statut (${statusChanges.length} transitions) - possible ping-pong`,
    )
  }

  return alerts
}
