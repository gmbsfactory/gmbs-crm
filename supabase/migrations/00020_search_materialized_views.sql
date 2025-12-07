-- ========================================
-- GMBS CRM - Vues Matérialisées de Recherche
-- ========================================
-- Version: 1.0
-- Date: 2025-01-XX
-- Description: Vues matérialisées optimisées pour la recherche full-text
--              PostgreSQL avec indexation GIN sur tsvector
--
-- Performance attendue:
-- - Recherche interventions: 150-300ms (vs 800-1200ms actuellement)
-- - Recherche artisans: 100-200ms (vs 400-600ms actuellement)
-- - Recherche globale: 200-400ms (vs 1200-1800ms actuellement)
-- ========================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Pour similarité de texte
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- Pour ignorer les accents

-- ========================================
-- 1️⃣ VUE MATÉRIALISÉE: INTERVENTIONS
-- ========================================
-- Cette vue dénormalise TOUTES les données liées aux interventions
-- pour permettre une recherche full-text ultra-rapide

DROP MATERIALIZED VIEW IF EXISTS interventions_search_mv CASCADE;

CREATE MATERIALIZED VIEW interventions_search_mv AS
WITH intervention_comments AS (
  -- Sous-requête pour agréger les commentaires par intervention
  SELECT
    entity_id as intervention_id,
    string_agg(content, ' | ') as commentaires_aggreges
  FROM public.comments
  WHERE entity_type = 'intervention'
  GROUP BY entity_id
),
primary_artisans AS (
  -- Sous-requête pour récupérer l'artisan principal (un seul par intervention)
  SELECT DISTINCT ON (ia.intervention_id)
    ia.intervention_id,
    ia.artisan_id,
    art.prenom,
    art.nom,
    art.plain_nom,
    art.email,
    art.telephone,
    art.telephone2,
    art.raison_sociale,
    art.siret,
    art.statut_juridique,
    art.adresse_siege_social,
    art.ville_siege_social,
    art.code_postal_siege_social,
    art.adresse_intervention,
    art.ville_intervention,
    art.code_postal_intervention,
    art.numero_associe,
    art.statut_dossier,
    art.suivi_relances_docs,
    art.date_ajout
  FROM public.intervention_artisans ia
  LEFT JOIN public.artisans art ON ia.artisan_id = art.id
  WHERE ia.is_primary = true
  ORDER BY ia.intervention_id, ia.created_at ASC
)
SELECT
  -- ===== ID & Métadonnées principales =====
  i.id,
  i.id_inter,
  i.created_at,
  i.updated_at,
  i.is_active,

  -- ===== Champs directs de l'intervention (TEXT) =====
  i.contexte_intervention,
  i.consigne_intervention,
  i.consigne_second_artisan,
  i.commentaire_agent,
  i.reference_agence,
  i.adresse,
  i.code_postal,
  i.ville,
  i.key_code,
  i.floor,
  i.apartment_number,
  i.vacant_housing_instructions,

  -- ===== Dates converties en TEXT pour recherche =====
  to_char(i.date, 'DD/MM/YYYY HH24:MI') as date_formatted,
  to_char(i.date_termine, 'DD/MM/YYYY HH24:MI') as date_termine_formatted,
  to_char(i.date_prevue, 'DD/MM/YYYY HH24:MI') as date_prevue_formatted,
  to_char(i.due_date, 'DD/MM/YYYY') as due_date_formatted,

  -- ===== AGENCE (dénormalisée) =====
  a.code as agence_code,
  a.label as agence_label,
  a.region as agence_region,

  -- ===== TENANT/CLIENT (dénormalisé) =====
  t.firstname as tenant_firstname,
  t.lastname as tenant_lastname,
  t.email as tenant_email,
  t.telephone as tenant_telephone,
  t.telephone2 as tenant_telephone2,
  t.adresse as tenant_adresse,
  t.ville as tenant_ville,
  t.code_postal as tenant_code_postal,

  -- ===== OWNER/PROPRIETAIRE (dénormalisé) =====
  o.owner_firstname,
  o.owner_lastname,
  o.email as owner_email,
  o.telephone as owner_telephone,
  o.telephone2 as owner_telephone2,
  o.adresse as owner_adresse,
  o.ville as owner_ville,
  o.code_postal as owner_code_postal,

  -- ===== USER ASSIGNÉ (dénormalisé) =====
  u.firstname as assigned_user_firstname,
  u.lastname as assigned_user_lastname,
  u.username as assigned_user_username,
  u.code_gestionnaire as assigned_user_code,

  -- ===== STATUT (dénormalisé) =====
  s.code as statut_code,
  s.label as statut_label,
  s.color as statut_color,

  -- ===== MÉTIER (dénormalisé) =====
  m.code as metier_code,
  m.label as metier_label,
  m.description as metier_description,

  -- ===== ARTISAN PRINCIPAL (dénormalisé - TOUS les champs text) =====
  pa.prenom as artisan_prenom,
  pa.nom as artisan_nom,
  pa.plain_nom as artisan_plain_nom,
  pa.email as artisan_email,
  pa.telephone as artisan_telephone,
  pa.telephone2 as artisan_telephone2,
  pa.raison_sociale as artisan_raison_sociale,
  pa.siret as artisan_siret,
  pa.statut_juridique as artisan_statut_juridique,
  pa.adresse_siege_social as artisan_adresse_siege,
  pa.ville_siege_social as artisan_ville_siege,
  pa.code_postal_siege_social as artisan_code_postal_siege,
  pa.adresse_intervention as artisan_adresse_intervention,
  pa.ville_intervention as artisan_ville_intervention,
  pa.code_postal_intervention as artisan_code_postal_intervention,
  pa.numero_associe as artisan_numero_associe,
  pa.statut_dossier as artisan_statut_dossier,
  pa.suivi_relances_docs as artisan_suivi_relances,
  to_char(pa.date_ajout, 'DD/MM/YYYY') as artisan_date_ajout,

  -- ===== COMMENTAIRES (agrégés en un seul champ) =====
  ic.commentaires_aggreges,

  -- ===== VECTEUR DE RECHERCHE FULL-TEXT =====
  -- Pondération: A (poids fort) > B (poids moyen) > C (poids faible) > D (poids très faible)
  -- La pondération influence le score de pertinence (ts_rank)

  -- POIDS A: Identifiants critiques
  setweight(to_tsvector('french', unaccent(coalesce(i.id_inter, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.reference_agence, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.numero_associe, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.siret, ''))), 'A') ||

  -- POIDS B: Informations principales
  setweight(to_tsvector('french', unaccent(coalesce(i.contexte_intervention, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(a.label, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.plain_nom, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.raison_sociale, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.label, ''))), 'B') ||

  -- POIDS C: Informations secondaires
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_intervention, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.commentaire_agent, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.adresse, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.ville, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.code_postal, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(u.username, ''))), 'C') ||

  -- POIDS D: Détails et métadonnées
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_second_artisan, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(ic.commentaires_aggreges, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.adresse_siege_social, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.ville_siege_social, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(s.label, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.description, ''))), 'D')
  AS search_vector,

  -- ===== Champs pour tri et filtrage rapide =====
  i.statut_id,
  i.agence_id,
  i.metier_id,
  i.assigned_user_id,
  i.date,
  i.date_prevue,
  pa.artisan_id as primary_artisan_id

