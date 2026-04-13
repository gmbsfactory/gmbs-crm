"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updatesApi } from "@/lib/api"
import { updateKeys } from "@/lib/react-query/queryKeys"

export function useAcknowledgeUpdates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, updateIds }: { userId: string; updateIds: string[] }) =>
      updatesApi.acknowledgeUpdates(userId, updateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: updateKeys.unseen() })
      queryClient.invalidateQueries({ queryKey: updateKeys.journal() })
    },
  })
}
