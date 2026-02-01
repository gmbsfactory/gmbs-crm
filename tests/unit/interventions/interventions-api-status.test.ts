import { beforeEach, describe, expect, it, vi } from "vitest";

import { interventionsApi, invalidateReferenceCache } from "@/lib/api/v2";
import { supabase } from "@/lib/supabase-client";
import { referenceApi } from "@/lib/reference-api";

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
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
};

describe("interventionsApi - status handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateReferenceCache();
    vi.mocked(referenceApi.getAll).mockResolvedValue(mockReferenceData as any);
  });

  it("getAll should return interventions with joined status data", async () => {
    const mockRange = vi.fn().mockResolvedValue({
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
      error: null,
      count: 1,
    });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      range: mockRange,
    };

    vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

    const result = await interventionsApi.getAll();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status?.label).toBe("Demandé");
    expect(mockQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("status:intervention_statuses"),
      expect.objectContaining({ count: "exact" }),
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
