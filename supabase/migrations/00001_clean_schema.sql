-- ========================================
-- GMBS CRM - Schema Principal Consolidé
-- ========================================
-- Version: 3.0 (Consolidé)
-- Date: 2025-11-27
-- Description: Schéma complet de la base de données avec toutes les colonnes

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ========================================
-- 1️⃣ ENUMS
-- ========================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('connected','dnd','busy','offline');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'target_period_type') THEN
    CREATE TYPE target_period_type AS ENUM ('week', 'month', 'year');
  END IF;
END $$;

-- ========================================
-- 2️⃣ CORE USERS & AUTHENTICATION
-- ========================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE,
  firstname text,
  lastname text,
  color text,
  code_gestionnaire text UNIQUE,
  status user_status NOT NULL DEFAULT 'offline',
  token_version int DEFAULT 0,
  last_seen_at timestamptz,
  -- SMTP fields (compatible avec l'API existante)
  email_smtp text,
  email_smtp_host text,
  email_smtp_port integer,
  email_smtp_user text,
  email_smtp_password_encrypted text,
  email_smtp_from_name text,
  email_smtp_from_address text,
  email_smtp_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

-- ========================================
-- 3️⃣ REFERENCE DATA
-- ========================================

CREATE TABLE IF NOT EXISTS public.metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.artisan_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.intervention_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Agency config for feature toggles
CREATE TABLE IF NOT EXISTS public.agency_config (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  requires_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agency_config IS 'Feature toggles per agency (e.g. reference_agence requirement for BR-AGN-001).';

-- ========================================
-- 4️⃣ ARTISANS & CLIENTS
-- ========================================

CREATE TABLE IF NOT EXISTS public.artisans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom text,
  nom text,
  email text UNIQUE,
  plain_nom text,
  telephone text,
  telephone2 text,
  departement int,
  raison_sociale text,
  siret text UNIQUE,
  statut_juridique text,
  adresse_siege_social text,
  ville_siege_social text,
  code_postal_siege_social text,
  adresse_intervention text,
  ville_intervention text,
  code_postal_intervention text,
  intervention_latitude numeric(9,6),
  intervention_longitude numeric(9,6),
  numero_associe text,
  gestionnaire_id uuid REFERENCES public.users(id),
  statut_id uuid REFERENCES public.artisan_statuses(id),
  statut_dossier text CHECK (statut_dossier IS NULL OR statut_dossier IN ('INCOMPLET', 'À compléter', 'COMPLET')),
  suivi_relances_docs text,
  date_ajout date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.artisans.statut_dossier IS 'Statut du dossier de l''artisan (documents) : INCOMPLET, À compléter, COMPLET';

CREATE TABLE IF NOT EXISTS public.artisan_metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  metier_id uuid REFERENCES public.metiers(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artisan_id, metier_id)
);

CREATE TABLE IF NOT EXISTS public.artisan_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artisan_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.artisan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  kind text NOT NULL,
  url text NOT NULL,
  mime_type text,
  filename text,
  file_size int,
  content_hash TEXT,
  derived_sizes JSONB DEFAULT '{}'::jsonb,
  mime_preferred TEXT,
  created_at timestamptz DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  created_by_display text NULL,
  created_by_code text NULL,
  created_by_color text NULL
);

COMMENT ON COLUMN public.artisan_attachments.content_hash IS 'Hash SHA-256 du contenu de l''image pour déduplication et versioning';
COMMENT ON COLUMN public.artisan_attachments.derived_sizes IS 'URLs des dérivés générés : {"40": "url", "80": "url", "160": "url"}';
COMMENT ON COLUMN public.artisan_attachments.mime_preferred IS 'Format MIME préféré pour l''affichage (image/webp ou image/jpeg)';

CREATE TABLE IF NOT EXISTS public.artisan_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  reason text,
  is_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref text UNIQUE,
  firstname text,
  lastname text,
  email text,
  telephone text,
  telephone2 text,
  adresse text,
  ville text,
  code_postal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.owner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref text UNIQUE,
  owner_firstname text,
  owner_lastname text,  
  telephone text,
  telephone2 text,
  adresse text,
  ville text,
  email text,
  code_postal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- 5️⃣ INTERVENTIONS
