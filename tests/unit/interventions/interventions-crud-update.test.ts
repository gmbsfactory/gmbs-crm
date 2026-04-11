import { beforeEach, describe, expect, it, vi } from "vitest";

import { interventionsApi, invalidateReferenceCache } from "@/lib/api/v2";
import { supabase } from "@/lib/supabase-client";
import { referenceApi } from "@/lib/reference-api";
import { automaticTransitionService } from "@/lib/interventions/automatic-transition-service";

// ===== MOCKS =====

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock("@/lib/reference-api", () => ({
  referenceApi: {
    getAll: vi.fn(),
  },
}));

vi.mock("@/lib/interventions/automatic-transition-service", () => ({
  automaticTransitionService: {
    executeTransition: vi.fn().mockResolvedValue(undefined),
  },
}));

// ===== FIXTURES =====

const mockReferenceData = {
  interventionStatuses: [
    { id: "status-demande", code: "DEMANDE", label: "Demandé", color: "#3B82F6", sort_order: 1 },
    { id: "status-accepte", code: "ACCEPTE", label: "Accepté", color: "#10B981", sort_order: 2 },
    { id: "status-terminee", code: "INTER_TERMINEE", label: "Inter terminée", color: "#10B981", sort_order: 8 },
  ],
  artisanStatuses: [],
  agencies: [],
  metiers: [],
  users: [{ id: "user-1", username: "test", firstname: "Test", lastname: "User", code_gestionnaire: "TU", color: null, avatar_url: null }],
  allUsers: [{ id: "user-1", username: "test", firstname: "Test", lastname: "User", code_gestionnaire: "TU", color: null, avatar_url: null }],
};

const mockUpdatedRow = {
  id: "interv-1",
  statut_id: "status-accepte",
  status: { id: "status-accepte", code: "ACCEPTE", label: "Accepté", color: "#10B981", sort_order: 2 },
  intervention_artisans: [{ artisan_id: "artisan-1" }],
  updated_at: "2026-04-11T10:00:00.000Z",
};

/** Helper to build fluent Supabase mock chain */
function buildSupabaseMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.update = vi.fn().mockReturnValue(chain);
  return chain;
}

// ===== TESTS =====

