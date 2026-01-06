"use client"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { FileText, Archive } from "lucide-react"
import { useArtisanContextMenu } from "@/hooks/useArtisanContextMenu"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { usePermissions } from "@/hooks/usePermissions"

interface ArtisanContextMenuContentProps {
  artisanId: string
  isArchived?: boolean
  onOpen?: () => void
}

export function ArtisanContextMenuContent({
  artisanId,
  isArchived = false,
  onOpen,
}: ArtisanContextMenuContentProps) {
  const {
    onOpen: handleOpen,
    onArchive: handleArchive,
    archiveModal,
    isArchived: hookIsArchived,
  } = useArtisanContextMenu(artisanId)
  const { can } = usePermissions()
  
  // Utiliser la prop isArchived si fournie, sinon utiliser la valeur du hook
  const shouldHideArchive = isArchived || hookIsArchived
  const canWriteArtisans = can("write_artisans")

  const handleOpenClick = () => {
    handleOpen()
    onOpen?.()
  }

  return (
    <>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={handleOpenClick}>
          <FileText className="mr-2 h-4 w-4" />
          Ouvrir fiche artisan
        </ContextMenuItem>
        {canWriteArtisans && !shouldHideArchive && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={handleArchive}
              disabled={archiveModal.isSubmitting}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archiver
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      <StatusReasonModal
        open={archiveModal.isOpen}
        type="archive"
        onConfirm={archiveModal.onConfirm}
        onCancel={archiveModal.onCancel}
        isSubmitting={archiveModal.isSubmitting}
      />
    </>
  )
}