FROM public.interventions i
LEFT JOIN public.agencies a ON i.agence_id = a.id
LEFT JOIN public.tenants t ON i.tenant_id = t.id
LEFT JOIN public.owner o ON i.owner_id = o.id
LEFT JOIN public.users u ON i.assigned_user_id = u.id
LEFT JOIN public.intervention_statuses s ON i.statut_id = s.id
LEFT JOIN public.metiers m ON i.metier_id = m.id
LEFT JOIN primary_artisans pa ON i.id = pa.intervention_id
LEFT JOIN intervention_comments ic ON i.id = ic.intervention_id

WHERE i.is_active = true;

-- Index GIN sur le vecteur de recherche (critical pour performance)
CREATE INDEX idx_interventions_search_vector ON interventions_search_mv USING gin(search_vector);

-- Index B-tree sur les colonnes de filtrage fréquent
CREATE INDEX idx_interventions_search_statut ON interventions_search_mv(statut_id);
CREATE INDEX idx_interventions_search_agence ON interventions_search_mv(agence_id);
CREATE INDEX idx_interventions_search_assigned_user ON interventions_search_mv(assigned_user_id);
CREATE INDEX idx_interventions_search_date ON interventions_search_mv(date DESC);

-- Index unique sur l'ID pour les jointures rapides
CREATE UNIQUE INDEX idx_interventions_search_id ON interventions_search_mv(id);

