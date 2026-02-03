-- ========================================
-- CRÉATION D'UN UTILISATEUR DE TEST
-- ========================================
-- Script pour créer un utilisateur de test avec authentification

-- 1. Créer l'utilisateur dans auth.users (authentification Supabase)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test@gmbs.fr',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NULL,
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Test", "last_name": "User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- 2. Créer l'utilisateur dans public.users (données métier)
INSERT INTO public.users (
  id,
  username,
  email,
  firstname,
  lastname,
  color,
  code_gestionnaire,
  status,
  token_version,
  last_seen_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test',
  'test@gmbs.fr',
  'Test',
  'User',
  '#FF6B6B',
  'TEST',
  'connected',
  0,
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- 3. Créer un utilisateur admin également
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@gmbs.fr',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NULL,
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Admin", "last_name": "User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id,
  username,
  email,
  firstname,
  lastname,
  color,
  code_gestionnaire,
  status,
  token_version,
  last_seen_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin',
  'admin@gmbs.fr',
  'Admin',
  'User',
  '#FF0000',
  'ADMIN',
  'connected',
  0,
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- 4. Afficher les utilisateurs créés
SELECT 
  u.username,
  u.email,
  u.firstname,
  u.lastname,
  u.code_gestionnaire,
  u.status
FROM public.users u
WHERE u.username IN ('test', 'admin')
ORDER BY u.username;
