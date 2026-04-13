import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { runPostMutationTasks, type PostMutationConfig } from "@/lib/interventions/post-mutation-tasks"

// Mock API modules
vi.mock("@/lib/api", () => ({
  interventionsApi: {
    setPrimaryArtisan: vi.fn().mockResolvedValue(undefined),
    setSecondaryArtisan: vi.fn().mockResolvedValue(undefined),
    upsertCostsBatch: vi.fn().mockResolvedValue(undefined),
    deleteCost: vi.fn().mockResolvedValue(undefined),
    upsertPayment: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("@/lib/api/commentsApi", () => ({
  commentsApi: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { interventionsApi } from "@/lib/api"
import { commentsApi } from "@/lib/api/commentsApi"
import { toast } from "sonner"

// Helper to flush all pending promises
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("runPostMutationTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return void immediately (fire-and-forget)", () => {
    const result = runPostMutationTasks({ interventionId: "int-1" })
    expect(result).toBeUndefined()
  })

  describe("artisan assignments", () => {
    it("should call setPrimaryArtisan when primary artisan changes", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: "art-old", next: "art-new" },
        },
      })

      await flushPromises()
      expect(interventionsApi.setPrimaryArtisan).toHaveBeenCalledWith("int-1", "art-new")
    })

    it("should NOT call setPrimaryArtisan when primary artisan is unchanged", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: "art-same", next: "art-same" },
        },
      })

      await flushPromises()
      expect(interventionsApi.setPrimaryArtisan).not.toHaveBeenCalled()
    })

    it("should call setSecondaryArtisan when secondary artisan changes", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          secondary: { current: null, next: "art-2" },
        },
      })

      await flushPromises()
      expect(interventionsApi.setSecondaryArtisan).toHaveBeenCalledWith("int-1", "art-2")
    })

    it("should handle removing artisans (next = null)", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: "art-1", next: null },
        },
      })

      await flushPromises()
      expect(interventionsApi.setPrimaryArtisan).toHaveBeenCalledWith("int-1", null)
    })
  })

  describe("costs", () => {
    it("should call upsertCostsBatch with all costs", async () => {
      const costs = [
        { cost_type: "sst" as const, amount: 100, artisan_order: 1 as const, label: "Coût SST" },
        { cost_type: "materiel" as const, amount: 50, artisan_order: 1 as const, label: "Coût Matériel" },
      ]

      runPostMutationTasks({
        interventionId: "int-1",
        costs,
      })

      await flushPromises()
      expect(interventionsApi.upsertCostsBatch).toHaveBeenCalledWith("int-1", costs)
    })

    it("should NOT call upsertCostsBatch when costs array is empty", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        costs: [],
      })

      await flushPromises()
      expect(interventionsApi.upsertCostsBatch).not.toHaveBeenCalled()
    })

    it("should NOT call upsertCostsBatch when costs is undefined", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
      })

      await flushPromises()
      expect(interventionsApi.upsertCostsBatch).not.toHaveBeenCalled()
    })
  })

  describe("delete secondary costs", () => {
    it("should delete secondary artisan costs when deleteSecondaryCosts is true", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        deleteSecondaryCosts: true,
      })

      await flushPromises()
      expect(interventionsApi.deleteCost).toHaveBeenCalledWith("int-1", "sst", 2)
      expect(interventionsApi.deleteCost).toHaveBeenCalledWith("int-1", "materiel", 2)
    })

    it("should NOT delete secondary costs when deleteSecondaryCosts is false", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        deleteSecondaryCosts: false,
      })

      await flushPromises()
      expect(interventionsApi.deleteCost).not.toHaveBeenCalled()
    })
  })

  describe("payments", () => {
    it("should call upsertPayment for each payment", async () => {
      const payments = [
        { payment_type: "acompte_sst", amount: 200, currency: "EUR", is_received: true, payment_date: "2024-01-15" },
        { payment_type: "acompte_client", amount: 300, currency: "EUR", is_received: false, payment_date: null },
      ]

      runPostMutationTasks({
        interventionId: "int-1",
        payments,
      })

      await flushPromises()
      expect(interventionsApi.upsertPayment).toHaveBeenCalledTimes(2)
      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith("int-1", payments[0])
      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith("int-1", payments[1])
    })
  })

  describe("comments", () => {
    it("should create a comment when provided", async () => {
      runPostMutationTasks({
        interventionId: "int-1",
        comment: {
          entity_type: "intervention",
          content: "Test comment",
          comment_type: "internal",
          is_internal: true,
          author_id: "user-1",
        },
      })

      await flushPromises()
      expect(commentsApi.create).toHaveBeenCalledWith({
        entity_id: "int-1",
        entity_type: "intervention",
        content: "Test comment",
        comment_type: "internal",
        is_internal: true,
        author_id: "user-1",
      })
    })

    it("should show toast on comment creation failure", async () => {
      vi.mocked(commentsApi.create).mockRejectedValueOnce(new Error("Network error"))

      runPostMutationTasks({
        interventionId: "int-1",
        comment: {
          entity_type: "intervention",
          content: "Test",
          comment_type: "internal",
        },
      })

      await flushPromises()
      expect(toast.error).toHaveBeenCalledWith("Le commentaire n'a pas pu être enregistré.")
    })
  })

  describe("error isolation", () => {
    it("should not propagate errors from individual tasks", async () => {
      vi.mocked(interventionsApi.setPrimaryArtisan).mockRejectedValueOnce(new Error("API error"))
      vi.mocked(interventionsApi.upsertCostsBatch).mockRejectedValueOnce(new Error("Cost error"))

      // Should not throw
      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: null, next: "art-1" },
        },
        costs: [{ cost_type: "sst", amount: 100, artisan_order: 1 }],
      })

      await flushPromises()
      // Both were called even though they failed
      expect(interventionsApi.setPrimaryArtisan).toHaveBeenCalled()
      expect(interventionsApi.upsertCostsBatch).toHaveBeenCalled()
    })

    it("should continue other tasks when one fails", async () => {
      vi.mocked(interventionsApi.setPrimaryArtisan).mockRejectedValueOnce(new Error("API error"))

      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: null, next: "art-1" },
          secondary: { current: null, next: "art-2" },
        },
      })

      await flushPromises()
      // Secondary should still be called even if primary fails
      expect(interventionsApi.setSecondaryArtisan).toHaveBeenCalledWith("int-1", "art-2")
    })
  })

  describe("cache invalidations", () => {
    it("should invalidate dashboard cache after tasks complete", async () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      }

      runPostMutationTasks({
        interventionId: "int-1",
        costs: [{ cost_type: "sst", amount: 100, artisan_order: 1 }],
        queryClient: mockQueryClient as any,
        invalidateDashboard: true,
      })

      await flushPromises()
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["admin", "dashboard"] })
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["podium"] })
    })

    it("should invalidate comments cache when invalidateComments is true", async () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      }

      runPostMutationTasks({
        interventionId: "int-1",
        comment: {
          entity_type: "intervention",
          content: "Test",
          comment_type: "internal",
        },
        queryClient: mockQueryClient as any,
        invalidateComments: true,
      })

      await flushPromises()
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["comments", "intervention", "int-1"],
      })
    })

    it("should only invalidate intervention detail when dashboard/comments flags are false", async () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      }

      runPostMutationTasks({
        interventionId: "int-1",
        costs: [{ cost_type: "sst", amount: 100, artisan_order: 1 }],
        queryClient: mockQueryClient as any,
        invalidateDashboard: false,
        invalidateComments: false,
      })

      await flushPromises()

      // Should always invalidate intervention detail after tasks
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["interventions", "detail", "int-1"],
        refetchType: "all",
      })
      // But NOT dashboard or comments
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["admin", "dashboard"] })
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["podium"] })
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: ["comments", "intervention", "int-1"],
      })
    })

    it("should always invalidate intervention detail even when no tasks are present", async () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      }

      runPostMutationTasks({
        interventionId: "int-1",
        queryClient: mockQueryClient as any,
        invalidateDashboard: true,
      })

      await flushPromises()
      // Even without tasks, intervention detail must be invalidated
      // to replace optimistic data (owner_id UUID) with enriched data (owner name)
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["interventions", "detail", "int-1"],
        refetchType: "all",
      })
    })
  })

  describe("full integration", () => {
    it("should handle all task types simultaneously", async () => {
      const mockQueryClient = { invalidateQueries: vi.fn() }

      runPostMutationTasks({
        interventionId: "int-1",
        artisans: {
          primary: { current: "art-old", next: "art-new" },
          secondary: { current: null, next: "art-2" },
        },
        costs: [
          { cost_type: "sst", amount: 100, artisan_order: 1, label: "SST" },
          { cost_type: "materiel", amount: 50, artisan_order: 2, label: "Mat" },
        ],
        payments: [
          { payment_type: "acompte_sst", amount: 200 },
        ],
        comment: {
          entity_type: "intervention",
          content: "Initial comment",
          comment_type: "internal",
          is_internal: true,
        },
        queryClient: mockQueryClient as any,
        invalidateDashboard: true,
        invalidateComments: true,
      })

      await flushPromises()

      expect(interventionsApi.setPrimaryArtisan).toHaveBeenCalledWith("int-1", "art-new")
      expect(interventionsApi.setSecondaryArtisan).toHaveBeenCalledWith("int-1", "art-2")
      expect(interventionsApi.upsertCostsBatch).toHaveBeenCalledTimes(1)
      expect(interventionsApi.upsertPayment).toHaveBeenCalledTimes(1)
      expect(commentsApi.create).toHaveBeenCalledTimes(1)
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled()
    })
  })
})