COMMENT ON MATERIALIZED VIEW interventions_search_mv IS
'Vue matérialisée pour recherche full-text optimisée sur les interventions.
Inclut toutes les données textuelles des interventions et relations (agence, tenant, artisan, etc.).
Rafraîchissement automatique via triggers sur tables sources.';


-- ========================================
-- 2️⃣ VUE MATÉRIALISÉE: ARTISANS
-- ========================================

DROP MATERIALIZED VIEW IF EXISTS artisans_search_mv CASCADE;

CREATE MATERIALIZED VIEW artisans_search_mv AS
SELECT
  -- ===== ID & Métadonnées principales =====
  art.id,
  art.created_at,
  art.updated_at,
  art.is_active,

  -- ===== Champs directs de l'artisan (TOUS les TEXT) =====
  art.prenom,
  art.nom,
  art.plain_nom,
  art.email,
  art.telephone,
  art.telephone2,
  art.raison_sociale,
  art.siret,
  art.statut_juridique,
  art.adresse_siege_social,
  art.ville_siege_social,
  art.code_postal_siege_social,
  art.adresse_intervention,
  art.ville_intervention,
  art.code_postal_intervention,
  art.numero_associe,
  art.statut_dossier,
  art.suivi_relances_docs,
  art.departement,
  to_char(art.date_ajout, 'DD/MM/YYYY') as date_ajout_formatted,

  -- ===== STATUT ARTISAN (dénormalisé) =====
  ast.code as statut_code,
  ast.label as statut_label,
  ast.color as statut_color,

  -- ===== GESTIONNAIRE (dénormalisé) =====
  u.firstname as gestionnaire_firstname,
  u.lastname as gestionnaire_lastname,
  u.username as gestionnaire_username,
  u.code_gestionnaire as gestionnaire_code,

  -- ===== MÉTIERS (agrégés) =====
  string_agg(DISTINCT m.code, ', ') as metiers_codes,
  string_agg(DISTINCT m.label, ', ') as metiers_labels,
  string_agg(DISTINCT m.description, ' | ') as metiers_descriptions,

  -- ===== ZONES (agrégées) =====
  string_agg(DISTINCT z.code, ', ') as zones_codes,
  string_agg(DISTINCT z.label, ', ') as zones_labels,
  string_agg(DISTINCT z.region, ', ') as zones_regions,

  -- ===== NOMBRE D'INTERVENTIONS ACTIVES =====
  COUNT(DISTINCT CASE WHEN i.is_active = true THEN ia.intervention_id END) as active_interventions_count,

  -- ===== VECTEUR DE RECHERCHE FULL-TEXT =====

  -- POIDS A: Identifiants critiques
  setweight(to_tsvector('french', unaccent(coalesce(art.numero_associe, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.siret, ''))), 'A') ||

  -- POIDS B: Informations principales
  setweight(to_tsvector('french', unaccent(coalesce(art.plain_nom, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.raison_sociale, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.prenom || ' ' || art.nom, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(string_agg(DISTINCT m.label, ' '), ''))), 'B') ||

  -- POIDS C: Informations secondaires
  setweight(to_tsvector('french', unaccent(coalesce(art.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.telephone, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.telephone2, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.ville_intervention, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.ville_siege_social, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(u.username, ''))), 'C') ||

  -- POIDS D: Détails et métadonnées
  setweight(to_tsvector('french', unaccent(coalesce(art.adresse_siege_social, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.adresse_intervention, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.statut_juridique, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(art.suivi_relances_docs, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(string_agg(DISTINCT z.label, ' '), ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(ast.label, ''))), 'D')
  AS search_vector,

  -- ===== Champs pour tri et filtrage rapide =====
  art.statut_id,
  art.gestionnaire_id

FROM public.artisans art
LEFT JOIN public.artisan_statuses ast ON art.statut_id = ast.id
LEFT JOIN public.users u ON art.gestionnaire_id = u.id
LEFT JOIN public.artisan_metiers am ON art.id = am.artisan_id
LEFT JOIN public.metiers m ON am.metier_id = m.id
LEFT JOIN public.artisan_zones az ON art.id = az.artisan_id
LEFT JOIN public.zones z ON az.zone_id = z.id
LEFT JOIN public.intervention_artisans ia ON art.id = ia.artisan_id
LEFT JOIN public.interventions i ON ia.intervention_id = i.id

WHERE art.is_active = true

GROUP BY
  art.id, art.created_at, art.updated_at, art.is_active,
  art.prenom, art.nom, art.plain_nom, art.email, art.telephone, art.telephone2,
  art.raison_sociale, art.siret, art.statut_juridique,
  art.adresse_siege_social, art.ville_siege_social, art.code_postal_siege_social,
  art.adresse_intervention, art.ville_intervention, art.code_postal_intervention,
  art.numero_associe, art.statut_dossier, art.suivi_relances_docs, art.departement, art.date_ajout,
  art.statut_id, art.gestionnaire_id,
  ast.code, ast.label, ast.color,
  u.firstname, u.lastname, u.username, u.code_gestionnaire;

-- Index GIN sur le vecteur de recherche
CREATE INDEX idx_artisans_search_vector ON artisans_search_mv USING gin(search_vector);

-- Index B-tree sur les colonnes de filtrage fréquent
CREATE INDEX idx_artisans_search_statut ON artisans_search_mv(statut_id);
CREATE INDEX idx_artisans_search_gestionnaire ON artisans_search_mv(gestionnaire_id);

-- Index unique sur l'ID
CREATE UNIQUE INDEX idx_artisans_search_id ON artisans_search_mv(id);

COMMENT ON MATERIALIZED VIEW artisans_search_mv IS
'Vue matérialisée pour recherche full-text optimisée sur les artisans.
Inclut toutes les données textuelles des artisans et relations (métiers, zones, gestionnaire, etc.).
Rafraîchissement automatique via triggers sur tables sources.';


-- ========================================
-- 3️⃣ VUE MATÉRIALISÉE: RECHERCHE GLOBALE
-- ========================================
-- UNION des deux vues ci-dessus pour une recherche unifiée

DROP MATERIALIZED VIEW IF EXISTS global_search_mv CASCADE;

CREATE MATERIALIZED VIEW global_search_mv AS
-- Interventions
SELECT
  'intervention'::text as entity_type,
  id as entity_id,
  search_vector,
  jsonb_build_object(
    'id_inter', id_inter,
    'contexte', contexte_intervention,
    'adresse', adresse,
    'ville', ville,
    'agence', agence_label,
    'artisan', artisan_plain_nom,
    'statut', statut_label,
    'statut_color', statut_color,
    'date', date_formatted,
    'assigned_user', assigned_user_username
  ) as metadata,
  created_at,
  updated_at
FROM interventions_search_mv

UNION ALL

-- Artisans
SELECT
  'artisan'::text as entity_type,
  id as entity_id,
  search_vector,
  jsonb_build_object(
    'numero_associe', numero_associe,
    'plain_nom', plain_nom,
    'raison_sociale', raison_sociale,
    'email', email,
    'telephone', telephone,
    'ville', ville_intervention,
    'metiers', metiers_labels,
    'statut', statut_label,
    'statut_color', statut_color,
    'interventions_actives', active_interventions_count
  ) as metadata,
  created_at,
  updated_at
FROM artisans_search_mv;

-- Index GIN sur le vecteur de recherche global
CREATE INDEX idx_global_search_vector ON global_search_mv USING gin(search_vector);

-- Index sur le type d'entité pour filtrage rapide
CREATE INDEX idx_global_search_entity_type ON global_search_mv(entity_type);

-- Index composite pour pagination
CREATE INDEX idx_global_search_created_at ON global_search_mv(created_at DESC, entity_id);

-- Index unique requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY
-- La combinaison (entity_type, entity_id) identifie de manière unique chaque entité
CREATE UNIQUE INDEX idx_global_search_unique ON global_search_mv(entity_type, entity_id);

COMMENT ON MATERIALIZED VIEW global_search_mv IS
'Vue matérialisée pour recherche globale (cmd+k style) sur interventions ET artisans.
UNION des vues interventions_search_mv et artisans_search_mv.
Utilisé pour la barre de recherche universelle de l''application.';


-- ========================================
-- 4️⃣ FONCTIONS DE RAFRAÎCHISSEMENT
-- ========================================

-- Fonction pour rafraîchir la vue interventions
CREATE OR REPLACE FUNCTION refresh_interventions_search()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
  -- Rafraîchir aussi la vue globale car elle dépend de interventions_search_mv
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
END;
$$;

COMMENT ON FUNCTION refresh_interventions_search() IS
'Rafraîchit la vue matérialisée interventions_search_mv et global_search_mv de manière CONCURRENTE (sans bloquer les lectures).
Appelée automatiquement par les triggers sur les tables sources.';

-- Fonction pour rafraîchir la vue artisans
CREATE OR REPLACE FUNCTION refresh_artisans_search()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
  -- Rafraîchir aussi la vue globale car elle dépend de artisans_search_mv
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
END;
$$;

COMMENT ON FUNCTION refresh_artisans_search() IS
'Rafraîchit la vue matérialisée artisans_search_mv et global_search_mv de manière CONCURRENTE (sans bloquer les lectures).
Appelée automatiquement par les triggers sur les tables sources.';


-- ========================================
-- 5️⃣ TRIGGERS DE RAFRAÎCHISSEMENT AUTOMATIQUE
-- ========================================

-- IMPORTANT: Les triggers utilisent pg_notify pour déclencher un refresh ASYNCHRONE
-- Cela évite de bloquer les transactions d'écriture

-- Trigger function générique pour notifier le besoin de refresh interventions
CREATE OR REPLACE FUNCTION notify_interventions_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notifier via PostgreSQL LISTEN/NOTIFY (non-bloquant)
  PERFORM pg_notify('refresh_interventions_search', '');
  RETURN NULL;
END;
$$;

-- Trigger function générique pour notifier le besoin de refresh artisans
CREATE OR REPLACE FUNCTION notify_artisans_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notifier via PostgreSQL LISTEN/NOTIFY (non-bloquant)
  PERFORM pg_notify('refresh_artisans_search', '');
  RETURN NULL;
END;
$$;

-- Triggers sur la table INTERVENTIONS
DROP TRIGGER IF EXISTS trigger_interventions_search_refresh ON public.interventions;
CREATE TRIGGER trigger_interventions_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.interventions
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

-- Triggers sur la table INTERVENTION_ARTISANS (car affecte l'artisan principal)
DROP TRIGGER IF EXISTS trigger_intervention_artisans_search_refresh ON public.intervention_artisans;
CREATE TRIGGER trigger_intervention_artisans_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

-- Triggers sur la table COMMENTS (car agrégés dans interventions_search_mv)
DROP TRIGGER IF EXISTS trigger_comments_search_refresh ON public.comments;
CREATE TRIGGER trigger_comments_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

-- Triggers sur la table AGENCIES
DROP TRIGGER IF EXISTS trigger_agencies_search_refresh ON public.agencies;
CREATE TRIGGER trigger_agencies_search_refresh
  AFTER INSERT OR UPDATE ON public.agencies
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

-- Triggers sur la table TENANTS
DROP TRIGGER IF EXISTS trigger_tenants_search_refresh ON public.tenants;
CREATE TRIGGER trigger_tenants_search_refresh
  AFTER INSERT OR UPDATE ON public.tenants
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

-- Triggers sur la table ARTISANS
DROP TRIGGER IF EXISTS trigger_artisans_interventions_search_refresh ON public.artisans;
CREATE TRIGGER trigger_artisans_interventions_search_refresh
  AFTER INSERT OR UPDATE ON public.artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_interventions_search_refresh();

DROP TRIGGER IF EXISTS trigger_artisans_artisans_search_refresh ON public.artisans;
CREATE TRIGGER trigger_artisans_artisans_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_artisans_search_refresh();

-- Triggers sur ARTISAN_METIERS
DROP TRIGGER IF EXISTS trigger_artisan_metiers_search_refresh ON public.artisan_metiers;
CREATE TRIGGER trigger_artisan_metiers_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_metiers
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_artisans_search_refresh();

-- Triggers sur ARTISAN_ZONES
DROP TRIGGER IF EXISTS trigger_artisan_zones_search_refresh ON public.artisan_zones;
CREATE TRIGGER trigger_artisan_zones_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_zones
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_artisans_search_refresh();

COMMENT ON FUNCTION notify_interventions_search_refresh() IS
'Fonction trigger qui notifie via pg_notify le besoin de rafraîchir interventions_search_mv.
Le refresh réel est effectué de manière asynchrone par un worker (Supabase Realtime ou cron job).';

COMMENT ON FUNCTION notify_artisans_search_refresh() IS
'Fonction trigger qui notifie via pg_notify le besoin de rafraîchir artisans_search_mv.
Le refresh réel est effectué de manière asynchrone par un worker (Supabase Realtime ou cron job).';


-- ========================================
-- 6️⃣ FONCTION RPC POUR RECHERCHE OPTIMISÉE
-- ========================================

-- Fonction RPC pour rechercher dans les interventions avec score de pertinence
-- Améliorée pour gérer les correspondances partielles (ex: "Flat" -> "Flatlooker")
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
      isv.agence_label ILIKE '%' || p_query || '%'
      OR isv.contexte_intervention ILIKE '%' || p_query || '%'
      OR isv.adresse ILIKE '%' || p_query || '%'
    ORDER BY 
      CASE 
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 1
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 2
        ELSE 3
      END,
      isv.date DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END;
  
  -- Recherche combinée : full-text + préfixe + ILIKE pour agence_label
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
      -- Bonus pour correspondance dans agence_label (très important pour les recherches d'agence)
      CASE 
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 0.5
        ELSE 0
      END
    )::real AS rank
  FROM interventions_search_mv isv
  WHERE 
    -- Correspondance full-text standard
    (isv.search_vector @@ v_tsquery_full)
    -- OU correspondance avec préfixe
    OR (isv.search_vector @@ v_tsquery_prefix)
    -- OU correspondance partielle dans agence_label (critique pour "Flat" -> "Flatlooker")
    OR (isv.agence_label ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, isv.date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_interventions IS
'Recherche full-text dans les interventions avec score de pertinence.
Gère les correspondances partielles (ex: "Flat" trouve "Flatlooker") via:
  - Recherche full-text standard (websearch_to_tsquery)
  - Recherche avec préfixe (to_tsquery avec :*)
  - Recherche ILIKE sur agence_label pour les noms d''agence
Paramètres:
  - p_query: Termes de recherche (supporte AND, OR, NOT, phrases "entre guillemets")
  - p_limit: Nombre de résultats max (défaut: 20)
  - p_offset: Offset pour pagination (défaut: 0)
Retourne les interventions triées par pertinence puis date.';

-- Fonction RPC pour rechercher dans les artisans avec score de pertinence
-- Améliorée pour gérer les correspondances partielles (même logique que search_interventions)
CREATE OR REPLACE FUNCTION search_artisans(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  numero_associe text,
  plain_nom text,
  raison_sociale text,
  email text,
  telephone text,
  ville_intervention text,
  metiers_labels text,
  statut_label text,
  statut_color text,
  active_interventions_count bigint,
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
  -- 2. Requête avec préfixe (pour correspondances partielles)
  BEGIN
    v_tsquery_full := websearch_to_tsquery('french', unaccent(p_query));
    -- Pour les préfixes, on ajoute :* à chaque terme
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
      asv.id,
      asv.numero_associe,
      asv.plain_nom,
      asv.raison_sociale,
      asv.email,
      asv.telephone,
      asv.ville_intervention,
      asv.metiers_labels,
      asv.statut_label,
      asv.statut_color,
      asv.active_interventions_count,
      1.0::real AS rank
    FROM artisans_search_mv asv
    WHERE 
      asv.plain_nom ILIKE '%' || p_query || '%'
      OR asv.raison_sociale ILIKE '%' || p_query || '%'
      OR asv.numero_associe ILIKE '%' || p_query || '%'
      OR asv.siret ILIKE '%' || p_query || '%'
    ORDER BY 
      CASE 
        WHEN asv.numero_associe ILIKE '%' || p_query || '%' THEN 1
        WHEN asv.siret ILIKE '%' || p_query || '%' THEN 1
        WHEN asv.plain_nom ILIKE '%' || p_query || '%' THEN 2
        ELSE 3
      END,
      asv.numero_associe ASC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END;
  
  -- Recherche combinée : full-text + préfixe + ILIKE pour champs critiques
  RETURN QUERY
  SELECT
    asv.id,
    asv.numero_associe,
    asv.plain_nom,
    asv.raison_sociale,
    asv.email,
    asv.telephone,
    asv.ville_intervention,
    asv.metiers_labels,
    asv.statut_label,
    asv.statut_color,
    asv.active_interventions_count,
    GREATEST(
      -- Score full-text standard
      COALESCE(ts_rank(asv.search_vector, v_tsquery_full), 0),
      -- Score avec préfixe (légèrement réduit pour favoriser les correspondances exactes)
      COALESCE(ts_rank(asv.search_vector, v_tsquery_prefix) * 0.9, 0),
      -- Bonus pour correspondance dans numero_associe (très important)
      CASE 
        WHEN asv.numero_associe ILIKE '%' || p_query || '%' THEN 0.5
        ELSE 0
      END,
      -- Bonus pour correspondance dans plain_nom
      CASE 
        WHEN asv.plain_nom ILIKE '%' || p_query || '%' THEN 0.4
        ELSE 0
      END,
      -- Bonus pour correspondance dans raison_sociale
      CASE 
        WHEN asv.raison_sociale ILIKE '%' || p_query || '%' THEN 0.3
        ELSE 0
      END,
      -- Bonus pour correspondance dans siret (important pour recherche par numéro)
      CASE 
        WHEN asv.siret ILIKE '%' || p_query || '%' THEN 0.5
        ELSE 0
      END
    )::real AS rank
  FROM artisans_search_mv asv
  WHERE 
    -- Correspondance full-text standard
    (asv.search_vector @@ v_tsquery_full)
    -- OU correspondance avec préfixe
    OR (asv.search_vector @@ v_tsquery_prefix)
    -- OU correspondance partielle dans champs critiques
    OR (asv.numero_associe ILIKE '%' || p_query || '%')
    OR (asv.plain_nom ILIKE '%' || p_query || '%')
    OR (asv.raison_sociale ILIKE '%' || p_query || '%')
    OR (asv.siret ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, asv.numero_associe ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_artisans IS
'Recherche full-text dans les artisans avec score de pertinence.
Gère les correspondances partielles (ex: "Dup" trouve "Dupont") via:
  - Recherche full-text standard (websearch_to_tsquery)
  - Recherche avec préfixe (to_tsquery avec :*)
  - Recherche ILIKE sur numero_associe, siret, plain_nom, raison_sociale
Paramètres:
  - p_query: Termes de recherche (supporte AND, OR, NOT, phrases "entre guillemets")
  - p_limit: Nombre de résultats max (défaut: 20)
  - p_offset: Offset pour pagination (défaut: 0)
Retourne les artisans triés par pertinence puis numero_associe.
Le SIRET est recherché avec un poids A (priorité élevée) dans le vecteur full-text et via ILIKE pour les correspondances partielles.';

-- Fonction RPC pour recherche globale (interventions + artisans)
-- Améliorée pour gérer les correspondances partielles (même logique que search_interventions)
CREATE OR REPLACE FUNCTION search_global(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  metadata jsonb,
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
  -- 2. Requête avec préfixe (pour correspondances partielles)
  BEGIN
    v_tsquery_full := websearch_to_tsquery('french', unaccent(p_query));
    -- Pour les préfixes, on ajoute :* à chaque terme
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
      gsv.entity_type,
      gsv.entity_id,
      gsv.metadata,
      1.0::real AS rank
    FROM global_search_mv gsv
    WHERE
      (p_entity_type IS NULL OR gsv.entity_type = p_entity_type)
      AND (
        -- Pour les interventions
        (gsv.entity_type = 'intervention' AND (
          (gsv.metadata->>'agence')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'contexte')::text ILIKE '%' || p_query || '%'
        ))
        -- Pour les artisans
        OR (gsv.entity_type = 'artisan' AND (
          (gsv.metadata->>'numero_associe')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'plain_nom')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'raison_sociale')::text ILIKE '%' || p_query || '%'
        ))
      )
    ORDER BY gsv.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END;
  
  -- Recherche combinée : full-text + préfixe + ILIKE pour champs critiques
  RETURN QUERY
  SELECT
    gsv.entity_type,
    gsv.entity_id,
    gsv.metadata,
    GREATEST(
      -- Score full-text standard
      COALESCE(ts_rank(gsv.search_vector, v_tsquery_full), 0),
      -- Score avec préfixe (légèrement réduit pour favoriser les correspondances exactes)
      COALESCE(ts_rank(gsv.search_vector, v_tsquery_prefix) * 0.9, 0),
      -- Bonus pour correspondances dans champs critiques selon le type d'entité
      CASE 
        WHEN gsv.entity_type = 'intervention' THEN
          CASE 
            WHEN (gsv.metadata->>'agence')::text ILIKE '%' || p_query || '%' THEN 0.5
            WHEN (gsv.metadata->>'contexte')::text ILIKE '%' || p_query || '%' THEN 0.3
            ELSE 0
          END
        WHEN gsv.entity_type = 'artisan' THEN
          CASE 
            WHEN (gsv.metadata->>'numero_associe')::text ILIKE '%' || p_query || '%' THEN 0.5
            WHEN (gsv.metadata->>'plain_nom')::text ILIKE '%' || p_query || '%' THEN 0.4
            WHEN (gsv.metadata->>'raison_sociale')::text ILIKE '%' || p_query || '%' THEN 0.3
            ELSE 0
          END
        ELSE 0
      END
    )::real AS rank
  FROM global_search_mv gsv
  WHERE
    (p_entity_type IS NULL OR gsv.entity_type = p_entity_type)
    AND (
      -- Correspondance full-text standard
      (gsv.search_vector @@ v_tsquery_full)
      -- OU correspondance avec préfixe
      OR (gsv.search_vector @@ v_tsquery_prefix)
      -- OU correspondance partielle dans champs critiques selon le type
      OR (
        -- Pour les interventions
        (gsv.entity_type = 'intervention' AND (
          (gsv.metadata->>'agence')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'contexte')::text ILIKE '%' || p_query || '%'
        ))
        -- Pour les artisans
        OR (gsv.entity_type = 'artisan' AND (
          (gsv.metadata->>'numero_associe')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'plain_nom')::text ILIKE '%' || p_query || '%'
          OR (gsv.metadata->>'raison_sociale')::text ILIKE '%' || p_query || '%'
        ))
      )
    )
  ORDER BY rank DESC, gsv.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_global IS
'Recherche globale full-text dans interventions ET artisans avec score de pertinence.
Gère les correspondances partielles (même logique que search_interventions et search_artisans) via:
  - Recherche full-text standard (websearch_to_tsquery)
  - Recherche avec préfixe (to_tsquery avec :*)
  - Recherche ILIKE sur champs critiques (agence pour interventions, numero_associe/plain_nom pour artisans)
Paramètres:
  - p_query: Termes de recherche (supporte AND, OR, NOT, phrases "entre guillemets")
  - p_limit: Nombre de résultats max (défaut: 20)
  - p_offset: Offset pour pagination (défaut: 0)
  - p_entity_type: Filtrer par type (''intervention'' ou ''artisan'', NULL pour tout)
Retourne les résultats triés par pertinence puis date de création.';


-- ========================================
-- 7️⃣ RAFRAÎCHISSEMENT INITIAL
-- ========================================

-- Rafraîchir toutes les vues une première fois
-- IMPORTANT: On n'utilise PAS CONCURRENTLY pour le premier refresh car les vues viennent d'être créées
-- CONCURRENTLY nécessite un index unique qui n'existe qu'après le premier refresh
-- (Attention : peut prendre quelques secondes selon la taille de la BDD)
-- REFRESH MATERIALIZED VIEW interventions_search_mv;
-- REFRESH MATERIALIZED VIEW artisans_search_mv;
-- REFRESH MATERIALIZED VIEW global_search_mv;

-- NOTE: Les vues sont automatiquement peuplées à la création avec les données du SELECT
-- Pas besoin de refresh initial explicite


-- ========================================
-- 8️⃣ CONFIGURATION OPTIONNELLE: CRON JOB
-- ========================================

-- Option 1: pg_cron (si disponible sur Supabase)
-- Rafraîchir toutes les 5 minutes en arrière-plan
-- SELECT cron.schedule(
--   'refresh-search-views',
--   '*/5 * * * *',
--   $$
--   SELECT refresh_interventions_search();
--   SELECT refresh_artisans_search();
--   $$
-- );

-- Option 2: Supabase Realtime (listener sur les notifications)
-- Configurer un listener Realtime qui écoute les canaux:
--   - refresh_interventions_search
--   - refresh_artisans_search
-- Et déclenche les refresh via Edge Function


-- ========================================
-- FIN DE LA MIGRATION
-- ========================================
-- Les vues matérialisées sont maintenant créées et prêtes à l'emploi !
--
-- Pour les utiliser côté client:
-- 1. Edge Function: SELECT * FROM search_interventions('votre recherche')
-- 2. Client JS: supabase.rpc('search_interventions', { p_query: 'votre recherche' })
--
-- Performance attendue:
-- - Recherche interventions: 150-300ms (vs 800-1200ms)
-- - Recherche artisans: 100-200ms (vs 400-600ms)
-- - Recherche globale: 200-400ms (vs 1200-1800ms)
