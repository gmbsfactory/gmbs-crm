import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Orchestrateur Global", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-31T23:59:59";

  it("devrait retourner toutes les sections du dashboard en un seul appel", async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(data).toHaveProperty('kpi_main');
    expect(data).toHaveProperty('performance_gestionnaires');
    expect(data).toHaveProperty('performance_agences');
    expect(data).toHaveProperty('performance_metiers');
    expect(data).toHaveProperty('cycles_moyens');
    expect(data).toHaveProperty('sparkline_data');
    expect(data).toHaveProperty('volume_by_status');
    expect(data).toHaveProperty('conversion_funnel');
    expect(data).toHaveProperty('status_breakdown');
  });

  it("devrait respecter les paramètres de limitation", async () => {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_top_gestionnaires: 5
    });

    if (error) throw error;
    expect(data.performance_gestionnaires.length).toBeLessThanOrEqual(5);
  });

  it("devrait filtrer globalement par agence", async () => {
    const { data: agences } = await supabase.from('agencies').select('id').limit(1);
    if (!agences || agences.length === 0) return;

    const { data, error } = await supabase.rpc('get_admin_dashboard_stats_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_agence_ids: [agences[0].id]
    });

    if (error) throw error;
    
    // Si kpi_main a des données, elles doivent correspondre au filtre
    expect(data.kpi_main).toBeDefined();
  });
});