-- ========================================

CREATE TABLE IF NOT EXISTS public.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_inter text UNIQUE,
  agence_id uuid REFERENCES public.agencies(id),
  tenant_id uuid REFERENCES public.tenants(id),
  owner_id uuid REFERENCES public.owner(id),
  assigned_user_id uuid REFERENCES public.users(id),
  statut_id uuid REFERENCES public.intervention_statuses(id),
  metier_id uuid REFERENCES public.metiers(id),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  date timestamptz NOT NULL,
  date_termine timestamptz,
  date_prevue timestamptz,
  due_date timestamptz,
  
  contexte_intervention text,
  consigne_intervention text,
  consigne_second_artisan text,
  commentaire_agent text,
  reference_agence TEXT,
  
  adresse text,
  code_postal text,
  ville text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  
  -- Vacant housing fields
  is_vacant boolean DEFAULT false,
  key_code text,
  floor text,
  apartment_number text,
  vacant_housing_instructions text,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.interventions.reference_agence IS 'External agency reference captured when required (BR-AGN-001).';
COMMENT ON COLUMN public.interventions.adresse IS 'Adresse de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN public.interventions.contexte_intervention IS 'Contexte de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN public.interventions.metier_id IS 'Métier/Type d''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN public.interventions.statut_id IS 'Statut de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN public.interventions.agence_id IS 'Agence cliente (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN public.interventions.latitude IS 'Latitude de l''adresse de l''intervention';
COMMENT ON COLUMN public.interventions.longitude IS 'Longitude de l''adresse de l''intervention';

CREATE TABLE IF NOT EXISTS public.intervention_artisans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  role text CHECK (role IN ('primary','secondary')),
  is_primary boolean DEFAULT false,
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (intervention_id, artisan_id)
);

CREATE TABLE IF NOT EXISTS public.intervention_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  cost_type text NOT NULL CHECK (cost_type IN ('sst','materiel','intervention','marge')),
  label text,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'EUR',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.intervention_costs IS 'Table des coûts d''intervention. Les montants >= 100 000 pour les types sst et intervention sont automatiquement mis à 0 lors de l''import.';

CREATE TABLE IF NOT EXISTS public.intervention_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  payment_type text NOT NULL CHECK (payment_type IN ('acompte_sst','acompte_client','final')),
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'EUR',
  is_received boolean DEFAULT false,
  payment_date timestamptz,
  reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intervention_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  url text NOT NULL,
  mime_type text,
  filename text,
  file_size int,
  created_at timestamptz DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  created_by_display text NULL,
  created_by_code text NULL,
  created_by_color text NULL
);

-- ========================================
-- 6️⃣ COMMENTS & NOTES
-- ========================================

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('artisan','intervention','task','client')),
  entity_id uuid NOT NULL,
  author_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  comment_type text CHECK (comment_type IN ('internal','external','system')),
  reason_type text CHECK (reason_type IS NULL OR reason_type IN ('archive', 'done')),
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.comments.reason_type IS 'Motif système pour ARC-001 (archive/done)';

-- ========================================
-- 7️⃣ TASKS & WORKFLOWS
-- ========================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority int CHECK (priority BETWEEN 1 AND 5) DEFAULT 3,
  status_id uuid REFERENCES public.task_statuses(id),
  creator_id uuid REFERENCES public.users(id),
  assignee_id uuid REFERENCES public.users(id),
  intervention_id uuid REFERENCES public.interventions(id),
  artisan_id uuid REFERENCES public.artisans(id),
  due_date timestamptz,
  metadata jsonb,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- 8️⃣ CHAT & AI
