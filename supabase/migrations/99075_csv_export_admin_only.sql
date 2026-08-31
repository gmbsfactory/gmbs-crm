-- ========================================
-- Export CSV interventions : admin uniquement
-- ========================================
-- Contexte : `import_interventions` est déjà restreinte à `admin` (99025).
-- `export_interventions` avait été attribuée à `manager` et `gestionnaire`
-- par parité avec l'accès historique de l'UI Settings.
--
-- Décision : l'export CSV expose l'intégralité du référentiel interventions
-- (montants, coûts, marges, données clients). On l'aligne sur l'import et on
-- la réserve aux administrateurs.
--
-- Effet : les cartes Import/Export de la page Profil disparaissent pour les
-- non-admins (gating `can('export_interventions')` / `can('import_interventions')`)
-- et les routes API `/api/exports/interventions` et `/api/imports/interventions`
-- répondent 403 via `requirePermission`.

DELETE FROM public.role_permissions
WHERE permission_id = (
    SELECT id FROM public.permissions WHERE key = 'export_interventions'
  )
  AND role_id IN (
    SELECT id FROM public.roles WHERE name <> 'admin'
  );

-- Filet de sécurité : l'admin conserve bien les deux permissions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.key IN ('export_interventions', 'import_interventions')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public.role_permissions IS
  'Attribution des permissions par rôle. export_interventions et import_interventions sont réservées à admin (99075).';
