"use client"

import { useQuery } from "@tanstack/react-query"
import { updatesApi } from "@/lib/api"
import { updateKeys } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export function useUnseenUpdates() {
  const { data: currentUser } = useCurrentUser()

  return useQuery({
    queryKey: updateKeys.unseen(),
    queryFn: () =>
      updatesApi.getUnseen(
        currentUser!.id,
        currentUser!.roles || []
      ),
    enabled: Boolean(currentUser?.id),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
