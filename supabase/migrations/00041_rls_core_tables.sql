-- ========================================
-- RLS Policies for Core CRM Tables
-- ========================================
-- Version: 1.0
-- Date: 2025-12-22
-- Description: Row Level Security for users, artisans, interventions
-- 
-- NOTE: Most API routes use supabaseAdmin which bypasses RLS.
-- These policies protect:
-- 1. Direct Supabase client access from frontend
-- 2. PostgREST direct access
-- 3. Future migration to authenticated client

-- ========================================
-- 1️⃣ AUTH USER MAPPING TABLE
-- ========================================

-- Create auth_user_mapping table if it doesn't exist
-- This table links auth.users.id to public.users.id
CREATE TABLE IF NOT EXISTS public.auth_user_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  public_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_user_mapping_auth_user_id ON public.auth_user_mapping(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_mapping_public_user_id ON public.auth_user_mapping(public_user_id);

COMMENT ON TABLE public.auth_user_mapping IS 'Maps Supabase Auth user IDs to public.users IDs for RLS policies';

-- ========================================
-- 2️⃣ HELPER FUNCTIONS
-- ========================================

-- Function to get public user ID from auth.uid()
-- Uses auth_user_mapping table, otherwise falls back to email match
CREATE OR REPLACE FUNCTION public.get_public_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_public_user_id uuid;
  v_email text;
BEGIN
  -- Try auth_user_mapping first (faster)
  SELECT public_user_id INTO v_public_user_id
  FROM public.auth_user_mapping
  WHERE auth_user_id = auth.uid();
  
  IF v_public_user_id IS NOT NULL THEN
    RETURN v_public_user_id;
  END IF;
  
  -- Fallback: match by email
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_public_user_id FROM public.users WHERE email = v_email;
  END IF;
  
  RETURN v_public_user_id;
END;
$$;

-- Function to check if current user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_public_user_id uuid;
BEGIN
  v_public_user_id := public.get_public_user_id();
  IF v_public_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_public_user_id
    AND lower(r.name) = lower(role_name)
  );
END;
$$;

-- Function to check if current user has any of the specified roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(role_names text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_public_user_id uuid;
BEGIN
  v_public_user_id := public.get_public_user_id();
  IF v_public_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_public_user_id
    AND lower(r.name) = ANY(SELECT lower(unnest(role_names)))
  );
END;
$$;

-- ========================================
-- 3️⃣ USERS TABLE RLS
-- ========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read users (for selectors, assignments)
DROP POLICY IF EXISTS users_select_authenticated ON public.users;
CREATE POLICY users_select_authenticated ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can insert users
DROP POLICY IF EXISTS users_insert_admin ON public.users;
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

-- Users can update their own profile, admin can update anyone
DROP POLICY IF EXISTS users_update_self_or_admin ON public.users;
CREATE POLICY users_update_self_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING (
    id = public.get_public_user_id() 
    OR public.user_has_role('admin')
  )
  WITH CHECK (
    id = public.get_public_user_id() 
    OR public.user_has_role('admin')
  );

-- Only admin can delete users
DROP POLICY IF EXISTS users_delete_admin ON public.users;
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 4️⃣ USER_ROLES TABLE RLS
-- ========================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read roles (for display)
DROP POLICY IF EXISTS user_roles_select_authenticated ON public.user_roles;
CREATE POLICY user_roles_select_authenticated ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can manage user roles
DROP POLICY IF EXISTS user_roles_insert_admin ON public.user_roles;
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_roles_update_admin ON public.user_roles;
CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 5️⃣ USER_PAGE_PERMISSIONS TABLE RLS
-- ========================================

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own page permissions, admin can read all
DROP POLICY IF EXISTS user_page_permissions_select ON public.user_page_permissions;
CREATE POLICY user_page_permissions_select ON public.user_page_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = public.get_public_user_id() 
    OR public.user_has_role('admin')
  );

-- Only admin can manage page permissions
DROP POLICY IF EXISTS user_page_permissions_insert_admin ON public.user_page_permissions;
CREATE POLICY user_page_permissions_insert_admin ON public.user_page_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_page_permissions_update_admin ON public.user_page_permissions;
CREATE POLICY user_page_permissions_update_admin ON public.user_page_permissions
  FOR UPDATE TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_page_permissions_delete_admin ON public.user_page_permissions;
