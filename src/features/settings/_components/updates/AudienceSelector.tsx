"use client"

import { useGestionnaires } from "@/hooks/useGestionnaires"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { cn } from "@/lib/utils"

const ROLE_FILTERS = [
  { key: "all", label: "Tous" },
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "gestionnaire", label: "Gestionnaire" },
] as const

interface AudienceSelectorProps {
  audience: string[]
  targetUserIds: string[]
  onChange: (audience: string[], targetUserIds: string[]) => void
}

export function AudienceSelector({ audience, targetUserIds, onChange }: AudienceSelectorProps) {
  const { data: gestionnaires } = useGestionnaires()

  const isRoleActive = (role: string) => audience.includes(role)

  const toggleRole = (role: string) => {
    if (role === "all") {
      if (audience.includes("all")) {
        onChange([], [])
      } else {
        onChange(["all"], [])
      }
      return
    }

    const newAudience = audience.filter(a => a !== "all")
    if (newAudience.includes(role)) {
      onChange(newAudience.filter(a => a !== role), targetUserIds)
    } else {
      onChange([...newAudience, role], targetUserIds)
    }
  }

  const toggleUser = (userId: string) => {
    const newIds = targetUserIds.includes(userId)
      ? targetUserIds.filter(id => id !== userId)
      : [...targetUserIds, userId]
    onChange(audience, newIds)
  }

  const selectAllOfRole = (role: string) => {
    if (!gestionnaires) return
    const usersOfRole = gestionnaires.filter(g => {
      if (role === "all") return true
      return (g.roles || []).some(r => r.toLowerCase() === role) ||
        (g.role || "").toLowerCase() === role
    })
    const ids = usersOfRole.map(g => g.id)
    const allSelected = ids.every(id => targetUserIds.includes(id))

    if (allSelected) {
      onChange(audience, targetUserIds.filter(id => !ids.includes(id)))
    } else {
      const merged = new Set([...targetUserIds, ...ids])
      onChange(audience, Array.from(merged))
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground block">Audience</label>

      {/* Role filters */}
      <div className="flex flex-wrap gap-1.5">
        {ROLE_FILTERS.map(rf => (
          <button
            key={rf.key}
            type="button"
            onClick={() => toggleRole(rf.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isRoleActive(rf.key)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {rf.label}
          </button>
        ))}
      </div>

      {/* Individual users */}
      {gestionnaires && gestionnaires.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ciblage individuel ({targetUserIds.length} sélectionné{targetUserIds.length !== 1 ? "s" : ""})
            </span>
            <div className="flex gap-1">
              {ROLE_FILTERS.filter(rf => rf.key !== "all").map(rf => (
                <button
                  key={rf.key}
                  type="button"
                  onClick={() => selectAllOfRole(rf.key)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted"
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {gestionnaires.map(g => {
              const isSelected = targetUserIds.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleUser(g.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-muted/50 opacity-60 hover:opacity-100"
                  )}
                >
                  <GestionnaireBadge
                    firstname={g.firstname}
                    lastname={g.lastname}
                    color={g.color}
                    avatarUrl={g.avatar_url}
                    size="xs"
                    showBorder={false}
                  />
                  <span className="font-medium">
                    {g.firstname} {g.lastname?.[0]}.
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
