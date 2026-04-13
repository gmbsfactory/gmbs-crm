"use client"

import { useQuery } from "@tanstack/react-query"
import { updatesApi } from "@/lib/api"
import { updateKeys } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export function useUpdatesJournal() {
  const { data: currentUser } = useCurrentUser()

  return useQuery({
    queryKey: updateKeys.journal(),
    queryFn: () =>
      updatesApi.getJournal(
        currentUser!.id,
        currentUser!.roles || []
      ),
    enabled: Boolean(currentUser?.id),
    staleTime: 5 * 60_000,
  })
}
