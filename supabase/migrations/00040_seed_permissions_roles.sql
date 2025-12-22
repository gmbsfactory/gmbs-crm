-- ========================================
-- Seed missing permissions + role mapping (existing DBs)
-- ========================================

-- Add new permissions from legacy mapping
INSERT INTO public.permissions (key, description)
VALUES
  ('edit_closed_interventions', 'Edit closed interventions'),
  ('export_artisans', 'Export artisans'),
  ('view_comptabilite', 'View accounting page'),
  ('manage_roles', 'Manage user roles and page permissions'),
  ('manage_settings', 'Manage enums, agencies, workflow'),
  ('view_admin', 'Access admin dashboard and analytics')
ON CONFLICT (key) DO NOTHING;

UPDATE public.permissions
SET description = 'Manage user roles and page permissions'
WHERE key = 'manage_roles';

-- Remove deprecated permissions (billing, analytics)
DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND p.key IN ('manage_billing', 'view_analytics');

DELETE FROM public.permissions
WHERE key IN ('manage_billing', 'view_analytics');

-- Admin gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager mapping
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

-- Gestionnaire mapping
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
