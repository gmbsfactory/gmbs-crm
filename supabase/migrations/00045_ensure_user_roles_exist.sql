-- ========================================
-- Ensure User Roles Exist
-- ========================================
-- Assigns default role to users without any role

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id FROM public.users u CROSS JOIN public.roles r
WHERE r.name = 'gestionnaire'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Debug view
CREATE OR REPLACE VIEW public.v_user_permissions_debug AS
SELECT u.id as user_id, u.email, u.username, r.name as role_name,
  array_agg(DISTINCT p.key ORDER BY p.key) as permissions
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
LEFT JOIN public.permissions p ON rp.permission_id = p.id
GROUP BY u.id, u.email, u.username, r.name;

GRANT SELECT ON public.v_user_permissions_debug TO authenticated;