-- ========================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_private boolean DEFAULT true,
  title text NOT NULL,
  context_type text CHECK (context_type IN ('intervention','task','artisan','general')),
  context_id uuid,
  created_by uuid REFERENCES public.users(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'owner',
  joined_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id),
  type text CHECK (type IN ('user','system','assistant')) DEFAULT 'user',
  content text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime_type text,
  filename text,
  file_size int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  model_tier text DEFAULT 'consumption',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  role text NOT NULL,
  content text NOT NULL,
  tokens int,
  cost_cents int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  context text,
  conversation jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Email logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message_html text,
  email_type text CHECK (email_type IN ('devis', 'intervention')),
  attachments_count int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index pour email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_intervention ON public.email_logs(intervention_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_artisan ON public.email_logs(artisan_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON public.email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);

COMMENT ON TABLE public.email_logs IS 'Logs des emails envoyés depuis le CRM';
COMMENT ON COLUMN public.email_logs.email_type IS 'Type d''email: devis (visite technique) ou intervention';
COMMENT ON COLUMN public.email_logs.status IS 'Statut: sent (envoyé), failed (échec), pending (en attente)';

-- ========================================
-- 9️⃣ BILLING & SUBSCRIPTIONS
-- ========================================

CREATE TABLE IF NOT EXISTS public.billing_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  current_plan_id text,
  cadence text,
  status text,
  stripe_customer_id text,
  requests_remaining bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  stripe_payment_method_id text UNIQUE NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  stripe_subscription_id text UNIQUE NOT NULL,
  plan_id text,
  cadence text,
  status text NOT NULL,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text CHECK (type IN ('subscription','recharge')) NOT NULL,
  amount_cents int NOT NULL,
  currency text DEFAULT 'EUR',
  status text NOT NULL,
  plan_id text,
  pack_id text,
  requests_credited int,
  stripe_checkout_session_id text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  delta int NOT NULL,
  reason text,
  chat_tier text,
  created_at timestamptz DEFAULT now()
);

-- ========================================
-- 🔟 LOGS & SYNC
-- ========================================

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text CHECK (operation IN ('push','pull','conflict')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changes jsonb,
  success boolean DEFAULT true,
  error text,
  created_at timestamptz DEFAULT now()
);

-- ========================================
-- 📊 INITIAL DATA
-- ========================================

INSERT INTO public.roles(name, description)
SELECT x.name, x.description
FROM (VALUES 
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with elevated permissions'),
  ('gestionnaire', 'Standard user with basic permissions')
) AS x(name, description)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permissions(key, description)
SELECT x.key, x.description
FROM (VALUES 
  ('read_interventions', 'Read interventions'),
  ('write_interventions', 'Create and edit interventions'),
  ('delete_interventions', 'Delete interventions'),
  ('read_artisans', 'Read artisans'),
  ('write_artisans', 'Create and edit artisans'),
  ('delete_artisans', 'Delete artisans'),
  ('read_users', 'Read users'),
  ('write_users', 'Create and edit users'),
  ('delete_users', 'Delete users'),
  ('manage_billing', 'Manage billing and subscriptions')
) AS x(key, description)
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 📝 TABLE COMMENTS
-- ========================================

COMMENT ON TABLE public.users IS 'Users table with authentication and profile information';
COMMENT ON TABLE public.artisans IS 'Artisans/contractors table with business information';
COMMENT ON TABLE public.interventions IS 'Interventions/jobs table with client and work details';
COMMENT ON TABLE public.tasks IS 'Task management system';
COMMENT ON TABLE public.conversations IS 'Chat conversations for AI assistant';
COMMENT ON TABLE public.agencies IS 'Client agencies referenced in interventions';
COMMENT ON TABLE public.metiers IS 'Professions/trades reference table';
COMMENT ON TABLE public.zones IS 'Intervention zones/regions';
COMMENT ON TABLE public.comments IS 'Unified comments system for all entities';
COMMENT ON TABLE public.intervention_costs IS 'Cost breakdown for interventions';
COMMENT ON TABLE public.intervention_payments IS 'Payment tracking for interventions';

-- ========================================
-- PERMISSIONS POUR LE SCHÉMA PUBLIC
-- ========================================
-- Accorder les permissions nécessaires au rôle service_role
-- (utilisé par les scripts d'import et les Edge Functions)

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Permissions par défaut pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Permissions pour authenticated (utilisateurs authentifiés)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Permissions par défaut pour authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;

-- Permissions pour anon (utilisateurs non authentifiés / scripts Node.js)
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Permissions par défaut pour anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
