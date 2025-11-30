-- ========================================
-- Marge de novembre pour Lucien et Badr
-- ========================================
WITH 
  -- Récupérer les IDs des gestionnaires
  gestionnaires AS (
    SELECT id, username, firstname, lastname
    FROM public.users
    WHERE username IN ('lucien', 'badr')
  ),
  
  -- Interventions de novembre 2024 pour ces gestionnaires
  interventions_novembre AS (
    SELECT i.id, i.assigned_user_id
    FROM public.interventions i
    INNER JOIN gestionnaires g ON i.assigned_user_id = g.id
    WHERE i.is_active = true
      AND i.date >= '2025-11-01'::date
      AND i.date < '2025-12-01'::date
      AND i.assigned_user_id IS NOT NULL
  ),
  
  -- Interventions terminées en novembre
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_novembre ip ON ip.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= '2025-11-01'::timestamptz
      AND ist.transition_date < '2025-12-01'::timestamptz
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
  ),
  
  -- Statistiques par gestionnaire
  gestionnaire_stats AS (
    SELECT
      ip.assigned_user_id as gestionnaire_id,
      g.username,
      g.firstname,
      g.lastname,
      COUNT(DISTINCT tt.intervention_id)::int as total_interventions,
      COALESCE(SUM(icc.total_ca), 0)::numeric as total_paiements,
      COALESCE(SUM(icc.total_sst + icc.total_materiel), 0)::numeric as total_couts,
      COALESCE(SUM(icc.total_ca), 0)::numeric - COALESCE(SUM(icc.total_sst + icc.total_materiel), 0)::numeric as marge
    FROM interventions_novembre ip
    INNER JOIN transitions_terminees tt ON tt.intervention_id = ip.id
    LEFT JOIN public.intervention_costs_cache icc ON icc.intervention_id = ip.id
    INNER JOIN gestionnaires g ON g.id = ip.assigned_user_id
    GROUP BY ip.assigned_user_id, g.username, g.firstname, g.lastname
    HAVING COUNT(DISTINCT tt.intervention_id) > 0
  )
  
SELECT 
  username as gestionnaire,
  COALESCE(firstname || ' ' || lastname, username) as nom_complet,
  total_interventions as interventions_terminees,
  ROUND(total_paiements, 2) as chiffre_affaires,
  ROUND(total_couts, 2) as total_couts,
  ROUND(marge, 2) as marge,
  CASE 
    WHEN total_paiements > 0 
    THEN ROUND((marge / total_paiements) * 100, 2)
    ELSE 0
  END as marge_pourcentage
FROM gestionnaire_stats
ORDER BY marge DESC;

-- ========================================
-- Requête : id_inter, coûts, CA et marge
-- ========================================
SELECT 
  i.id_inter,
  i.id as intervention_id,
  
  -- Coûts détaillés par type
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as cout_intervention,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'sst' THEN ic.amount ELSE 0 END), 0)::numeric as cout_sst,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'materiel' THEN ic.amount ELSE 0 END), 0)::numeric as cout_materiel,
  
  -- Chiffre d'affaires (CA) = somme des coûts de type 'intervention'
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
  
  -- Marge = CA - (SST + Matériel)
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
    - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge,
  
  -- Pourcentage de marge
  CASE 
    WHEN COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) > 0
    THEN ROUND(
      ((COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
        - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric)
       / COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 1)::numeric) * 100, 
      2
    )
    ELSE 0
  END as marge_pourcentage

FROM public.interventions i
LEFT JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE i.is_active = true
  -- Optionnel : filtrer par période ou gestionnaire
  AND i.date >= '2025-11-01'::date
  AND i.date < '2025-12-01'::date
  AND i.assigned_user_id IN (SELECT id FROM public.users WHERE username IN ('lucien', 'badr'))
GROUP BY i.id, i.id_inter
HAVING COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) > 0  -- Seulement les interventions avec CA
ORDER BY i.id_inter;






-- ========================================
-- Requête corrigée : inclut les marges négatives
-- ========================================
SELECT 
  i.id_inter,
  i.id as intervention_id,
  
  -- Coûts détaillés par type
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as cout_intervention,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'sst' THEN ic.amount ELSE 0 END), 0)::numeric as cout_sst,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'materiel' THEN ic.amount ELSE 0 END), 0)::numeric as cout_materiel,
  
  -- Chiffre d'affaires (CA) = somme des coûts de type 'intervention'
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
  
  -- Marge = CA - (SST + Matériel)
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
    - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge,
  
  -- Pourcentage de marge
  CASE 
    WHEN COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) > 0
    THEN ROUND(
      ((COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
        - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric)
       / COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 1)::numeric) * 100, 
      2
    )
    ELSE 
      -- Si CA = 0 mais coûts > 0, marge négative infinie (on met -100% pour indication)
      CASE 
        WHEN COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0) > 0
        THEN -100.00
        ELSE 0
      END
  END as marge_pourcentage

FROM public.interventions i
LEFT JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE i.is_active = true
  AND i.date >= '2025-11-01'::date
  AND i.date < '2025-12-01'::date
  AND i.assigned_user_id IN (SELECT id FROM public.users WHERE username IN ('lucien', 'badr'))
GROUP BY i.id, i.id_inter
-- SUPPRIMER le HAVING pour voir toutes les interventions, y compris celles avec marge négative
-- HAVING COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) > 0
ORDER BY marge ASC;  -- Trier par marge croissante pour voir les négatives en premier