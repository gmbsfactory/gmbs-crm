-- Vérifier la bonne application, le bon fonctionnement de la fonction rpc 

-- CTE 1
WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id
    FROM public.interventions i
    LEFT JOIN public.metiers ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01'
      AND i.date < '2026-01-01')
SELECT * 
FROM interventions_periode;


-- CTE 2 
WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01'
      AND transition_date < '2026-01-01'
)
SELECT *
FROM inter_terminees;


-- CTE 3 
WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01'
      AND i.date < '2026-01-01'
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
)
SELECT *
FROM (
   SELECT 
      COUNT(*) FILTER (WHERE statut_code = 'DEMANDE')::integer as nb_demandees,
      (SELECT COUNT(*)::integer FROM inter_terminees) as nb_terminees,
      COUNT(*) FILTER (WHERE statut_code = 'DEVIS_ENVOYE')::integer as nb_devis,
      COUNT(*) FILTER (WHERE statut_code = ANY(ARRAY['INTER_TERMINEE', 'INTER_EN_COURS', 'DEVIS_ENVOYE']))::integer as nb_valides
    FROM interventions_periode
) s;


-- CTE 4
--    status breakdown
WITH interventions_periode AS (
  SELECT ist.code as statut_code
  FROM public.interventions i
  LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
  WHERE i.is_active = true
    AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
    AND i.date <  '2026-01-01T00:00:00Z'::timestamptz
)
SELECT statut_code, COUNT(*) as cnt
FROM interventions_periode
GROUP BY statut_code
ORDER BY cnt DESC;

-- CTE 5
--     metier breakdown
WITH interventions_periode AS (
  SELECT ist.code as metier
  FROM public.interventions i
  LEFT JOIN public.metiers ist ON ist.id = i.metier_id
  WHERE i.is_active = true
    AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
    AND i.date <  '2026-01-01T00:00:00Z'::timestamptz
)
SELECT metier, COUNT(*) as cnt
FROM interventions_periode
WHERE metier IS NOT NULL
GROUP BY metier
ORDER BY cnt DESC;


-- CTE 6: Breakdown par agence (GROUP BY avec comptage des terminées)
WITH interventions_periode AS (
  SELECT i.id, ist.code as agency_code
  FROM public.interventions i
  LEFT JOIN public.agencies ist ON ist.id = i.agence_id
  WHERE i.is_active = true
    AND date >= '2025-01-01T00:00:00Z'::timestamptz
    AND date <  '2026-01-01T00:00:00Z'::timestamptz
),
inter_terminees AS (
  SELECT DISTINCT intervention_id
  FROM public.intervention_status_transitions
  WHERE to_status_code = 'INTER_TERMINEE'
    AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
    AND transition_date <  '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  agency_code,
  COUNT(*)::integer as total_interventions,
  COUNT(*) FILTER (WHERE id IN (SELECT intervention_id FROM inter_terminees))::integer as terminated_interventions
FROM interventions_periode
WHERE agency_code IS NOT NULL
GROUP BY agency_code
ORDER BY total_interventions DESC;


-- CTE 7: Paiements agrégés par intervention (pour calcul global et par agence)
-- payments per terminated intervention
WITH inter_terminees AS (
  SELECT DISTINCT intervention_id
  FROM public.intervention_status_transitions
  WHERE to_status_code = 'INTER_TERMINEE'
    AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
    AND transition_date <  '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  ic.intervention_id,
  i.agence_id,
  SUM(ic.amount)::numeric as total_couts
FROM inter_terminees it
JOIN public.interventions i ON i.id = it.intervention_id
JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE ic.cost_type = 'intervention'
GROUP BY ic.intervention_id, i.agence_id
ORDER BY total_couts DESC;


-- CTE 8: Coûts agrégés par intervention (pour calcul global et par agence)
WITH inter_terminees AS (
  SELECT DISTINCT intervention_id
  FROM public.intervention_status_transitions
  WHERE to_status_code = 'INTER_TERMINEE'
    AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
    AND transition_date <  '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  ic.intervention_id,
  i.agence_id,
  ic.cost_type,
  SUM(ic.amount)::numeric as total_couts
FROM inter_terminees it
JOIN public.interventions i ON i.id = it.intervention_id
JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE ic.cost_type IN ('sst', 'materiel')
GROUP BY ic.intervention_id, i.agence_id, ic.cost_type
ORDER BY ic.intervention_id, ic.cost_type;

-- Benef
WITH inter_terminees AS (
  SELECT DISTINCT intervention_id
  FROM public.intervention_status_transitions
  WHERE to_status_code = 'INTER_TERMINEE'
    AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
    AND transition_date <  '2026-01-01T00:00:00Z'::timestamptz
),
costs_by_type AS (
  SELECT 
    ic.intervention_id,
    a.label as agence_label,
    SUM(ic.amount) FILTER (WHERE ic.cost_type = 'intervention')::numeric as revenus_intervention,
    SUM(ic.amount) FILTER (WHERE ic.cost_type = 'sst')::numeric as couts_sst,
    SUM(ic.amount) FILTER (WHERE ic.cost_type = 'materiel')::numeric as couts_materiel
  FROM inter_terminees it
  JOIN public.interventions i ON i.id = it.intervention_id
  JOIN public.intervention_costs ic ON ic.intervention_id = i.id
  JOIN public.agencies a ON a.id = i.agence_id
  GROUP BY ic.intervention_id, agence_label
)
SELECT 
  intervention_id,
  agence_label,
  COALESCE(revenus_intervention, 0)::numeric as revenus_intervention,
  COALESCE(couts_sst, 0)::numeric as couts_sst,
  COALESCE(couts_materiel, 0)::numeric as couts_materiel,
  (COALESCE(revenus_intervention, 0) - COALESCE(couts_sst, 0) - COALESCE(couts_materiel, 0))::numeric as benefice
FROM costs_by_type
ORDER BY benefice DESC;



-- CTE 9: Stats financières globales




-- CTE 10: Stats financières par agence
