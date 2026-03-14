-- ========================================
-- GMBS CRM - Essential Data Only
-- ========================================
-- This seed file contains ONLY essential reference data:
-- - Users (gestionnaires GMBS)
-- - Métiers (reference data)
-- - Zones (reference data)
-- - Statuts (reference data)
-- - Base agencies (reference data)
--
-- NO MOCKUP DATA (artisans, interventions, clients)
-- Real data will come from Google Sheets import
-- 
-- Date: 2025-10-28
-- ========================================

-- ========================================
-- 1️⃣ USERS (GESTIONNAIRES)
-- ========================================
-- Using fixed UUIDs to match auth.users created in seed_admin_auth.sql

INSERT INTO public.users (
  id, username, email, firstname, lastname, color, code_gestionnaire, status, token_version, last_seen_at, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'admin@gmbs.fr', 'Development', 'Admin', '#FF0000', 'ADMIN', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000013', 'badr', 'badr@gmbs.fr', 'Boujimal', 'Badr', '#FF6B6B', 'B', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'andrea', 'andrea@gmbs.fr', 'GAUTRET', 'Andrea', '#C5E0F4', 'A', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'olivier', 'olivier@gmbs.fr', 'Gestionnaire', 'Olivier', '#A22116', 'O', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'tom', 'tom@gmbs.fr', 'Birckel', 'Tom', '#A22116', 'T', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'paul', 'paul@gmbs.fr', 'Aguenana', 'Paul', '#EBF551', 'P', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000006', 'louis', 'louis@gmbs.fr', 'Saune', 'Louis', '#69D9E5', 'J', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000007', 'samuel', 'samuel@gmbs.fr', 's', 'Samuel', '#543481', 'S', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000008', 'lucien', 'lucien@gmbs.fr', 'L', 'Lucien', '#35714E', 'L', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000009', 'killian', 'killian@gmbs.fr', 'K', 'Killian', '#1227A1', 'K', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000010', 'dimitri', 'dimitri@gmbs.fr', 'Montanari', 'Dimitri', '#FBE6A8', 'D', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000011', 'soulaimane', 'soulaimane@gmbs.fr', 'Soulaimane', 'Soulaimane', '#FF6B6B', 'SO', 'offline', 0, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', 'clement', 'clement@gmbs.fr', 'Clément', 'Clément', '#4ECDC4', 'C', 'offline', 0, NULL, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  firstname = EXCLUDED.firstname,
  lastname = EXCLUDED.lastname,
  color = EXCLUDED.color,
  code_gestionnaire = EXCLUDED.code_gestionnaire,
  updated_at = NOW();

-- ========================================
-- 2️⃣ MÉTIERS (REFERENCE DATA)
-- ========================================

INSERT INTO public.metiers (code, label, description, color) VALUES
('AUTRES', 'AUTRES', 'Autres métiers', '#6B7280'),
('BRICOLAGE', 'Bricolage', 'Bricolage et petits travaux', '#6366F1'),
('CAMION', 'CAMION', 'Services de camion', '#84CC16'),
('CHAUFFAGE', 'Chauffage', 'Installation et réparation chauffage', '#EF4444'),
('CLIMATISATION', 'Climatisation', 'Climatisation et ventilation', '#06B6D4'),
('ELECTRICITE', 'Electricite', 'Électricité générale', '#F59E0B'),
('ELECTROMENAGER', 'Electroménager', 'Électroménager', '#0EA5E9'),
('ENTRETIEN_GENERAL', 'Entretien général', 'Entretien général', '#14B8A6'),
('JARDINAGE', 'Jardinage', 'Jardinage et espaces verts', '#22C55E'),
('MENUISIER', 'Menuiserie', 'Menuiserie et ébénisterie', '#10B981'),
('MULTI-SERVICE', 'Multi-Service', 'Services multiples', '#A855F7'),
('MENAGE', 'Menage', 'Services de ménage', '#FB7185'),
('NETTOYAGE', 'Nettoyage', 'Services de nettoyage', '#34D399'),
('NUISIBLE', 'Nuisible', 'Lutte contre les nuisibles', '#F87171'),
('PEINTURE', 'Peinture', 'Peinture et décoration', '#8B5CF6'),
('PLOMBERIE', 'Plomberie', 'Plomberie générale', '#3B82F6'),
('RDF', 'RDF', 'Réparation de défauts', '#60A5FA'),
('RENOVATION', 'Renovation', 'Rénovation générale', '#C084FC'),
('SERRURERIE', 'Serrurerie', 'Serrurerie et sécurité', '#F97316'),
('VITRERIE', 'Vitrerie', 'Vitrerie et miroiterie', '#EC4899'),
('VOLET-STORE', 'Volet/Store', 'Volets et stores', '#818CF8')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 3️⃣ AGENCIES (REFERENCE DATA)
-- ========================================

INSERT INTO public.agencies (code, label, region) VALUES
('DEFAUT', 'Défaut', 'Non spécifié')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 4️⃣ ZONES (REFERENCE DATA)
-- ========================================

INSERT INTO public.zones (code, label, region) VALUES 
('PARIS', 'Paris', 'Île-de-France'),
('LYON', 'Lyon', 'Auvergne-Rhône-Alpes'),
('MARSEILLE', 'Marseille', 'Provence-Alpes-Côte d''Azur'),
('TOULOUSE', 'Toulouse', 'Occitanie'),
('NICE', 'Nice', 'Provence-Alpes-Côte d''Azur'),
('NANTES', 'Nantes', 'Pays de la Loire'),
('STRASBOURG', 'Strasbourg', 'Grand Est'),
('MONTPELLIER', 'Montpellier', 'Occitanie'),
('BORDEAUX', 'Bordeaux', 'Nouvelle-Aquitaine'),
('LILLE', 'Lille', 'Hauts-de-France')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 5️⃣ STATUTS ARTISANS (REFERENCE DATA)
-- ========================================

INSERT INTO public.artisan_statuses (code, label, color, sort_order) VALUES 
('CANDIDAT', 'Candidat', '#A855F7', 1),
('ONE_SHOT', 'One Shot', '#F97316', 2),
('POTENTIEL', 'Potentiel', '#FACC15', 3),
('NOVICE', 'Novice', '#60A5FA', 4),
('FORMATION', 'Formation', '#38BDF8', 5),
('CONFIRME', 'Confirmé', '#22C55E', 6),
('EXPERT', 'Expert', '#6366F1', 7),
('INACTIF', 'Inactif', '#EF4444', 8),
('ARCHIVE', 'Archivé', '#6B7280', 9)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 6️⃣ STATUTS INTERVENTIONS (REFERENCE DATA)
-- ========================================

INSERT INTO public.intervention_statuses (code, label, color, sort_order) VALUES 
('DEMANDE', 'Demandé', '#3B82F6', 1),
('ACCEPTE', 'Accepté', '#10B981', 2),
('DEVIS_ENVOYE', 'Devis Envoyé', '#8B5CF6', 3),
('INTER_EN_COURS', 'Inter en cours', '#F59E0B', 4),
('INTER_TERMINEE', 'Inter terminée', '#10B981', 5),
('VISITE_TECHNIQUE', 'Visite Technique', '#06B6D4', 6),
('ATT_ACOMPTE', 'Att Acompte', '#F97316', 7),
('ANNULE', 'Annulé', '#EF4444', 8),
('REFUSE', 'Refusé', '#EF4444', 9),
('STAND_BY', 'Stand by', '#6B7280', 10),
('SAV', 'SAV', '#EC4899', 11)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 6️⃣ STATUTS TÂCHES (REFERENCE DATA)
-- ========================================

INSERT INTO public.task_statuses (code, label, color, sort_order) VALUES 
('TODO', 'À faire', '#3B82F6', 1),
('DOING', 'En cours', '#F59E0B', 2),
('DONE', 'Terminé', '#10B981', 3),
('CANCELLED', 'Annulé', '#EF4444', 4)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 7️⃣ RÔLES (REFERENCE DATA)
-- ========================================

INSERT INTO public.roles (name, description) VALUES
('ADMIN', 'Accès complet au système'),
('MANAGER', 'Gestion d''équipe'),
('GESTIONNAIRE', 'Opérations quotidiennes'),
('VIEWER', 'Lecture seule')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 8️⃣ PERMISSIONS (REFERENCE DATA)
-- ========================================

INSERT INTO public.permissions (key, description) VALUES
('interventions.view', 'Peut voir les interventions'),
('interventions.create', 'Peut créer des interventions'),
('interventions.edit', 'Peut modifier les interventions'),
('interventions.delete', 'Peut supprimer les interventions'),
('artisans.view', 'Peut voir les artisans'),
('artisans.create', 'Peut créer des artisans'),
('artisans.edit', 'Peut modifier les artisans'),
('artisans.delete', 'Peut supprimer les artisans'),
('users.view', 'Peut voir les utilisateurs'),
('users.manage', 'Peut gérer les utilisateurs'),
('settings.view', 'Peut voir les paramètres'),
('settings.edit', 'Peut modifier les paramètres')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 9️⃣ ASSOCIATIONS RÔLES-PERMISSIONS
-- ========================================

-- Admin : Toutes les permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'ADMIN'),
  id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager : Toutes sauf gestion users
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'MANAGER'),
  id
