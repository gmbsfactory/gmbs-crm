import { create } from "zustand"
import type { InterventionFormData, CollapsibleSectionsState } from "@/lib/interventions/form-types"

// ===== STORE DE DRAFT DES FORMULAIRES D'INTERVENTION =====
// Persiste l'état du formulaire en mémoire (pas de localStorage — données sensibles)
// pour survivre aux cycles fermeture/réouverture du modal (navigation artisan, transitions Realtime)

const DRAFT_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

/** Clé spéciale pour sauvegarder le draft d'une nouvelle intervention (mode create) */
export const NEW_INTERVENTION_DRAFT_KEY = "__new__"

export interface InterventionDraft {
  formData: InterventionFormData
  locationQuery: string
  selectedArtisanId: string | null
  selectedSecondArtisanId: string | null
  collapsibleState: CollapsibleSectionsState
  hasPendingChanges: boolean
  savedAt: number
}

interface InterventionDraftState {
  drafts: Record<string, InterventionDraft>
  saveDraft: (id: string, draft: Omit<InterventionDraft, "savedAt">) => void
  clearDraft: (id: string) => void
  getDraft: (id: string) => InterventionDraft | null
  purgeExpiredDrafts: () => void
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
    // Retourne null si expiré, sans mutation — la purge est faite par purgeExpiredDrafts
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) return null
    return draft
  },

  purgeExpiredDrafts: () =>
    set((state) => {
      const now = Date.now()
      const remaining: Record<string, InterventionDraft> = {}
      for (const [id, draft] of Object.entries(state.drafts)) {
        if (now - draft.savedAt <= DRAFT_MAX_AGE_MS) {
          remaining[id] = draft
        }
      }
      return { drafts: remaining }
    }),
}))
