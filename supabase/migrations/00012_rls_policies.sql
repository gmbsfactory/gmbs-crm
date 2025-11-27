-- ========================================
-- Row Level Security Policies
-- ========================================

-- ========================================
-- BILLING TABLES RLS
-- ========================================

ALTER TABLE IF EXISTS payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- Payment Methods
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_methods' AND policyname='pm_owner_rw') THEN
    CREATE POLICY pm_owner_rw ON payment_methods
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Subscriptions
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

-- Orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_owner_r') THEN
    CREATE POLICY orders_owner_r ON orders
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Usage Events
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

-- Billing State
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

-- Chat Sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_sessions' AND policyname='chat_sessions_owner_rw') THEN
    CREATE POLICY chat_sessions_owner_rw ON chat_sessions
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Chat Messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_owner_rw') THEN
    CREATE POLICY chat_messages_owner_rw ON chat_messages
      FOR ALL TO authenticated USING (
        author_id = auth.uid()
        OR EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid())
      ) WITH CHECK (author_id = auth.uid());
  END IF;
END $$;

