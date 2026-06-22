/**
 * Types du dashboard "Monitoring DEV" (page /monitoring-dev, réservée au rôle dev).
 *
 * Alimentés par les RPC `get_global_activity_feed` et `get_team_connections`
 * (migration 99033). Réutilise `RecentAction` du suivi quotidien pour rester
 * compatible avec le composant partagé `ActivityTimeline`.
 */
import type { RecentAction } from "@/hooks/useUserDailyActivity"

// ---------------------------------------------------------------------------
// Flux d'activité global
// ---------------------------------------------------------------------------

/** Auteur d'une action (snapshot figé dans les tables d'audit). */
export interface ActivityActor {
  user_id: string | null
  display: string | null
  code: string | null
  color: string | null
}

/** Une ligne du flux global = une action d'audit enrichie de son auteur. */
export interface GlobalActivityRow extends RecentAction {
  id: string
  actor: ActivityActor
}

/** Retour paginé de `get_global_activity_feed`. */
export interface GlobalActivityFeedResult {
  items: GlobalActivityRow[]
  total: number
}

export type ActivityEntityType = "intervention" | "artisan"

/** Paramètres d'appel du flux global. */
export interface GlobalActivityFeedParams {
  startDate: Date
  endDate: Date
  userIds?: string[] | null
  actionTypes?: string[] | null
  entityTypes?: ActivityEntityType[] | null
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Connexions / déconnexions (dérivé de user_page_sessions)
// ---------------------------------------------------------------------------

export interface ConnectionSession {
  page_name: string
  started_at: string
  ended_at: string
  duration_ms: number
}

/** Présence d'un gestionnaire pour un jour donné. */
export interface TeamConnectionDay {
  /** Jour ISO (YYYY-MM-DD). */
  date: string
  /** Première activité du jour = heure de connexion. */
  first_seen_at: string | null
  /** Dernière activité du jour = heure de déconnexion. */
  last_seen_at: string | null
  total_screen_time_ms: number
  sessions: ConnectionSession[]
}

/** Journal de connexions d'un gestionnaire sur la période. */
export interface TeamConnection {
  user_id: string
  firstname: string | null
  lastname: string | null
  color: string | null
  avatar_url: string | null
  code_gestionnaire: string | null
  days: TeamConnectionDay[]
}

// ---------------------------------------------------------------------------
// Pulse : heatmap + dossiers les plus actifs
// ---------------------------------------------------------------------------

export type HeatmapBucket = "hour" | "day"

/** Une cellule du heatmap : nb d'actions d'un gestionnaire dans un bucket. */
export interface HeatmapCell {
  user_id: string
  firstname: string | null
  lastname: string | null
  color: string | null
  code_gestionnaire: string | null
  /** "08".."19" (heure) ou "YYYY-MM-DD" (jour). */
  bucket: string
  count: number
}

export interface TopEntityActor {
  actor_user_id: string | null
  color: string | null
  count: number
}

/** Une entité (intervention/artisan) parmi les plus actives. */
export interface TopEntity {
  entity_type: ActivityEntityType
  entity_id: string
  entity_label: string | null
  count: number
  last_action_at: string | null
  last_action_type?: string | null
  last_actor?: { user_id: string | null; display: string | null; color: string | null } | null
  actors?: TopEntityActor[]
}

// ---------------------------------------------------------------------------
// État UI de la page Monitoring DEV (partagé entre _lib et _components)
// ---------------------------------------------------------------------------

export type SortKey = "screen" | "actions" | "created" | "devis" | "completed" | "retard"
export type RightView = "feed" | "entities"
export type Maxed = "left" | "right" | null

/** Focus contextuel : flux restreint à un gestionnaire (+ jour, + heure optionnelle). */
export interface DevFocus {
  userId: string
  label: string
  color: string
  start: Date
  end: Date
}
