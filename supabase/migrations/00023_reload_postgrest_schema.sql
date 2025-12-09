-- ========================================
-- MIGRATION 00023: Recharger le cache PostgREST
-- ========================================
-- Cette migration force PostgREST à recharger son cache de schéma
-- pour que les nouvelles fonctions RPC soient visibles.
-- ========================================

-- Forcer PostgREST à recharger le schéma
NOTIFY pgrst, 'reload schema';

-- Vérifier que la fonction search_interventions existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'search_interventions' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'La fonction search_interventions n''existe pas !';
  END IF;
  
  RAISE NOTICE 'La fonction search_interventions existe et est prête à l''emploi.';
END $$;

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================

