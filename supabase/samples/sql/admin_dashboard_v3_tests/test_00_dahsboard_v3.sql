SELECT public.get_admin_dashboard_stats_v3(
  '2025-01-01T00:00:00Z'::timestamp,  -- Note: TIMESTAMP not TIMESTAMPTZ
  '2026-01-01T00:00:00Z'::timestamp,  -- Note: TIMESTAMP not TIMESTAMPTZ
  NULL::uuid,  -- p_agence_id
  NULL::uuid,  -- p_metier_id
  NULL::uuid,  -- p_gestionnaire_id
  10,          -- p_top_gestionnaires (optional)
  10           -- p_top_agences (optional)
) as rpc_result;