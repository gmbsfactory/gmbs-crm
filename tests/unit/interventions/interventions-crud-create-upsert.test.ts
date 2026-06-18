import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateReferenceCache } from "@/lib/api";
import { create, upsertDirect } from "@/lib/api/interventions/crud/mutations";
import { supabase } from "@/lib/supabase-client";
import { referenceApi } from "@/lib/reference-api";

// ===== MOCKS =====
// PR1a (fix/status-transitions-single-source) : create() et upsertDirect() n'écrivent
// plus de transition côté applicatif (ni DELETE de la ligne trigger, ni chaîne synthétique).
// Le trigger DB `log_intervention_status_transition_on_insert` est l'unique écrivain.
// L'acteur est propagé via created_by / updated_by.

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock("@/lib/reference-api", () => ({
  referenceApi: { getAll: vi.fn() },
}));

const mockReferenceData = {
  interventionStatuses: [
    { id: "s1", code: "DEMANDE", label: "Demandé", color: "#3B82F6", sort_order: 1 },
  ],
  artisanStatuses: [],
  agencies: [],
  metiers: [],
  users: [],
  allUsers: [],
};

/** Mock fluent Supabase chain supportant insert/upsert/select/eq/single/maybeSingle. */
function buildMock(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.single = vi.fn().mockResolvedValue(resolved);
  return chain;
}

const createdRow = { id: "interv-1", statut_id: "s1" };

describe("interventions CRUD — source unique (trigger-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateReferenceCache();
    vi.mocked(referenceApi.getAll).mockResolvedValue(mockReferenceData as any);
  });

  describe("create()", () => {
    it("should NOT delete the trigger row nor write a synthetic chain", async () => {
      const insertChain = buildMock({ data: createdRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(insertChain as any);

      await create({ statut_id: "s1" } as any, { userId: "actor-1" });

      // Aucune opération sur intervention_status_transitions
      const touchedTransitions = vi
        .mocked(supabase.from)
        .mock.calls.some(([table]) => table === "intervention_status_transitions");
      expect(touchedTransitions).toBe(false);
      // Aucune RPC de chaîne synthétique
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "create_automatic_status_transitions_on_creation",
        expect.anything(),
      );
    });

    it("should propagate created_by/updated_by when an actor is provided", async () => {
      const insertChain = buildMock({ data: createdRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(insertChain as any);

      await create({ statut_id: "s1" } as any, { userId: "actor-1" });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ created_by: "actor-1", updated_by: "actor-1" }),
      );
    });

    it("should NOT inject created_by when no actor is provided (browser relies on auth.uid())", async () => {
      const insertChain = buildMock({ data: createdRow, error: null });
      vi.mocked(supabase.from).mockReturnValue(insertChain as any);

      await create({ statut_id: "s1" } as any);

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.not.objectContaining({ created_by: expect.anything() }),
      );
    });
  });

  describe("upsertDirect()", () => {
    it("should set created_by + updated_by on a NEW row, without touching transitions", async () => {
      const selectChain = buildMock({ data: null, error: null }); // maybeSingle -> pas d'existant
      const upsertChain = buildMock({ data: createdRow, error: null });
      const client = {
        from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValue(upsertChain),
      };

      await upsertDirect({ id_inter: "INT-1", statut_id: "s1" } as any, client as any, {
        userId: "actor-1",
      });

      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ created_by: "actor-1", updated_by: "actor-1" }),
        expect.objectContaining({ onConflict: "id_inter" }),
      );
      const touchedTransitions = client.from.mock.calls.some(
        ([table]: [string]) => table === "intervention_status_transitions",
      );
      expect(touchedTransitions).toBe(false);
    });

    it("should set only updated_by on an EXISTING row (ne pas écraser created_by)", async () => {
      const selectChain = buildMock({ data: { id: "interv-1", statut_id: "s0" }, error: null });
      const upsertChain = buildMock({ data: createdRow, error: null });
      const client = {
        from: vi.fn().mockReturnValueOnce(selectChain).mockReturnValue(upsertChain),
      };

      await upsertDirect({ id_inter: "INT-1", statut_id: "s1" } as any, client as any, {
        userId: "actor-1",
      });

      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ updated_by: "actor-1" }),
        expect.anything(),
      );
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.not.objectContaining({ created_by: expect.anything() }),
        expect.anything(),
      );
    });
  });
});
