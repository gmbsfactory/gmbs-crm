-- ============================================================================
-- Monitoring DEV : flux d'actions en temps réel
-- ----------------------------------------------------------------------------
-- Expose les journaux d'audit (intervention_audit_log, artisan_audit_log) au
-- Realtime Postgres afin que /monitoring-dev rafraîchisse son flux d'actions et
-- ses statistiques en direct (abonnement postgres_changes INSERT).
--
-- Sécurité — pourquoi c'est sûr :
--   Toutes les fonctions d'audit (audit_intervention_*, audit_artisan_*, …) sont
--   SECURITY DEFINER : elles écrivent en s'exécutant comme le propriétaire de la
--   table, donc en CONTOURNANT la RLS. Activer la RLS sur intervention_audit_log
--   ne bloque donc pas l'écriture des logs par les triggers — seules les LECTURES
--   directes (l'abonnement Realtime côté client) passent par la policy SELECT.
--
--   intervention_audit_log avait la RLS DÉSACTIVÉE avec des grants larges
--   (authenticated pouvait INSERT/UPDATE/DELETE en direct). On la met en miroir
--   exact d'artisan_audit_log : SELECT autorisé en lecture, écriture directe
--   verrouillée (WITH CHECK false) — ce qui referme aussi cette faille.
-- ============================================================================

-- 1) RLS + policies sur intervention_audit_log (miroir d'artisan_audit_log) -----
ALTER TABLE public.intervention_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view intervention audit log"
  ON public.intervention_audit_log;
CREATE POLICY "Authenticated users can view intervention audit log"
  ON public.intervention_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Intervention audit log can only be inserted by trigger"
  ON public.intervention_audit_log;
CREATE POLICY "Intervention audit log can only be inserted by trigger"
  ON public.intervention_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2) Ajout des deux tables à la publication Realtime (idempotent) --------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'intervention_audit_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_audit_log;
      RAISE NOTICE 'intervention_audit_log ajoutée à supabase_realtime';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'artisan_audit_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.artisan_audit_log;
      RAISE NOTICE 'artisan_audit_log ajoutée à supabase_realtime';
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime absente — étape Realtime ignorée';
  END IF;
END $$;
