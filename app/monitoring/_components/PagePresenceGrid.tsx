"use client"

import { LayoutDashboard, Wrench, HardHat, Receipt, FileText, Settings, Eye } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { cn } from "@/lib/utils"
import type { PagePresenceUser } from "@/types/presence"

interface PageConfig {
  label: string
  icon: React.ElementType
  gradient: string
  border: string
  badge: string
}

const PAGE_CONFIG: Record<string, PageConfig> = {
  dashboard: {
    label: "Dashboard",
    icon: LayoutDashboard,
    gradient: "from-sky-500/10 to-sky-500/5 dark:from-sky-500/20 dark:to-sky-500/5",
    border: "border-sky-500/30 dark:border-sky-400/20",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  interventions: {
    label: "Interventions",
    icon: Wrench,
    gradient: "from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/5",
    border: "border-orange-500/30 dark:border-orange-400/20",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  artisans: {
    label: "Artisans",
    icon: HardHat,
    gradient: "from-violet-500/10 to-violet-500/5 dark:from-violet-500/20 dark:to-violet-500/5",
    border: "border-violet-500/30 dark:border-violet-400/20",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  comptabilite: {
    label: "Comptabilite",
    icon: Receipt,
    gradient: "from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5",
    border: "border-emerald-500/30 dark:border-emerald-400/20",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  settings: {
    label: "Parametres",
    icon: Settings,
    gradient: "from-slate-500/10 to-slate-500/5 dark:from-slate-500/20 dark:to-slate-500/5",
    border: "border-slate-500/30 dark:border-slate-400/20",
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
}

const FALLBACK_CONFIG: PageConfig = {
  label: "Autre",
  icon: FileText,
  gradient: "from-gray-500/10 to-gray-500/5",
  border: "border-gray-500/20",
  badge: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
}

const KNOWN_PAGES = ["dashboard", "interventions", "artisans", "comptabilite", "settings"]

interface PagePresenceGridProps {
  grouped: Record<string, PagePresenceUser[]>
  onSelectUser: (userId: string) => void
}

export function PagePresenceGrid({ grouped, onSelectUser }: PagePresenceGridProps) {
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  // Order: known pages first, then others
  const others = Object.keys(grouped).filter(
    (k) => !KNOWN_PAGES.includes(k) && k !== "_other"
  )
  const orderedPages: string[] = []
  for (const p of [...KNOWN_PAGES, ...others, "_other"]) {
    if (grouped[p]?.length) orderedPages.push(p)
  }

  if (orderedPages.length === 0) {
    return null
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedPages.map((pageKey) => {
          const users = grouped[pageKey]
          const config = PAGE_CONFIG[pageKey] ?? FALLBACK_CONFIG
          const Icon = config.icon
          const label = PAGE_CONFIG[pageKey]?.label ?? pageKey

          return (
            <div
              key={pageKey}
              className={cn(
                "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md",
                config.gradient,
                config.border,
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", config.badge)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-semibold">{label}</h3>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", config.badge)}>
                  {users.length}
                </span>
              </div>

              {/* User badges */}
              <div className="flex flex-wrap gap-2">
                {users.map((user) => {
                  const nameParts = user.name.split(" ")
                  const firstName = nameParts[0] || ""
                  const lastName = nameParts.slice(1).join(" ") || ""
                  const hasIntervention = Boolean(user.activeInterventionId)
                  const hasArtisan = Boolean(user.activeArtisanId)

                  return (
                    <Tooltip key={user.userId}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelectUser(user.userId)}
                          className="relative rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <GestionnaireBadge
                            prenom={firstName}
                            name={lastName}
                            color={user.color}
                            avatarUrl={user.avatarUrl}
                            size="sm"
                            showBorder
                          />
                          {(hasIntervention || hasArtisan) && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
                              <Eye className="h-2 w-2 text-white" />
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs">{user.name}</p>
                          {hasIntervention && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                interventionModal.open(user.activeInterventionId!)
                              }}
                              className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                            >
                              <Eye className="h-2.5 w-2.5" /> Intervention ouverte
                            </button>
                          )}
                          {hasArtisan && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                artisanModal.open(user.activeArtisanId!)
                              }}
                              className="flex items-center gap-1 text-[11px] text-violet-500 hover:underline"
                            >
                              <Eye className="h-2.5 w-2.5" /> Artisan ouvert
                            </button>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
