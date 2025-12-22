-- ========================================
-- Fix Role Permissions Synchronization
-- ========================================
-- Ensures role_permissions table matches the expected permissions per role
-- Manager/Gestionnaire should NOT have delete_interventions

DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'manager')
  AND permission_id IN (SELECT id FROM public.permissions WHERE key IN (
    'delete_interventions', 'edit_closed_interventions', 'delete_artisans',
    'write_users', 'delete_users', 'manage_roles', 'manage_settings', 'view_admin'
  ));

DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'gestionnaire')
  AND permission_id IN (SELECT id FROM public.permissions WHERE key IN (
    'delete_interventions', 'edit_closed_interventions', 'delete_artisans',
    'export_artisans', 'write_users', 'delete_users', 'manage_roles',
    'manage_settings', 'view_admin', 'view_comptabilite'
  ));

-- Ensure admin has all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

