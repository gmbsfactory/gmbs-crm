import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - Volume par Statut", () => {
  const periodStart = "2024-12-01T00:00:00";
  const periodEnd = "2024-12-07T23:59:59";

  it("devrait retourner le volume agrégé par jour et par statut", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_volume_by_status_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const point = data[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('demande');
      expect(point).toHaveProperty('devis_envoye');
      expect(point).toHaveProperty('accepte');
      expect(point).toHaveProperty('en_cours');
      expect(point).toHaveProperty('termine');
    }
  });

  it("devrait avoir le même nombre de points que de jours dans la période", async () => {
    const { data, error } = await supabase.rpc('get_dashboard_volume_by_status_v3', {
      p_period_start: periodStart,
      p_period_end: periodEnd
    });

    if (error) throw error;
    expect(data.length).toBe(7);
  });
});








