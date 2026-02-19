"use client"

import { useState } from "react"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { cn } from "@/lib/utils"
import { ChevronDown, Users, X } from "lucide-react"

const ROLES = [
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

/** Résumé compact de la sélection : "Tous", "Admin + 2", "3 utilisateurs", etc. */
function getSelectionSummary(audience: string[], targetUserIds: string[]): string {
  const parts: string[] = []

  if (audience.includes("all")) {
    parts.push("Tous")
  } else {
    for (const r of ROLES) {
      if (r.key !== "all" && audience.includes(r.key)) {
        parts.push(r.label)
      }
    }
  }

  const extraUsers = targetUserIds.length
  if (parts.length === 0 && extraUsers === 0) return "Aucun ciblage"
  if (parts.length === 0) return `${extraUsers} utilisateur${extraUsers > 1 ? "s" : ""}`
  if (extraUsers > 0) return `${parts.join(", ")} + ${extraUsers}`
  return parts.join(", ")
}

export function AudienceSelector({ audience, targetUserIds, onChange }: AudienceSelectorProps) {
  const { data: gestionnaires } = useGestionnaires()
  const [isExpanded, setIsExpanded] = useState(false)

  const isRoleActive = (role: string) => audience.includes(role)

  const toggleRole = (role: string) => {
    if (role === "all") {
      if (audience.includes("all")) {
        onChange([], targetUserIds)
      } else {
        onChange(["all"], targetUserIds)
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

  const removeUser = (userId: string) => {
    onChange(audience, targetUserIds.filter(id => id !== userId))
  }

  const summary = getSelectionSummary(audience, targetUserIds)
  const hasSelection = audience.length > 0 || targetUserIds.length > 0

  // Utilisateurs sélectionnés individuellement (pour afficher les chips)
  const selectedUsers = gestionnaires?.filter(g => targetUserIds.includes(g.id)) ?? []

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">Ciblage</label>

      {/* Résumé cliquable */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors text-left",
          isExpanded ? "ring-2 ring-ring border-transparent" : "hover:border-foreground/20"
        )}
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn("flex-1 truncate", hasSelection ? "text-foreground font-medium" : "text-muted-foreground")}>
          {summary}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
          isExpanded && "rotate-180"
        )} />
      </button>

      {/* Panneau déplié */}
      {isExpanded && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          {/* Rôles */}
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Par rôle</span>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map(rf => (
                <button
                  key={rf.key}
                  type="button"
                  onClick={() => toggleRole(rf.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    isRoleActive(rf.key)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted border"
                  )}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Utilisateurs individuels */}
          {gestionnaires && gestionnaires.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Individuel
              </span>
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
                          : "bg-background opacity-60 hover:opacity-100 border"
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
      )}

      {/* Chips de sélection (toujours visibles quand replié) */}
      {!isExpanded && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map(g => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              <GestionnaireBadge
                firstname={g.firstname}
                lastname={g.lastname}
                color={g.color}
                avatarUrl={g.avatar_url}
                size="xs"
                showBorder={false}
              />
              {g.firstname} {g.lastname?.[0]}.
              <button
                type="button"
                onClick={() => removeUser(g.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
