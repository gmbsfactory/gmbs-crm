-- Migration 00022: Fonction Top Artisans Performance
-- Retourne le top 5 des artisans par marge générée

CREATE OR REPLACE FUNCTION get_top_artisans(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer DEFAULT 5,
  p_agence_id uuid DEFAULT NULL,
  p_metier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH artisan_stats AS (
    SELECT
      ia.artisan_id,
      a.nom as artisan_name,
      a.prenom as artisan_firstname,
      COUNT(DISTINCT i.id) as nb_interventions,
      COUNT(DISTINCT CASE
        WHEN isc.current_status_code IN ('INTER_TERMINEE', 'TERMINE')
        THEN i.id
      END) as nb_terminees,
      COALESCE(SUM(icc.total_ca), 0) as total_ca,
      COALESCE(SUM(icc.total_marge), 0) as total_marge,
      ROUND(
        COALESCE(SUM(icc.total_marge) * 100.0 / NULLIF(SUM(icc.total_ca), 0), 0),
        1
      ) as taux_marge
    FROM intervention_artisans ia
    INNER JOIN artisans a ON a.id = ia.artisan_id
    INNER JOIN interventions i ON i.id = ia.intervention_id
    LEFT JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = i.id
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
    GROUP BY ia.artisan_id, a.nom, a.prenom
    ORDER BY total_marge DESC
    LIMIT p_limit
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'artisanId', artisan_id,
      'artisanName', artisan_name || ' ' || artisan_firstname,
      'nbInterventions', nb_interventions,
      'nbTerminees', nb_terminees,
      'ca', total_ca,
      'marge', total_marge,
      'tauxMarge', taux_marge
    )
  ) INTO v_result
  FROM artisan_stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION get_top_artisans IS 'Retourne le top N artisans classés par marge générée sur une période donnée';
