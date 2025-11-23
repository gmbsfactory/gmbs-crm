-- ========================================
-- CTE 12: Stats financières par gestionnaire
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
interventions_gestionnaires AS (
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
    
    UNION
    
    SELECT DISTINCT
      i.id as intervention_id,
      a.gestionnaire_id
    FROM interventions_periode i
    INNER JOIN public.intervention_artisans ia ON ia.intervention_id = i.id
    INNER JOIN public.artisans a ON a.id = ia.artisan_id
    WHERE a.gestionnaire_id IS NOT NULL
      AND a.is_active = true
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
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
gestionnaire_financials AS (
    SELECT 
      ig.gestionnaire_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_gestionnaires ig
    INNER JOIN inter_terminees it ON it.intervention_id = ig.intervention_id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ig.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = ig.intervention_id
    WHERE ig.gestionnaire_id IS NOT NULL
    GROUP BY ig.gestionnaire_id
)
SELECT 
  gf.gestionnaire_id,
  u.email as gestionnaire_email,
  u.raw_user_meta_data->>'full_name' as gestionnaire_nom,
  gf.total_paiements,
  gf.total_couts,
  (gf.total_paiements - gf.total_couts)::numeric as marge_brute,
  CASE 
    WHEN gf.total_paiements > 0 
    THEN ROUND(((gf.total_paiements - gf.total_couts) / gf.total_paiements * 100)::numeric, 2)
    ELSE 0 
  END as taux_marge_pourcent
FROM gestionnaire_financials gf
LEFT JOIN public.users u ON u.id = gf.gestionnaire_id
ORDER BY gf.total_paiements DESC;

