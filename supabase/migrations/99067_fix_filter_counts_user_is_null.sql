-- Migration: corriger le comptage des filtres pour la contrainte « non-assignée »
--
-- Bug : sur la vue Market (statut=DEMANDE + attribueA is_empty), la puce de
-- filtre agence affichait un compteur gonflé (ex: Matera « 9 ») alors que la
-- liste n'affichait que les interventions réellement non-assignées (ex: 2).
--
-- Cause : get_intervention_filter_counts (migration 00087) ne pouvait pas
-- exprimer « assigned_user_id IS NULL ». Le paramètre p_user_id surchargeait
-- NULL pour signifier À LA FOIS « pas de filtre utilisateur » ET « non-assignée »
-- (condition « $4 IS NULL OR assigned_user_id = $4 » → vraie pour toutes les
-- lignes quand p_user_id est NULL). La contrainte « non-assignée » de la vue
-- Market était donc silencieusement abandonnée dans le comptage, contrairement
-- au chemin liste (Edge Function) qui possède déjà un booléen p_user_is_null.
--
-- Fix : ajouter un paramètre p_user_is_null (miroir du chemin liste). Quand il
-- est vrai, on filtre assigned_user_id IS NULL ; sinon on garde le comportement
-- historique (filtre par UUID, ou aucun filtre si p_user_id est NULL).
--
-- Note : la signature change (nouveau paramètre) → DROP avant CREATE, sinon
-- PostgreSQL crée une surcharge ambiguë au lieu de remplacer la fonction.

DROP FUNCTION IF EXISTS get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_intervention_filter_counts(
  p_group_column TEXT,
  p_statut_id UUID DEFAULT NULL,
  p_agence_id UUID DEFAULT NULL,
  p_metier_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_is_null BOOLEAN DEFAULT FALSE,
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
       AND (CASE WHEN $7 THEN assigned_user_id IS NULL
                 ELSE ($4 IS NULL OR assigned_user_id = $4) END)
       AND ($5 IS NULL OR date >= $5::DATE)
       AND ($6 IS NULL OR date <= $6::DATE)
       AND %I IS NOT NULL
     GROUP BY %I',
    p_group_column, p_group_column, p_group_column
  )
  USING p_statut_id, p_agence_id, p_metier_id, p_user_id, p_start_date, p_end_date, p_user_is_null;
END;
$$;

-- Préserver l'exposition existante (RPC appelé côté client pour les compteurs
-- de filtres). Le DROP a retiré les grants ; on les restaure explicitement.
GRANT EXECUTE ON FUNCTION get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, BOOLEAN, TEXT, TEXT) TO anon, authenticated;
