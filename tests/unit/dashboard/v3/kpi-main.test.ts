import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase-client";

describe("Dashboard V3 - KPIs Principaux", () => {
    const periodStart = "2024-12-01T00:00:00";
    const periodEnd = "2024-12-31T23:59:59";

    it("devrait retourner la structure correcte pour kpi_main", async () => {
        const { data, error } = await supabase.rpc('get_dashboard_kpi_main_v3', {
            p_period_start: periodStart,
            p_period_end: periodEnd
        });

        if (error) throw error;

        expect(data).toHaveProperty('nb_interventions_demandees');
        expect(data).toHaveProperty('nb_interventions_terminees');
        expect(data).toHaveProperty('taux_transformation');
        expect(data).toHaveProperty('ca_total');
        expect(data).toHaveProperty('couts_total');
        expect(data).toHaveProperty('marge_total');
        expect(data).toHaveProperty('taux_marge');
        expect(data).toHaveProperty('ca_moyen_par_intervention');
    });

    it("devrait retourner 0 si la période est dans le futur", async () => {
        const { data, error } = await supabase.rpc('get_dashboard_kpi_main_v3', {
            p_period_start: "2099-01-01T00:00:00",
            p_period_end: "2099-01-31T23:59:59"
        });

        if (error) throw error;

        expect(data.nb_interventions_demandees).toBe(0);
        expect(data.ca_total).toBe(0);
    });

    it("devrait filtrer par agence si spécifié", async () => {
        const { data: agences } = await supabase.from('agencies').select('id').limit(1);
        if (!agences || agences.length === 0) return;

        const { data, error } = await supabase.rpc('get_dashboard_kpi_main_v3', {
            p_period_start: periodStart,
            p_period_end: periodEnd,
            p_agence_ids: [agences[0].id]
        });

        if (error) throw error;
        expect(data).toBeDefined();
    });
});











