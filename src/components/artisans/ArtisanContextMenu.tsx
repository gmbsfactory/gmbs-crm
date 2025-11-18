"use client"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { FileText, Pencil, Archive } from "lucide-react"
import { useArtisanContextMenu } from "@/hooks/useArtisanContextMenu"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"

interface ArtisanContextMenuContentProps {
  artisanId: string
  isArchived?: boolean
  onOpen?: () => void
  onEdit?: () => void
}

export function ArtisanContextMenuContent({
  artisanId,
  isArchived = false,
  onOpen,
  onEdit,
}: ArtisanContextMenuContentProps) {
  const {
    onOpen: handleOpen,
    onEdit: handleEdit,
    onArchive: handleArchive,
    archiveModal,
    isArchived: hookIsArchived,
  } = useArtisanContextMenu(artisanId)
  
  // Utiliser la prop isArchived si fournie, sinon utiliser la valeur du hook
  const shouldHideArchive = isArchived || hookIsArchived

  const handleOpenClick = () => {
    handleOpen()
    onOpen?.()
  }

  const handleEditClick = () => {
    handleEdit()
    onEdit?.()
  }

  return (
    <>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={handleOpenClick}>
          <FileText className="mr-2 h-4 w-4" />
          Ouvrir fiche artisan
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleEditClick}>
          <Pencil className="mr-2 h-4 w-4" />
          Modifier fiche artisan
        </ContextMenuItem>
        {!shouldHideArchive && (
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

