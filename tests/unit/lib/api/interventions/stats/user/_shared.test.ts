import { describe, it, expect, vi, beforeEach } from "vitest";

// Builder de requête espionné : chaque filtre enregistre (méthode, colonne, valeur)
// et la chaîne est "thenable" pour être awaitée comme une requête Supabase.
const calls: Array<{ fn: string; column: string; value: unknown }> = [];
let rows: unknown[] = [];

const makeQuery = () => {
  const record = (fn: string) => (column: string, value: unknown) => {
    calls.push({ fn, column, value });
    return query;
  };
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: record("eq"),
    in: record("in"),
    not: record("not"),
    gte: record("gte"),
    lt: record("lt"),
    lte: record("lte"),
    abortSignal: vi.fn(() => query),
    then: (resolve: (r: unknown) => unknown) => resolve({ data: rows, error: null }),
  };
  return query;
};

const fromMock = vi.fn(() => makeQuery());

vi.mock("@/lib/api/common/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...(args as [])) },
}));

const { fetchUserTransitions } = await import(
  "@/lib/api/interventions/stats/user/_shared"
);

const filter = (fn: string, column: string) =>
  calls.filter((c) => c.fn === fn && c.column === column);

describe("fetchUserTransitions", () => {
  beforeEach(() => {
    calls.length = 0;
    rows = [];
    vi.clearAllMocks();
  });

  it("applique une borne haute exclusive sur transition_date", async () => {
    // Régression : une borne `lte` sur le dernier jour de la période était
    // castée à minuit par Postgres et perdait toutes les transitions du jour.
    await fetchUserTransitions({
      userId: "user-1",
      startStr: "2026-08-01",
      endStrExclusive: "2026-09-01",
    });

    expect(filter("lt", "transition_date")).toEqual([
      { fn: "lt", column: "transition_date", value: "2026-09-01" },
    ]);
    expect(filter("lte", "transition_date")).toHaveLength(0);
  });

  it("applique une borne basse inclusive sur transition_date", async () => {
    await fetchUserTransitions({
      userId: "user-1",
      startStr: "2026-08-01",
      endStrExclusive: "2026-09-01",
    });

    const bounds = filter("gte", "transition_date").map((c) => c.value);
    expect(bounds).toContain("2026-08-01");
  });

  it("restreint aux interventions actives", async () => {
    await fetchUserTransitions({
      userId: "user-42",
      startStr: "2026-08-01",
      endStrExclusive: "2026-09-01",
    });

    expect(fromMock).toHaveBeenCalledWith("intervention_status_transitions");
    expect(filter("eq", "interventions.is_active")[0]?.value).toBe(true);
  });

  it("attribue les transitions a l'acteur, pas au proprietaire du dossier", async () => {
    await fetchUserTransitions({
      userId: "user-42",
      startStr: "2026-08-01",
      endStrExclusive: "2026-09-01",
    });

    // Regle n.4 (transitions-scope.ts) : celui qui passe le dossier au statut
    // recolte la stat, meme si le dossier est assigne a un collegue absent.
    expect(filter("eq", "changed_by_user_id")[0]?.value).toBe("user-42");
    expect(filter("eq", "interventions.assigned_user_id")).toHaveLength(0);
  });
});
