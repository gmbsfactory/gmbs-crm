"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Z_CLASS } from "@/lib/ui/z-index"

/** Photo affichable par la visionneuse (sous-ensemble de `PortalReportPhoto`). */
export interface LightboxPhoto {
  id: string
  url: string
  filename?: string | null
  metadata?: {
    phase?: string | null
    comment?: string | null
  } | null
}

export interface PhotoLightboxProps {
  /** Photos navigables (l'ordre est celui de la grille appelante). */
  photos: LightboxPhoto[]
  /** Index affiché à l'ouverture ; `null` = visionneuse fermée. */
  index: number | null
  onClose: () => void
  onIndexChange?: (index: number) => void
  /** Bandeau de contexte, ex. « v3 · Karim B. » */
  caption?: string | null
}

/** Distance minimale d'un balayage tactile pour changer de photo. */
const SWIPE_THRESHOLD_PX = 40

function phaseLabel(phase: string | null | undefined): string | null {
  if (phase === "avant") return "avant"
  if (phase === "apres") return "après"
  return null
}

/**
 * Visionneuse de photos plein écran.
 *
 * `z-index` : étage `visionneuse` de l'échelle unique (src/lib/ui/z-index.ts).
 * Au-dessus des dialogues et des confirmations, car la visionneuse peut être
 * ouverte depuis n'importe lequel de ces étages.
 *
 * La visionneuse est RENDUE DANS LE `body` via un portail, et c'est ce qui rend
 * l'étage effectif : elle est appelée depuis le rapport d'une intervention,
 * donc depuis l'intérieur d'un `GenericModal` dont le conteneur est
 * `fixed z-[70]` et crée un contexte d'empilement. Rendue en ligne, son 1600
 * serait borné à 70 vis-à-vis du reste de la page et tout dialogue (1300) ou
 * toute confirmation (1500), eux portalisés par Radix, passeraient devant.
 *
 * Fermeture par Échap ou clic sur le fond ; navigation ← / → au clavier et par
 * balayage tactile ; compteur « 3 / 8 », légende et bandeau de contexte.
 */
export function PhotoLightbox({ photos, index, onClose, onIndexChange, caption }: PhotoLightboxProps) {
  const [internalIndex, setInternalIndex] = useState(index ?? 0)
  const touchStartX = useRef<number | null>(null)

  const current = index === null ? null : photos[internalIndex] ?? null
  const total = photos.length
  // Cible du portail : `document.body` n'existe pas au rendu serveur.
  const [conteneurPortail, setConteneurPortail] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setConteneurPortail(document.body)
  }, [])

  useEffect(() => {
    if (index !== null) setInternalIndex(index)
  }, [index])

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      setInternalIndex((previous) => {
        const next = (previous + delta + total) % total
        onIndexChange?.(next)
        return next
      })
    },
    [total, onIndexChange],
  )

  useEffect(() => {
    if (index === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      else if (event.key === "ArrowLeft") go(-1)
      else if (event.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, onClose, go])

  if (index === null || !current || !conteneurPortail) return null

  const alt = current.metadata?.comment || current.filename || "Photo de l'artisan"
  const phase = phaseLabel(current.metadata?.phase)
  const banner = [caption, phase].filter(Boolean).join(" · ")

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_CLASS.visionneuse} flex items-center justify-center bg-black/90 p-4`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo agrandie"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null) return
        const delta = (event.changedTouches[0]?.clientX ?? start) - start
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
        go(delta < 0 ? 1 : -1)
      }}
    >
      {banner && (
        <p className="absolute left-4 top-5 max-w-[60%] truncate text-xs text-white/80">{banner}</p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 text-white hover:bg-white/10"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </Button>

      {total > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation()
              go(-1)
            }}
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation()
              go(1)
            }}
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />

      <div className={cn("absolute inset-x-0 bottom-4 px-4 text-center text-white/90")}>
        {current.metadata?.comment && <p className="text-sm">{current.metadata.comment}</p>}
        {total > 1 && (
          <p className="mt-1 text-xs text-white/70" aria-label="Position dans la série">
            {internalIndex + 1} / {total}
          </p>
        )}
      </div>
    </div>,
    conteneurPortail,
  )
}
