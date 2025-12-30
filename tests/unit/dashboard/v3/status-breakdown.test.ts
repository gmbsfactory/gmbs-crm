import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Status Breakdown", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner la répartition actuelle des statuts", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_status_breakdown_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const s = data[0];
      expect(s).toHaveProperty('status_code');
      expect(s).toHaveProperty('status_label');
      expect(s).toHaveProperty('count');
    }
  });

  it("la somme des counts devrait égaler le nombre total d'interventions demandées", async () => {
    const { data: statsMain } = await supabase.rpc('get_dashboard_kpi_main_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    const { data: breakdown } = await supabase.rpc('get_dashboard_status_breakdown_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    const totalBreakdown = breakdown.reduce((acc: number, curr: any) => acc + curr.count, 0);
    expect(totalBreakdown).toBe(statsMain.nb_interventions_demandees);
  });
});

