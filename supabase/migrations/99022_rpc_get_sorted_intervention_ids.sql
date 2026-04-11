-- RPC: get_sorted_intervention_ids
-- Retourne les IDs d'interventions triés, avec support du tri sur
-- les colonnes de coûts (via intervention_costs_cache).
--
-- Le mapping propriété frontend → colonne DB est géré ici (whitelist stricte).
-- Les propriétés non reconnues tombent sur le tri par défaut (created_at DESC).

CREATE OR REPLACE FUNCTION public.get_sorted_intervention_ids(
  p_sort_property text DEFAULT NULL,
  p_sort_dir text DEFAULT 'desc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  -- Filtres existants (optionnels)
  p_statut_ids uuid[] DEFAULT NULL,
  p_agence_id uuid DEFAULT NULL,
  p_metier_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_user_is_null boolean DEFAULT false,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  intervention_id uuid,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_order_column text;
  v_order_asc boolean;
  v_needs_cost_join boolean := false;
BEGIN
  -- Whitelist stricte : mapping propriété frontend → colonne DB
  v_order_column := CASE p_sort_property
    -- Colonnes directes table interventions
    WHEN 'date'              THEN 'i.created_at'
    WHEN 'created_at'        THEN 'i.created_at'
    WHEN 'dateIntervention'  THEN 'i.date'
    WHEN 'datePrevue'        THEN 'i.date_prevue'
    WHEN 'date_prevue'       THEN 'i.date_prevue'
    WHEN 'date_termine'      THEN 'i.date_termine'
    WHEN 'due_date'          THEN 'i.due_date'
    WHEN 'id_inter'          THEN 'i.id_inter'
    WHEN 'updated_at'        THEN 'i.updated_at'
    -- Colonnes via intervention_costs_cache
    WHEN 'coutIntervention'  THEN 'cc.total_ca'
    WHEN 'coutSST'           THEN 'cc.total_sst'
    WHEN 'coutMateriel'      THEN 'cc.total_materiel'
    WHEN 'marge'             THEN 'cc.total_marge'
    -- Défaut
    ELSE 'i.created_at'
  END;

  v_needs_cost_join := v_order_column LIKE 'cc.%';
  v_order_asc := COALESCE(p_sort_dir, 'desc') = 'asc';

  RETURN QUERY EXECUTE format(
    'SELECT i.id AS intervention_id, count(*) OVER() AS total_count
     FROM public.interventions i
     %s
     WHERE i.is_active = true
       %s %s %s %s %s %s
     ORDER BY %s %s NULLS LAST, i.id DESC
     LIMIT %s OFFSET %s',
    -- LEFT JOIN conditionnel
    CASE WHEN v_needs_cost_join
      THEN 'LEFT JOIN public.intervention_costs_cache cc ON cc.intervention_id = i.id'
      ELSE ''
    END,
    -- Filtres conditionnels
    CASE WHEN p_statut_ids IS NOT NULL
      THEN format('AND i.statut_id = ANY(%L::uuid[])', p_statut_ids)
      ELSE ''
    END,
    CASE WHEN p_agence_id IS NOT NULL
      THEN format('AND i.agence_id = %L', p_agence_id)
      ELSE ''
    END,
    CASE WHEN p_metier_ids IS NOT NULL
      THEN format('AND i.metier_id = ANY(%L::uuid[])', p_metier_ids)
      ELSE ''
    END,
    CASE WHEN p_user_is_null
      THEN 'AND i.assigned_user_id IS NULL'
      WHEN p_user_id IS NOT NULL
      THEN format('AND i.assigned_user_id = %L', p_user_id)
      ELSE ''
    END,
    CASE WHEN p_start_date IS NOT NULL
      THEN format('AND i.date >= %L', p_start_date)
      ELSE ''
    END,
    CASE WHEN p_end_date IS NOT NULL
      THEN format('AND i.date <= %L', p_end_date)
      ELSE ''
    END,
    -- ORDER BY
    v_order_column,
    CASE WHEN v_order_asc THEN 'ASC' ELSE 'DESC' END,
    -- LIMIT / OFFSET
    p_limit,
    p_offset
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_sorted_intervention_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sorted_intervention_ids TO service_role;
