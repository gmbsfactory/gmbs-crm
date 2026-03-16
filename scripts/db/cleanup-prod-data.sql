-- ============================================================
-- GMBS CRM — Cleanup données de test / livraison production
-- ============================================================
-- Usage : exécuter dans Supabase SQL Editor (ou psql)
-- Effet  : supprime TOUTES les interventions et artisans
--          ainsi que les données qui en dépendent.
-- Préserve : users, gestionnaires, enums, statuts, rôles,
--            permissions, agences, zones, métiers, config.
--
-- ✅ Idempotent : safe à rejouer plusieurs fois
-- ✅ Atomique   : tout-ou-rien via une transaction
-- ✅ Sécurisé   : ne touche jamais aux tables de référence
--
-- ATTENTION : script destructif — toujours exécuter
--             validate-before-cleanup.sql avant ce script.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ÉTAPE 1 — Supprimer les logs et données liées aux artisans
--           et interventions (tables qui référencent les deux)
-- ------------------------------------------------------------

-- Logs emails liés aux interventions et artisans
DELETE FROM public.email_logs
WHERE intervention_id IS NOT NULL
   OR artisan_id IS NOT NULL;

-- Logs de synchronisation pour interventions et artisans
DELETE FROM public.sync_logs
WHERE entity_type IN ('intervention', 'artisan', 'client', 'tenant', 'owner');

-- Logs d'audit interventions
DELETE FROM public.intervention_audit_log;

-- Logs d'audit artisans
DELETE FROM public.artisan_audit_log;

-- ------------------------------------------------------------
-- ÉTAPE 2 — Supprimer les conversations/messages liés
--           à des interventions ou artisans
-- ------------------------------------------------------------

DELETE FROM public.message_attachments
WHERE message_id IN (
  SELECT m.id FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.context_type IN ('intervention', 'artisan')
);

DELETE FROM public.messages
WHERE conversation_id IN (
  SELECT id FROM public.conversations
  WHERE context_type IN ('intervention', 'artisan')
);

DELETE FROM public.conversation_participants
WHERE conversation_id IN (
  SELECT id FROM public.conversations
  WHERE context_type IN ('intervention', 'artisan')
);

DELETE FROM public.conversations
WHERE context_type IN ('intervention', 'artisan');

-- ------------------------------------------------------------
-- ÉTAPE 3 — Supprimer les tâches liées aux interventions
--           et artisans
-- ------------------------------------------------------------

DELETE FROM public.tasks
WHERE intervention_id IS NOT NULL
   OR artisan_id IS NOT NULL;

-- ------------------------------------------------------------
-- ÉTAPE 4 — Supprimer les commentaires liés aux interventions
--           artisans, clients/tenants/owners
-- ------------------------------------------------------------

DELETE FROM public.comments
WHERE entity_type IN ('intervention', 'artisan', 'client');

-- ------------------------------------------------------------
-- ÉTAPE 5 — Supprimer les rappels (reminders) d'interventions
-- ------------------------------------------------------------

DELETE FROM public.intervention_reminders;

-- ------------------------------------------------------------
-- ÉTAPE 6 — Supprimer les données d'intervention
--           (dans l'ordre des FK enfants → parent)
-- ------------------------------------------------------------

-- Pièces jointes des interventions
DELETE FROM public.intervention_attachments;

-- Coûts des interventions
DELETE FROM public.intervention_costs;

-- Paiements des interventions
DELETE FROM public.intervention_payments;

-- Associations intervention ↔ artisan
DELETE FROM public.intervention_artisans;

-- Interventions elles-mêmes
DELETE FROM public.interventions;

-- ------------------------------------------------------------
-- ÉTAPE 7 — Supprimer les données artisans
--           (dans l'ordre des FK enfants → parent)
-- ------------------------------------------------------------

-- Pièces jointes des artisans
DELETE FROM public.artisan_attachments;

-- Absences des artisans
DELETE FROM public.artisan_absences;

-- Associations artisan ↔ métier
DELETE FROM public.artisan_metiers;

-- Associations artisan ↔ zone
DELETE FROM public.artisan_zones;

-- Artisans eux-mêmes
DELETE FROM public.artisans;

-- ------------------------------------------------------------
-- ÉTAPE 8 — Supprimer les clients orphelins
--           (tenants et owners sans intervention associée)
-- ------------------------------------------------------------

-- Tenants non référencés par aucune intervention
DELETE FROM public.tenants
WHERE id NOT IN (
  SELECT DISTINCT tenant_id FROM public.interventions
  WHERE tenant_id IS NOT NULL
);

-- Owners non référencés par aucune intervention
DELETE FROM public.owner
WHERE id NOT IN (
  SELECT DISTINCT owner_id FROM public.interventions
  WHERE owner_id IS NOT NULL
);

-- ------------------------------------------------------------
-- ÉTAPE 9 — Vérification finale avant commit
-- ------------------------------------------------------------

DO $$
DECLARE
  v_interventions  int;
  v_artisans       int;
  v_tenants        int;
  v_owners         int;
  v_users          int;
  v_metiers        int;
  v_statuts_artisan int;
  v_statuts_inter  int;
BEGIN
  SELECT COUNT(*) INTO v_interventions  FROM public.interventions;
  SELECT COUNT(*) INTO v_artisans       FROM public.artisans;
  SELECT COUNT(*) INTO v_tenants        FROM public.tenants;
  SELECT COUNT(*) INTO v_owners         FROM public.owner;
  SELECT COUNT(*) INTO v_users          FROM public.users;
  SELECT COUNT(*) INTO v_metiers        FROM public.metiers;
  SELECT COUNT(*) INTO v_statuts_artisan FROM public.artisan_statuses;
  SELECT COUNT(*) INTO v_statuts_inter  FROM public.intervention_statuses;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'RÉSULTAT DU CLEANUP';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Interventions restantes  : %', v_interventions;
  RAISE NOTICE 'Artisans restants        : %', v_artisans;
  RAISE NOTICE 'Tenants restants         : %', v_tenants;
  RAISE NOTICE 'Owners restants          : %', v_owners;
  RAISE NOTICE '--------------------------------------';
  RAISE NOTICE 'DONNÉES PRÉSERVÉES';
  RAISE NOTICE 'Users/gestionnaires      : %', v_users;
  RAISE NOTICE 'Métiers (référence)      : %', v_metiers;
  RAISE NOTICE 'Statuts artisans         : %', v_statuts_artisan;
  RAISE NOTICE 'Statuts interventions    : %', v_statuts_inter;
  RAISE NOTICE '======================================';

  -- Garde-fou : si des interventions ou artisans restent, annuler
  IF v_interventions > 0 THEN
    RAISE EXCEPTION 'ERREUR: % intervention(s) non supprimée(s) — rollback', v_interventions;
  END IF;

  IF v_artisans > 0 THEN
    RAISE EXCEPTION 'ERREUR: % artisan(s) non supprimé(s) — rollback', v_artisans;
  END IF;

  -- Garde-fou : si les données de référence ont disparu, c'est un bug — annuler
  IF v_users = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: table users est vide après cleanup — rollback';
  END IF;

  IF v_metiers = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: table metiers est vide après cleanup — rollback';
  END IF;

END $$;

COMMIT;

-- ============================================================
-- FIN DU SCRIPT
-- La base est propre et prête pour l'import des vraies données.
-- Prochaine étape : node scripts/data/imports/google-sheets-import-clean-v2.js
-- ============================================================
