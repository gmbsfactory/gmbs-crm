'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'

interface PageStat {
  page_name: string
  total_duration_ms: number
  visit_count: number
}

interface ActionStat {
  action_type: string
  count: number
}

export interface InterventionMeta {
  id_inter: string | null
  date: string | null
  statut_code: string | null
  statut_label: string | null
  statut_color: string | null
}

export interface ArtisanMeta {
  nom: string | null
  prenom: string | null
  raison_sociale: string | null
  statut_code: string | null
  statut_label: string | null
  statut_color: string | null
}

export interface RecentAction {
  action_type: string
  entity_type: 'intervention' | 'artisan'
  entity_id: string
  entity_label: string | null
  entity_meta: InterventionMeta | ArtisanMeta | null
  occurred_at: string
  changed_fields: string[] | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

export interface UserDailyActivity {
  first_seen_at: string | null
  last_seen_at: string | null
  total_screen_time_ms: number
  pages: PageStat[]
  intervention_actions: ActionStat[]
  interventions_created: number
  interventions_completed: number
  devis_sent: number
  recent_actions: RecentAction[]
}

export function useUserDailyActivity(userId: string | null, date?: Date) {
  const dateStr = (date ?? new Date()).toISOString().split('T')[0]

  return useQuery<UserDailyActivity>({
    queryKey: ['user-daily-activity', userId, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_user_daily_activity' as any,
        {
          p_user_id: userId!,
          p_date: dateStr,
        }
      )
      if (error) throw error
      return data as unknown as UserDailyActivity
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
