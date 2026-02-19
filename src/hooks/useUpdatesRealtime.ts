"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { updateKeys } from "@/lib/react-query/queryKeys"

/**
 * Subscribe to realtime changes on app_updates.
 * On any INSERT/UPDATE/DELETE, invalidate unseen + journal queries
 * so gestionnaires see new publications instantly.
 * Low-traffic table, no need for leader-election.
 */
export function useUpdatesRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('app-updates-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_updates' },
        () => {
          queryClient.invalidateQueries({ queryKey: updateKeys.unseen() })
          queryClient.invalidateQueries({ queryKey: updateKeys.journal() })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
