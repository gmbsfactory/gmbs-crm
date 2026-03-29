import { create } from "zustand"
import type { InterventionFormData, CollapsibleSectionsState } from "@/lib/interventions/form-types"

// ===== STORE DE DRAFT DES FORMULAIRES D'INTERVENTION =====
// Persiste l'état du formulaire en mémoire (pas de localStorage — données sensibles)
// pour survivre aux cycles fermeture/réouverture du modal (navigation artisan, transitions Realtime)

const DRAFT_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

export interface InterventionDraft {
  formData: InterventionFormData
  locationQuery: string
  selectedArtisanId: string | null
  selectedSecondArtisanId: string | null
  collapsibleState: CollapsibleSectionsState
  savedAt: number
}

interface InterventionDraftState {
  drafts: Record<string, InterventionDraft>
  saveDraft: (id: string, draft: Omit<InterventionDraft, "savedAt">) => void
  clearDraft: (id: string) => void
  getDraft: (id: string) => InterventionDraft | null
}

export const useInterventionDraftStore = create<InterventionDraftState>((set, get) => ({
  drafts: {},

  saveDraft: (id, draft) =>
    set((state) => ({
      drafts: { ...state.drafts, [id]: { ...draft, savedAt: Date.now() } },
    })),

  clearDraft: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.drafts
      return { drafts: rest }
    }),

  getDraft: (id) => {
    const draft = get().drafts[id]
    if (!draft) return null

    // Auto-expiration silencieuse des drafts trop anciens
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      set((state) => {
        const { [id]: _, ...rest } = state.drafts
        return { drafts: rest }
      })
      return null
    }

    return draft
  },
}))
