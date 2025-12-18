-- ========================================
-- GMBS CRM - Amélioration Recherche Commentaires
-- ========================================
-- Date: 2025-12-18
-- Description: Augmente le poids des commentaires dans la recherche full-text
--              de D (très faible) à C (moyen) pour permettre une meilleure
--              recherche dans le contenu des commentaires d'interventions
-- ========================================

-- ========================================
-- 1️⃣ RECRÉER LA VUE MATÉRIALISÉE INTERVENTIONS
--    avec poids C pour les commentaires
-- ========================================

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
  -- ⭐ COMMENTAIRES UPGRADÉS DE D À C ⭐
  setweight(to_tsvector('french', unaccent(coalesce(ic.commentaires_aggreges, ''))), 'C') ||

  -- POIDS D: Détails et métadonnées
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_second_artisan, ''))), 'D') ||
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
⭐ MISE À JOUR: Commentaires avec poids C (au lieu de D) pour améliorer la recherche dans les commentaires.
Rafraîchissement automatique via triggers sur tables sources.';


-- ========================================
-- 2️⃣ RECRÉER LA VUE MATÉRIALISÉE GLOBALE
--    (dépend de interventions_search_mv)
-- ========================================

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
CREATE UNIQUE INDEX idx_global_search_unique ON global_search_mv(entity_type, entity_id);

COMMENT ON MATERIALIZED VIEW global_search_mv IS
'Vue matérialisée pour recherche globale (cmd+k style) sur interventions ET artisans.
UNION des vues interventions_search_mv et artisans_search_mv.
⭐ MISE À JOUR: Commentaires avec poids C pour meilleure recherche.
Utilisé pour la barre de recherche universelle de l''application.';


-- ========================================
-- 3️⃣ RAFRAÎCHISSEMENT INITIAL DES VUES
-- ========================================

-- Rafraîchir les vues pour appliquer les nouveaux poids
REFRESH MATERIALIZED VIEW interventions_search_mv;
REFRESH MATERIALIZED VIEW artisans_search_mv;
REFRESH MATERIALIZED VIEW global_search_mv;

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================
-- Les commentaires ont maintenant un poids C au lieu de D
-- dans la recherche full-text, ce qui améliore significativement
-- la recherche dans le contenu des commentaires d'interventions.
