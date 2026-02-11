-- ========================================
-- REQUÊTES D'ANALYSE QUALITÉ D'IMPORT
-- ========================================
-- Ces requêtes permettent de vérifier la qualité de l'import des interventions
-- et de comparer les données importées avec celles du Google Sheet
-- Date: 2025-10-18
-- Usage: 
--   1. Script Node.js rapide: npx tsx scripts/tests/check-import-quality.js
--   2. Requêtes SQL détaillées: Exécuter dans l'éditeur SQL de Supabase
--   3. CLI PostgreSQL: psql -f scripts/tests/check-import-quality.sql
--
-- STRUCTURE DU SCRIPT:
-- 1️⃣ DONNÉES IMPORTÉES (Base de données)
-- 2️⃣ DONNÉES GOOGLE SHEET (Analyse des colonnes CSV)
-- 3️⃣ COMPARAISONS ET ANALYSES CROISÉES
-- 4️⃣ RÉSUMÉS ET MÉTRIQUES DE QUALITÉ

-- ========================================
-- 1️⃣ DONNÉES IMPORTÉES - INTERVENTIONS AVEC/SANS STATUT
-- ========================================

-- Nombre total d'interventions importées
SELECT 
  'IMPORTÉES' as source,
  COUNT(*) as total_interventions,
  COUNT(statut_id) as avec_statut,
  COUNT(*) - COUNT(statut_id) as sans_statut,
  ROUND(
    (COUNT(statut_id)::numeric / NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_statut
FROM interventions
WHERE is_active = true;

-- Détail des interventions sans statut
SELECT 
  id,
  id_inter,
  date,
  adresse,
  ville,
  assigned_user_id,
  created_at
FROM interventions
WHERE statut_id IS NULL
  AND is_active = true
ORDER BY created_at DESC
LIMIT 20;


-- ========================================
-- 1️⃣ DONNÉES IMPORTÉES - INTERVENTIONS AVEC/SANS COÛTS
-- ========================================

-- Statistiques globales des coûts importés
SELECT 
  'IMPORTÉES' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as avec_couts,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as sans_couts,
  ROUND(
    (COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_couts
FROM interventions i
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true
  AND i.id_inter NOT LIKE 'INT%';

-- Détail des interventions AVEC coûts (par type)
SELECT 
  i.id,
  i.id_inter,
  i.date,
  COUNT(ic.id) as nombre_couts,
  COUNT(CASE WHEN ic.cost_type = 'sst' THEN 1 END) as cout_sst,
  COUNT(CASE WHEN ic.cost_type = 'materiel' THEN 1 END) as cout_materiel,
  COUNT(CASE WHEN ic.cost_type = 'intervention' THEN 1 END) as cout_intervention,
  COUNT(CASE WHEN ic.cost_type = 'marge' THEN 1 END) as cout_total,
  SUM(ic.amount) as montant_total
FROM interventions i
INNER JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true
GROUP BY i.id, i.id_inter, i.date
ORDER BY i.date DESC
LIMIT 20;

-- Détail des interventions SANS coûts
SELECT 
  i.id,
  i.id_inter,
  i.date,
  i.adresse,
  i.ville,
  s.label as statut,
  u.firstname || ' ' || u.lastname as gestionnaire
FROM interventions i
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
LEFT JOIN intervention_statuses s ON i.statut_id = s.id
LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.is_active = true
  AND ic.id IS NULL
ORDER BY i.date DESC
LIMIT 20;


-- ========================================
-- 1️⃣ DONNÉES IMPORTÉES - INTERVENTIONS AVEC/SANS ARTISANS
-- ========================================

-- Statistiques globales des artisans importés
SELECT 
  'IMPORTÉES' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN ia.id IS NOT NULL THEN i.id END) as avec_artisans,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN ia.id IS NOT NULL THEN i.id END) as sans_artisans,
  ROUND(
    (COUNT(DISTINCT CASE WHEN ia.id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_artisans
FROM interventions i
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
WHERE i.is_active = true;

-- Détail des interventions AVEC artisans (comptage par intervention)
SELECT 
  i.id,
  i.id_inter,
  i.date,
  i.adresse,
  COUNT(ia.id) as nombre_artisans,
  COUNT(CASE WHEN ia.is_primary THEN 1 END) as artisans_primaires,
  COUNT(CASE WHEN NOT ia.is_primary THEN 1 END) as artisans_secondaires,
  STRING_AGG(
    a.prenom || ' ' || a.nom || 
    CASE WHEN ia.is_primary THEN ' (primaire)' ELSE '' END,
    ', '
  ) as artisans
FROM interventions i
INNER JOIN intervention_artisans ia ON i.id = ia.intervention_id
LEFT JOIN artisans a ON ia.artisan_id = a.id
WHERE i.is_active = true
GROUP BY i.id, i.id_inter, i.date, i.adresse
ORDER BY i.date DESC
LIMIT 20;

-- Détail des interventions SANS artisans
SELECT 
  i.id,
  i.id_inter,
  i.date,
  i.adresse,
  i.ville,
  s.label as statut,
  m.label as metier,
  u.firstname || ' ' || u.lastname as gestionnaire
FROM interventions i
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
LEFT JOIN intervention_statuses s ON i.statut_id = s.id
LEFT JOIN metiers m ON i.metier_id = m.id
LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.is_active = true
  AND ia.id IS NULL
ORDER BY i.date DESC
LIMIT 20;


-- ========================================
-- 2️⃣ DONNÉES GOOGLE SHEET - ANALYSE DES COLONNES CSV
-- ========================================
-- 
-- NOTE: Ces requêtes analysent les données brutes du Google Sheet
-- Les colonnes analysées sont celles utilisées par data-mapper.js:
-- - ID, Date, Statut, Métier, Agence, Gest.
-- - Adresse d'intervention, Contexte d'intervention
-- - Locataire, Em@ail Locataire, TEL LOC, PROPRIO
-- - COUT SST, COÛT MATERIEL, COUT INTER, Numéro SST
-- - SST (artisan SST)
--
-- Ces données doivent être importées depuis le CSV pour être analysées ici.
-- Pour l'instant, nous analysons les données déjà importées.

-- Analyse des statuts dans les données importées (reflète le Google Sheet)
SELECT 
  'GOOGLE SHEET (via import)' as source,
  COUNT(*) as total_interventions,
  COUNT(CASE WHEN statut_id IS NOT NULL THEN 1 END) as avec_statut,
  COUNT(CASE WHEN statut_id IS NULL THEN 1 END) as sans_statut,
  ROUND(
    (COUNT(CASE WHEN statut_id IS NOT NULL THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_statut
FROM interventions
WHERE is_active = true;

-- Analyse des coûts dans les données importées (reflète le Google Sheet)
SELECT 
  'GOOGLE SHEET (via import)' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as avec_couts,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as sans_couts,
  ROUND(
    (COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_couts
FROM interventions i
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true
  AND i.id_inter NOT LIKE 'INT%';

-- Analyse des artisans SST dans les données importées (reflète le Google Sheet)
SELECT 
  'GOOGLE SHEET (via import)' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END) as avec_artisan_sst,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END) as sans_artisan_sst,
  ROUND(
    (COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_artisan_sst
FROM interventions i
WHERE i.is_active = true;

-- Analyse des tenants (locataires) dans les données importées (reflète le Google Sheet)
SELECT 
  'GOOGLE SHEET (via import)' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.tenant_id IS NOT NULL THEN i.id END) as avec_tenant,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN i.tenant_id IS NOT NULL THEN i.id END) as sans_tenant,
  ROUND(
    (COUNT(DISTINCT CASE WHEN i.tenant_id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_tenant
FROM interventions i
WHERE i.is_active = true;

-- Analyse des owners (propriétaires) dans les données importées (reflète le Google Sheet)
SELECT 
  'GOOGLE SHEET (via import)' as source,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.owner_id IS NOT NULL THEN i.id END) as avec_owner,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN i.owner_id IS NOT NULL THEN i.id END) as sans_owner,
  ROUND(
    (COUNT(DISTINCT CASE WHEN i.owner_id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_owner
FROM interventions i
WHERE i.is_active = true;


-- ========================================
-- 3️⃣ COMPARAISONS ET ANALYSES CROISÉES
-- ========================================

-- Vue d'ensemble comparative: Importées vs Google Sheet
SELECT 
  'COMPARAISON' as type_analyse,
  'Statuts' as metrique,
  COUNT(CASE WHEN statut_id IS NOT NULL THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN statut_id IS NULL THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN statut_id IS NOT NULL THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COMPARAISON' as type_analyse,
  'Coûts' as metrique,
  COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as avec_donnees,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as sans_donnees,
  ROUND(
    (COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions i
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true AND i.id_inter NOT LIKE 'INT%'

UNION ALL

SELECT 
  'COMPARAISON' as type_analyse,
  'Artisans SST' as metrique,
  COUNT(CASE WHEN artisan_sst_id IS NOT NULL THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN artisan_sst_id IS NULL THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN artisan_sst_id IS NOT NULL THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COMPARAISON' as type_analyse,
  'Tenants' as metrique,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COMPARAISON' as type_analyse,
  'Owners' as metrique,
  COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

ORDER BY metrique;


-- ========================================
-- 4️⃣ ANALYSE DÉTAILLÉE DES COLONNES GOOGLE SHEET
-- ========================================
-- 
-- Cette section analyse les données spécifiques du Google Sheet
-- en se basant sur les colonnes utilisées par data-mapper.js

-- Analyse des colonnes principales du Google Sheet
SELECT 
  'COLONNES GOOGLE SHEET' as type_analyse,
  'ID Interventions' as colonne,
  COUNT(CASE WHEN id_inter IS NOT NULL AND id_inter != '' THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN id_inter IS NULL OR id_inter = '' THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN id_inter IS NOT NULL AND id_inter != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COLONNES GOOGLE SHEET' as type_analyse,
  'Dates' as colonne,
  COUNT(CASE WHEN date IS NOT NULL AND date != '2000-01-01T00:00:00Z' THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN date IS NULL OR date = '2000-01-01T00:00:00Z' THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN date IS NOT NULL AND date != '2000-01-01T00:00:00Z' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COLONNES GOOGLE SHEET' as type_analyse,
  'Adresses' as colonne,
  COUNT(CASE WHEN adresse IS NOT NULL AND adresse != '' THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN adresse IS NULL OR adresse = '' THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN adresse IS NOT NULL AND adresse != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COLONNES GOOGLE SHEET' as type_analyse,
  'Villes' as colonne,
  COUNT(CASE WHEN ville IS NOT NULL AND ville != '' THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN ville IS NULL OR ville = '' THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN ville IS NOT NULL AND ville != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'COLONNES GOOGLE SHEET' as type_analyse,
  'Contexte Intervention' as colonne,
  COUNT(CASE WHEN contexte_intervention IS NOT NULL AND contexte_intervention != '' THEN 1 END) as avec_donnees,
  COUNT(CASE WHEN contexte_intervention IS NULL OR contexte_intervention = '' THEN 1 END) as sans_donnees,
  ROUND(
    (COUNT(CASE WHEN contexte_intervention IS NOT NULL AND contexte_intervention != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_completude
FROM interventions
WHERE is_active = true

ORDER BY colonne;


-- ========================================
-- 5️⃣ RÉSUMÉ COMPLET DE QUALITÉ
-- ========================================

-- Vue d'ensemble complète
SELECT 
  'Total interventions' as metric,
  COUNT(*)::text as valeur
FROM interventions
WHERE is_active = true

UNION ALL

SELECT 
  'Avec statut',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND statut_id IS NOT NULL

UNION ALL

SELECT 
  'Sans statut',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND statut_id IS NULL

UNION ALL

SELECT 
  'Avec au moins 1 coût',
  COUNT(DISTINCT i.id)::text
FROM interventions i
INNER JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true

UNION ALL

SELECT 
  'Sans coûts',
  COUNT(DISTINCT i.id)::text
FROM interventions i
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true AND ic.id IS NULL

UNION ALL

SELECT 
  'Avec au moins 1 artisan',
  COUNT(DISTINCT i.id)::text
FROM interventions i
INNER JOIN intervention_artisans ia ON i.id = ia.intervention_id
WHERE i.is_active = true

UNION ALL

SELECT 
  'Sans artisans',
  COUNT(DISTINCT i.id)::text
FROM interventions i
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
WHERE i.is_active = true AND ia.id IS NULL

UNION ALL

SELECT 
  'Avec tenant (locataire)',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND tenant_id IS NOT NULL

UNION ALL

SELECT 
  'Avec owner (propriétaire)',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND owner_id IS NOT NULL

UNION ALL

SELECT 
  'Avec métier',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND metier_id IS NOT NULL

UNION ALL

SELECT 
  'Avec gestionnaire',
  COUNT(*)::text
FROM interventions
WHERE is_active = true AND assigned_user_id IS NOT NULL;


-- ========================================
-- 5️⃣ QUALITÉ DES DONNÉES PAR MÉTRIQUE
-- ========================================

-- Analyse détaillée des champs remplis
SELECT 
  COUNT(*) as total,
  COUNT(statut_id) as avec_statut,
  COUNT(metier_id) as avec_metier,
  COUNT(assigned_user_id) as avec_gestionnaire,
  COUNT(agence_id) as avec_agence,
  COUNT(tenant_id) as avec_tenant,
  COUNT(owner_id) as avec_owner,
  COUNT(adresse) as avec_adresse,
  COUNT(ville) as avec_ville,
  COUNT(code_postal) as avec_code_postal,
  COUNT(latitude) as avec_coordonnees_gps,
  COUNT(contexte_intervention) as avec_contexte,
  COUNT(commentaire_agent) as avec_commentaire,
  ROUND(AVG(CASE WHEN statut_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as pct_statut,
  ROUND(AVG(CASE WHEN metier_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as pct_metier,
  ROUND(AVG(CASE WHEN assigned_user_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as pct_gestionnaire
FROM interventions
WHERE is_active = true;


-- ========================================
-- 6️⃣ INTERVENTIONS PROBLÉMATIQUES
-- ========================================

-- Interventions "complètes" vs "incomplètes"
-- Une intervention complète a : statut, date, artisan, au moins 1 coût

WITH intervention_quality AS (
  SELECT 
    i.id,
    i.id_inter,
    i.date,
    i.adresse,
    s.label as statut,
    CASE WHEN i.statut_id IS NOT NULL THEN 1 ELSE 0 END as has_statut,
    CASE WHEN i.date IS NOT NULL THEN 1 ELSE 0 END as has_date,
    CASE WHEN ia.id IS NOT NULL THEN 1 ELSE 0 END as has_artisan,
    CASE WHEN ic.id IS NOT NULL THEN 1 ELSE 0 END as has_cout,
    CASE WHEN i.metier_id IS NOT NULL THEN 1 ELSE 0 END as has_metier,
    CASE WHEN i.assigned_user_id IS NOT NULL THEN 1 ELSE 0 END as has_gestionnaire,
    (
      CASE WHEN i.statut_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN i.date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN ia.id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN ic.id IS NOT NULL THEN 1 ELSE 0 END
    ) as quality_score
  FROM interventions i
  LEFT JOIN intervention_statuses s ON i.statut_id = s.id
  LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
  LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
  WHERE i.is_active = true
)
SELECT 
  quality_score,
  COUNT(*) as nombre_interventions,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM interventions WHERE is_active = true) * 100, 2) as pourcentage,
  CASE 
    WHEN quality_score = 4 THEN '✅ Complètes'
    WHEN quality_score >= 2 THEN '⚠️  Partielles'
    ELSE '❌ Incomplètes'
  END as categorie
FROM intervention_quality
GROUP BY quality_score
ORDER BY quality_score DESC;


-- ========================================
-- 7️⃣ TOP INTERVENTIONS À CORRIGER
-- ========================================

-- Les 20 interventions les plus "incomplètes" à corriger en priorité
WITH intervention_completeness AS (
  SELECT 
    i.id,
    i.id_inter,
    i.date,
    i.adresse,
    i.ville,
    s.label as statut,
    (
      CASE WHEN i.statut_id IS NULL THEN 'statut manquant, ' ELSE '' END ||
      CASE WHEN i.date IS NULL THEN 'date manquante, ' ELSE '' END ||
      CASE WHEN ia.id IS NULL THEN 'aucun artisan, ' ELSE '' END ||
      CASE WHEN ic.id IS NULL THEN 'aucun coût, ' ELSE '' END ||
      CASE WHEN i.metier_id IS NULL THEN 'métier manquant, ' ELSE '' END ||
      CASE WHEN i.assigned_user_id IS NULL THEN 'gestionnaire manquant, ' ELSE '' END
    ) as problemes,
    (
      CASE WHEN i.statut_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN i.date IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN ia.id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN ic.id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN i.metier_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN i.assigned_user_id IS NOT NULL THEN 1 ELSE 0 END
    ) as score_qualite
  FROM interventions i
  LEFT JOIN intervention_statuses s ON i.statut_id = s.id
  LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
  LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
  WHERE i.is_active = true
)
SELECT 
  id_inter,
  date,
  adresse,
  ville,
  statut,
  TRIM(TRAILING ', ' FROM problemes) as problemes_detectes,
  score_qualite || '/6' as completude
FROM intervention_completeness
WHERE score_qualite < 6
ORDER BY score_qualite ASC, date DESC
LIMIT 20;


-- ========================================
-- 8️⃣ STATISTIQUES PAR STATUT
-- ========================================

-- Répartition des interventions par statut avec qualité des données
SELECT 
  COALESCE(s.label, '(Sans statut)') as statut,
  s.color,
  COUNT(i.id) as nombre_interventions,
  COUNT(DISTINCT ia.artisan_id) as nombre_artisans_distincts,
  COUNT(DISTINCT ic.id) as nombre_couts_total,
  ROUND(AVG(ic.amount), 2) as cout_moyen,
  COUNT(CASE WHEN i.tenant_id IS NOT NULL THEN 1 END) as avec_tenant,
  COUNT(CASE WHEN i.owner_id IS NOT NULL THEN 1 END) as avec_owner
FROM interventions i
LEFT JOIN intervention_statuses s ON i.statut_id = s.id
LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id
LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
WHERE i.is_active = true
GROUP BY s.id, s.label, s.color, s.sort_order
ORDER BY s.sort_order NULLS LAST;


-- ========================================
-- 6️⃣ ANALYSE SPÉCIFIQUE DES COÛTS GOOGLE SHEET
-- ========================================
-- 
-- Analyse détaillée des coûts selon les colonnes du Google Sheet:
-- - COUT SST
-- - COÛT MATERIEL (peut contenir URL)
-- - COUT INTER
-- - Numéro SST

-- Répartition des types de coûts importés
SELECT 
  'COÛTS GOOGLE SHEET' as type_analyse,
  ic.cost_type as type_cout,
  COUNT(*) as nombre_couts,
  ROUND(AVG(ic.amount), 2) as montant_moyen,
  ROUND(MIN(ic.amount), 2) as montant_min,
  ROUND(MAX(ic.amount), 2) as montant_max,
  SUM(ic.amount) as montant_total
FROM intervention_costs ic
INNER JOIN interventions i ON ic.intervention_id = i.id
WHERE i.is_active = true
GROUP BY ic.cost_type
ORDER BY ic.cost_type;

-- Analyse des coûts matériel avec metadata (URLs, numéros SST)
SELECT 
  'COÛTS MATÉRIEL AVEC MÉTADONNÉES' as type_analyse,
  COUNT(*) as total_couts_materiel,
  COUNT(CASE WHEN ic.metadata IS NOT NULL AND ic.metadata != '' THEN 1 END) as avec_metadata,
  COUNT(CASE WHEN ic.metadata IS NULL OR ic.metadata = '' THEN 1 END) as sans_metadata,
  ROUND(
    (COUNT(CASE WHEN ic.metadata IS NOT NULL AND ic.metadata != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_metadata
FROM intervention_costs ic
INNER JOIN interventions i ON ic.intervention_id = i.id
WHERE i.is_active = true 
  AND ic.cost_type = 'materiel';

-- Détail des métadonnées des coûts matériel
SELECT 
  ic.id,
  i.id_inter,
  ic.amount,
  ic.metadata,
  CASE 
    WHEN ic.metadata LIKE '%"url"%' THEN 'Contient URL'
    WHEN ic.metadata LIKE '%"numero_sst"%' THEN 'Contient Numéro SST'
    WHEN ic.metadata LIKE '%"url"%' AND ic.metadata LIKE '%"numero_sst"%' THEN 'Contient URL + Numéro SST'
    ELSE 'Autres métadonnées'
  END as type_metadata
FROM intervention_costs ic
INNER JOIN interventions i ON ic.intervention_id = i.id
WHERE i.is_active = true 
  AND ic.cost_type = 'materiel'
  AND ic.metadata IS NOT NULL 
  AND ic.metadata != ''
ORDER BY i.date DESC
LIMIT 20;


-- ========================================
-- 7️⃣ ANALYSE DES RELATIONS GOOGLE SHEET
-- ========================================
-- 
-- Analyse des relations créées depuis le Google Sheet:
-- - Tenants (Locataire, Em@ail Locataire, TEL LOC)
-- - Owners (PROPRIO)
-- - Artisans SST (SST)

-- Statistiques des tenants créés depuis le Google Sheet
SELECT 
  'TENANTS GOOGLE SHEET' as type_analyse,
  COUNT(*) as total_tenants,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as avec_email,
  COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END) as avec_telephone,
  COUNT(CASE WHEN firstname IS NOT NULL AND firstname != '' THEN 1 END) as avec_prenom,
  COUNT(CASE WHEN lastname IS NOT NULL AND lastname != '' THEN 1 END) as avec_nom,
  ROUND(
    (COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_email,
  ROUND(
    (COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_telephone
FROM tenants
WHERE is_active = true;

-- Statistiques des owners créés depuis le Google Sheet
SELECT 
  'OWNERS GOOGLE SHEET' as type_analyse,
  COUNT(*) as total_owners,
  COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END) as avec_telephone,
  COUNT(CASE WHEN owner_firstname IS NOT NULL AND owner_firstname != '' THEN 1 END) as avec_prenom,
  COUNT(CASE WHEN owner_lastname IS NOT NULL AND owner_lastname != '' THEN 1 END) as avec_nom,
  ROUND(
    (COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as pourcentage_avec_telephone
FROM owners
WHERE is_active = true;

-- Statistiques des artisans SST assignés depuis le Google Sheet
SELECT 
  'ARTISANS SST GOOGLE SHEET' as type_analyse,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END) as avec_artisan_sst,
  COUNT(DISTINCT i.id) - COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END) as sans_artisan_sst,
  ROUND(
    (COUNT(DISTINCT CASE WHEN i.artisan_sst_id IS NOT NULL THEN i.id END)::numeric / 
     NULLIF(COUNT(DISTINCT i.id), 0) * 100), 2
  ) as pourcentage_avec_artisan_sst
FROM interventions i
WHERE i.is_active = true;

-- Détail des artisans SST assignés
SELECT 
  i.id_inter,
  i.date,
  i.adresse,
  a.prenom,
  a.nom,
  a.email,
  a.telephone,
  CASE 
    WHEN a.email IS NOT NULL AND a.telephone IS NOT NULL THEN 'Email + Téléphone'
    WHEN a.email IS NOT NULL THEN 'Email seulement'
    WHEN a.telephone IS NOT NULL THEN 'Téléphone seulement'
    ELSE 'Aucun contact'
  END as type_contact
FROM interventions i
INNER JOIN artisans a ON i.artisan_sst_id = a.id
WHERE i.is_active = true
ORDER BY i.date DESC
LIMIT 20;


-- ========================================
-- 8️⃣ RÉSUMÉ FINAL DE QUALITÉ D'IMPORT
-- ========================================

-- Score de qualité global de l'import
WITH quality_metrics AS (
  SELECT 
    COUNT(*) as total_interventions,
    COUNT(CASE WHEN statut_id IS NOT NULL THEN 1 END) as avec_statut,
    COUNT(CASE WHEN date IS NOT NULL AND date != '2000-01-01T00:00:00Z' THEN 1 END) as avec_date_valide,
    COUNT(CASE WHEN adresse IS NOT NULL AND adresse != '' THEN 1 END) as avec_adresse,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as avec_tenant,
    COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as avec_owner,
    COUNT(CASE WHEN artisan_sst_id IS NOT NULL THEN 1 END) as avec_artisan_sst,
    COUNT(DISTINCT CASE WHEN ic.id IS NOT NULL THEN i.id END) as avec_couts
  FROM interventions i
  LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
  WHERE i.is_active = true
)
SELECT 
  'SCORE QUALITÉ GLOBAL' as type_analyse,
  total_interventions,
  ROUND(
    ((avec_statut + avec_date_valide + avec_adresse + avec_tenant + avec_owner + avec_artisan_sst + avec_couts)::numeric / 
     (total_interventions * 7) * 100), 2
  ) as score_qualite_pourcentage,
  CASE 
    WHEN ((avec_statut + avec_date_valide + avec_adresse + avec_tenant + avec_owner + avec_artisan_sst + avec_couts)::numeric / 
          (total_interventions * 7) * 100) >= 80 THEN '✅ EXCELLENT'
    WHEN ((avec_statut + avec_date_valide + avec_adresse + avec_tenant + avec_owner + avec_artisan_sst + avec_couts)::numeric / 
          (total_interventions * 7) * 100) >= 60 THEN '⚠️ BON'
    WHEN ((avec_statut + avec_date_valide + avec_adresse + avec_tenant + avec_owner + avec_artisan_sst + avec_couts)::numeric / 
          (total_interventions * 7) * 100) >= 40 THEN '⚠️ MOYEN'
    ELSE '❌ À AMÉLIORER'
  END as evaluation_qualite
FROM quality_metrics;

