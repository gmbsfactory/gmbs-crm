-- =====================================================================
-- 99083_email_attachments_intervention.sql
-- LOT L7 — Les pieces jointes de l'e-mail deviennent des pieces de l'intervention.
--
-- Avant ce lot, le gestionnaire joignait des fichiers de SON DISQUE, encodes en base64 dans
-- le corps de la requete ; email_logs n'en gardait que le NOMBRE. L'application artisan ne
-- pouvait donc pas montrer « ce que joint l'e-mail » (spec §5.6, point 3 du verbatim).
--
-- Cette migration pose la seule chose qui manquait en base : la MARQUE d'envoi. Le selecteur
-- de la modale coche desormais des lignes d'intervention_attachments et le serveur lit les
-- fichiers dans Storage ; il reste a dire QUELLES pieces sont parties chez l'artisan, pour
-- que l'API portail puisse les exposer sans deviner.
--
-- 1. intervention_attachments.sent_to_artisan_at        — horodatage du PREMIER envoi.
--    intervention_attachments.sent_to_artisan_email_log_id — l'e-mail de ce premier envoi.
--    Le premier envoi fait foi : c'est la date a laquelle l'artisan a recu la piece. Les
--    renvois ulterieurs sont traces par email_logs.attachment_ids, pas en ecrasant la date
--    (meme motif que dossier_validated_at en 99078, pose une seule fois).
--
-- 2. email_logs.attachment_ids — la liste exacte des pieces de CHAQUE envoi. attachments_count
--    restait un compteur aveugle : « 3 pieces » sans savoir lesquelles.
--
-- 3. Durcissement email_logs, motif 99082 : la table porte anon=arwdDxtm herite des
--    ALTER DEFAULT PRIVILEGES de 00001. Sa RLS n'a AUCUNE policy anon, donc anon ne lit rien
--    par PostgREST — mais TRUNCATE (D) et TRIGGER (t) ne passent par aucune policy : avec la
--    seule cle anon, `TRUNCATE public.email_logs` reste autorise. On revoque et on regrante
--    les quatre verbes, exactement comme 99082 l'a fait pour intervention_costs et
--    intervention_attachments. Aucun changement fonctionnel : les policies authenticated
--    existantes sont intactes et le service_role n'est pas concerne par les grants.
--
-- Cout WAL : intervention_attachments est publiee en REPLICA IDENTITY FULL (99077). L'UPDATE
-- d'estampillage est borne — il ne vise QUE les lignes non encore marquees
-- (`WHERE sent_to_artisan_at IS NULL`), donc au plus une ecriture par piece et par vie.
--
-- NUMERO : 99083 et non 99082 — 99082_rls_tables_enfant_intervention.sql (correctif de revue
-- du socle L0) occupe deja ce numero sur la branche. Voir l'ecart signale dans le rapport.
--
-- IDEMPOTENTE ET REJOUABLE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Marque d'envoi sur les pieces de l'intervention
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- BORNE D'ATTENTE DES VERROUS (correctif de recette, constat 1).
--
-- 99077 ajoute intervention_attachments, artisan_reports et artisan_attachments
-- a la publication « supabase_realtime ». Le gestionnaire d'abonnements de
-- Supabase Realtime (application_name « realtime_subscription_manager_pub ») se
-- reveille alors pour lire ces relations (AccessShareLock) au moment meme ou ces
-- migrations demandent un AccessExclusiveLock sur les memes tables ou leurs
-- voisines : un deadlock 40P01 a ete observe une fois sur quatre resets locaux,
-- et la fenetre est ouverte a chaque deploiement en production, ou Realtime est
-- toujours vivant.
--
-- Sans borne, l'attente est infinie et rien ne fait reessayer. Avec elle, la
-- collision devient un echec net (55P03 lock_not_available) sur une migration
-- deja IDEMPOTENTE : il suffit de la rejouer. On prefere un echec lisible et
-- rejouable a un deadlock aleatoire.
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';
ALTER TABLE public.intervention_attachments
  ADD COLUMN IF NOT EXISTS sent_to_artisan_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_artisan_email_log_id  UUID;

COMMENT ON COLUMN public.intervention_attachments.sent_to_artisan_at IS
  'Date du PREMIER envoi de cette piece a un artisan par la modale e-mail. NULL = jamais envoyee. '
  'Non ecrasee par les renvois : l''historique complet vit dans email_logs.attachment_ids.';

COMMENT ON COLUMN public.intervention_attachments.sent_to_artisan_email_log_id IS
  'email_logs.id de l''envoi qui a pose sent_to_artisan_at. NULL si le journal n''a pas pu etre ecrit.';

-- FK gardee : email_logs peut manquer sur une base partiellement migree.
DO $$
BEGIN
  IF to_regclass('public.email_logs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'intervention_attachments_sent_email_log_fkey'
         AND conrelid = 'public.intervention_attachments'::regclass
     )
  THEN
    ALTER TABLE public.intervention_attachments
      ADD CONSTRAINT intervention_attachments_sent_email_log_fkey
      FOREIGN KEY (sent_to_artisan_email_log_id)
      REFERENCES public.email_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index PARTIEL : l'immense majorite des pieces ne sont jamais envoyees par mail.
-- La question posee par l'API portail est « les pieces envoyees de CETTE intervention ».
CREATE INDEX IF NOT EXISTS idx_intervention_attachments_sent_to_artisan
  ON public.intervention_attachments (intervention_id, sent_to_artisan_at DESC)
  WHERE sent_to_artisan_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Quelles pieces exactement, dans chaque e-mail
-- ---------------------------------------------------------------------
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS attachment_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.email_logs.attachment_ids IS
  'intervention_attachments.id des pieces reellement jointes a cet e-mail, dans l''ordre d''envoi. '
  'Pas de FK : un tableau ne peut pas en porter, et la suppression d''une piece ne doit pas '
  'reecrire un journal d''envoi. attachments_count reste le compteur affiche (pieces + logo GMBS).';

-- ---------------------------------------------------------------------
-- 3. Durcissement des privileges d'email_logs (motif 99082)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.email_logs') IS NULL THEN RETURN; END IF;

  -- REVOKE ALL puis GRANT des quatre verbes, et non « REVOKE SELECT, INSERT … » :
  -- ce dernier laisserait TRUNCATE (D) et TRIGGER (t), qui ne passent par aucune policy.
  REVOKE ALL ON public.email_logs FROM anon;
  REVOKE ALL ON public.email_logs FROM authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
END $$;
