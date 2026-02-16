import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useInterventionFormState } from "@/hooks/useInterventionFormState"
import { createNewFormData } from "@/lib/interventions/form-types"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import type { ArtisanSearchResult } from "@/components/artisans/ArtisanSearchModal"
import { toast } from "sonner"

// ---- Mocks ----

const mockRefData = {
  interventionStatuses: [
    { id: "status-demande", code: "DEMANDE", label: "Demandé", color: "#3B82F6" },
    { id: "status-devis", code: "DEVIS_ENVOYE", label: "Devis envoyé", color: "#F59E0B" },
    { id: "status-vt", code: "VISITE_TECHNIQUE", label: "Visite technique", color: "#8B5CF6" },
    { id: "status-encours", code: "INTER_EN_COURS", label: "Inter en cours", color: "#10B981" },
    { id: "status-terminee", code: "INTER_TERMINEE", label: "Terminée", color: "#6B7280" },
    { id: "status-acompte", code: "ATT_ACOMPTE", label: "Att. acompte", color: "#EC4899" },
  ],
  agencies: [
    { id: "agency-1", label: "Agence Paris", requires_reference: false },
  ],
  artisanStatuses: [
    { id: "as-1", code: "ACTIF", label: "Actif" },
    { id: "as-2", code: "ARCHIVE", label: "Archivé" },
  ],
  metiers: [],
}

vi.mock("@/hooks/useReferenceDataQuery", () => ({
  useReferenceDataQuery: () => ({ data: mockRefData, loading: false, error: null, refresh: vi.fn(), getInterventionStatusLabel: (id: string) => id, getAgencyLabel: (id: string) => id, getUserCode: (id: string) => id }),
}))

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    data: {
      id: "user-1",
      firstname: "Jean",
      lastname: "Dupont",
      username: "jdupont",
      email: "jean@example.com",
      code_gestionnaire: "JD",
      color: "#ff0000",
      avatar_url: null,
      roles: [{ name: "admin" }],
    },
  }),
}))

vi.mock("@/hooks/useGeocodeSearch", () => ({
  useGeocodeSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    suggestions: [],
    isSuggesting: false,
    clearSuggestions: vi.fn(),
    geocode: vi.fn(),
  }),
}))

vi.mock("@/hooks/useNearbyArtisans", () => ({
  useNearbyArtisans: () => ({
    artisans: [],
    loading: false,
    error: null,
  }),
}))

vi.mock("@/hooks/useFormDataChanges", () => ({
  useFormDataChanges: () => false,
}))

