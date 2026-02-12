-- Migration 00083: AI Infrastructure
--
-- Purpose: Install pgvector extension and create AI-related tables
-- for the contextual AI assistant feature (Option C - keyboard shortcuts).
--
-- Tables created:
--   intervention_embeddings  - Vector embeddings for semantic search
--   intervention_ai_cache    - Cached AI results (summaries, scores, etc.)
--   artisan_ai_scores        - AI-computed artisan reliability/quality scores
--   intervention_predictions  - AI predictions (duration, cost, delay risk)

-- 1. Install pgvector extension (natively supported on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embeddings table for interventions
CREATE TABLE IF NOT EXISTS intervention_embeddings (
    id uuid PRIMARY KEY REFERENCES interventions(id) ON DELETE CASCADE,
    embedding vector(1536),
    model_name text DEFAULT 'text-embedding-3-small',
    source_text_hash text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_intervention_embeddings_vector
    ON intervention_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- 3. AI cache table (summaries, sentiment, risk scores, recommendations)
CREATE TABLE IF NOT EXISTS intervention_ai_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id uuid REFERENCES interventions(id) ON DELETE CASCADE,
    cache_type text NOT NULL CHECK (cache_type IN (
        'summary', 'sentiment', 'risk_score', 'recommendation',
        'classification', 'next_steps', 'email_draft'
    )),
    cached_value jsonb NOT NULL,
    confidence numeric(5,2),
    computed_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    UNIQUE(intervention_id, cache_type)
);

CREATE INDEX IF NOT EXISTS idx_intervention_ai_cache_lookup
    ON intervention_ai_cache (intervention_id, cache_type);

CREATE INDEX IF NOT EXISTS idx_intervention_ai_cache_expiry
    ON intervention_ai_cache (expires_at)
    WHERE expires_at IS NOT NULL;

-- 4. Artisan AI scores (reliability, quality, match)
CREATE TABLE IF NOT EXISTS artisan_ai_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id uuid REFERENCES artisans(id) ON DELETE CASCADE,
    score_type text NOT NULL CHECK (score_type IN (
        'reliability', 'lateness_risk', 'quality', 'match_score'
    )),
    score numeric(5,2) CHECK (score BETWEEN 0 AND 100),
    confidence numeric(5,2),
    factors jsonb,
    computed_at timestamptz DEFAULT now(),
    UNIQUE(artisan_id, score_type)
);

CREATE INDEX IF NOT EXISTS idx_artisan_ai_scores_lookup
    ON artisan_ai_scores (artisan_id, score_type);

-- 5. Intervention predictions (duration, cost, delay risk, conversion)
CREATE TABLE IF NOT EXISTS intervention_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id uuid REFERENCES interventions(id) ON DELETE CASCADE,
    prediction_type text NOT NULL CHECK (prediction_type IN (
        'duration', 'cost', 'delay_risk', 'conversion'
    )),
    predicted_value numeric(12,2),
    confidence_interval jsonb,
    factors jsonb,
    computed_at timestamptz DEFAULT now(),
    UNIQUE(intervention_id, prediction_type)
);

CREATE INDEX IF NOT EXISTS idx_intervention_predictions_lookup
    ON intervention_predictions (intervention_id, prediction_type);

-- 6. Auto-update updated_at on intervention_embeddings
CREATE OR REPLACE FUNCTION update_embedding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_embedding_updated_at
    BEFORE UPDATE ON intervention_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_updated_at();

-- 7. RLS policies (same pattern as existing tables)
ALTER TABLE intervention_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_predictions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Edge Functions use service role)
CREATE POLICY "service_role_all_intervention_embeddings"
    ON intervention_embeddings FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_intervention_ai_cache"
    ON intervention_ai_cache FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_artisan_ai_scores"
    ON artisan_ai_scores FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_intervention_predictions"
    ON intervention_predictions FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read AI data
CREATE POLICY "authenticated_read_intervention_embeddings"
    ON intervention_embeddings FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "authenticated_read_intervention_ai_cache"
    ON intervention_ai_cache FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "authenticated_read_artisan_ai_scores"
    ON artisan_ai_scores FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "authenticated_read_intervention_predictions"
    ON intervention_predictions FOR SELECT
    TO authenticated USING (true);
