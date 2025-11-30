-- ========================================
-- AI Views Table
-- ========================================

CREATE TABLE IF NOT EXISTS ai_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  context text NOT NULL,
  title text NOT NULL,
  layout text NOT NULL,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sorts jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible_properties jsonb NOT NULL DEFAULT '[]'::jsonb,
  layout_options jsonb,
  metadata jsonb,
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_views_signature_idx ON ai_views(signature);
CREATE INDEX IF NOT EXISTS ai_views_context_idx ON ai_views(context);

