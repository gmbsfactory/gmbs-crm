import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Entonnoir de Conversion", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner les 5 étapes de l'entonnoir", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_conversion_funnel_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(data).toHaveLength(5);
    expect(data[0].status_code).toBe('DEMANDE');
    expect(data[4].status_code).toBe('INTER_TERMINEE');
  });

  it("chaque étape devrait avoir un count numérique", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_conversion_funnel_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    data.forEach((step: any) => {
      expect(typeof step.count).toBe('number');
      expect(step.count).toBeGreaterThanOrEqual(0);
    });
  });

  it("le count devrait être décroissant entre les étapes", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_conversion_funnel_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    for (let i = 0; i < data.length - 1; i++) {
      expect(data[i].count).toBeGreaterThanOrEqual(data[i+1].count);
    }
  });
});








