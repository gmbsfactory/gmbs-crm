// ===== UI CHROME D'UN FORMULAIRE D'INTERVENTION =====
// État purement présentation : sections collapsibles, dropdowns de recherche
// artisan, modale email, visibilité des suggestions d'adresse. Aucun lien direct
// avec formData — les écritures formData restent dans useInterventionFormState.

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { CollapsibleSectionsState } from "@/lib/interventions/form-types"
import { getDefaultCollapsibleState } from "@/lib/interventions/form-types"

export interface UseInterventionFormUIOptions {
  /** État collapsible initial — typiquement issu d'un draft restauré. */
  initialCollapsibleState?: CollapsibleSectionsState
  /** Si vrai, la section "second artisan" s'ouvre par défaut (edit avec second artisan). */
  initialOpenSecondArtisan?: boolean
  /** Pour validation: le selectedArtisanId courant lorsqu'on ouvre la modale email sans artisanId. */
  getFallbackEmailArtisanId?: () => string | null
}

export interface ArtisanSearchPosition {
  x: number
  y: number
  width?: number
  height?: number
}

export interface EmailModalState {
  type: "devis" | "intervention"
  artisanId: string
}

export function useInterventionFormUI(options: UseInterventionFormUIOptions = {}) {
  const { initialCollapsibleState, initialOpenSecondArtisan = false, getFallbackEmailArtisanId } = options

  // ---- Sections collapsibles ----
  const [collapsibleState, setCollapsibleState] = useState<CollapsibleSectionsState>(() => {
    if (initialCollapsibleState) return initialCollapsibleState
    return {
      ...getDefaultCollapsibleState(),
      isSecondArtisanOpen: initialOpenSecondArtisan,
    }
  })

  // ---- Recherche artisan UI state ----
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [showSecondArtisanSearch, setShowSecondArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<ArtisanSearchPosition | null>(null)
  const [secondArtisanSearchPosition, setSecondArtisanSearchPosition] = useState<ArtisanSearchPosition | null>(null)
  const [artisanDisplayMode, setArtisanDisplayMode] = useState<"nom" | "rs" | "tel">("nom")

  // ---- Modale email ----
  const [emailModalState, setEmailModalState] = useState<EmailModalState | null>(null)

  const openEmailModal = useCallback(
    (type: "devis" | "intervention", artisanId?: string) => {
      const targetArtisanId = artisanId || getFallbackEmailArtisanId?.() || null
      if (!targetArtisanId) {
        toast.error("Veuillez sélectionner un artisan")
        return
      }
      setEmailModalState({ type, artisanId: targetArtisanId })
    },
    [getFallbackEmailArtisanId],
  )

  const closeEmailModal = useCallback(() => setEmailModalState(null), [])

  // ---- Suggestions d'adresse ----
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const suggestionBlurTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const timeoutRef = suggestionBlurTimeoutRef
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    // Collapsibles
    collapsibleState,
    setCollapsibleState,

    // Recherche artisan UI
    showArtisanSearch,
    setShowArtisanSearch,
    showSecondArtisanSearch,
    setShowSecondArtisanSearch,
    artisanSearchPosition,
    setArtisanSearchPosition,
    secondArtisanSearchPosition,
    setSecondArtisanSearchPosition,
    artisanDisplayMode,
    setArtisanDisplayMode,

    // Modale email
    emailModalState,
    openEmailModal,
    closeEmailModal,

    // Suggestions d'adresse
    showLocationSuggestions,
    setShowLocationSuggestions,
    suggestionBlurTimeoutRef,
  }
}
