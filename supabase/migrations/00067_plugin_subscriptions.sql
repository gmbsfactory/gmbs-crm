-- ============================================
-- GMBS CRM - Plugin Subscriptions
-- ============================================

-- Table for tracking plugin subscriptions
CREATE TABLE IF NOT EXISTS public.plugin_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Plugin identification
    plugin_id TEXT NOT NULL,  -- 'portal_artisans', 'agences_gmbs', etc.
    
    -- Stripe data
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    
    -- Period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Only one subscription per plugin
    UNIQUE(plugin_id)
);

COMMENT ON TABLE public.plugin_subscriptions IS 'Plugin subscription status for GMBS plugins';

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_plugin_subscriptions_plugin ON public.plugin_subscriptions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_subscriptions_status ON public.plugin_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_plugin_subscriptions_stripe ON public.plugin_subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE public.plugin_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read
CREATE POLICY "Authenticated users can read plugin subscriptions"
ON public.plugin_subscriptions
FOR SELECT
TO authenticated
USING (true);

-- Policy: only service role can modify
CREATE POLICY "Service role can manage plugin subscriptions"
ON public.plugin_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update trigger
CREATE OR REPLACE FUNCTION update_plugin_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plugin_subscriptions_updated_at ON public.plugin_subscriptions;
CREATE TRIGGER trg_plugin_subscriptions_updated_at
BEFORE UPDATE ON public.plugin_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_plugin_subscription_updated_at();
