"use client"

import type { ComponentType } from "react"
import { BarChart3, History, Info, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar } from "@/components/artisans/Avatar"
import { PresenceAvatars } from "@/components/ui/intervention-modal/PresenceAvatars"
import type { ModalDisplayMode } from "@/types/modal-display"
import type { Artisan } from "@/lib/api/common/types"
import { computeBadgeStyle } from "@/components/ui/artisan-modal/_lib/badge-style"
import { formatDate } from "@/components/ui/artisan-modal/_lib/format"
import { cn } from "@/lib/utils"

type ArtisanStatus = { id: string; label: string | null; color?: string | null }

type Props = {
  artisan: Artisan | null | undefined
  mode: ModalDisplayMode
  ModeIcon: ComponentType<{ className?: string }>
  onCycleMode?: () => void
  onCancel: () => void
  showStats: boolean
  onToggleStats: () => void
  onOpenHistory: () => void
  viewers: Parameters<typeof PresenceAvatars>[0]["viewers"]
  photoProfilMetadata: Parameters<typeof Avatar>[0]["photoProfilMetadata"]
  avatarInitials: string
  displayName: string
  companyName: string | null
  activeIndex?: number
  totalCount?: number
  artisanStatuses: ArtisanStatus[] | undefined
}

export function ArtisanModalHeader({
  artisan,
  mode,
  ModeIcon,
  onCycleMode,
  onCancel,
  showStats,
  onToggleStats,
  onOpenHistory,
  viewers,
  photoProfilMetadata,
  avatarInitials,
  displayName,
  companyName,
  activeIndex,
  totalCount,
  artisanStatuses,
}: Props) {
  return (
    <header className="modal-config-columns-header relative bg-[#8DA5CE] dark:bg-transparent">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="modal-config-columns-icon-button"
              onClick={onCancel}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
        </Tooltip>

        {onCycleMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="modal-config-columns-icon-button"
                onClick={onCycleMode}
                aria-label="Changer le mode d'affichage"
              >
                <ModeIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="modal-config-columns-tooltip">
              Ajuster l&apos;affichage ({mode})
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="modal-config-columns-icon-placeholder" />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "modal-config-columns-icon-button",
                showStats && "bg-primary/20 text-primary",
              )}
              onClick={onToggleStats}
              aria-label={showStats ? "Afficher les informations" : "Afficher les statistiques"}
            >
              {showStats ? <Info className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="modal-config-columns-tooltip">
            {showStats ? "Informations" : "Statistiques"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="modal-config-columns-icon-button"
              onClick={onOpenHistory}
              aria-label="Voir l'historique"
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="modal-config-columns-tooltip">
            Historique des actions
          </TooltipContent>
        </Tooltip>
        <PresenceAvatars viewers={viewers} />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
        <Avatar
          photoProfilMetadata={photoProfilMetadata}
          initials={avatarInitials}
          name={displayName}
          size={48}
          priority={true}
          className="pointer-events-auto"
        />
        <div className="flex flex-col items-center">
          <div className="modal-config-columns-title">
            {displayName}
            {activeIndex !== undefined && totalCount !== undefined && totalCount > 1 ? (
              <span className="ml-2 text-sm text-muted-foreground">
                ({(activeIndex ?? 0) + 1} / {totalCount})
              </span>
            ) : null}
          </div>
          {companyName ? (
            <span className="text-xs text-muted-foreground">{companyName}</span>
          ) : null}
        </div>
      </div>
      {artisan && (
        <div className="flex items-center gap-2">
          {artisan.created_at && (
            <span className="text-xs text-muted-foreground mr-2">
              Créé le {formatDate(artisan.created_at)}
            </span>
          )}
          {(() => {
            const status = artisanStatuses?.find((s) => s.id === artisan.statut_id)
            if (!status) return null
            const pillStyles = status.color ? computeBadgeStyle(status.color) : undefined
            return (
              <Badge
                className="text-xs font-semibold px-2.5 py-0.5 whitespace-nowrap"
                style={pillStyles}
              >
                {status.label}
              </Badge>
            )
          })()}
        </div>
      )}
    </header>
  )
}
