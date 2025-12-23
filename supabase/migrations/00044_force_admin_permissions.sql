-- ========================================
-- Force Admin Permissions (Production Fix)
-- ========================================
-- Ensures admin role has ALL permissions

INSERT INTO public.permissions (key, description) VALUES
  ('read_interventions', 'Read interventions'),
  ('write_interventions', 'Create and edit interventions'),
  ('delete_interventions', 'Delete interventions'),
  ('edit_closed_interventions', 'Edit closed interventions'),
  ('read_artisans', 'Read artisans'),
  ('write_artisans', 'Create and edit artisans'),
  ('delete_artisans', 'Delete artisans'),
  ('export_artisans', 'Export artisans'),
  ('read_users', 'Read users'),
  ('write_users', 'Create and edit users'),
  ('delete_users', 'Delete users'),
  ('manage_roles', 'Manage user roles and permissions'),
  ('manage_settings', 'Manage system settings'),
  ('view_admin', 'View admin dashboard'),
  ('view_comptabilite', 'View accounting page')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles (name) VALUES ('admin'), ('manager'), ('gestionnaire')
ON CONFLICT (name) DO NOTHING;

-- Clean and reinsert all role permissions
DELETE FROM public.role_permissions WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin');
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'admin';

DELETE FROM public.role_permissions WHERE role_id = (SELECT id FROM public.roles WHERE name = 'manager');
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.key IN (
  'read_interventions', 'write_interventions', 'read_artisans', 'write_artisans',
  'read_users', 'export_artisans', 'view_comptabilite'
) WHERE r.name = 'manager';

DELETE FROM public.role_permissions WHERE role_id = (SELECT id FROM public.roles WHERE name = 'gestionnaire');
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.key IN (
  'read_interventions', 'write_interventions', 'read_artisans', 'write_artisans', 'read_users'
) WHERE r.name = 'gestionnaire';

