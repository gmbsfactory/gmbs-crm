-- ========================================
-- DIAGNOSTIC : Pourquoi la marge est négative pour Badr ?
-- ========================================
WITH 
  gestionnaires AS (
    SELECT id, username, firstname, lastname
    FROM public.users
    WHERE username IN ('lucien', 'badr')
  ),
  
  interventions_novembre AS (
    SELECT i.id, i.id_inter, i.assigned_user_id
    FROM public.interventions i
    INNER JOIN gestionnaires g ON i.assigned_user_id = g.id
    WHERE i.is_active = true
      AND i.date >= '2025-11-01'::date
      AND i.date < '2025-12-01'::date
      AND i.assigned_user_id IS NOT NULL
  ),
  
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_novembre ip ON ip.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= '2025-11-01'::timestamptz
      AND ist.transition_date < '2025-12-01'::timestamptz
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
  ),
  
  -- Comparaison : intervention_costs vs intervention_costs_cache
  comparaison AS (
    SELECT
      ip.id_inter,
      ip.id as intervention_id,
      g.username,
      -- Données depuis intervention_costs (table source)
      COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as ca_direct,
      COALESCE(SUM(CASE WHEN ic.cost_type = 'sst' THEN ic.amount ELSE 0 END), 0)::numeric as sst_direct,
      COALESCE(SUM(CASE WHEN ic.cost_type = 'materiel' THEN ic.amount ELSE 0 END), 0)::numeric as materiel_direct,
      -- Données depuis intervention_costs_cache
      COALESCE(icc.total_ca, 0)::numeric as ca_cache,
      COALESCE(icc.total_sst, 0)::numeric as sst_cache,
      COALESCE(icc.total_materiel, 0)::numeric as materiel_cache,
      -- Marge calculée
      (COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
       - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric) as marge_direct,
      (COALESCE(icc.total_ca, 0)::numeric - COALESCE(icc.total_sst + icc.total_materiel, 0)::numeric) as marge_cache
    FROM interventions_novembre ip
    INNER JOIN transitions_terminees tt ON tt.intervention_id = ip.id
    LEFT JOIN public.intervention_costs ic ON ic.intervention_id = ip.id
    LEFT JOIN public.intervention_costs_cache icc ON icc.intervention_id = ip.id
    INNER JOIN gestionnaires g ON g.id = ip.assigned_user_id
    GROUP BY ip.id, ip.id_inter, g.username, icc.total_ca, icc.total_sst, icc.total_materiel
  )
  
SELECT 
  username,
  id_inter,
  ca_direct,
  sst_direct,
  materiel_direct,
  marge_direct,
  ca_cache,
  sst_cache,
  materiel_cache,
  marge_cache,
  -- Différences
  (ca_cache - ca_direct) as diff_ca,
  ((sst_cache + materiel_cache) - (sst_direct + materiel_direct)) as diff_couts,
  (marge_cache - marge_direct) as diff_marge,
  -- Problèmes détectés
  CASE 
    WHEN ca_direct = 0 AND (sst_direct > 0 OR materiel_direct > 0) THEN '⚠️ Coûts sans CA (direct)'
    WHEN ca_cache = 0 AND (sst_cache > 0 OR materiel_cache > 0) THEN '⚠️ Coûts sans CA (cache)'
    WHEN ABS(ca_cache - ca_direct) > 0.01 THEN '⚠️ Désynchronisation CA'
    WHEN ABS((sst_cache + materiel_cache) - (sst_direct + materiel_direct)) > 0.01 THEN '⚠️ Désynchronisation coûts'
    WHEN marge_cache < 0 THEN '⚠️ Marge négative'
    ELSE '✓ OK'
  END as statut
FROM comparaison
WHERE username = 'badr'  -- Focus sur Badr pour le diagnostic
ORDER BY marge_cache ASC;