-- ========================================
-- GMBS CRM - Clean Database Schema
-- ========================================
-- Clean, scalable database schema for GMBS CRM
-- Date: 2025-01-01
-- Version: 2.0

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ========================================
-- 1️⃣ ENUMS
-- ========================================

-- User status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('connected','dnd','busy','offline');
  END IF;
END $$;

-- ========================================
-- 2️⃣ CORE USERS & AUTHENTICATION

-- ========================================

-- Users table
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auth providers
CREATE TABLE IF NOT EXISTS public.auth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

-- Roles and permissions
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

-- Métiers (professions)
CREATE TABLE IF NOT EXISTS public.metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Zones d'intervention
CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Agences
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Artisan statuses
CREATE TABLE IF NOT EXISTS public.artisan_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Intervention statuses
CREATE TABLE IF NOT EXISTS public.intervention_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Task statuses
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

-- ========================================
-- 4️⃣ ARTISANS & CLIENTS
-- ========================================

-- Artisans table
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
  suivi_relances_docs text,
  date_ajout date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Artisan-Métier relationships
CREATE TABLE IF NOT EXISTS public.artisan_metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  metier_id uuid REFERENCES public.metiers(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artisan_id, metier_id)
);

-- Artisan-Zone relationships
CREATE TABLE IF NOT EXISTS public.artisan_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artisan_id, zone_id)
);

-- Artisan attachments
CREATE TABLE IF NOT EXISTS public.artisan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('kbis','assurance','cni_recto_verso','iban','decharge_partenariat','photo_profil','autre','a_classe')),
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

-- Artisan absences
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

-- Tenant table
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
-- Owner table
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

-- Interventions table
CREATE TABLE IF NOT EXISTS public.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_inter text UNIQUE,
  agence_id uuid REFERENCES public.agencies(id),
  tenant_id uuid REFERENCES public.tenants(id),
  owner_id uuid REFERENCES public.owner(id),
  assigned_user_id uuid REFERENCES public.users(id),
  statut_id uuid REFERENCES public.intervention_statuses(id),
  metier_id uuid REFERENCES public.metiers(id),
  
  date timestamptz NOT NULL,
  date_termine timestamptz,
  date_prevue timestamptz,
  due_date timestamptz,
  
  contexte_intervention text,
  consigne_intervention text,
  consigne_second_artisan text,
  commentaire_agent text,
  
  adresse text,
  code_postal text,
  ville text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Intervention-Artisan relationships
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

-- Intervention costs
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

-- Intervention payments
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

-- Intervention attachments
CREATE TABLE IF NOT EXISTS public.intervention_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('devis','photos','facturesGMBS','facturesArtisans','facturesMateriel','autre','a_classe')),
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

-- Comments table (unified for all entities)
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('artisan','intervention','task','client')),
  entity_id uuid NOT NULL,
  author_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  comment_type text CHECK (comment_type IN ('internal','external','system')),
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- 7️⃣ TASKS & WORKFLOWS
-- ========================================

-- Tasks table
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

-- Conversations
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

-- Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'owner',
  joined_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id),
  type text CHECK (type IN ('user','system','assistant')) DEFAULT 'user',
  content text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Message attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime_type text,
  filename text,
  file_size int,
  created_at timestamptz DEFAULT now()
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  model_tier text DEFAULT 'consumption',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat messages
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

-- AI Assistants
CREATE TABLE IF NOT EXISTS public.ai_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  context text,
  conversation jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Note: ai_views table créée dans migration 20251006_create_ai_views.sql

-- ========================================
-- 9️⃣ BILLING & SUBSCRIPTIONS
-- ========================================

-- Billing state
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

-- Payment methods
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

-- Subscriptions
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


-- Usage events
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

-- Sync logs
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
-- 🔧 INDEXES
-- ========================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_code_gestionnaire ON public.users(code_gestionnaire);

-- Artisans indexes
CREATE INDEX IF NOT EXISTS idx_artisans_gestionnaire_id ON public.artisans(gestionnaire_id);
CREATE INDEX IF NOT EXISTS idx_artisans_email ON public.artisans(email);
CREATE INDEX IF NOT EXISTS idx_artisans_statut_id ON public.artisans(statut_id);
CREATE INDEX IF NOT EXISTS idx_artisans_is_active ON public.artisans(is_active);

