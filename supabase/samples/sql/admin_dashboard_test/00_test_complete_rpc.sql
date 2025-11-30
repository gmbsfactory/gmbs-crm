-- ========================================
-- Test complet de la fonction RPC V2.0
-- ========================================
-- Compare les résultats de la fonction RPC avec les CTEs individuelles
-- Utilise les mêmes paramètres que l'application
-- V2.0: Ajout Cycle Time, Sparklines, Deltas, Filtres optionnels

SELECT public.get_admin_dashboard_stats_v2(
  '2025-01-01T00:00:00Z'::timestamptz,
  '2026-01-01T00:00:00Z'::timestamptz,
  'DEMANDE',
  'DEVIS_ENVOYE',
  'ACCEPTE',
  'INTER_EN_COURS',
  'INTER_TERMINEE',
  'ATT_ACOMPTE',
  ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'],
  NULL::uuid,  -- p_agence_id
  NULL::uuid,  -- p_gestionnaire_id
  NULL::uuid   -- p_metier_id
) as rpc_result;

-- Afficher le résultat formaté
SELECT 
  jsonb_pretty(
    public.get_admin_dashboard_stats(
      '2025-01-01T00:00:00Z'::timestamptz,
      '2026-01-01T00:00:00Z'::timestamptz,
      'DEMANDE',
      'DEVIS_ENVOYE',
      'ACCEPTE',
      'INTER_EN_COURS',
      'INTER_TERMINEE',
      'ATT_ACOMPTE',
      ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'],
      NULL::uuid,
      NULL::uuid,
      NULL::uuid
    )
  ) as rpc_result_formatted;

-- Test avec filtres optionnels
-- Test avec filtre agence
SELECT 
  jsonb_pretty(
    public.get_admin_dashboard_stats(
      '2025-01-01T00:00:00Z'::timestamptz,
      '2026-01-01T00:00:00Z'::timestamptz,
      'DEMANDE',
      'DEVIS_ENVOYE',
      'ACCEPTE',
      'INTER_EN_COURS',
      'INTER_TERMINEE',
      'ATT_ACOMPTE',
      ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'],
      (SELECT id FROM public.agencies LIMIT 1),  -- p_agence_id
      NULL::uuid,
      NULL::uuid
    )
  ) as rpc_result_with_agence_filter;

-- Test avec filtre gestionnaire
SELECT 
  jsonb_pretty(
    public.get_admin_dashboard_stats(
      '2025-01-01T00:00:00Z'::timestamptz,
      '2026-01-01T00:00:00Z'::timestamptz,
      'DEMANDE',
      'DEVIS_ENVOYE',
      'ACCEPTE',
      'INTER_EN_COURS',
      'INTER_TERMINEE',
      'ATT_ACOMPTE',
      ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'],
      NULL::uuid,
      (SELECT id FROM public.users WHERE assigned_user_id IS NOT NULL LIMIT 1),  -- p_gestionnaire_id
      NULL::uuid
    )
  ) as rpc_result_with_gestionnaire_filter;

