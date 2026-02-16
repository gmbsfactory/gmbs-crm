-- Migration: Fonction RPC pour compter les interventions groupées par colonne
-- Remplace ~29 requêtes HEAD individuelles par 1 seule requête POST par propriété

CREATE OR REPLACE FUNCTION get_intervention_filter_counts(
  p_group_column TEXT,
  p_statut_id UUID DEFAULT NULL,
  p_agence_id UUID DEFAULT NULL,
  p_metier_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
) RETURNS TABLE(group_value TEXT, cnt BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Valider le nom de colonne (protection injection SQL)
  IF p_group_column NOT IN ('metier_id', 'agence_id', 'statut_id', 'assigned_user_id') THEN
    RAISE EXCEPTION 'Colonne non autorisee: %', p_group_column;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT %I::TEXT, COUNT(*)
     FROM interventions
     WHERE is_active = true
       AND ($1 IS NULL OR statut_id = $1)
       AND ($2 IS NULL OR agence_id = $2)
       AND ($3 IS NULL OR metier_id = $3)
       AND ($4 IS NULL OR assigned_user_id = $4)
       AND ($5 IS NULL OR date >= $5::DATE)
       AND ($6 IS NULL OR date <= $6::DATE)
       AND %I IS NOT NULL
     GROUP BY %I',
    p_group_column, p_group_column, p_group_column
  )
  USING p_statut_id, p_agence_id, p_metier_id, p_user_id, p_start_date, p_end_date;
END;
$$;
