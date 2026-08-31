import { describe, it, expect, vi, beforeEach } from "vitest";

// Les fetchers Supabase sont mockés : on teste le fenêtrage de période et le
// bucketing, pas la couche réseau (couverte par _shared.test.ts).
const fetchUserTransitions = vi.fn();
const fetchUserArtisans = vi.fn(async () => []);
const fetchUserArtisansMissionnesDeduped = vi.fn(async () => new Map());

// Factory complète (pas d'importOriginal) : importer le module réel tirerait
// le client Supabase, qui exige des variables d'environnement en test.
vi.mock("@/lib/api/interventions/stats/user/_shared", () => ({
  formatDate: (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`,
  requireUserId: (userId: string) => {
    if (!userId) throw new Error("userId is required");
  },
  fetchUserTransitions: (...args: unknown[]) => fetchUserTransitions(...args),
  fetchUserArtisans: (...args: unknown[]) => fetchUserArtisans(...args),
  fetchUserArtisansMissionnesDeduped: (...args: unknown[]) =>
    fetchUserArtisansMissionnesDeduped(...args),
}));

const { getMonthlyStatsByUser } = await import(
  "@/lib/api/interventions/stats/user/period/monthly"
);
const { getYearlyStatsByUser } = await import(
  "@/lib/api/interventions/stats/user/period/yearly"
);

const devis = (isoDate: string, id: string) => ({
  id,
  intervention_id: id,
  transition_date: isoDate,
  to_status_code: "DEVIS_ENVOYE",
});

describe("fenêtrage des périodes de stats utilisateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUserTransitions.mockResolvedValue([]);
    fetchUserArtisans.mockResolvedValue([]);
    fetchUserArtisansMissionnesDeduped.mockResolvedValue(new Map());
  });

  describe("getMonthlyStatsByUser", () => {
    it("borne les transitions au 1er du mois suivant (exclusif)", async () => {
      await getMonthlyStatsByUser("user-1", "2026-08-15");

      expect(fetchUserTransitions).toHaveBeenCalledWith(
        expect.objectContaining({
          startStr: "2026-08-01",
          endStrExclusive: "2026-09-01",
        })
      );
    });

    it("compte les devis envoyés le dernier jour du mois", async () => {
      // Régression : la borne `lte '2026-08-31'` excluait toute la journée du 31,
      // alors que la vue semaine les affichait bien.
      fetchUserTransitions.mockResolvedValue([
        devis("2026-08-31T09:00:00", "i1"),
        devis("2026-08-31T14:30:00", "i2"),
        devis("2026-08-31T18:45:00", "i3"),
        devis("2026-08-31T23:15:00", "i4"),
      ]);

      const stats = await getMonthlyStatsByUser("user-1", "2026-08-01");

      expect(stats.devis_envoye.total).toBe(4);
      // Le 31/08/2026 est un lundi : il ouvre la dernière semaine du mois.
      const lastWeek = stats.devis_envoye.counts.at(-1);
      expect(lastWeek).toBe(4);
    });
  });

  describe("getYearlyStatsByUser", () => {
    it("borne les transitions au 1er janvier suivant (exclusif)", async () => {
      await getYearlyStatsByUser("user-1", "2026-05-10");

      expect(fetchUserTransitions).toHaveBeenCalledWith(
        expect.objectContaining({
          startStr: "2026-01-01",
          endStrExclusive: "2027-01-01",
        })
      );
    });

    it("compte les devis envoyés le 31 décembre", async () => {
      fetchUserTransitions.mockResolvedValue([devis("2026-12-31T16:00:00", "i1")]);

      const stats = await getYearlyStatsByUser("user-1", "2026-01-01");

      expect(stats.devis_envoye.decembre).toBe(1);
      expect(stats.devis_envoye.total).toBe(1);
    });
  });
});
