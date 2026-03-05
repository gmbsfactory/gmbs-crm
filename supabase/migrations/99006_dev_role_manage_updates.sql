-- ============================================================
-- Migration 99006: Rôle "dev" + permission "manage_updates"
--
-- Le rôle "dev" est un admin déguisé avec la permission
-- supplémentaire "manage_updates" (gestion des app_updates).
-- Ce rôle n'est PAS attribuable via l'UI.
-- Attribution uniquement via SQL Editor.
-- ============================================================

-- 1. Créer le rôle "dev"
INSERT INTO public.roles (name, description)
VALUES ('dev', 'Développeur — admin avec gestion des mises à jour applicatives')
ON CONFLICT (name) DO NOTHING;

-- 2. Créer la permission "manage_updates"
INSERT INTO public.permissions (key, description)
VALUES ('manage_updates', 'Gérer les mises à jour de l''application (créer, modifier, publier, supprimer)')
ON CONFLICT (key) DO NOTHING;

-- 3. Associer TOUTES les permissions admin + manage_updates au rôle "dev"
DO $$
DECLARE
  v_dev_role_id uuid;
  v_perm record;
  v_admin_perm_keys text[] := ARRAY[
    'read_interventions', 'write_interventions', 'delete_interventions', 'edit_closed_interventions',
    'read_artisans', 'write_artisans', 'delete_artisans', 'export_artisans',
    'read_users', 'write_users', 'delete_users', 'manage_roles',
    'manage_settings', 'view_admin', 'view_comptabilite',
    'manage_updates'
  ];
BEGIN
  SELECT id INTO v_dev_role_id FROM public.roles WHERE name = 'dev';

  FOR v_perm IN
    SELECT id FROM public.permissions WHERE key = ANY(v_admin_perm_keys)
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_dev_role_id, v_perm.id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Assigner le rôle "dev" aux développeurs
DO $$
DECLARE
  v_dev_role_id uuid;
  v_user_id uuid;
  v_emails text[] := ARRAY['abwebcraft.dev@gmail.com', 'h@gmbs.fr'];
  v_email text;
BEGIN
  SELECT id INTO v_dev_role_id FROM public.roles WHERE name = 'dev';

  FOREACH v_email IN ARRAY v_emails
  LOOP
    SELECT id INTO v_user_id FROM public.users WHERE email = v_email;
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (v_user_id, v_dev_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
