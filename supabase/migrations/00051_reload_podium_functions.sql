-- ========================================
-- MIGRATION 00051: Recharger le schéma PostgREST pour les fonctions podium
-- ========================================
-- Cette migration force PostgREST à recharger son cache de schéma
-- pour que les fonctions podium (get_current_podium_period) soient visibles.
-- ========================================

-- Vérifier que la fonction get_current_podium_period existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_current_podium_period' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'La fonction get_current_podium_period n''existe pas ! Veuillez appliquer la migration 00048_podium_auto_refresh.sql d''abord.';
  END IF;
  
  RAISE NOTICE 'La fonction get_current_podium_period existe et est prête à l''emploi.';
END $$;

-- Forcer PostgREST à recharger le schéma
NOTIFY pgrst, 'reload schema';

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================


