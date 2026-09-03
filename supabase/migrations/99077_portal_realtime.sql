-- ============================================================================
-- 99077 — Temps réel du portail artisans
--
-- But : rendre instantané, dans le CRM, ce que l'artisan envoie depuis le
-- portail (photos de chantier, rapport d'intervention, pièces du dossier).
-- Sans ces tables dans la publication « supabase_realtime », le CRM devait
-- être actualisé à la main pour voir arriver une photo ou un rapport.
--
-- interventions et intervention_reminders sont déjà publiées : le drapeau
-- has_portal_report (badge « À vérifier ») remontait donc déjà tout seul.
--
-- Idempotente : chaque ajout est conditionné à l'absence de la table dans la
-- publication, ce qui la rend rejouable et applicable en production où
-- certaines tables peuvent déjà être publiées.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['intervention_attachments', 'artisan_reports', 'artisan_attachments']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime'
                         AND schemaname = 'public'
                         AND tablename = t)
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Table %.% ajoutee a la publication supabase_realtime', 'public', t;
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL : sans cela, les evenements DELETE ne portent que la
-- cle primaire, donc ni intervention_id ni artisan_id — le CRM ne saurait pas
-- quelle intervention rafraichir quand une photo est supprimee.
ALTER TABLE public.intervention_attachments REPLICA IDENTITY FULL;
ALTER TABLE public.artisan_reports REPLICA IDENTITY FULL;
ALTER TABLE public.artisan_attachments REPLICA IDENTITY FULL;
