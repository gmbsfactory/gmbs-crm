"use client"

import { Eye } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import type { PagePresenceUser } from "@/types/presence"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  interventions: "Interventions",
  artisans: "Artisans",
  comptabilite: "Comptabilite",
  wheretheuser: "Suivi",
  settings: "Parametres",
}

interface OnlineUsersBarProps {
  users: PagePresenceUser[]
  onSelectUser: (userId: string) => void
}

/**
 * Compact horizontal row of online user badges.
 * Each badge shows the user's current page on hover.
 * Active modals (intervention/artisan) are indicated by a small colored ring.
 * Clicking "Intervention ouverte" / "Artisan ouvert" opens the modal in-page.
 */
export function OnlineUsersBar({ users, onSelectUser }: OnlineUsersBarProps) {
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-3">
        Aucun utilisateur connecte
      </p>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap gap-3">
        {users.map((user) => {
          const nameParts = user.name.split(" ")
          const firstName = nameParts[0] || ""
          const lastName = nameParts.slice(1).join(" ") || ""
          const pageLabel = PAGE_LABELS[user.currentPage ?? ""] ?? user.currentPage ?? "\u2014"
          const hasModal = Boolean(user.activeInterventionId || user.activeArtisanId)

          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelectUser(user.userId)}
                  className="group relative flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative">
                    <GestionnaireBadge
                      prenom={firstName}
                      name={lastName}
                      color={user.color}
                      avatarUrl={user.avatarUrl}
                      size="md"
                      showBorder
                    />
                    {/* Green pulse dot */}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                    </span>
                    {/* Modal indicator */}
                    {hasModal && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
                        <Eye className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground max-w-[60px] truncate leading-tight">
                    {firstName}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-muted-foreground">Page : {pageLabel}</p>
                  {user.activeInterventionId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        interventionModal.open(user.activeInterventionId!)
                      }}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    >
                      <Eye className="h-3 w-3" /> Intervention ouverte
                    </button>
                  )}
                  {user.activeArtisanId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        artisanModal.open(user.activeArtisanId!)
                      }}
                      className="flex items-center gap-1 text-xs text-violet-500 hover:underline"
                    >
                      <Eye className="h-3 w-3" /> Artisan ouvert
                    </button>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
