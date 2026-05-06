-- ========================================
-- Permissions CSV import/export interventions
-- ========================================
-- Spec : docs/specs/crm-csv-import-export.md §8.3
--
-- export_interventions : déjà disponible dans l'UI Settings (livré). On crée
--   la permission rétroactivement et on l'attribue aux rôles qui avaient déjà
--   accès à l'export (admin, manager, gestionnaire) pour ne pas régresser.
--
-- import_interventions : nouveauté à venir. Restreinte à `admin` uniquement
--   (décision §8.3 : un import CSV peut écraser des données, donc admin only).

INSERT INTO public.permissions (key, description)
VALUES
  ('export_interventions', 'Export interventions to CSV (in-app, RLS-bound)'),
  ('import_interventions', 'Import interventions from CSV (in-app, RLS-bound, admin only)')
ON CONFLICT (key) DO NOTHING;

-- Admin : les deux permissions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.key IN ('export_interventions', 'import_interventions')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager + Gestionnaire : export uniquement (parité avec l'accès actuel).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'export_interventions'
WHERE r.name IN ('manager', 'gestionnaire')
ON CONFLICT (role_id, permission_id) DO NOTHING;
