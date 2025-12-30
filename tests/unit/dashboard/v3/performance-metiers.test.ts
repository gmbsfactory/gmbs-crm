import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Performance Métiers", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner la performance par métier", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_metiers_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const m = data[0];
      expect(m).toHaveProperty('metier_id');
      expect(m).toHaveProperty('metier_nom');
      expect(m).toHaveProperty('nb_interventions_demandees');
      expect(m).toHaveProperty('pourcentage_volume');
      expect(m).toHaveProperty('ca_total');
    }
  });

  it("devrait sommer à 100% (environ) le volume total si données présentes", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_performance_metiers_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    const totalInterventions = data.reduce((acc: number, curr: any) => acc + curr.nb_interventions_demandees, 0);
    if (totalInterventions > 0) {
      const totalPourcentage = data.reduce((acc: number, curr: any) => acc + curr.pourcentage_volume, 0);
      expect(totalPourcentage).toBeGreaterThanOrEqual(99.9);
      expect(totalPourcentage).toBeLessThanOrEqual(100.1);
    }
  });
});

