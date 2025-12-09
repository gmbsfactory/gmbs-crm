-- ========================================
-- MIGRATION 00022: Correction de search_interventions
-- ========================================
-- Problème: La fonction search_interventions ne faisait pas de recherche ILIKE
-- sur les champs critiques (id_inter, artisan_plain_nom), seulement sur agence_label.
-- 
-- Solution: Ajouter des filtres ILIKE pour id_inter et artisan_plain_nom
-- ========================================

CREATE OR REPLACE FUNCTION search_interventions(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  id_inter text,
  contexte_intervention text,
  adresse text,
  ville text,
  agence_label text,
  artisan_plain_nom text,
  statut_label text,
  statut_color text,
  date_formatted text,
  rank real
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_query_normalized text;
  v_tsquery_full tsquery;
  v_tsquery_prefix tsquery;
BEGIN
  -- Normaliser la requête
  v_query_normalized := trim(lower(unaccent(p_query)));
  
  -- Si la requête est vide, retourner vide
  IF v_query_normalized = '' THEN
    RETURN;
  END IF;
  
  -- Créer deux types de requêtes :
  -- 1. Requête full-text standard (pour correspondances exactes)
  -- 2. Requête avec préfixe (pour correspondances partielles comme "Flat" -> "Flatlooker")
  BEGIN
    v_tsquery_full := websearch_to_tsquery('french', unaccent(p_query));
    -- Pour les préfixes, on ajoute :* à chaque terme
    -- Exemple: "Flat" devient "Flat:*" qui match "Flat", "Flatlooker", "Flatiron", etc.
    -- On remplace les espaces par " & " pour l'opérateur AND
    v_tsquery_prefix := to_tsquery('french', 
      regexp_replace(
        regexp_replace(unaccent(p_query), '''', '', 'g'),  -- Enlever les apostrophes
        '\s+', ':* & ', 'g'  -- Remplacer espaces par ":* & "
      ) || ':*'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si la création de la requête échoue, utiliser une recherche ILIKE simple
    RETURN QUERY
    SELECT
      isv.id,
      isv.id_inter,
      isv.contexte_intervention,
      isv.adresse,
      isv.ville,
      isv.agence_label,
      isv.artisan_plain_nom,
      isv.statut_label,
      isv.statut_color,
      isv.date_formatted,
      1.0::real AS rank
    FROM interventions_search_mv isv
    WHERE 
      isv.id_inter ILIKE '%' || p_query || '%'
      OR isv.agence_label ILIKE '%' || p_query || '%'
      OR isv.artisan_plain_nom ILIKE '%' || p_query || '%'
      OR isv.contexte_intervention ILIKE '%' || p_query || '%'
      OR isv.adresse ILIKE '%' || p_query || '%'
      OR isv.ville ILIKE '%' || p_query || '%'
      OR isv.tenant_firstname ILIKE '%' || p_query || '%'
      OR isv.tenant_lastname ILIKE '%' || p_query || '%'
    ORDER BY 
      CASE 
        WHEN isv.id_inter ILIKE '%' || p_query || '%' THEN 1
        WHEN isv.artisan_plain_nom ILIKE '%' || p_query || '%' THEN 2
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 3
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 4
        ELSE 5
      END,
      isv.date DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END;
  
  -- Recherche combinée : full-text + préfixe + ILIKE pour tous les champs critiques
  RETURN QUERY
  SELECT
    isv.id,
    isv.id_inter,
    isv.contexte_intervention,
    isv.adresse,
    isv.ville,
    isv.agence_label,
    isv.artisan_plain_nom,
    isv.statut_label,
    isv.statut_color,
    isv.date_formatted,
    GREATEST(
      -- Score full-text standard
      COALESCE(ts_rank(isv.search_vector, v_tsquery_full), 0),
      -- Score avec préfixe (légèrement réduit pour favoriser les correspondances exactes)
      COALESCE(ts_rank(isv.search_vector, v_tsquery_prefix) * 0.9, 0),
      -- Bonus pour correspondance dans id_inter (CRITIQUE - priorité maximale)
      CASE 
        WHEN isv.id_inter ILIKE '%' || p_query || '%' THEN 0.8
        ELSE 0
      END,
      -- Bonus pour correspondance dans artisan_plain_nom (CRITIQUE)
      CASE 
        WHEN isv.artisan_plain_nom ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0
      END,
      -- Bonus pour correspondance dans agence_label
      CASE 
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 0.5
        ELSE 0
      END,
      -- Bonus pour correspondance dans contexte_intervention
      CASE 
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 0.4
        ELSE 0
      END,
      -- Bonus pour correspondance dans tenant (nom du client)
      CASE 
        WHEN isv.tenant_firstname ILIKE '%' || p_query || '%' THEN 0.4
        WHEN isv.tenant_lastname ILIKE '%' || p_query || '%' THEN 0.4
        ELSE 0
      END,
      -- Bonus pour correspondance dans ville/adresse
      CASE 
        WHEN isv.ville ILIKE '%' || p_query || '%' THEN 0.3
        WHEN isv.adresse ILIKE '%' || p_query || '%' THEN 0.3
        ELSE 0
      END
    )::real AS rank
  FROM interventions_search_mv isv
  WHERE 
    -- Correspondance full-text standard
    (isv.search_vector @@ v_tsquery_full)
    -- OU correspondance avec préfixe
    OR (isv.search_vector @@ v_tsquery_prefix)
    -- OU correspondance partielle dans id_inter (CRITIQUE)
    OR (isv.id_inter ILIKE '%' || p_query || '%')
    -- OU correspondance partielle dans artisan_plain_nom (CRITIQUE)
    OR (isv.artisan_plain_nom ILIKE '%' || p_query || '%')
    -- OU correspondance partielle dans agence_label
    OR (isv.agence_label ILIKE '%' || p_query || '%')
    -- OU correspondance partielle dans contexte_intervention
    OR (isv.contexte_intervention ILIKE '%' || p_query || '%')
    -- OU correspondance partielle dans tenant (nom du client)
    OR (isv.tenant_firstname ILIKE '%' || p_query || '%')
    OR (isv.tenant_lastname ILIKE '%' || p_query || '%')
    -- OU correspondance partielle dans ville/adresse
    OR (isv.ville ILIKE '%' || p_query || '%')
    OR (isv.adresse ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, isv.date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_interventions IS
'Recherche full-text dans les interventions avec score de pertinence.
CORRIGÉ: Ajoute des recherches ILIKE sur tous les champs critiques:
  - id_inter (ID intervention)
  - artisan_plain_nom (nom de l''artisan)
  - agence_label (nom de l''agence)
  - contexte_intervention
  - tenant_firstname/lastname (nom du client)
  - ville/adresse
Paramètres:
  - p_query: Termes de recherche
  - p_limit: Nombre de résultats max (défaut: 20)
  - p_offset: Offset pour pagination (défaut: 0)
Retourne les interventions triées par pertinence puis date.';

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================

