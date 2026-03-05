import { beforeEach, describe, expect, it, vi } from "vitest";

import { interventionsApi, invalidateReferenceCache } from "@/lib/api/v2";
import { supabase } from "@/lib/supabase-client";
import { referenceApi } from "@/lib/reference-api";

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock("@/lib/reference-api", () => ({
  referenceApi: {
    getAll: vi.fn(),
  },
}));

const mockReferenceData = {
  interventionStatuses: [
    { id: "status-1", code: "DEMANDE", label: "Demandé", color: "#3B82F6", sort_order: 1 },
  ],
  artisanStatuses: [],
  agencies: [],
  metiers: [],
  users: [],
  allUsers: [],
};

describe("interventionsApi - status handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateReferenceCache();
    vi.mocked(referenceApi.getAll).mockResolvedValue(mockReferenceData as any);
  });

  it("getAll should return interventions with joined status data", async () => {
    // getAll utilise fetch vers l'edge function, on doit mocker fetch
    const mockResponseData = {
      data: [
        {
          id: "1",
          statut_id: "status-1",
          status: {
            id: "status-1",
            code: "DEMANDE",
            label: "Demandé",
            color: "#3B82F6",
            sort_order: 1,
          },
        },
      ],
      total: 1,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponseData),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await interventionsApi.getAll();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status?.label).toBe("Demandé");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/interventions-v2/interventions"),
      expect.any(Object),
    );
  });

  it("getAllStatuses should fetch every status ordered by sort_order", async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: mockReferenceData.interventionStatuses,
      error: null,
    });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: mockOrder,
    };

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

    const statuses = await interventionsApi.getAllStatuses();

    expect(statuses).toEqual(mockReferenceData.interventionStatuses);
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("getStatusByCode returns null when status not found", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    };

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

    const status = await interventionsApi.getStatusByCode("UNKNOWN");
    expect(status).toBeNull();
  });

  it("getStatusByCode returns status when found", async () => {
    const record = mockReferenceData.interventionStatuses[0];

    const mockSingle = vi.fn().mockResolvedValue({
      data: record,
      error: null,
    });
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    };

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

    const status = await interventionsApi.getStatusByCode("DEMANDE");
    expect(status).toEqual(record);
    expect(mockQuery.eq).toHaveBeenCalledWith("code", "DEMANDE");
  });
});
