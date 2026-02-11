-- ============================================
-- COMPTAGE DES ENTITÉS DANS LA BASE DE DONNÉES
-- ============================================

-- Utilisateurs (users)
SELECT 
  'UTILISATEURS' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM users;

-- Agences (agencies)
SELECT 
  'AGENCES' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM agencies;

-- Statuts d'intervention (intervention_statuses)
SELECT 
  'STATUTS INTERVENTION' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM intervention_statuses;

-- Statuts d'artisan (artisan_statuses)
SELECT 
  'STATUTS ARTISAN' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM artisan_statuses;

-- Métiers
SELECT 
  'MÉTIERS' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM metiers;

-- Zones
SELECT 
  'ZONES' as categorie,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as actifs,
  COUNT(*) FILTER (WHERE is_active = false) as inactifs
FROM zones;

-- ============================================
-- DÉTAILS PAR TYPE
-- ============================================

-- Liste des utilisateurs
SELECT 
  '========== UTILISATEURS ==========' as section;

SELECT 
  id,
  firstname,
  lastname,
  email,
  role,
  is_active,
  created_at::date as date_creation
FROM users
ORDER BY lastname, firstname;

-- Liste des agences
SELECT 
  '========== AGENCES ==========' as section;

SELECT 
  id,
  label as nom,
  code,
  is_active,
  created_at::date as date_creation
FROM agencies
ORDER BY label;

-- Liste des statuts d'intervention
SELECT 
  '========== STATUTS INTERVENTION ==========' as section;

SELECT 
  id,
  code,
  label as nom,
  color,
  sort_order as ordre,
  is_active,
  created_at::date as date_creation
FROM intervention_statuses
ORDER BY sort_order, label;

-- Liste des statuts d'artisan
SELECT 
  '========== STATUTS ARTISAN ==========' as section;

SELECT 
  id,
  code,
  label as nom,
  color,
  sort_order as ordre,
  is_active,
  created_at::date as date_creation
FROM artisan_statuses
ORDER BY sort_order, label;

-- Liste des métiers
SELECT 
  '========== MÉTIERS ==========' as section;

SELECT 
  id,
  label as nom,
  code,
  is_active,
  created_at::date as date_creation
FROM metiers
ORDER BY label;

-- Liste des zones
SELECT 
  '========== ZONES ==========' as section;

SELECT 
  id,
  label as nom,
  code,
  departement_code,
  is_active,
  created_at::date as date_creation
FROM zones
ORDER BY departement_code, label;

-- ============================================
-- STATISTIQUES D'USAGE
-- ============================================

-- Interventions par utilisateur
SELECT 
  '========== INTERVENTIONS PAR UTILISATEUR ==========' as section;

SELECT 
  u.firstname || ' ' || u.lastname as utilisateur,
  u.email,
  COUNT(i.id) as nb_interventions
FROM users u
LEFT JOIN interventions i ON i.assigned_user_id = u.id
GROUP BY u.id, u.firstname, u.lastname, u.email
ORDER BY nb_interventions DESC;

-- Interventions par agence
SELECT 
  '========== INTERVENTIONS PAR AGENCE ==========' as section;

SELECT 
  a.label as agence,
  COUNT(i.id) as nb_interventions
FROM agencies a
LEFT JOIN interventions i ON i.agence_id = a.id
GROUP BY a.id, a.label
ORDER BY nb_interventions DESC;

-- Interventions par statut
SELECT 
  '========== INTERVENTIONS PAR STATUT ==========' as section;

SELECT 
  s.code,
  s.label as statut,
  COUNT(i.id) as nb_interventions
FROM intervention_statuses s
LEFT JOIN interventions i ON i.statut_id = s.id
GROUP BY s.id, s.code, s.label, s.sort_order
ORDER BY s.sort_order;

-- Artisans par statut
SELECT 
  '========== ARTISANS PAR STATUT ==========' as section;

SELECT 
  s.code,
  s.label as statut,
  COUNT(a.id) as nb_artisans
FROM artisan_statuses s
LEFT JOIN artisans a ON a.statut_id = s.id
GROUP BY s.id, s.code, s.label, s.sort_order
ORDER BY s.sort_order;




