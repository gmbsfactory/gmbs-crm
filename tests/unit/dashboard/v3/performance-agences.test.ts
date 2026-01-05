import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Performance Agences", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner la performance par agence", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_agences_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const a = data[0];
      expect(a).toHaveProperty('agence_id');
      expect(a).toHaveProperty('agence_nom');
      expect(a).toHaveProperty('nb_interventions_demandees');
      expect(a).toHaveProperty('ca_total');
      expect(a).toHaveProperty('nb_gestionnaires_actifs');
    }
  });

  it("devrait être trié par CA décroissant", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_agences_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    if (data.length > 1) {
      expect(data[0].ca_total).toBeGreaterThanOrEqual(data[1].ca_total);
    }
  });
});






