-- ========================================
-- Script d'initialisation des objectifs par défaut
-- ========================================
-- Ce script peut être exécuté manuellement en production
-- pour initialiser les objectifs de tous les gestionnaires existants
-- 
-- Usage en production:
--   psql $DATABASE_URL -f supabase/seeds/init_default_targets.sql
-- 
-- Date: 2025-01-XX
-- ========================================

-- Fonction pour insérer les objectifs par défaut pour un gestionnaire
DO $$
DECLARE
  gestionnaire_record RECORD;
  admin_user_id UUID;
  inserted_count INTEGER := 0;
BEGIN
  -- Trouver l'ID de l'utilisateur admin (celui avec username = 'admin')
  SELECT id INTO admin_user_id
  FROM public.users
  WHERE username = 'admin'
  LIMIT 1;

  -- Si aucun admin trouvé, utiliser NULL (les objectifs seront créés sans created_by)
  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'Aucun utilisateur admin trouvé, les objectifs seront créés sans created_by';
  END IF;

  -- Parcourir tous les gestionnaires (utilisateurs non-admin)
  FOR gestionnaire_record IN
    SELECT u.id, u.username, u.firstname, u.lastname
    FROM public.users u
    WHERE u.username IS NOT NULL
      AND u.username != 'admin'
      AND u.id != COALESCE(admin_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT EXISTS (
        -- Exclure les utilisateurs qui sont admin via les rôles
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
          AND LOWER(r.name) = 'admin'
      )
    ORDER BY u.username
  LOOP
    -- Insérer les objectifs pour les trois périodes (week, month, year)
    -- Valeurs par défaut du composant TargetsSettings :
    -- week: 1500€, month: 5000€, year: 58000€
    -- performance_target: 40%
    
    INSERT INTO public.gestionnaire_targets (user_id, period_type, margin_target, performance_target, created_by)
    VALUES
      (gestionnaire_record.id, 'week', 1500.00, 40.00, admin_user_id),
      (gestionnaire_record.id, 'month', 5000.00, 40.00, admin_user_id),
      (gestionnaire_record.id, 'year', 58000.00, 40.00, admin_user_id)
    ON CONFLICT (user_id, period_type) DO NOTHING;
    
    -- Compter les insertions réussies
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    IF inserted_count > 0 THEN
      RAISE NOTICE '✓ Objectifs créés pour: % % (username: %, ID: %)', 
        COALESCE(gestionnaire_record.firstname, ''), 
        COALESCE(gestionnaire_record.lastname, ''),
        gestionnaire_record.username, 
        gestionnaire_record.id;
    ELSE
      RAISE NOTICE '⊘ Objectifs déjà existants pour: % (username: %)', 
        gestionnaire_record.username, 
        gestionnaire_record.id;
    END IF;
  END LOOP;
  
  -- Afficher un résumé
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Initialisation terminée!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total d''objectifs dans la table: %', 
    (SELECT COUNT(*) FROM public.gestionnaire_targets);
END $$;