FROM permissions
WHERE key NOT IN ('users.manage', 'settings.edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Gestionnaire : Opérations quotidiennes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'GESTIONNAIRE'),
  id
FROM permissions
WHERE key IN (
  'interventions.view', 'interventions.create', 'interventions.edit',
  'artisans.view', 'artisans.create', 'artisans.edit'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer : Lecture seule
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'VIEWER'),
  id
FROM permissions
WHERE key IN ('interventions.view', 'artisans.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========================================
-- 🔟 ASSOCIATION USERS-ROLES
-- ========================================

-- Admin role
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  id,
  (SELECT id FROM roles WHERE name = 'ADMIN')
FROM users
WHERE username IN ('admin', 'badr')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Manager role
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  id,
  (SELECT id FROM roles WHERE name = 'MANAGER')
FROM users
WHERE username = 'andrea'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Gestionnaire role
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  id,
  (SELECT id FROM roles WHERE name = 'GESTIONNAIRE')
FROM users
WHERE username IN ('olivier', 'tom', 'paul', 'louis', 'samuel', 'lucien', 'killian', 'dimitri', 'soulaimane', 'clement')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ========================================
-- ✅ END OF ESSENTIAL SEED
-- ========================================
-- NO artisans, interventions, clients, or other mockup data
-- Real data will be imported from Google Sheets using:
--   npm run import:all
-- ========================================
