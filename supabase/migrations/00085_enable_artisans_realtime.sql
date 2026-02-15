-- ========================================
-- Activation du Realtime pour les tables artisans et intervention_artisans
-- ========================================
-- Layer 1 du refactoring Realtime : multiplexer 3 tables sur un seul channel WebSocket
-- afin d'obtenir des mises à jour instantanées pour les artisans et les changements
-- d'affectation artisan↔intervention, sans connexion supplémentaire.

-- 1. REPLICA IDENTITY FULL pour artisans
-- Nécessaire pour avoir accès aux anciennes valeurs (old) lors des UPDATE et DELETE
ALTER TABLE public.artisans REPLICA IDENTITY FULL;

-- 2. REPLICA IDENTITY FULL pour intervention_artisans (table de jonction)
ALTER TABLE public.intervention_artisans REPLICA IDENTITY FULL;

-- 3. Ajouter les deux tables à la publication supabase_realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.artisans;
      RAISE NOTICE 'Table artisans ajoutée à la publication supabase_realtime';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Table artisans déjà dans la publication supabase_realtime';
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_artisans;
      RAISE NOTICE 'Table intervention_artisans ajoutée à la publication supabase_realtime';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Table intervention_artisans déjà dans la publication supabase_realtime';
    END;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime non trouvée - ignoré (normal en local)';
  END IF;
END $$;
