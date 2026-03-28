-- ========================================
-- GMBS CRM - Ajout email owner + plain_nom_client/plain_nom_facturation à la recherche
-- ========================================
-- Champs manquants dans le tsvector :
--   - o.email (owner email)
--   - t.plain_nom_client (nom locataire tel que saisi dans le modal)
--   - o.plain_nom_facturation (nom propriétaire tel que saisi dans le modal)
-- ========================================

DROP MATERIALIZED VIEW IF EXISTS global_search_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS interventions_search_mv CASCADE;

CREATE MATERIALIZED VIEW interventions_search_mv AS
WITH intervention_comments AS (
  SELECT
    entity_id as intervention_id,
    string_agg(content, ' | ') as commentaires_aggreges
  FROM public.comments
  WHERE entity_type = 'intervention'
  GROUP BY entity_id
),
primary_artisans AS (
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
  i.id,
  i.id_inter,
  i.created_at,
  i.updated_at,
  i.is_active,

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

  to_char(i.date, 'DD/MM/YYYY HH24:MI') as date_formatted,
  to_char(i.date_termine, 'DD/MM/YYYY HH24:MI') as date_termine_formatted,
  to_char(i.date_prevue, 'DD/MM/YYYY HH24:MI') as date_prevue_formatted,
  to_char(i.due_date, 'DD/MM/YYYY') as due_date_formatted,

  a.code as agence_code,
  a.label as agence_label,
  a.region as agence_region,

  t.firstname as tenant_firstname,
  t.lastname as tenant_lastname,
  t.plain_nom_client as tenant_plain_nom_client,
  t.email as tenant_email,
  t.telephone as tenant_telephone,
  t.telephone2 as tenant_telephone2,
  t.adresse as tenant_adresse,
  t.ville as tenant_ville,
  t.code_postal as tenant_code_postal,

  o.owner_firstname,
  o.owner_lastname,
  o.plain_nom_facturation as owner_plain_nom_facturation,
  o.email as owner_email,
  o.telephone as owner_telephone,
  o.telephone2 as owner_telephone2,
  o.adresse as owner_adresse,
  o.ville as owner_ville,
  o.code_postal as owner_code_postal,

  u.firstname as assigned_user_firstname,
  u.lastname as assigned_user_lastname,
  u.username as assigned_user_username,
  u.code_gestionnaire as assigned_user_code,

  s.code as statut_code,
  s.label as statut_label,
  s.color as statut_color,

  m.code as metier_code,
  m.label as metier_label,
  m.description as metier_description,

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

  ic.commentaires_aggreges,

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
  setweight(to_tsvector('french', unaccent(coalesce(t.plain_nom_client, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.plain_nom_facturation, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.label, ''))), 'B') ||

  -- POIDS C: Informations secondaires
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_intervention, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.commentaire_agent, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.adresse, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.ville, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.code_postal, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(u.username, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(ic.commentaires_aggreges, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(t.telephone, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(t.telephone2, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(o.telephone, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(o.telephone2, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(pa.telephone, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(pa.telephone2, '[^0-9]', '', 'g'), ''))), 'C') ||

  -- POIDS D: Détails et métadonnées
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_second_artisan, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.adresse_siege_social, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(pa.ville_siege_social, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(s.label, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.description, ''))), 'D')
  AS search_vector,

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

CREATE INDEX idx_interventions_search_vector ON interventions_search_mv USING gin(search_vector);
CREATE INDEX idx_interventions_search_statut ON interventions_search_mv(statut_id);
CREATE INDEX idx_interventions_search_agence ON interventions_search_mv(agence_id);
CREATE INDEX idx_interventions_search_assigned_user ON interventions_search_mv(assigned_user_id);
CREATE INDEX idx_interventions_search_date ON interventions_search_mv(date DESC);
CREATE UNIQUE INDEX idx_interventions_search_id ON interventions_search_mv(id);

-- Recréer global_search_mv qui dépend de interventions_search_mv
CREATE MATERIALIZED VIEW global_search_mv AS
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

CREATE INDEX idx_global_search_vector ON global_search_mv USING gin(search_vector);
CREATE INDEX idx_global_search_entity_type ON global_search_mv(entity_type);
CREATE INDEX idx_global_search_created_at ON global_search_mv(created_at DESC, entity_id);
CREATE UNIQUE INDEX idx_global_search_unique ON global_search_mv(entity_type, entity_id);

REFRESH MATERIALIZED VIEW interventions_search_mv;
REFRESH MATERIALIZED VIEW global_search_mv;
