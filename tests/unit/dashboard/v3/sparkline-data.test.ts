import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Sparkline Data", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-07T23:59:59"; // 7 jours

  it("devrait retourner une série temporelle complète", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_sparkline_data_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    // On s'attend à avoir un point par jour (du 1 au 7 inclus)
    expect(data.length).toBe(7);
  });

  it("chaque point devrait avoir les métriques quotidiennes", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_sparkline_data_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    if (data.length > 0) {
      const point = data[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('nb_interventions_demandees');
      expect(point).toHaveProperty('nb_interventions_terminees');
      expect(point).toHaveProperty('ca_jour');
      expect(point).toHaveProperty('marge_jour');
    }
  });
});





