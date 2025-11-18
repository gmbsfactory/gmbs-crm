-- ========================================
-- Test complet de la fonction RPC
-- ========================================
-- Compare les résultats de la fonction RPC avec les CTEs individuelles
-- Utilise les mêmes paramètres que l'application

SELECT public.get_admin_dashboard_stats(
  '2025-01-01T00:00:00Z'::timestamptz,
  '2026-01-01T00:00:00Z'::timestamptz,
  'DEMANDE',
  'DEVIS_ENVOYE',
  'ACCEPTE',
  'INTER_EN_COURS',
  'INTER_TERMINEE',
  'ATT_ACOMPTE',
  ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE']
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
      ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE']
    )
  ) as rpc_result_formatted;

