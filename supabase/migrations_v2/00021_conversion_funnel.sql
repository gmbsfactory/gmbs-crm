-- Migration 00021: Fonction de Conversion Funnel
-- Calcule les taux de conversion réels entre chaque étape du funnel

CREATE OR REPLACE FUNCTION get_conversion_funnel(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_agence_id uuid DEFAULT NULL,
  p_gestionnaire_id uuid DEFAULT NULL,
  p_metier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- CTE pour compter les interventions ayant atteint chaque statut
  WITH status_reached AS (
    SELECT
      DISTINCT ON (ist.intervention_id, ist.to_status_code)
      ist.intervention_id,
      ist.to_status_code,
      MIN(ist.transition_date) OVER (
        PARTITION BY ist.intervention_id, ist.to_status_code
      ) as first_reached_at
    FROM intervention_status_transitions ist
    INNER JOIN interventions i ON i.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  ),
  counts AS (
    SELECT
      'DEMANDE' as status_code,
      COUNT(*) as count,
      NULL::numeric as conversion_rate_from_previous
    FROM status_reached
    WHERE to_status_code = 'DEMANDE'

    UNION ALL

    SELECT
      'DEVIS_ENVOYE' as status_code,
      COUNT(*) as count,
      ROUND(
        COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'DEMANDE'),
          0
        ), 1
      ) as conversion_rate_from_previous
    FROM status_reached
    WHERE to_status_code = 'DEVIS_ENVOYE'

    UNION ALL

    SELECT
      'ACCEPTE' as status_code,
      COUNT(*) as count,
      ROUND(
        COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'DEVIS_ENVOYE'),
          0
        ), 1
      ) as conversion_rate_from_previous
    FROM status_reached
    WHERE to_status_code = 'ACCEPTE'

    UNION ALL

    SELECT
      'INTER_EN_COURS' as status_code,
      COUNT(*) as count,
      ROUND(
        COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'ACCEPTE'),
          0
        ), 1
      ) as conversion_rate_from_previous
    FROM status_reached
    WHERE to_status_code IN ('INTER_EN_COURS', 'EN_COURS')

    UNION ALL

    SELECT
      'INTER_TERMINEE' as status_code,
      COUNT(*) as count,
      ROUND(
        COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM status_reached WHERE to_status_code IN ('INTER_EN_COURS', 'EN_COURS')),
          0
        ), 1
      ) as conversion_rate_from_previous
    FROM status_reached
    WHERE to_status_code IN ('INTER_TERMINEE', 'TERMINE')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'statusCode', status_code,
      'count', count,
      'conversionRate', conversion_rate_from_previous
    )
    ORDER BY
      CASE status_code
        WHEN 'DEMANDE' THEN 1
        WHEN 'DEVIS_ENVOYE' THEN 2
        WHEN 'ACCEPTE' THEN 3
        WHEN 'INTER_EN_COURS' THEN 4
        WHEN 'INTER_TERMINEE' THEN 5
      END
  ) INTO v_result
  FROM counts;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION get_conversion_funnel IS 'Calcule les taux de conversion entre chaque étape du funnel de vente';
