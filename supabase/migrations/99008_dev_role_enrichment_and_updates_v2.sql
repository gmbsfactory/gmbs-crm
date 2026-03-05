-- ============================================================
-- Migration 99008: Correctifs rôle dev + enrichissement app_updates
--
-- 1a. Restaurer le rôle admin aux devs (annule la suppression de 99007)
-- 1b. Étendre la contrainte severity (ajout 'feature', 'fix')
-- 1c. Corriger les policies RLS (admin OR dev)
-- 1d. Activer le realtime sur app_update_views
-- ============================================================

-- ============================================================
-- 1a. Restaurer le rôle admin aux développeurs
-- La migration 99007 a supprimé admin au lieu de le laisser coexister
-- avec dev. On ré-insère admin pour ces utilisateurs.
-- ============================================================

DO $$
DECLARE
  v_admin_role_id uuid;
  v_user_id uuid;
  v_emails text[] := ARRAY['abwebcraft.dev@gmail.com', 'h@gmbs.fr'];
  v_email text;
BEGIN
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin';
  FOREACH v_email IN ARRAY v_emails
  LOOP
    SELECT id INTO v_user_id FROM public.users WHERE email = v_email;
    IF v_user_id IS NOT NULL AND v_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (v_user_id, v_admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 1b. Étendre la contrainte severity
-- Ajout de 'feature' et 'fix' aux valeurs autorisées
-- ============================================================

ALTER TABLE public.app_updates DROP CONSTRAINT app_updates_severity_check;
ALTER TABLE public.app_updates ADD CONSTRAINT app_updates_severity_check
  CHECK (severity IN ('info', 'important', 'breaking', 'feature', 'fix'));

-- ============================================================
-- 1c. Corriger les policies RLS — admin OR dev
-- ============================================================

-- --- app_updates ---

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "app_updates_select_published" ON public.app_updates;
DROP POLICY IF EXISTS "app_updates_insert_admin" ON public.app_updates;
DROP POLICY IF EXISTS "app_updates_update_admin" ON public.app_updates;
DROP POLICY IF EXISTS "app_updates_delete_admin" ON public.app_updates;

-- SELECT : tous voient les publiées, admin/dev voient aussi les brouillons
CREATE POLICY "app_updates_select_published"
  ON public.app_updates FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR public.user_has_role('admin')
    OR public.user_has_role('dev')
  );

-- INSERT : admin ou dev
CREATE POLICY "app_updates_insert_admin"
  ON public.app_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('dev')
  );

-- UPDATE : admin ou dev
CREATE POLICY "app_updates_update_admin"
  ON public.app_updates FOR UPDATE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('dev')
  )
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('dev')
  );

-- DELETE : admin ou dev
CREATE POLICY "app_updates_delete_admin"
  ON public.app_updates FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('dev')
  );

-- --- app_update_views ---

-- Supprimer l'ancienne policy admin-only pour SELECT
DROP POLICY IF EXISTS "app_update_views_select_admin" ON public.app_update_views;

-- SELECT : admin ou dev peut voir toutes les vues
CREATE POLICY "app_update_views_select_admin"
  ON public.app_update_views FOR SELECT
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('dev')
  );

-- ============================================================
-- 1d. Activer le realtime sur app_update_views
-- ============================================================

ALTER TABLE public.app_update_views REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_update_views;
