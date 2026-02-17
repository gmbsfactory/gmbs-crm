"use client"

import { Badge } from "@/components/ui/badge"
import { UserActivityCard } from "./UserActivityCard"
import type { PagePresenceUser } from "@/types/presence"

const PAGE_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "\uD83D\uDCCA" },
  interventions: { label: "Interventions", icon: "\uD83D\uDD27" },
  artisans: { label: "Artisans", icon: "\uD83D\uDC77" },
  comptabilite: { label: "Comptabilite", icon: "\uD83D\uDCB0" },
}

interface PageGroupSectionProps {
  pageKey: string
  users: PagePresenceUser[]
  onSelectUser: (userId: string) => void
}

export function PageGroupSection({ pageKey, users, onSelectUser }: PageGroupSectionProps) {
  const config = PAGE_LABELS[pageKey]
  const label = config?.label ?? pageKey
  const icon = config?.icon ?? "\uD83D\uDCC4"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
        <Badge variant="secondary" className="text-xs">
          {users.length}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <UserActivityCard
            key={user.userId}
            user={user}
            onSelect={onSelectUser}
          />
        ))}
      </div>
    </div>
  )
}
