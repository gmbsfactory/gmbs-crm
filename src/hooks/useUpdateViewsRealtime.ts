"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { updateKeys } from "@/lib/react-query/queryKeys"

/**
 * Subscribe to realtime changes on app_update_views.
 * On any INSERT/UPDATE/DELETE, invalidate the admin views query.
 * Low-traffic table (dev-only page), no need for leader-election.
 */
export function useUpdateViewsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('update-views-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_update_views' },
        () => {
          queryClient.invalidateQueries({ queryKey: updateKeys.adminWithViews() })
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
