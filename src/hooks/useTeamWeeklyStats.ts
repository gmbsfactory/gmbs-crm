'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'

export interface DayPageStat {
  page: string
  duration_ms: number
}

export interface DailyBreakdown {
  date: string
  first_seen_at: string
  screen_time_ms: number
  created: number
  completed: number
  devis: number
  actions: number
  pages: DayPageStat[]
}

export interface TeamMemberWeeklyStat {
  user_id: string
  firstname: string | null
  lastname: string | null
  color: string | null
  avatar_url: string | null
  code_gestionnaire: string | null
  days_active: number
  total_screen_time_ms: number
  avg_daily_screen_time_ms: number
  interventions_created: number
  interventions_completed: number
  devis_sent: number
  total_actions: number
  daily_breakdown: DailyBreakdown[]
}

export function useTeamWeeklyStats(startDate: Date, endDate: Date) {
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  return useQuery<TeamMemberWeeklyStat[]>({
    queryKey: ['team-weekly-stats', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_team_weekly_stats' as any,
        {
          p_start_date: startStr,
          p_end_date: endStr,
        }
      )
      if (error) throw error
      return (data as unknown as TeamMemberWeeklyStat[]) ?? []
    },
    staleTime: 5 * 60_000,
  })
}
