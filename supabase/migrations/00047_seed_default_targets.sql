-- ========================================
-- Seed Default Targets for Existing Gestionnaires
-- ========================================
-- Cette migration insère automatiquement des objectifs par défaut
-- pour tous les gestionnaires existants (sauf admin)
-- Date: 2025-01-XX
-- ========================================

-- Fonction pour insérer les objectifs par défaut pour un gestionnaire
-- Utilise les valeurs par défaut du composant TargetsSettings
DO $$
DECLARE
  gestionnaire_record RECORD;
  admin_user_id UUID;
BEGIN
  -- Trouver l'ID de l'utilisateur admin (celui avec username = 'admin')
  SELECT id INTO admin_user_id
  FROM public.users
  WHERE username = 'admin'
  LIMIT 1;

  -- Parcourir tous les gestionnaires (utilisateurs non-admin)
  FOR gestionnaire_record IN
    SELECT u.id, u.username
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
    
    RAISE NOTICE 'Objectifs par défaut créés pour le gestionnaire: % (ID: %)', 
      gestionnaire_record.username, gestionnaire_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migration terminée: objectifs par défaut créés pour tous les gestionnaires existants';
END $$;

