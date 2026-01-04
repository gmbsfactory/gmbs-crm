import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Performance Gestionnaires", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner une liste de gestionnaires triée par CA", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_gestionnaires_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_limit: 10
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 1) {
      expect(data[0].ca_total).toBeGreaterThanOrEqual(data[1].ca_total);
    }
  });

  it("chaque gestionnaire devrait avoir les champs de performance", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_gestionnaires_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    if (data.length > 0) {
      const g = data[0];
      expect(g).toHaveProperty('gestionnaire_id');
      expect(g).toHaveProperty('gestionnaire_nom');
      expect(g).toHaveProperty('nb_interventions_prises');
      expect(g).toHaveProperty('nb_interventions_terminees');
      expect(g).toHaveProperty('ca_total');
      expect(g).toHaveProperty('marge_total');
    }
  });
});





