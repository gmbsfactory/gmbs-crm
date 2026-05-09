"use client"

import { useEffect, useRef, useState } from "react"
import type { UseFormReset } from "react-hook-form"
import {
  type ArtisanFormValues,
  type ArtisanWithRelations,
  mapArtisanToForm,
} from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type Args = {
  artisanId: string
  artisan: ArtisanWithRelations | undefined
  reset: UseFormReset<ArtisanFormValues>
}

/**
 * Resets the form when the loaded artisan changes, and exposes
 * `isFormInitialized` so the caller knows when `isDirty` is meaningful.
 *
 * Why: react-hook-form's `isDirty` flips true during the initial reset,
 * which previously caused the unsaved-changes dialog to fire on first paint.
 * The 150ms gate lets `reset()` finish before we trust dirty state.
 */
export function useArtisanFormInitialization({ artisanId, artisan, reset }: Args) {
  const [isFormInitialized, setIsFormInitialized] = useState(false)
  const initializedArtisanIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (artisan) {
      if (initializedArtisanIdRef.current === artisan.id) {
        return
      }

      const formValues = mapArtisanToForm(artisan)
      initializedArtisanIdRef.current = artisan.id

      reset(formValues, { keepDefaultValues: false, keepDirtyValues: false })

      const timer = setTimeout(() => {
        setIsFormInitialized(true)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setIsFormInitialized(false)
      initializedArtisanIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan])

  useEffect(() => {
    if (artisanId !== initializedArtisanIdRef.current) {
      setIsFormInitialized(false)
      initializedArtisanIdRef.current = null
    }
  }, [artisanId])

  return { isFormInitialized }
}
