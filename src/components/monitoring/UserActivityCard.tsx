"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { PagePresenceUser } from "@/types/presence"

interface UserActivityCardProps {
  user: PagePresenceUser
  onSelect: (userId: string) => void
}

/** Format duration from joinedAt to now as "Xh Xmin" */
function formatDuration(joinedAt: string): string {
  const diff = Date.now() - new Date(joinedAt).getTime()
  const totalMins = Math.max(0, Math.floor(diff / 60000))
  if (totalMins < 1) return "< 1min"
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours === 0) return `${mins}min`
  return `${hours}h ${mins.toString().padStart(2, "0")}min`
}

/** Format joinedAt as HH:MM */
function formatTime(joinedAt: string): string {
  const d = new Date(joinedAt)
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

export function UserActivityCard({ user, onSelect }: UserActivityCardProps) {
  const router = useRouter()
  const nameParts = user.name.split(" ")
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""

  // Timer that re-renders every 60s
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/5 cursor-pointer"
      onClick={() => onSelect(user.userId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(user.userId)
        }
      }}
    >
      <GestionnaireBadge
        prenom={firstName}
        name={lastName}
        color={user.color}
        avatarUrl={user.avatarUrl}
        size="md"
        showBorder
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{user.name}</p>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Actif</span>
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          Premiere co: {formatTime(user.joinedAt)}
        </p>

        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <span>&#9201;</span> {formatDuration(user.joinedAt)}
        </p>
      </div>

      <div className="flex flex-col gap-1 self-end shrink-0">
        {user.activeInterventionId && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/interventions?modal=${user.activeInterventionId}`)
            }}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={`Voir intervention ${user.activeInterventionId}`}
          >
            <span className="text-xs">Intervention</span>
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        {user.activeArtisanId && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/artisans?modal=${user.activeArtisanId}`)
            }}
            className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-2 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
            title={`Voir artisan ${user.activeArtisanId}`}
          >
            <span className="text-xs">Artisan</span>
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
