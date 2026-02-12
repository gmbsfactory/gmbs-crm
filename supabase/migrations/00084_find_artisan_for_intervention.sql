-- ===== RPC: Trouver les artisans les plus adaptes pour une intervention =====
-- Recherche par metier + zone (departement), priorise les artisans du gestionnaire,
-- puis trie par nombre d'interventions terminees.
-- Utilisee par l'Edge Function ai-contextual-action (action find_artisan).

CREATE OR REPLACE FUNCTION find_artisans_for_intervention(
  p_metier_code text,
  p_code_postal text,
  p_gestionnaire_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  artisan_id uuid,
  artisan_nom text,
  artisan_prenom text,
  artisan_raison_sociale text,
  artisan_telephone text,
  artisan_email text,
  artisan_numero_associe text,
  artisan_ville text,
  artisan_code_postal text,
  artisan_statut text,
  is_gestionnaire_artisan boolean,
  interventions_terminees bigint,
  interventions_totales bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH artisan_inter_stats AS (
    SELECT
      ia.artisan_id AS aid,
      COUNT(DISTINCT i.id) FILTER (
        WHERE i.statut_code IN ('INTER_TERMINEE', 'INTER_FACTUREE')
      ) AS terminated,
      COUNT(DISTINCT i.id) AS total
    FROM intervention_artisans ia
    INNER JOIN interventions i ON ia.intervention_id = i.id AND i.is_active = true
    GROUP BY ia.artisan_id
  )
  SELECT
    a.id,
    a.nom,
    a.prenom,
    a.raison_sociale,
    a.telephone,
    a.email,
    a.numero_associe,
    a.ville_intervention,
    a.code_postal_intervention,
    ast.label,
    COALESCE(a.gestionnaire_id = p_gestionnaire_id, false),
    COALESCE(ais.terminated, 0),
    COALESCE(ais.total, 0)
  FROM artisans a
  INNER JOIN artisan_metiers am ON a.id = am.artisan_id
  INNER JOIN metiers m ON am.metier_id = m.id
  INNER JOIN artisan_statuses ast ON a.statut_id = ast.id
  LEFT JOIN artisan_inter_stats ais ON a.id = ais.aid
  WHERE m.code = p_metier_code
    AND a.is_active = true
    AND ast.label NOT ILIKE '%archiv%'
    AND LEFT(COALESCE(a.code_postal_intervention, ''), 2) = LEFT(p_code_postal, 2)
  ORDER BY
    COALESCE(a.gestionnaire_id = p_gestionnaire_id, false) DESC,
    COALESCE(ais.terminated, 0) DESC,
    COALESCE(ais.total, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
