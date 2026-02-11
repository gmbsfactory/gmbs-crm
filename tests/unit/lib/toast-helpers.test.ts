import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id-123"),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from "sonner"
import { toastSaveOperation, extractErrorMessage } from "@/lib/toast-helpers"

const mockToast = toast as unknown as {
  loading: ReturnType<typeof vi.fn>
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

describe("extractErrorMessage", () => {
  it("should extract message from Error instance", () => {
    expect(extractErrorMessage(new Error("Network timeout"))).toBe("Network timeout")
  })

  it("should return string errors directly", () => {
    expect(extractErrorMessage("Quelque chose a échoué")).toBe("Quelque chose a échoué")
  })

  describe("traduction des erreurs PostgreSQL", () => {
    it("should translate unique constraint violation (23505) with field details", () => {
      const pgError = {
        message: "duplicate key value violates unique constraint",
        details: 'Key (id_inter)=(TEST-001) already exists.',
        code: "23505",
        hint: "",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "Le numéro d'intervention « TEST-001 » est déjà utilisé. Veuillez en choisir un autre."
      )
    })

    it("should translate unique constraint violation (23505) without parseable details", () => {
      const pgError = {
        message: "duplicate key",
        code: "23505",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "Cette valeur existe déjà. Veuillez en choisir une autre."
      )
    })

    it("should translate NOT NULL violation (23502) with column name", () => {
      const pgError = {
        message: "null value in column",
        details: 'Failing row contains null value in column "metier_id".',
        code: "23502",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "Le champ « métier » est obligatoire."
      )
    })

    it("should translate foreign key violation (23503)", () => {
      const pgError = {
        message: "insert or update on table violates foreign key constraint",
        code: "23503",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "La référence sélectionnée n'existe plus. Veuillez actualiser la page."
      )
    })

    it("should translate permission denied (42501)", () => {
      const pgError = {
        message: "permission denied",
        code: "42501",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "Vous n'avez pas les droits nécessaires pour cette action."
      )
    })

    it("should translate timeout (57014)", () => {
      const pgError = {
        message: "canceling statement due to statement timeout",
        code: "57014",
      }
      expect(extractErrorMessage(pgError)).toBe(
        "L'opération a pris trop de temps. Veuillez réessayer."
      )
    })
  })

  it("should fallback to .message for unknown error codes", () => {
    const pgError = {
      message: "some unknown error",
      code: "99999",
    }
    expect(extractErrorMessage(pgError)).toBe("some unknown error")
  })

  it("should extract .error property from objects", () => {
    expect(extractErrorMessage({ error: "Auth failed" })).toBe("Auth failed")
  })

  it("should return generic french message for empty objects", () => {
    expect(extractErrorMessage({})).toBe("Une erreur inattendue s'est produite. Veuillez réessayer.")
  })

  it("should return generic french message for null", () => {
    expect(extractErrorMessage(null)).toBe("Une erreur inattendue s'est produite. Veuillez réessayer.")
  })

  it("should return generic french message for undefined", () => {
    expect(extractErrorMessage(undefined)).toBe("Une erreur inattendue s'est produite. Veuillez réessayer.")
  })
})

describe("toastSaveOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToast.loading.mockReturnValue("toast-id-123")
  })

  describe("cas nominal (succès)", () => {
    it("should show loading toast then success toast", async () => {
      const mockData = { id: "123", name: "Test" }
      const operation = vi.fn().mockResolvedValue(mockData)

      const result = await toastSaveOperation({
        loadingMessage: "Enregistrement en cours...",
        successMessage: "Enregistré avec succès",
        errorMessage: "Erreur lors de l'enregistrement",
        operation,
      })

      expect(mockToast.loading).toHaveBeenCalledWith("Enregistrement en cours...")
      expect(mockToast.success).toHaveBeenCalledWith("Enregistré avec succès", {
        id: "toast-id-123",
        duration: 5000,
      })
      expect(mockToast.error).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true, data: mockData })
    })
  })

  describe("cas d'erreur", () => {
    it("should show translated PostgrestError in toast description", async () => {
      const pgError = {
        message: "duplicate key value violates unique constraint",
        details: 'Key (id_inter)=(TEST-001) already exists.',
        code: "23505",
        hint: "",
      }
      const operation = vi.fn().mockRejectedValue(pgError)

      await toastSaveOperation({
        loadingMessage: "Enregistrement...",
        successMessage: "Succès",
        errorMessage: "Erreur lors de la mise à jour",
        operation,
      })

      expect(mockToast.error).toHaveBeenCalledWith("Erreur lors de la mise à jour", {
        id: "toast-id-123",
        duration: Infinity,
        description: "Le numéro d'intervention « TEST-001 » est déjà utilisé. Veuillez en choisir un autre.",
      })
    })

    it("should use Error.message when no PG code", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Réseau indisponible"))

      await toastSaveOperation({
        loadingMessage: "Loading...",
        successMessage: "Done",
        errorMessage: "Échec",
        operation,
      })

      expect(mockToast.error).toHaveBeenCalledWith("Échec", {
        id: "toast-id-123",
        duration: Infinity,
        description: "Réseau indisponible",
      })
    })
  })

  describe("toast permanent vs éphémère", () => {
    it("should set duration to 5000 for success (éphémère)", async () => {
      const operation = vi.fn().mockResolvedValue("data")
      await toastSaveOperation({
        loadingMessage: "...", successMessage: "OK", errorMessage: "KO", operation,
      })
      expect(mockToast.success.mock.calls[0][1].duration).toBe(5000)
    })

    it("should set duration to Infinity for error (permanent)", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("fail"))
      await toastSaveOperation({
        loadingMessage: "...", successMessage: "OK", errorMessage: "KO", operation,
      })
      expect(mockToast.error.mock.calls[0][1].duration).toBe(Infinity)
    })
  })

  describe("toast ID cohérent", () => {
    it("should reuse same toast ID for success", async () => {
      const operation = vi.fn().mockResolvedValue("ok")
      await toastSaveOperation({
        loadingMessage: "...", successMessage: "OK", errorMessage: "KO", operation,
      })
      expect(mockToast.success.mock.calls[0][1].id).toBe("toast-id-123")
    })

    it("should reuse same toast ID for error", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("fail"))
      await toastSaveOperation({
        loadingMessage: "...", successMessage: "OK", errorMessage: "KO", operation,
      })
      expect(mockToast.error.mock.calls[0][1].id).toBe("toast-id-123")
    })
  })
})
