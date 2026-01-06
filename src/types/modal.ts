import type { ModalDisplayMode } from "./modal-display"

export type ModalContent = "intervention" | "chat" | "artisan" | "new-intervention" | "new-artisan"

export type ModalContextData = Record<string, unknown>

export interface ActiveModalDescriptor {
  content: ModalContent
  id?: string | null
  context?: ModalContextData | null
  slug?: string[] | null
  origin?: string | null
}

export interface ModalOpenOptions {
  id?: string
  content?: ModalContent
  modeOverride?: ModalDisplayMode
  layoutId?: string | null
  orderedIds?: string[]
  index?: number
  context?: ModalContextData
  slug?: string[]
  origin?: string
  metadata?: Record<string, unknown>
}
