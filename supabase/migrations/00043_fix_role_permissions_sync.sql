-- ========================================
-- Fix Role Permissions Synchronization
-- ========================================
-- Version: 1.0
-- Date: 2025-12-22
-- Description: Ensures role_permissions table matches the expected permissions
--              per role as defined in the system specification.
-- 
-- This migration:
-- 1. Removes any extra permissions that shouldn't be in role_permissions
-- 2. Ensures each role has exactly the permissions it should have
-- 3. Does NOT touch user_permissions (individual overrides are preserved)

-- ========================================
-- 1️⃣ CLEAN UP: Remove extra permissions from Manager role
-- ========================================
-- Manager should NOT have: delete_interventions, edit_closed_interventions, 
-- delete_artisans, write_users, delete_users, manage_roles, manage_settings, view_admin

DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'manager')
  AND permission_id IN (
    SELECT id FROM public.permissions 
    WHERE key IN (
      'delete_interventions',
      'edit_closed_interventions', 
      'delete_artisans',
      'write_users',
      'delete_users',
      'manage_roles',
      'manage_settings',
      'view_admin'
    )
  );

-- ========================================
-- 2️⃣ CLEAN UP: Remove extra permissions from Gestionnaire role
-- ========================================
-- Gestionnaire should NOT have: delete_interventions, edit_closed_interventions,
-- delete_artisans, export_artisans, write_users, delete_users, manage_roles, 
-- manage_settings, view_admin, view_comptabilite

DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'gestionnaire')
  AND permission_id IN (
    SELECT id FROM public.permissions 
    WHERE key IN (
      'delete_interventions',
      'edit_closed_interventions',
      'delete_artisans',
      'export_artisans',
      'write_users',
      'delete_users',
      'manage_roles',
      'manage_settings',
      'view_admin',
      'view_comptabilite'
    )
  );

-- ========================================
-- 3️⃣ ENSURE: Admin has ALL permissions
-- ========================================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- 4️⃣ ENSURE: Manager has correct permissions
-- ========================================
-- Manager permissions: read_interventions, write_interventions, read_artisans, 
-- write_artisans, read_users, export_artisans, view_comptabilite

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'read_interventions',
  'write_interventions',
  'read_artisans',
  'write_artisans',
  'read_users',
  'export_artisans',
  'view_comptabilite'
)
WHERE r.name = 'manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- 5️⃣ ENSURE: Gestionnaire has correct permissions
-- ========================================
-- Gestionnaire permissions: read_interventions, write_interventions, 
-- read_artisans, write_artisans, read_users

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'read_interventions',
  'write_interventions',
  'read_artisans',
  'write_artisans',
  'read_users'
)
WHERE r.name = 'gestionnaire'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- 6️⃣ VERIFICATION QUERY (for debugging)
-- ========================================
-- Run this to verify the fix:
-- SELECT r.name as role, array_agg(p.key ORDER BY p.key) as permissions
-- FROM public.role_permissions rp
-- JOIN public.roles r ON r.id = rp.role_id
-- JOIN public.permissions p ON p.id = rp.permission_id
-- GROUP BY r.name
-- ORDER BY r.name;

COMMENT ON TABLE public.role_permissions IS 'Role-based permissions. Admin=all, Manager=read/write interventions+artisans+users+export+comptabilite, Gestionnaire=read/write interventions+artisans+read users';


