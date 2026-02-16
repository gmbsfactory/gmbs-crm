import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useInterventionStatuses } from "@/hooks/useInterventionStatuses";

const mockStatuses = [
  { id: "1", code: "DEMANDE", label: "Demandé", color: "#3B82F6", sort_order: 1 },
  { id: "2", code: "EN_COURS", label: "En cours", color: "#F59E0B", sort_order: 2 },
];

// Mock referenceApi.getAll() which is called by useReferenceDataQuery
vi.mock("@/lib/reference-api", () => ({
  referenceApi: {
    getAll: vi.fn(),
  },
}));

vi.mock("@/lib/react-query/queryKeys", () => ({
  referenceKeys: {
    allData: () => ["reference", "allData"],
    invalidateAll: () => ["reference"],
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useInterventionStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads statuses on mount and builds lookup maps", async () => {
    const { referenceApi } = await import("@/lib/reference-api");
    vi.mocked(referenceApi.getAll).mockResolvedValue({
      interventionStatuses: mockStatuses,
      artisanStatuses: [],
      agencies: [],
      metiers: [],
      users: [{ id: "u1", username: "test", code_gestionnaire: "TST", firstname: "Test", lastname: "User" }],
    } as any);

    const { result } = renderHook(() => useInterventionStatuses(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.statuses).toEqual(mockStatuses);
    expect(result.current.getStatusByCode("DEMANDE")).toEqual(mockStatuses[0]);
    expect(result.current.getStatusById("2")?.label).toBe("En cours");
  });

  it("saves error state when fetching fails", async () => {
    const { referenceApi } = await import("@/lib/reference-api");
    vi.mocked(referenceApi.getAll).mockRejectedValue(new Error("Failed to load"));

    const { result } = renderHook(() => useInterventionStatuses(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.statuses).toEqual([]);
  });
});
