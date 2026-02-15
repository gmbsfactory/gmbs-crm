-- ========================================
-- GMBS CRM - Complete Authentication System
-- ========================================
-- Creates all users in Supabase Auth system with roles
-- This integrates with the existing authentication flow
-- Date: 2025-01-15
-- 
-- Usage: Run this AFTER the main seed_mockup.sql
-- This ensures all users are properly linked with authentication

-- ========================================
-- CREATE ALL USERS IN SUPABASE AUTH
-- ========================================

-- Admin user (admin) - Full access
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'admin@gmbs.fr', crypt('admin', gen_salt('bf')),
  NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin", "prenom": "Development"}', NOW(), NOW(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Admin user (badr) - Full access
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000013',
  'authenticated', 'authenticated', 'badr@gmbs.fr', crypt('badr123', gen_salt('bf')),
  NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
  '{"name": "Boss", "prenom": "Badr"}', NOW(), NOW(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Manager user (andrea) - Elevated permissions
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'andrea@gmbs.fr', crypt('andrea123', gen_salt('bf')),
  NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
  '{"name": "GAUTRET", "prenom": "Andrea"}', NOW(), NOW(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Gestionnaire users - Standard permissions
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'olivier@gmbs.fr', crypt('olivier123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Olivier", "prenom": "Gestionnaire"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'tom@gmbs.fr', crypt('tom123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Birckel", "prenom": "Tom"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated', 'paul@gmbs.fr', crypt('paul123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Aguenana", "prenom": "Paul"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006',
   'authenticated', 'authenticated', 'louis@gmbs.fr', crypt('louis123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Saune", "prenom": "Louis"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007',
   'authenticated', 'authenticated', 'samuel@gmbs.fr', crypt('samuel123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "s", "prenom": "Samuel"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008',
   'authenticated', 'authenticated', 'lucien@gmbs.fr', crypt('lucien123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "L", "prenom": "Lucien"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000009',
   'authenticated', 'authenticated', 'killian@gmbs.fr', crypt('killian123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "K", "prenom": "Killian"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000010',
   'authenticated', 'authenticated', 'dimitri@gmbs.fr', crypt('dimitri123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Montanari", "prenom": "Dimitri"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011',
   'authenticated', 'authenticated', 'soulaimane@gmbs.fr', crypt('soulaimane123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Soulaimane", "prenom": "Soulaimane"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012',
   'authenticated', 'authenticated', 'clement@gmbs.fr', crypt('clement123', gen_salt('bf')),
   NOW(), NULL, NULL, '{"provider": "email", "providers": ["email"]}',
   '{"name": "Clément", "prenom": "Clément"}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- UPDATE ALL USERS IN PUBLIC.USERS
-- ========================================
-- Note: Users are now created with fixed UUIDs in seed_mockup.sql
-- So this section is no longer necessary but kept for compatibility

-- First, update all foreign key references to match the new UUIDs (should be no-op now)
-- Update conversations.created_by
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE c.created_by = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE c.created_by = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE c.created_by = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE c.created_by = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE c.created_by = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE c.created_by = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE c.created_by = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE c.created_by = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE c.created_by = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE c.created_by = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE c.created_by = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.conversations c SET created_by = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE c.created_by = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update conversation_participants.user_id
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.conversation_participants cp SET user_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE cp.user_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update messages.author_id
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE m.author_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE m.author_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE m.author_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE m.author_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE m.author_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE m.author_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE m.author_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE m.author_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE m.author_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE m.author_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE m.author_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.messages m SET author_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE m.author_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update chat_sessions.user_id
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.chat_sessions cs SET user_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE cs.user_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update chat_messages.author_id
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.chat_messages cm SET author_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE cm.author_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update comments.author_id
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE co.author_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE co.author_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE co.author_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE co.author_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE co.author_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE co.author_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE co.author_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE co.author_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE co.author_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE co.author_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE co.author_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.comments co SET author_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE co.author_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update tasks.creator_id and tasks.assignee_id
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.tasks t SET creator_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE t.creator_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.tasks t SET assignee_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE t.assignee_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update intervention_attachments.created_by
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.intervention_attachments ia SET created_by = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE ia.created_by = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update artisan_attachments.created_by
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.artisan_attachments aa SET created_by = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE aa.created_by = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Update ai_views.owner_id
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000001' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'admin' AND u.email = 'admin@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000002' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'andrea' AND u.email = 'andrea@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000003' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'olivier' AND u.email = 'olivier@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000004' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'tom' AND u.email = 'tom@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000005' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'paul' AND u.email = 'paul@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000006' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'louis' AND u.email = 'louis@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000007' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'samuel' AND u.email = 'samuel@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000008' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'lucien' AND u.email = 'lucien@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000009' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'killian' AND u.email = 'killian@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000010' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'dimitri' AND u.email = 'dimitri@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000011' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'soulaimane' AND u.email = 'soulaimane@gmbs.fr';
UPDATE public.ai_views av SET owner_id = '00000000-0000-0000-0000-000000000012' FROM public.users u WHERE av.owner_id = u.id AND u.username = 'clement' AND u.email = 'clement@gmbs.fr';

-- Now update all users to use the same IDs as auth.users
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000001' WHERE username = 'admin' AND email = 'admin@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000013' WHERE username = 'badr' AND email = 'badr@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000002' WHERE username = 'andrea' AND email = 'andrea@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000003' WHERE username = 'olivier' AND email = 'olivier@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000004' WHERE username = 'tom' AND email = 'tom@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000005' WHERE username = 'paul' AND email = 'paul@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000006' WHERE username = 'louis' AND email = 'louis@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000007' WHERE username = 'samuel' AND email = 'samuel@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000008' WHERE username = 'lucien' AND email = 'lucien@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000009' WHERE username = 'killian' AND email = 'killian@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000010' WHERE username = 'dimitri' AND email = 'dimitri@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000011' WHERE username = 'soulaimane' AND email = 'soulaimane@gmbs.fr';
UPDATE public.users SET id = '00000000-0000-0000-0000-000000000012' WHERE username = 'clement' AND email = 'clement@gmbs.fr';

-- ========================================
-- CREATE ROLES AND PERMISSIONS
-- ========================================

-- Insert roles if they don't exist
INSERT INTO public.roles(name, description)
SELECT x.name, x.description
FROM (VALUES 
  ('admin', 'Administrator with full access to all features'),
  ('manager', 'Manager with elevated permissions for team management'),
  ('gestionnaire', 'Standard user with basic permissions for daily operations')
) AS x(name, description)
ON CONFLICT (name) DO NOTHING;

-- Insert permissions if they don't exist
INSERT INTO public.permissions(key, description)
SELECT x.key, x.description
FROM (VALUES 
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
  ('manage_roles', 'Manage user roles and page permissions'),
  ('manage_settings', 'Manage enums, agencies, workflow'),
  ('view_admin', 'Access admin dashboard and analytics'),
  ('view_comptabilite', 'View accounting page')
) AS x(key, description)
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- ASSIGN ROLES TO USERS
-- ========================================

-- Assign admin role to admin user
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  r.id
FROM public.roles r
WHERE r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign admin role to badr user
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  '00000000-0000-0000-0000-000000000013',
  r.id
FROM public.roles r
WHERE r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign manager role to andrea
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  r.id
FROM public.roles r
WHERE r.name = 'manager'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign gestionnaire role to all other users
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  u.id,
  r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE u.username IN ('olivier', 'tom', 'paul', 'louis', 'samuel', 'lucien', 'killian', 'dimitri', 'soulaimane', 'clement')
  AND r.name = 'gestionnaire'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ========================================
-- ASSIGN PERMISSIONS TO ROLES
-- ========================================

-- Admin permissions (all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager permissions (most permissions except user management)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager'
  AND p.key IN ('read_interventions', 'write_interventions',
                'read_artisans', 'write_artisans',
                'read_users', 'export_artisans', 'view_comptabilite')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Gestionnaire permissions (basic permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'gestionnaire'
  AND p.key IN ('read_interventions', 'write_interventions',
                'read_artisans', 'write_artisans')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify the complete setup
DO $$
DECLARE
  auth_count integer;
  users_count integer;
  roles_count integer;
  permissions_count integer;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users WHERE email LIKE '%@gmbs.fr';
  SELECT COUNT(*) INTO users_count FROM public.users WHERE email LIKE '%@gmbs.fr';
  SELECT COUNT(*) INTO roles_count FROM public.user_roles;
  SELECT COUNT(*) INTO permissions_count FROM public.role_permissions;
  
  RAISE NOTICE 'Complete Authentication System Setup:';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '- Auth users created: %', auth_count;
  RAISE NOTICE '- Profile users linked: %', users_count;
  RAISE NOTICE '- User roles assigned: %', roles_count;
  RAISE NOTICE '- Role permissions assigned: %', permissions_count;
  
  IF auth_count = 13 AND users_count = 13 AND roles_count >= 13 AND permissions_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ All users ready for authentication!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Login Credentials:';
    RAISE NOTICE '====================';
    RAISE NOTICE 'Admin (Full Access):';
    RAISE NOTICE '  Email: admin@gmbs.fr      Password: admin';
    RAISE NOTICE '  Email: badr@gmbs.fr       Password: badr123';
    RAISE NOTICE '';
    RAISE NOTICE 'Manager (Elevated Access):';
    RAISE NOTICE '  Email: andrea@gmbs.fr';
    RAISE NOTICE '  Password: andrea123';
    RAISE NOTICE '';
    RAISE NOTICE 'Gestionnaires (Standard Access):';
    RAISE NOTICE '  Email: olivier@gmbs.fr    Password: olivier123';
    RAISE NOTICE '  Email: tom@gmbs.fr        Password: tom123';
    RAISE NOTICE '  Email: paul@gmbs.fr       Password: paul123';
    RAISE NOTICE '  Email: louis@gmbs.fr      Password: louis123';
    RAISE NOTICE '  Email: samuel@gmbs.fr     Password: samuel123';
    RAISE NOTICE '  Email: lucien@gmbs.fr     Password: lucien123';
    RAISE NOTICE '  Email: killian@gmbs.fr    Password: killian123';
    RAISE NOTICE '  Email: dimitri@gmbs.fr    Password: dimitri123';
    RAISE NOTICE '  Email: soulaimane@gmbs.fr Password: soulaimane123';
    RAISE NOTICE '  Email: clement@gmbs.fr    Password: clement123';
    RAISE NOTICE '';
    RAISE NOTICE '🎭 Role Hierarchy:';
    RAISE NOTICE '=================';
    RAISE NOTICE '- Admin: Full system access (admin@gmbs.fr)';
    RAISE NOTICE '- Manager: Team management (andrea@gmbs.fr)';
    RAISE NOTICE '- Gestionnaire: Daily operations (all others)';
  ELSE
    RAISE WARNING '⚠️  Setup may be incomplete. Check the counts above.';
  END IF;
END $$;
