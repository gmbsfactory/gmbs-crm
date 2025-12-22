-- ========================================
-- User Permissions (Individual Overrides)
-- ========================================
-- Version: 1.0
-- Date: 2025-12-22
-- Description: Allows per-user permission customization
-- 
-- Logic:
-- 1. User gets base permissions from their role via role_permissions
-- 2. user_permissions can GRANT (+) or REVOKE (-) specific permissions
-- 3. Final permissions = (role_permissions) + (user grants) - (user revokes)

-- ========================================
-- 1️⃣ USER PERMISSIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  -- true = granted (override to add), false = revoked (override to remove)
  granted boolean NOT NULL DEFAULT true,
  -- Who made this change
  granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON public.user_permissions(permission_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER trigger_update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- ========================================
-- 2️⃣ FUNCTION TO GET USER PERMISSIONS
-- ========================================

-- Function to get all effective permissions for a user
-- Combines role permissions with user overrides
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS TABLE (permission_key text, granted boolean, source text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH 
    -- Get permissions from user's role(s)
    role_perms AS (
      SELECT DISTINCT p.key, true AS granted, 'role' AS source
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      JOIN public.permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = p_user_id
    ),
    -- Get user-specific overrides
    user_overrides AS (
      SELECT p.key, up.granted, 'user' AS source
      FROM public.user_permissions up
      JOIN public.permissions p ON up.permission_id = p.id
      WHERE up.user_id = p_user_id
    ),
    -- Combine: user overrides take precedence
    combined AS (
      SELECT 
        COALESCE(uo.key, rp.key) AS key,
        COALESCE(uo.granted, rp.granted) AS granted,
        COALESCE(uo.source, rp.source) AS source
      FROM role_perms rp
      FULL OUTER JOIN user_overrides uo ON rp.key = uo.key
    )
  SELECT combined.key, combined.granted, combined.source
  FROM combined
  WHERE combined.granted = true;
END;
$$;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_has_permission boolean;
BEGIN
  -- Check user override first
  SELECT up.granted INTO v_has_permission
  FROM public.user_permissions up
  JOIN public.permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id AND p.key = p_permission_key;
  
  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;
  
  -- Fall back to role permissions
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id AND p.key = p_permission_key
  ) INTO v_has_permission;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$;

-- ========================================
-- 3️⃣ RLS POLICIES
-- ========================================

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
DROP POLICY IF EXISTS user_permissions_select_own ON public.user_permissions;
CREATE POLICY user_permissions_select_own ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = public.get_public_user_id()
    OR public.user_has_role('admin')
  );

-- Only admin can modify permissions
DROP POLICY IF EXISTS user_permissions_insert_admin ON public.user_permissions;
CREATE POLICY user_permissions_insert_admin ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_permissions_update_admin ON public.user_permissions;
CREATE POLICY user_permissions_update_admin ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS user_permissions_delete_admin ON public.user_permissions;
CREATE POLICY user_permissions_delete_admin ON public.user_permissions
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ========================================
-- 4️⃣ COMMENTS
-- ========================================

COMMENT ON TABLE public.user_permissions IS 'Per-user permission overrides. Grants or revokes specific permissions regardless of role.';
COMMENT ON COLUMN public.user_permissions.granted IS 'true = permission granted, false = permission revoked (even if role has it)';
COMMENT ON COLUMN public.user_permissions.granted_by IS 'Admin who granted/revoked this permission';
COMMENT ON FUNCTION public.get_user_permissions(uuid) IS 'Returns all effective permissions for a user (role + overrides)';
COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS 'Checks if user has a specific permission (considering overrides)';



