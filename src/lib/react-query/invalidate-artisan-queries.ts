import type { QueryClient } from "@tanstack/react-query"
import { artisanKeys } from "@/lib/react-query/queryKeys"

export function invalidateArtisanQueries(
  queryClient: QueryClient,
  artisanIds?: Array<string | null | undefined>
) {
  if (!Array.isArray(artisanIds) || artisanIds.length === 0) return

  const uniqueIds = Array.from(
    new Set(artisanIds.filter((id): id is string => typeof id === "string" && id.length > 0))
  )

  uniqueIds.forEach((artisanId) => {
    queryClient.invalidateQueries({ queryKey: artisanKeys.detail(artisanId), refetchType: "active" })
    queryClient.invalidateQueries({ queryKey: ["artisan", artisanId], refetchType: "active" })
  })
}
