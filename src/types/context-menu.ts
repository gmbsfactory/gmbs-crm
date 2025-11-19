// Types pour les menus contextuels

export type ContextMenuViewType = "default" | "market"

export interface InterventionContextMenuProps {
  interventionId: string
  viewType?: ContextMenuViewType
  onOpen?: () => void
  onOpenInNewTab?: () => void
}

export interface ArtisanContextMenuProps {
  artisanId: string
  onOpen?: () => void
  onEdit?: () => void
  onArchive?: () => void
}