-- Interventions indexes
CREATE INDEX IF NOT EXISTS idx_interventions_id_inter ON public.interventions(id_inter);
CREATE INDEX IF NOT EXISTS idx_interventions_agence_id ON public.interventions(agence_id);
CREATE INDEX IF NOT EXISTS idx_interventions_tenant_id ON public.interventions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interventions_owner_id ON public.interventions(owner_id);
CREATE INDEX IF NOT EXISTS idx_interventions_assigned_user_id ON public.interventions(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_interventions_statut_id ON public.interventions(statut_id);
CREATE INDEX IF NOT EXISTS idx_interventions_metier_id ON public.interventions(metier_id);
CREATE INDEX IF NOT EXISTS idx_interventions_date ON public.interventions(date);
CREATE INDEX IF NOT EXISTS idx_interventions_is_active ON public.interventions(is_active);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_intervention_id ON public.tasks(intervention_id);
CREATE INDEX IF NOT EXISTS idx_tasks_artisan_id ON public.tasks(artisan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON public.chat_messages(session_id, created_at);

-- ========================================
-- 🔧 TRIGGERS
-- ========================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers with IF NOT EXISTS checks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artisans_updated_at') THEN
    CREATE TRIGGER trg_artisans_updated_at
      BEFORE UPDATE ON public.artisans
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_interventions_updated_at') THEN
    CREATE TRIGGER trg_interventions_updated_at
      BEFORE UPDATE ON public.interventions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated_at') THEN
    CREATE TRIGGER trg_tasks_updated_at
      BEFORE UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artisan_absences_updated_at') THEN
    CREATE TRIGGER trg_artisan_absences_updated_at
      BEFORE UPDATE ON public.artisan_absences
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated_at') THEN
    CREATE TRIGGER trg_conversations_updated_at
      BEFORE UPDATE ON public.conversations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at') THEN
    CREATE TRIGGER trg_chat_sessions_updated_at
      BEFORE UPDATE ON public.chat_sessions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_state_updated_at') THEN
    CREATE TRIGGER trg_billing_state_updated_at
      BEFORE UPDATE ON public.billing_state
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_costs_updated_at') THEN
    CREATE TRIGGER trg_intervention_costs_updated_at
      BEFORE UPDATE ON public.intervention_costs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_payments_updated_at') THEN
    CREATE TRIGGER trg_intervention_payments_updated_at
      BEFORE UPDATE ON public.intervention_payments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comments_updated_at') THEN
    CREATE TRIGGER trg_comments_updated_at
      BEFORE UPDATE ON public.comments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenants_updated_at') THEN
    CREATE TRIGGER trg_tenants_updated_at
      BEFORE UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_owner_updated_at') THEN
    CREATE TRIGGER trg_owner_updated_at
      BEFORE UPDATE ON public.owner
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_metiers_updated_at') THEN
    CREATE TRIGGER trg_metiers_updated_at
      BEFORE UPDATE ON public.metiers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agencies_updated_at') THEN
    CREATE TRIGGER trg_agencies_updated_at
      BEFORE UPDATE ON public.agencies
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Usage delta trigger
CREATE OR REPLACE FUNCTION apply_usage_delta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE billing_state
     SET requests_remaining = GREATEST(0, requests_remaining + NEW.delta), updated_at = NOW()
   WHERE (user_id IS NULL) -- global pool
      OR (user_id = NEW.user_id); -- per-user pool when user_id present
  RETURN NEW;
END;$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usage_delta') THEN
    CREATE TRIGGER trg_usage_delta AFTER INSERT ON usage_events
    FOR EACH ROW EXECUTE FUNCTION apply_usage_delta();
  END IF;
END $$;

-- ========================================
-- 🔒 ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on billing tables
ALTER TABLE IF EXISTS payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_methods' AND policyname='pm_owner_rw') THEN
    CREATE POLICY pm_owner_rw ON payment_methods
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='subs_owner_r') THEN
    CREATE POLICY subs_owner_r ON subscriptions
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='subs_owner_w') THEN
    CREATE POLICY subs_owner_w ON subscriptions
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_owner_r') THEN
    CREATE POLICY orders_owner_r ON orders
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_events' AND policyname='usage_owner_ri') THEN
    CREATE POLICY usage_owner_ri ON usage_events
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_events' AND policyname='usage_owner_i') THEN
    CREATE POLICY usage_owner_i ON usage_events
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_state' AND policyname='billing_owner_r') THEN
    CREATE POLICY billing_owner_r ON billing_state
      FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_state' AND policyname='billing_owner_w') THEN
    CREATE POLICY billing_owner_w ON billing_state
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_sessions' AND policyname='chat_sessions_owner_rw') THEN
    CREATE POLICY chat_sessions_owner_rw ON chat_sessions
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_owner_rw') THEN
    CREATE POLICY chat_messages_owner_rw ON chat_messages
      FOR ALL TO authenticated USING (
        author_id = auth.uid()
        OR EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid())
      ) WITH CHECK (author_id = auth.uid());
  END IF;
END $$;

-- ========================================
-- 📊 INITIAL DATA
-- ========================================

-- Insert default roles
INSERT INTO public.roles(name, description)
SELECT x.name, x.description
FROM (VALUES 
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with elevated permissions'),
  ('gestionnaire', 'Standard user with basic permissions')
) AS x(name, description)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
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
-- ✅ SCHEMA COMPLETE
-- ========================================

-- Add table comments for documentation
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