CREATE POLICY user_page_permissions_delete_admin ON public.user_page_permissions
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 6️⃣ ARTISANS TABLE RLS
-- ========================================

ALTER TABLE public.artisans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read artisans
DROP POLICY IF EXISTS artisans_select_authenticated ON public.artisans;
CREATE POLICY artisans_select_authenticated ON public.artisans
  FOR SELECT TO authenticated
  USING (true);

-- Admin, manager, gestionnaire can insert artisans
DROP POLICY IF EXISTS artisans_insert_authorized ON public.artisans;
CREATE POLICY artisans_insert_authorized ON public.artisans
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));

-- Admin, manager, gestionnaire can update artisans
DROP POLICY IF EXISTS artisans_update_authorized ON public.artisans;
CREATE POLICY artisans_update_authorized ON public.artisans
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']))
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));

-- Only admin can delete artisans
DROP POLICY IF EXISTS artisans_delete_admin ON public.artisans;
CREATE POLICY artisans_delete_admin ON public.artisans
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 7️⃣ INTERVENTIONS TABLE RLS
-- ========================================

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read interventions
DROP POLICY IF EXISTS interventions_select_authenticated ON public.interventions;
CREATE POLICY interventions_select_authenticated ON public.interventions
  FOR SELECT TO authenticated
  USING (true);

-- Admin, manager, gestionnaire can insert interventions
DROP POLICY IF EXISTS interventions_insert_authorized ON public.interventions;
CREATE POLICY interventions_insert_authorized ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));

-- Admin, manager, gestionnaire can update interventions
DROP POLICY IF EXISTS interventions_update_authorized ON public.interventions;
CREATE POLICY interventions_update_authorized ON public.interventions
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']))
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));

-- Only admin can delete interventions
DROP POLICY IF EXISTS interventions_delete_admin ON public.interventions;
CREATE POLICY interventions_delete_admin ON public.interventions
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 8️⃣ ROLES & PERMISSIONS TABLES RLS
-- ========================================

-- roles table: read-only for all authenticated
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS roles_modify_admin ON public.roles;
CREATE POLICY roles_modify_admin ON public.roles
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- permissions table: read-only for all authenticated
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS permissions_modify_admin ON public.permissions;
CREATE POLICY permissions_modify_admin ON public.permissions
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- role_permissions table: read-only for all authenticated
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_authenticated ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_permissions_modify_admin ON public.role_permissions;
CREATE POLICY role_permissions_modify_admin ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- ========================================
-- 9️⃣ REFERENCE DATA TABLES RLS
-- ========================================

-- metiers: all can read, admin can modify
ALTER TABLE public.metiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metiers_select_authenticated ON public.metiers;
CREATE POLICY metiers_select_authenticated ON public.metiers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS metiers_modify_admin ON public.metiers;
CREATE POLICY metiers_modify_admin ON public.metiers
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- agencies: all can read, admin can modify
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agencies_select_authenticated ON public.agencies;
CREATE POLICY agencies_select_authenticated ON public.agencies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS agencies_modify_admin ON public.agencies;
CREATE POLICY agencies_modify_admin ON public.agencies
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- intervention_statuses: all can read, admin can modify
ALTER TABLE public.intervention_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intervention_statuses_select_authenticated ON public.intervention_statuses;
CREATE POLICY intervention_statuses_select_authenticated ON public.intervention_statuses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS intervention_statuses_modify_admin ON public.intervention_statuses;
CREATE POLICY intervention_statuses_modify_admin ON public.intervention_statuses
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- artisan_statuses: all can read, admin can modify
ALTER TABLE public.artisan_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artisan_statuses_select_authenticated ON public.artisan_statuses;
CREATE POLICY artisan_statuses_select_authenticated ON public.artisan_statuses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS artisan_statuses_modify_admin ON public.artisan_statuses;
CREATE POLICY artisan_statuses_modify_admin ON public.artisan_statuses
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON FUNCTION public.get_public_user_id() IS 'Resolves auth.uid() to public.users.id via auth_user_mapping or email fallback';
COMMENT ON FUNCTION public.user_has_role(text) IS 'Checks if current authenticated user has the specified role';
COMMENT ON FUNCTION public.user_has_any_role(text[]) IS 'Checks if current authenticated user has any of the specified roles';

