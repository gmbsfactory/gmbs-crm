-- ========================================
-- All Updated_at Triggers
-- ========================================

-- Base trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Artisans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artisans_updated_at') THEN
    CREATE TRIGGER trg_artisans_updated_at
      BEFORE UPDATE ON public.artisans
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Interventions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_interventions_updated_at') THEN
    CREATE TRIGGER trg_interventions_updated_at
      BEFORE UPDATE ON public.interventions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Tasks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated_at') THEN
    CREATE TRIGGER trg_tasks_updated_at
      BEFORE UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Artisan absences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artisan_absences_updated_at') THEN
    CREATE TRIGGER trg_artisan_absences_updated_at
      BEFORE UPDATE ON public.artisan_absences
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Conversations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated_at') THEN
    CREATE TRIGGER trg_conversations_updated_at
      BEFORE UPDATE ON public.conversations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Chat sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at') THEN
    CREATE TRIGGER trg_chat_sessions_updated_at
      BEFORE UPDATE ON public.chat_sessions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Billing state
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_state_updated_at') THEN
    CREATE TRIGGER trg_billing_state_updated_at
      BEFORE UPDATE ON public.billing_state
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Intervention costs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_costs_updated_at') THEN
    CREATE TRIGGER trg_intervention_costs_updated_at
      BEFORE UPDATE ON public.intervention_costs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Intervention payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_payments_updated_at') THEN
    CREATE TRIGGER trg_intervention_payments_updated_at
      BEFORE UPDATE ON public.intervention_payments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Comments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comments_updated_at') THEN
    CREATE TRIGGER trg_comments_updated_at
      BEFORE UPDATE ON public.comments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Tenants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenants_updated_at') THEN
    CREATE TRIGGER trg_tenants_updated_at
      BEFORE UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Owner
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_owner_updated_at') THEN
    CREATE TRIGGER trg_owner_updated_at
      BEFORE UPDATE ON public.owner
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Metiers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_metiers_updated_at') THEN
    CREATE TRIGGER trg_metiers_updated_at
      BEFORE UPDATE ON public.metiers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Agencies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agencies_updated_at') THEN
    CREATE TRIGGER trg_agencies_updated_at
      BEFORE UPDATE ON public.agencies
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ========================================
-- INTERVENTION UPDATED_BY TRIGGER
-- ========================================

CREATE OR REPLACE FUNCTION set_intervention_updated_by()
RETURNS trigger AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_interventions_updated_by ON public.interventions;
CREATE TRIGGER trg_interventions_updated_by
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION set_intervention_updated_by();

CREATE OR REPLACE FUNCTION set_intervention_created_by()
RETURNS trigger AS $$
BEGIN
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_interventions_created_by ON public.interventions;
CREATE TRIGGER trg_interventions_created_by
  BEFORE INSERT ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION set_intervention_created_by();

-- ========================================
-- USAGE DELTA TRIGGER
-- ========================================

CREATE OR REPLACE FUNCTION apply_usage_delta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE billing_state
     SET requests_remaining = GREATEST(0, requests_remaining + NEW.delta), updated_at = NOW()
   WHERE (user_id IS NULL)
      OR (user_id = NEW.user_id);
  RETURN NEW;
END;$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usage_delta') THEN
    CREATE TRIGGER trg_usage_delta AFTER INSERT ON usage_events
    FOR EACH ROW EXECUTE FUNCTION apply_usage_delta();
  END IF;
END $$;

