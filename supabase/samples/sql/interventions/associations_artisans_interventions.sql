-- ===== ASSOCIATIONS ARTISANS - INTERVENTIONS =====
-- Ce script permet de visualiser et analyser les associations entre les artisans et les interventions


-- Vérifier s'il y a des interventions mais pas d'associations
SELECT 
(SELECT COUNT(*) FROM interventions WHERE is_active = true) as interventions_count,
(SELECT COUNT(*) FROM intervention_artisans) as associations_count;


-- ============================================
-- 1. TOUTES LES ASSOCIATIONS ARTISANS-INTERVENTIONS
-- ============================================
SELECT 
  ia.id as association_id,
  i.id as intervention_id,
  i.id_inter as intervention_externe_id,
  i.date as date_intervention,
  ist.code as statut_intervention,
  ist.label as statut_intervention_label,
  a.id as artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) as artisan_nom,
  a.email as artisan_email,
  a.telephone as artisan_telephone,
  ia.role as role_artisan,
  ia.is_primary as artisan_principal,
  ia.assigned_at as date_association,
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  m.label as metier_intervention,
  i.adresse,
  i.ville,
  i.code_postal
FROM intervention_artisans ia
INNER JOIN interventions i ON ia.intervention_id = i.id
INNER JOIN artisans a ON ia.artisan_id = a.id
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
LEFT JOIN users u ON a.gestionnaire_id = u.id
LEFT JOIN metiers m ON i.metier_id = m.id
WHERE i.is_active = true AND a.is_active = true
ORDER BY i.date DESC, i.id_inter ASC, ia.is_primary DESC, a.raison_sociale ASC, a.nom ASC;

-- ============================================
-- 2. NOMBRE D'INTERVENTIONS PAR ARTISAN
-- ============================================
SELECT 
  a.id as artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) as artisan_nom,
  a.email as artisan_email,
  a.telephone as artisan_telephone,
  COUNT(DISTINCT ia.intervention_id) as nombre_interventions_total,
  COUNT(DISTINCT CASE WHEN ia.is_primary = true THEN ia.intervention_id END) as nombre_interventions_principales,
  COUNT(DISTINCT CASE WHEN ia.is_primary = false THEN ia.intervention_id END) as nombre_interventions_secondaires,
  COUNT(DISTINCT CASE WHEN ist.code = 'INTER_TERMINEE' THEN ia.intervention_id END) as nombre_interventions_terminees,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  a.is_active as artisan_actif
FROM artisans a
LEFT JOIN intervention_artisans ia ON a.id = ia.artisan_id
LEFT JOIN interventions i ON ia.intervention_id = i.id AND i.is_active = true
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
LEFT JOIN users u ON a.gestionnaire_id = u.id
WHERE a.is_active = true
GROUP BY a.id, a.raison_sociale, a.prenom, a.nom, a.email, a.telephone, u.firstname, u.lastname, u.code_gestionnaire, a.is_active
HAVING COUNT(DISTINCT ia.intervention_id) > 0
ORDER BY nombre_interventions_total DESC, artisan_nom ASC;

-- ============================================
-- 3. NOMBRE D'ARTISANS PAR INTERVENTION
-- ============================================
SELECT 
  i.id as intervention_id,
  i.id_inter as intervention_externe_id,
  i.date as date_intervention,
  ist.code as statut_intervention,
  ist.label as statut_intervention_label,
  COUNT(DISTINCT ia.artisan_id) as nombre_artisans_total,
  COUNT(DISTINCT CASE WHEN ia.is_primary = true THEN ia.artisan_id END) as nombre_artisans_principaux,
  COUNT(DISTINCT CASE WHEN ia.is_primary = false THEN ia.artisan_id END) as nombre_artisans_secondaires,
  m.label as metier_intervention,
  i.adresse,
  i.ville,
  i.code_postal,
  u.firstname as gestionnaire_intervention_prenom,
  u.lastname as gestionnaire_intervention_nom,
  u.code_gestionnaire as gestionnaire_intervention_code
FROM interventions i
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
LEFT JOIN metiers m ON i.metier_id = m.id
LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.is_active = true
GROUP BY i.id, i.id_inter, i.date, ist.code, ist.label, m.label, i.adresse, i.ville, i.code_postal, u.firstname, u.lastname, u.code_gestionnaire
HAVING COUNT(DISTINCT ia.artisan_id) > 0
ORDER BY nombre_artisans_total DESC, i.date DESC;

-- ============================================
-- 4. INTERVENTIONS AVEC PLUSIEURS ARTISANS
-- ============================================
SELECT 
  i.id as intervention_id,
  i.id_inter as intervention_externe_id,
  i.date as date_intervention,
  ist.label as statut_intervention,
  COUNT(DISTINCT ia.artisan_id) as nombre_artisans,
  STRING_AGG(
    DISTINCT CASE 
      WHEN ia.is_primary = true THEN COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom))
    END, 
    ', '
  ) as artisans_principaux,
  STRING_AGG(
    DISTINCT CASE 
      WHEN ia.is_primary = false THEN COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom))
    END, 
    ', '
  ) as artisans_secondaires,
  m.label as metier_intervention
