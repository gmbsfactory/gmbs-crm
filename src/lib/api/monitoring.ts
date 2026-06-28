/**
 * API Monitoring DEV — façade des RPC d'activité agrégée (migration 99033).
 *
 * Les composants ne touchent jamais Supabase directement (cf. CLAUDE.md) :
 * ils passent par les hooks (`useGlobalActivityFeed`, `useTeamConnections`)
 * qui consomment ce module.
 */
import { supabase } from "@/lib/supabase-client"
import { toParisDateStr } from "@/lib/monitoring/local-date"
import type {
  GlobalActivityFeedParams,
  GlobalActivityFeedResult,
  HeatmapBucket,
  HeatmapCell,
  TeamConnection,
  TopEntity,
} from "@/types/monitoring"

/** YYYY-MM-DD (jour Europe/Paris) à partir d'une Date — voir local-date.ts. */
function toDateStr(d: Date): string {
  return toParisDateStr(d)
}

export const monitoringApi = {
  /** Flux global de toutes les actions (interventions + artisans) sur une période. */
  async getGlobalActivityFeed(
    params: GlobalActivityFeedParams
  ): Promise<GlobalActivityFeedResult> {
    const { data, error } = await supabase.rpc("get_global_activity_feed" as never, {
      p_date_start: params.startDate.toISOString(),
      p_date_end: params.endDate.toISOString(),
      p_user_ids: params.userIds ?? null,
      p_action_types: params.actionTypes ?? null,
      p_entity_types: params.entityTypes ?? null,
      p_limit: params.limit ?? 200,
      p_offset: params.offset ?? 0,
    })
    if (error) throw error
    return (
      (data as unknown as GlobalActivityFeedResult) ?? { items: [], total: 0 }
    )
  },

  /** Horaires de connexion/déconnexion + présence par jour (dérivé des sessions). */
  async getTeamConnections(
    startDate: Date,
    endDate: Date,
    userIds?: string[] | null
  ): Promise<TeamConnection[]> {
    const { data, error } = await supabase.rpc("get_team_connections" as never, {
      p_date_start: toDateStr(startDate),
      p_date_end: toDateStr(endDate),
      p_user_ids: userIds ?? null,
    })
    if (error) throw error
    return (data as unknown as TeamConnection[]) ?? []
  },

  /** Heatmap des actions par gestionnaire × bucket (heure/jour). */
  async getActivityHeatmap(
    startDate: Date,
    endDate: Date,
    bucket: HeatmapBucket,
    userIds?: string[] | null
  ): Promise<HeatmapCell[]> {
    const { data, error } = await supabase.rpc("get_activity_heatmap" as never, {
      p_date_start: startDate.toISOString(),
      p_date_end: endDate.toISOString(),
      p_bucket: bucket,
      p_user_ids: userIds ?? null,
    })
    if (error) throw error
    return (data as unknown as HeatmapCell[]) ?? []
  },

  /** Entités les plus actives sur la période. */
  async getTopEntities(
    startDate: Date,
    endDate: Date,
    limit = 10,
    userIds?: string[] | null
  ): Promise<TopEntity[]> {
    const { data, error } = await supabase.rpc("get_top_entities" as never, {
      p_date_start: startDate.toISOString(),
      p_date_end: endDate.toISOString(),
      p_limit: limit,
      p_user_ids: userIds ?? null,
    })
    if (error) throw error
    return (data as unknown as TopEntity[]) ?? []
  },
}