vi.mock("@/hooks/useArtisanModal", () => ({
  useArtisanModal: () => ({
    open: vi.fn(),
  }),
}))

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          lte: () => ({
            gte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// ---- Tests ----

describe("useInterventionFormState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultOptions = {
    mode: "create" as const,
    initialFormData: createNewFormData(),
  }

  describe("Initialization", () => {
    it("should return initial form data", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      expect(result.current.formData.statut_id).toBe("")
      expect(result.current.formData.latitude).toBe(48.8566)
      expect(result.current.formData.longitude).toBe(2.3522)
    })

    it("should have default state values", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.isGeocoding).toBe(false)
      expect(result.current.geocodeError).toBeNull()
      expect(result.current.selectedArtisanId).toBeNull()
      expect(result.current.selectedSecondArtisanId).toBeNull()
    })

    it("should initialize with provided artisan IDs", () => {
      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialSelectedArtisanId: "artisan-1",
          initialSelectedSecondArtisanId: "artisan-2",
        })
      )

      expect(result.current.selectedArtisanId).toBe("artisan-1")
      expect(result.current.selectedSecondArtisanId).toBe("artisan-2")
    })

    it("should compute currentUser from hook data", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      expect(result.current.currentUser).not.toBeNull()
      expect(result.current.currentUser?.displayName).toBe("Jean Dupont")
      expect(result.current.currentUser?.code).toBe("JD")
    })

    it("should default perimeter to 50 km", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      expect(result.current.perimeterKmInput).toBe("50")
      expect(result.current.perimeterKmValue).toBe(50)
    })
  })

  describe("handleInputChange", () => {
    it("should update formData field", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.handleInputChange("nomPrenomClient", "Martin Pierre")
      })

      expect(result.current.formData.nomPrenomClient).toBe("Martin Pierre")
    })

    it("should update boolean fields", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.handleInputChange("is_vacant", true)
      })

      expect(result.current.formData.is_vacant).toBe(true)
    })
  })

  describe("handleLocationChange", () => {
    it("should update latitude and longitude", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.handleLocationChange(43.2965, 5.3698)
      })

      expect(result.current.formData.latitude).toBe(43.2965)
      expect(result.current.formData.longitude).toBe(5.3698)
    })
  })

  describe("applyArtisanSelection", () => {
    it("should set artisan fields when artisan provided", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      const artisan: NearbyArtisan = {
        id: "artisan-1",
        displayName: "Paul Lefevre",
        distanceKm: 5,
        telephone: "0601020304",
        telephone2: null,
        email: "paul@artisan.fr",
        adresse: "10 Rue Test",
        ville: "Paris",
        codePostal: "75001",
        lat: 48.86,
        lng: 2.34,
        prenom: "Paul",
        nom: "Lefevre",
        raison_sociale: null,
        statut_id: null,
        photoProfilMetadata: null,
      }

      act(() => {
        result.current.applyArtisanSelection(artisan)
      })

      expect(result.current.selectedArtisanId).toBe("artisan-1")
      expect(result.current.formData.artisan).toBe("Paul Lefevre")
      expect(result.current.formData.artisanTelephone).toBe("0601020304")
      expect(result.current.formData.artisanEmail).toBe("paul@artisan.fr")
    })

    it("should clear artisan fields when null", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.applyArtisanSelection(null)
      })

      expect(result.current.selectedArtisanId).toBeNull()
      expect(result.current.formData.artisan).toBe("")
    })
  })

  describe("handleRemoveSelectedArtisan", () => {
    it("should clear selected artisan ID and search artisan", () => {
      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialSelectedArtisanId: "artisan-1",
        })
      )

      act(() => {
        result.current.handleRemoveSelectedArtisan()
      })

      expect(result.current.selectedArtisanId).toBeNull()
      expect(result.current.searchSelectedArtisan).toBeNull()
    })
  })

  describe("handleRemoveSecondArtisan", () => {
    it("should clear second artisan ID and form fields", () => {
      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialSelectedSecondArtisanId: "artisan-2",
        })
      )

      // First set some second artisan data
      act(() => {
        result.current.handleInputChange("secondArtisan", "Marie Duval")
        result.current.handleInputChange("secondArtisanTelephone", "0620212223")
        result.current.handleInputChange("secondArtisanEmail", "marie@artisan.fr")
      })

      act(() => {
        result.current.handleRemoveSecondArtisan()
      })

      expect(result.current.selectedSecondArtisanId).toBeNull()
      expect(result.current.formData.secondArtisan).toBe("")
      expect(result.current.formData.secondArtisanTelephone).toBe("")
      expect(result.current.formData.secondArtisanEmail).toBe("")
    })
  })

  describe("handleArtisanSearchSelect", () => {
    it("should set artisan from search result", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      const artisan: ArtisanSearchResult = {
        id: "artisan-search-1",
        raison_sociale: "Plomberie Express",
        prenom: "Jean",
        nom: "Dupont",
        telephone: "0601020304",
        email: "jean@plomberie.fr",
      }

      act(() => {
        result.current.handleArtisanSearchSelect(artisan)
      })

      expect(result.current.selectedArtisanId).toBe("artisan-search-1")
      expect(result.current.formData.artisan).toBe("Plomberie Express")
      expect(result.current.formData.artisanTelephone).toBe("0601020304")
      expect(result.current.formData.artisanEmail).toBe("jean@plomberie.fr")
      // Should store in searchSelectedArtisan since not in proximity
      expect(result.current.searchSelectedArtisan).not.toBeNull()
      expect(result.current.searchSelectedArtisan?.id).toBe("artisan-search-1")
    })
  })

  describe("handleSecondArtisanSearchSelect", () => {
    it("should set second artisan from search result", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      const artisan: ArtisanSearchResult = {
        id: "artisan-search-2",
        raison_sociale: null,
        plain_nom: "Marie Duval",
        prenom: "Marie",
        nom: "Duval",
        telephone: "0620212223",
        email: "marie@artisan.fr",
      }

      act(() => {
        result.current.handleSecondArtisanSearchSelect(artisan)
      })

      expect(result.current.selectedSecondArtisanId).toBe("artisan-search-2")
      expect(result.current.formData.secondArtisan).toBe("Marie Duval")
      expect(result.current.searchSelectedSecondArtisan).not.toBeNull()
    })
  })

  describe("Validation memos", () => {
    it("requiresDefinitiveId should be false for DEMANDE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-demande"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresDefinitiveId).toBe(false)
    })

    it("requiresDefinitiveId should be true for DEVIS_ENVOYE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-devis"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresDefinitiveId).toBe(true)
    })

    it("requiresDatePrevue should be true for VISITE_TECHNIQUE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-vt"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresDatePrevue).toBe(true)
    })

    it("requiresDatePrevue should be false for DEMANDE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-demande"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresDatePrevue).toBe(false)
    })

    it("requiresArtisan should be true for INTER_EN_COURS", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-encours"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresArtisan).toBe(true)
    })

    it("requiresArtisan should be false for DEMANDE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-demande"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresArtisan).toBe(false)
    })

    it("requiresFacture should be true for INTER_TERMINEE", () => {
      const formData = createNewFormData()
      formData.statut_id = "status-terminee"

      const { result } = renderHook(() =>
        useInterventionFormState({
          ...defaultOptions,
          initialFormData: formData,
        })
      )

      expect(result.current.requiresFacture).toBe(true)
    })
  })

  describe("handleOpenDevisEmailModal", () => {
    it("should show error when no artisan selected", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.handleOpenDevisEmailModal()
      })

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Veuillez sélectionner un artisan')
      expect(result.current.isDevisEmailModalOpen).toBe(false)
    })
  })

  describe("Collapsible state", () => {
    it("should have default collapsible state", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      expect(result.current.collapsibleState.isCommentsOpen).toBe(true)
      expect(result.current.collapsibleState.isProprietaireOpen).toBe(false)
      expect(result.current.collapsibleState.isClientOpen).toBe(false)
    })

    it("should allow updating collapsible state", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.setCollapsibleState(prev => ({ ...prev, isProprietaireOpen: true }))
      })

      expect(result.current.collapsibleState.isProprietaireOpen).toBe(true)
    })
  })

  describe("Perimeter", () => {
    it("should parse perimeter input correctly", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.setPerimeterKmInput("100")
      })

      expect(result.current.perimeterKmValue).toBe(100)
    })

    it("should clamp perimeter to MAX_RADIUS_KM", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.setPerimeterKmInput("99999")
      })

      expect(result.current.perimeterKmValue).toBe(10000)
    })

    it("should default to 50 for invalid input", () => {
      const { result } = renderHook(() => useInterventionFormState(defaultOptions))

      act(() => {
        result.current.setPerimeterKmInput("abc")
      })

      expect(result.current.perimeterKmValue).toBe(50)
    })
  })
})
