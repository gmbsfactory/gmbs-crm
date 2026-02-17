'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'

export interface InterventionRef {
  id: string
  numero: string | null
}

export interface TeamMemberOverview {
  user_id: string
  firstname: string | null
  lastname: string | null
  color: string | null
  avatar_url: string | null
  status: string | null
  code_gestionnaire: string | null
  first_seen_at: string | null
  total_screen_time_ms: number
  total_actions: number
  interventions_created: number
  interventions_completed: number
  devis_sent: number
  created_ids: InterventionRef[]
  completed_ids: InterventionRef[]
  devis_ids: InterventionRef[]
}

export function useTeamDailyOverview(date?: Date) {
  const dateStr = (date ?? new Date()).toISOString().split('T')[0]

  return useQuery<TeamMemberOverview[]>({
    queryKey: ['team-daily-overview', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_team_daily_overview' as any,
        {
          p_date: dateStr,
        }
      )
      if (error) throw error
      return (data as unknown as TeamMemberOverview[]) ?? []
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
