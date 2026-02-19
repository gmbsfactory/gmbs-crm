-- ============================================================
-- Migration 99007: Passer abwebcraft.dev@gmail.com et h@gmbs.fr
-- du rôle admin au rôle dev (admin déguisé + manage_updates)
-- ============================================================

DO $$
DECLARE
  v_dev_role_id uuid;
  v_admin_role_id uuid;
  v_user_id uuid;
  v_emails text[] := ARRAY['abwebcraft.dev@gmail.com', 'h@gmbs.fr'];
  v_email text;
BEGIN
  SELECT id INTO v_dev_role_id FROM public.roles WHERE name = 'dev';
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin';

  FOREACH v_email IN ARRAY v_emails
  LOOP
    SELECT id INTO v_user_id FROM public.users WHERE email = v_email;
    IF v_user_id IS NOT NULL THEN
      -- Supprimer l'ancien rôle admin
      DELETE FROM public.user_roles
      WHERE user_id = v_user_id AND role_id = v_admin_role_id;

      -- S'assurer que le rôle dev est bien assigné
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (v_user_id, v_dev_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
