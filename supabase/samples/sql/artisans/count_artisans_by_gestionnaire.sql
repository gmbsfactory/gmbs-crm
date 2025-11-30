-- ===== NOMBRE D'ARTISANS PAR GESTIONNAIRE =====
-- Ce script permet de compter le nombre d'artisans associés à chaque gestionnaire

-- ============================================
-- 1. NOMBRE TOTAL D'ARTISANS PAR GESTIONNAIRE
-- ============================================
SELECT 
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  u.email as gestionnaire_email,
  COUNT(a.id) as nombre_artisans_total
FROM users u
LEFT JOIN artisans a ON u.id = a.gestionnaire_id
GROUP BY u.id, u.firstname, u.lastname, u.code_gestionnaire, u.email
ORDER BY nombre_artisans_total DESC, u.lastname ASC;

-- ============================================
-- 2. NOMBRE D'ARTISANS ACTIFS PAR GESTIONNAIRE
-- ============================================
SELECT 
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  u.email as gestionnaire_email,
  COUNT(CASE WHEN a.is_active = true THEN 1 END) as nombre_artisans_actifs,
  COUNT(CASE WHEN a.is_active = false THEN 1 END) as nombre_artisans_inactifs,
  COUNT(a.id) as nombre_artisans_total
FROM users u
LEFT JOIN artisans a ON u.id = a.gestionnaire_id
GROUP BY u.id, u.firstname, u.lastname, u.code_gestionnaire, u.email
ORDER BY nombre_artisans_actifs DESC, u.lastname ASC;

-- ============================================
-- 3. DÉTAIL DES ARTISANS PAR GESTIONNAIRE
-- ============================================
SELECT 
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  a.id as artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) as artisan_nom,
  a.email as artisan_email,
  a.telephone as artisan_telephone,
  a.is_active as artisan_actif,
  ast.label as statut_artisan,
  a.date_ajout,
  a.created_at
FROM users u
LEFT JOIN artisans a ON u.id = a.gestionnaire_id
LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
ORDER BY u.lastname ASC, u.firstname ASC, a.raison_sociale ASC, a.nom ASC, a.prenom ASC;

-- ============================================
-- 4. GESTIONNAIRES SANS ARTISANS
-- ============================================
SELECT 
  u.id as gestionnaire_id,
  u.firstname as gestionnaire_prenom,
  u.lastname as gestionnaire_nom,
  u.code_gestionnaire,
  u.email as gestionnaire_email
FROM users u
LEFT JOIN artisans a ON u.id = a.gestionnaire_id
WHERE a.id IS NULL
ORDER BY u.lastname ASC, u.firstname ASC;

-- ============================================
-- 5. ARTISANS SANS GESTIONNAIRE
-- ============================================
SELECT 
  a.id as artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) as artisan_nom,
  a.email as artisan_email,
  a.telephone as artisan_telephone,
  a.is_active as artisan_actif,
  ast.label as statut_artisan,
  a.date_ajout,
  a.created_at
FROM artisans a
LEFT JOIN users u ON a.gestionnaire_id = u.id
LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
WHERE a.gestionnaire_id IS NULL
ORDER BY a.raison_sociale ASC, a.nom ASC, a.prenom ASC;

-- ============================================
-- 6. STATISTIQUES GLOBALES
-- ============================================
SELECT 
  COUNT(DISTINCT u.id) as nombre_gestionnaires_total,
  COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END) as nombre_gestionnaires_avec_artisans,
  COUNT(DISTINCT CASE WHEN a.id IS NULL THEN u.id END) as nombre_gestionnaires_sans_artisans,
  COUNT(a.id) as nombre_artisans_total,
  COUNT(CASE WHEN a.is_active = true THEN 1 END) as nombre_artisans_actifs,
  COUNT(CASE WHEN a.is_active = false THEN 1 END) as nombre_artisans_inactifs,
  COUNT(CASE WHEN a.gestionnaire_id IS NULL THEN 1 END) as nombre_artisans_sans_gestionnaire,
  ROUND(AVG(artisans_par_gestionnaire.nombre_artisans)::numeric, 2) as moyenne_artisans_par_gestionnaire,
  MAX(artisans_par_gestionnaire.nombre_artisans) as maximum_artisans_par_gestionnaire,
  MIN(artisans_par_gestionnaire.nombre_artisans) as minimum_artisans_par_gestionnaire
FROM users u
LEFT JOIN artisans a ON u.id = a.gestionnaire_id
LEFT JOIN (
  SELECT 
    u.id,
    COUNT(a.id) as nombre_artisans
  FROM users u
  LEFT JOIN artisans a ON u.id = a.gestionnaire_id
  GROUP BY u.id
) artisans_par_gestionnaire ON u.id = artisans_par_gestionnaire.id;

