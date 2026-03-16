-- ============================================================
-- GMBS CRM — Rapport de validation AVANT cleanup production
-- ============================================================
-- Usage : exécuter AVANT cleanup-prod-data.sql
-- Effet  : affiche un résumé de ce qui va être supprimé
--          sans rien modifier (lecture seule)
-- ============================================================

-- ------------------------------------------------------------
-- 1. RÉSUMÉ DES DONNÉES QUI SERONT SUPPRIMÉES
-- ------------------------------------------------------------

SELECT
  'SERA SUPPRIMÉ' AS action,
  'interventions'               AS table_name,
  COUNT(*)::text                AS count
FROM public.interventions

UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisans',             COUNT(*)::text FROM public.artisans
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_artisans',COUNT(*)::text FROM public.intervention_artisans
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_costs',   COUNT(*)::text FROM public.intervention_costs
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_payments',COUNT(*)::text FROM public.intervention_payments
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_attachments',COUNT(*)::text FROM public.intervention_attachments
UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisan_attachments',  COUNT(*)::text FROM public.artisan_attachments
UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisan_absences',     COUNT(*)::text FROM public.artisan_absences
UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisan_metiers',      COUNT(*)::text FROM public.artisan_metiers
UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisan_zones',        COUNT(*)::text FROM public.artisan_zones
UNION ALL SELECT 'SERA SUPPRIMÉ', 'comments (interventions+artisans)',
  COUNT(*)::text FROM public.comments WHERE entity_type IN ('intervention','artisan','client')
UNION ALL SELECT 'SERA SUPPRIMÉ', 'tasks (liées inter/artisan)',
  COUNT(*)::text FROM public.tasks WHERE intervention_id IS NOT NULL OR artisan_id IS NOT NULL
UNION ALL SELECT 'SERA SUPPRIMÉ', 'email_logs (liés inter/artisan)',
  COUNT(*)::text FROM public.email_logs WHERE intervention_id IS NOT NULL OR artisan_id IS NOT NULL
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_audit_log', COUNT(*)::text FROM public.intervention_audit_log
UNION ALL SELECT 'SERA SUPPRIMÉ', 'artisan_audit_log',      COUNT(*)::text FROM public.artisan_audit_log
UNION ALL SELECT 'SERA SUPPRIMÉ', 'intervention_reminders', COUNT(*)::text FROM public.intervention_reminders

ORDER BY table_name;

-- ------------------------------------------------------------
-- 2. TENANTS ET OWNERS — combien seront orphelins après cleanup
-- ------------------------------------------------------------

SELECT
  'SERA SUPPRIMÉ (orphelin)' AS action,
  'tenants'                  AS table_name,
  COUNT(*)::text             AS count
FROM public.tenants

UNION ALL

SELECT
  'SERA SUPPRIMÉ (orphelin)',
  'owners',
  COUNT(*)::text
FROM public.owner;

-- ------------------------------------------------------------
-- 3. DONNÉES QUI SERONT PRÉSERVÉES
-- ------------------------------------------------------------

SELECT
  'SERA PRÉSERVÉ' AS action,
  'users/gestionnaires'         AS table_name,
  COUNT(*)::text                AS count
FROM public.users

UNION ALL SELECT 'SERA PRÉSERVÉ', 'metiers (référence)',    COUNT(*)::text FROM public.metiers
UNION ALL SELECT 'SERA PRÉSERVÉ', 'zones (référence)',      COUNT(*)::text FROM public.zones
UNION ALL SELECT 'SERA PRÉSERVÉ', 'agencies',               COUNT(*)::text FROM public.agencies
UNION ALL SELECT 'SERA PRÉSERVÉ', 'artisan_statuses',       COUNT(*)::text FROM public.artisan_statuses
UNION ALL SELECT 'SERA PRÉSERVÉ', 'intervention_statuses',  COUNT(*)::text FROM public.intervention_statuses
UNION ALL SELECT 'SERA PRÉSERVÉ', 'task_statuses',          COUNT(*)::text FROM public.task_statuses
UNION ALL SELECT 'SERA PRÉSERVÉ', 'roles',                  COUNT(*)::text FROM public.roles
UNION ALL SELECT 'SERA PRÉSERVÉ', 'permissions',            COUNT(*)::text FROM public.permissions

ORDER BY table_name;

-- ------------------------------------------------------------
-- 4. DÉTAIL DES GESTIONNAIRES QUI SERONT PRÉSERVÉS
-- ------------------------------------------------------------

SELECT
  id,
  username,
  email,
  firstname,
  lastname,
  code_gestionnaire,
  created_at::date AS date_creation
FROM public.users
ORDER BY created_at;

-- ------------------------------------------------------------
-- 5. DÉTAIL DES ARTISANS QUI SERONT SUPPRIMÉS (aperçu 20 premiers)
-- ------------------------------------------------------------

SELECT
  id,
  COALESCE(prenom || ' ' || nom, plain_nom, raison_sociale, '(sans nom)') AS identite,
  email,
  telephone,
  date_ajout,
  created_at::date AS date_creation
FROM public.artisans
ORDER BY created_at
LIMIT 20;

-- ------------------------------------------------------------
-- 6. AVERTISSEMENT FINAL
-- ------------------------------------------------------------

SELECT
  '⚠️  AVERTISSEMENT' AS niveau,
  'Ces données seront définitivement supprimées. Faites un backup avant de lancer cleanup-prod-data.sql.' AS message;
