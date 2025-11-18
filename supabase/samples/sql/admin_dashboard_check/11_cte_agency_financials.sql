-- ========================================
-- CTE 10: Stats financières par agence
-- ========================================

WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
agency_breakdown AS (
    SELECT 
      agence_id,
      COUNT(*)::integer as total_interventions,
      COUNT(*) FILTER (WHERE id IN (SELECT intervention_id FROM inter_terminees))::integer as terminated_interventions
    FROM interventions_periode
    WHERE agence_id IS NOT NULL
    GROUP BY agence_id
),
paiements_agreges AS (
    SELECT 
      ic.intervention_id,
      i.agence_id,
      SUM(ic.amount)::numeric as total_paiements
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id, i.agence_id
),
couts_agreges AS (
    SELECT 
      ic.intervention_id,
      i.agence_id,
      SUM(ic.amount)::numeric as total_couts
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id, i.agence_id
),
agency_financials AS (
    SELECT 
      COALESCE(a.agence_id, p.agence_id, c.agence_id) as agence_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM agency_breakdown a
    LEFT JOIN paiements_agreges p ON p.agence_id = a.agence_id
    LEFT JOIN couts_agreges c ON c.agence_id = a.agence_id
    GROUP BY COALESCE(a.agence_id, p.agence_id, c.agence_id)
)
SELECT 
  af.agence_id,
  a.label as agence_label,
  ab.total_interventions,
  ab.terminated_interventions,
  af.total_paiements,
  af.total_couts,
  (af.total_paiements - af.total_couts)::numeric as marge_brute,
  CASE 
    WHEN af.total_paiements > 0 
    THEN ROUND(((af.total_paiements - af.total_couts) / af.total_paiements * 100)::numeric, 2)
    ELSE 0 
  END as taux_marge_pourcent
FROM agency_financials af
LEFT JOIN public.agencies a ON a.id = af.agence_id
LEFT JOIN agency_breakdown ab ON ab.agence_id = af.agence_id
ORDER BY af.total_paiements DESC;

