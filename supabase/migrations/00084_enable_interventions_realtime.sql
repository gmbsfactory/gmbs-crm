-- ========================================
-- Activation du Realtime pour la table interventions
-- ========================================
-- Cette table était activée manuellement via le Dashboard Supabase sur le projet hébergé
-- mais n'avait jamais été ajoutée dans les migrations, ce qui causait des erreurs
-- en local : "Failed to connect. Please check your RLS policies and try again."

-- 1. REPLICA IDENTITY FULL pour avoir accès aux anciennes valeurs (old)
-- lors des événements UPDATE et DELETE via Realtime
ALTER TABLE public.interventions REPLICA IDENTITY FULL;

-- 2. Ajouter la table à la publication supabase_realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.interventions;
      RAISE NOTICE 'Table interventions ajoutée à la publication supabase_realtime';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Table interventions déjà dans la publication supabase_realtime';
    END;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime non trouvée - ignoré (normal en local)';
  END IF;
END $$;