FROM interventions i
INNER JOIN intervention_artisans ia ON i.id = ia.intervention_id
INNER JOIN artisans a ON ia.artisan_id = a.id AND a.is_active = true
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
LEFT JOIN metiers m ON i.metier_id = m.id
WHERE i.is_active = true
GROUP BY i.id, i.id_inter, i.date, ist.label, m.label
HAVING COUNT(DISTINCT ia.artisan_id) > 1
ORDER BY nombre_artisans DESC, i.date DESC;

-- ============================================
-- 5. ARTISANS SANS INTERVENTIONS
-- ============================================
SELECT 
  a.id as artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) as artisan_nom,
  a.email as artisan_email,
  a.telephone as artisan_telephone,
  ast.label as statut_artisan,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  a.date_ajout,
  a.created_at
FROM artisans a
LEFT JOIN intervention_artisans ia ON a.id = ia.artisan_id
LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
LEFT JOIN users u ON a.gestionnaire_id = u.id
WHERE a.is_active = true AND ia.id IS NULL
ORDER BY a.raison_sociale ASC, a.nom ASC, a.prenom ASC;

-- ============================================
-- 6. INTERVENTIONS SANS ARTISANS
-- ============================================
SELECT 
  i.id as intervention_id,
  i.id_inter as intervention_externe_id,
  i.date as date_intervention,
  ist.code as statut_intervention,
  ist.label as statut_intervention_label,
  m.label as metier_intervention,
  i.adresse,
  i.ville,
  i.code_postal,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire
FROM interventions i
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
LEFT JOIN metiers m ON i.metier_id = m.id
LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.is_active = true AND ia.id IS NULL
ORDER BY i.date DESC;

-- ============================================
-- 7. STATISTIQUES GLOBALES
-- ============================================
SELECT 
  COUNT(DISTINCT ia.id) as nombre_associations_total,
  COUNT(DISTINCT ia.artisan_id) as nombre_artisans_avec_interventions,
  COUNT(DISTINCT ia.intervention_id) as nombre_interventions_avec_artisans,
  COUNT(DISTINCT CASE WHEN ia.is_primary = true THEN ia.id END) as nombre_associations_principales,
  COUNT(DISTINCT CASE WHEN ia.is_primary = false THEN ia.id END) as nombre_associations_secondaires,
  ROUND(AVG(interventions_par_artisan.nombre_interventions)::numeric, 2) as moyenne_interventions_par_artisan,
  MAX(interventions_par_artisan.nombre_interventions) as maximum_interventions_par_artisan,
  ROUND(AVG(artisans_par_intervention.nombre_artisans)::numeric, 2) as moyenne_artisans_par_intervention,
  MAX(artisans_par_intervention.nombre_artisans) as maximum_artisans_par_intervention
FROM intervention_artisans ia
INNER JOIN interventions i ON ia.intervention_id = i.id AND i.is_active = true
INNER JOIN artisans a ON ia.artisan_id = a.id AND a.is_active = true
LEFT JOIN (
  SELECT 
    a.id,
    COUNT(DISTINCT ia.intervention_id) as nombre_interventions
  FROM artisans a
  INNER JOIN intervention_artisans ia ON a.id = ia.artisan_id
  INNER JOIN interventions i ON ia.intervention_id = i.id AND i.is_active = true
  WHERE a.is_active = true
  GROUP BY a.id
) interventions_par_artisan ON a.id = interventions_par_artisan.id
LEFT JOIN (
  SELECT 
    i.id,
    COUNT(DISTINCT ia.artisan_id) as nombre_artisans
  FROM interventions i
  INNER JOIN intervention_artisans ia ON i.id = ia.intervention_id
  INNER JOIN artisans a ON ia.artisan_id = a.id AND a.is_active = true
  WHERE i.is_active = true
  GROUP BY i.id
) artisans_par_intervention ON i.id = artisans_par_intervention.id;

-- ============================================
-- 8. ASSOCIATIONS PAR GESTIONNAIRE
-- ============================================
SELECT 
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  COUNT(DISTINCT ia.artisan_id) as nombre_artisans_avec_interventions,
  COUNT(DISTINCT ia.intervention_id) as nombre_interventions_associees,
  COUNT(DISTINCT ia.id) as nombre_associations_total,
  COUNT(DISTINCT CASE WHEN ia.is_primary = true THEN ia.id END) as nombre_associations_principales,
  COUNT(DISTINCT CASE WHEN ist.code = 'INTER_TERMINEE' THEN ia.intervention_id END) as nombre_interventions_terminees
FROM users u
INNER JOIN artisans a ON u.id = a.gestionnaire_id AND a.is_active = true
INNER JOIN intervention_artisans ia ON a.id = ia.artisan_id
INNER JOIN interventions i ON ia.intervention_id = i.id AND i.is_active = true
LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
GROUP BY u.id, u.firstname, u.lastname, u.code_gestionnaire
ORDER BY nombre_interventions_associees DESC, u.lastname ASC;


