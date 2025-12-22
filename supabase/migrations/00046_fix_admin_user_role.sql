-- ========================================
-- Fix Admin User Role
-- ========================================
-- Ensures admin@gmbs.fr has admin role

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id FROM public.users u CROSS JOIN public.roles r
WHERE u.email = 'admin@gmbs.fr' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id FROM public.users u CROSS JOIN public.roles r
WHERE u.username = 'admin' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Remove other roles from admin user (keep only admin)
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM public.users WHERE email = 'admin@gmbs.fr' OR username = 'admin')
  AND role_id != (SELECT id FROM public.roles WHERE name = 'admin');

