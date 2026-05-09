"use client"

import { Button } from "@/components/ui/button"
import type { Artisan } from "@/lib/api/common/types"

type Props = {
  artisan: Artisan | null | undefined
  canWriteArtisans: boolean
  isReadOnly: boolean
  isSaving: boolean
  isLoading: boolean
  shortcutHint: string
  isArchived: boolean
  onArchive: () => void
  onCancel: () => void
}

export function ArtisanModalFooter({
  artisan,
  canWriteArtisans,
  isReadOnly,
  isSaving,
  isLoading,
  shortcutHint,
  isArchived,
  onArchive,
  onCancel,
}: Props) {
  return (
    <footer className="modal-config-columns-footer flex items-center justify-between gap-2 px-4 py-3 md:px-6 bg-[#8DA5CE] dark:bg-transparent">
      <div>
        {artisan && canWriteArtisans && !isReadOnly &&
          (isArchived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
              disabled
            >
              Archivé
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800"
              onClick={onArchive}
              disabled={isSaving || isLoading}
            >
              Archiver
            </Button>
          ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {isReadOnly ? "Fermer" : "Annuler"}
        </Button>
        {!isReadOnly && (
          <Button type="submit" size="sm" disabled={isSaving || isLoading || !canWriteArtisans}>
            {isSaving ? (
              "Enregistrement..."
            ) : (
              <>
                Enregistrer
                <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
                  {shortcutHint}
                </kbd>
              </>
            )}
          </Button>
        )}
      </div>
    </footer>
  )
}
