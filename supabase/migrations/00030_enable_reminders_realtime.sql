-- ========================================
-- ✅ Activation du Realtime pour les reminders
-- ========================================
-- Cette migration active le Realtime Supabase pour la table intervention_reminders
-- Cela permet aux utilisateurs de recevoir des notifications en temps réel
-- quand ils sont mentionnés dans un reminder ou quand leurs reminders sont modifiés.

-- 1. Configurer REPLICA IDENTITY FULL pour avoir accès aux anciennes valeurs
-- lors des événements UPDATE et DELETE
ALTER TABLE public.intervention_reminders REPLICA IDENTITY FULL;

-- 2. Ajouter la table à la publication supabase_realtime
-- Note: On utilise DO $$ pour éviter les erreurs si la table est déjà dans la publication
DO $$
BEGIN
  -- Vérifier si la publication existe
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Ajouter la table à la publication (ignore l'erreur si déjà ajoutée)
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_reminders;
      RAISE NOTICE 'Table intervention_reminders ajoutée à la publication supabase_realtime';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Table intervention_reminders déjà dans la publication supabase_realtime';
    END;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime non trouvée - ignoré (normal en local)';
  END IF;
END $$;

-- 3. S'assurer que les index sont optimaux pour les requêtes realtime
-- Index sur is_active pour filtrer rapidement les reminders actifs
CREATE INDEX IF NOT EXISTS idx_intervention_reminders_is_active 
  ON public.intervention_reminders(is_active) 
  WHERE is_active = true;

COMMENT ON TABLE public.intervention_reminders IS 
  'Reminders pour interventions avec mentions utilisateur - Realtime activé';