describe("interventionsApi.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateReferenceCache();
    vi.mocked(referenceApi.getAll).mockResolvedValue(mockReferenceData as any);
  });

  describe("stripAdminOnlyFields", () => {
    it("should keep contexte_intervention when user is admin", async () => {
      // Mock /api/auth/me returns admin role
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { roles: ["admin"] } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      // No status change — simple field update
      const updateChain = buildSupabaseMock({ data: { ...mockUpdatedRow, contexte_intervention: "admin context" }, error: null });
      const selectChain = buildSupabaseMock({ data: { statut_id: null }, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        return updateChain as any;
      });

      const result = await interventionsApi.update("interv-1", {
        contexte_intervention: "admin context",
      });

      // The update call should include contexte_intervention
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ contexte_intervention: "admin context" }),
      );
    });

    it("should strip contexte_intervention when user is NOT admin", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { roles: ["gestionnaire"] } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(updateChain as any);

      await interventionsApi.update("interv-1", {
        contexte_intervention: "sneaky context",
        adresse: "123 rue Test",
      });

      // contexte_intervention should be stripped, adresse should remain
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ contexte_intervention: "sneaky context" }),
      );
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ adresse: "123 rue Test" }),
      );
    });

    it("should strip contexte_intervention when auth check fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
      vi.stubGlobal("fetch", fetchMock);

      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(updateChain as any);

      await interventionsApi.update("interv-1", {
        contexte_intervention: "some context",
      });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ contexte_intervention: expect.anything() }),
      );
    });
  });

  describe("status transition handling", () => {
    it("should NOT trigger transition when statut_id is unchanged", async () => {
      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      // fetchCurrentStatus returns same statut_id
      const selectChain = buildSupabaseMock({
        data: { statut_id: "status-accepte", status: { code: "ACCEPTE" } },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        // First call: fetchCurrentStatus, second call: the update
        return callCount === 1 ? (selectChain as any) : (updateChain as any);
      });

      await interventionsApi.update("interv-1", { statut_id: "status-accepte" });

      expect(automaticTransitionService.executeTransition).not.toHaveBeenCalled();
    });

    it("should trigger transition when statut_id changes", async () => {
      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      const selectChain = buildSupabaseMock({
        data: { statut_id: "status-demande", status: { code: "DEMANDE" } },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (selectChain as any) : (updateChain as any);
      });

      await interventionsApi.update("interv-1", { statut_id: "status-accepte" });

      expect(automaticTransitionService.executeTransition).toHaveBeenCalledWith(
        "interv-1",
        "DEMANDE",
        "ACCEPTE",
        "user-1",
        expect.objectContaining({ updated_via: "api_v2" }),
      );
    });

    it("should use RPC fallback when status codes cannot be resolved", async () => {
      const updateChain = buildSupabaseMock({ data: { ...mockUpdatedRow, statut_id: "status-unknown" }, error: null });
      const selectChain = buildSupabaseMock({
        data: { statut_id: "status-old-unknown", status: null },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (selectChain as any) : (updateChain as any);
      });

      await interventionsApi.update("interv-1", { statut_id: "status-unknown" });

      // Should NOT call executeTransition (codes unresolvable)
      expect(automaticTransitionService.executeTransition).not.toHaveBeenCalled();
      // Should call RPC fallback
      expect(supabase.rpc).toHaveBeenCalledWith(
        "log_status_transition_from_api",
        expect.objectContaining({
          p_intervention_id: "interv-1",
          p_from_status_id: "status-old-unknown",
          p_to_status_id: "status-unknown",
        }),
      );
    });
  });

  describe("artisan status recalculation", () => {
    it("should recalculate artisan status when transitioning TO terminal status", async () => {
      const updatedWithTerminal = {
        ...mockUpdatedRow,
        statut_id: "status-terminee",
        status: { id: "status-terminee", code: "INTER_TERMINEE", label: "Inter terminée", color: "#10B981", sort_order: 8 },
        intervention_artisans: [{ artisan_id: "artisan-1" }, { artisan_id: "artisan-2" }],
      };

      const updateChain = buildSupabaseMock({ data: updatedWithTerminal, error: null });
      const selectChain = buildSupabaseMock({
        data: { statut_id: "status-accepte", status: { code: "ACCEPTE" } },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (selectChain as any) : (updateChain as any);
      });

      await interventionsApi.update("interv-1", { statut_id: "status-terminee" });

      expect(supabase.rpc).toHaveBeenCalledWith("recalculate_artisan_status", { artisan_uuid: "artisan-1" });
      expect(supabase.rpc).toHaveBeenCalledWith("recalculate_artisan_status", { artisan_uuid: "artisan-2" });
    });

    it("should NOT recalculate artisan status for non-terminal transitions", async () => {
      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      const selectChain = buildSupabaseMock({
        data: { statut_id: "status-demande", status: { code: "DEMANDE" } },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (selectChain as any) : (updateChain as any);
      });

      // Clear rpc mock from transition handling
      vi.mocked(supabase.rpc).mockClear();

      await interventionsApi.update("interv-1", { statut_id: "status-accepte" });

      // rpc was called for the transition logging, but NOT for recalculate_artisan_status
      const rpcCalls = vi.mocked(supabase.rpc).mock.calls;
      const recalcCalls = rpcCalls.filter(([name]) => name === "recalculate_artisan_status");
      expect(recalcCalls).toHaveLength(0);
    });
  });

  describe("basic update flow", () => {
    it("should update and return mapped intervention", async () => {
      const updateChain = buildSupabaseMock({ data: mockUpdatedRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(updateChain as any);

      const result = await interventionsApi.update("interv-1", { adresse: "456 avenue Test" });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ adresse: "456 avenue Test", updated_at: expect.any(String) }),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("interv-1");
    });

    it("should throw when update returns error", async () => {
      const updateChain = buildSupabaseMock({ data: null, error: { message: "DB error", code: "42000" } });
      vi.mocked(supabase.from).mockReturnValue(updateChain as any);

      await expect(
        interventionsApi.update("interv-1", { adresse: "fail" }),
      ).rejects.toThrow();
    });
  });
});
