-- ============================================================================
-- 99076 — Portail artisans : migration de convergence (démo locale)
-- ============================================================================
-- Contrat : docs/architecture/portail-demo-contrat-api.md (§4)
-- Étude   : docs/architecture/portail-artisans-v2.md (§4.d)
--
-- Cette migration est IDEMPOTENTE. Elle doit passer :
--   * sur une base locale où aucun objet portail n'existe (supabase db reset) ;
--   * sur la production, où les objets créés par les migrations 00064..00069
--     de la branche depose_docs existent déjà (DDL de référence différente :
--     artisan_reports.content NOT NULL, status CHECK draft/submitted/reviewed/approved,
--     reviewed_by -> auth.users, artisan_portal_tokens.token NOT NULL UNIQUE…).
--
-- Règles : CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--          DROP POLICY IF EXISTS avant CREATE POLICY, DROP TRIGGER IF EXISTS
--          avant CREATE TRIGGER, CREATE INDEX IF NOT EXISTS,
--          DROP FUNCTION IF EXISTS avant CREATE FUNCTION.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. artisan_portal_tokens — jetons d'accès au portail (hachés en SHA-256)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artisan_portal_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    -- Colonne historique (00065) : jeton en clair. Plus jamais renseignée ;
    -- conservée nullable pour compatibilité avec la production.
    token TEXT UNIQUE,
    token_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    last_accessed_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.artisan_portal_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE public.artisan_portal_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.artisan_portal_tokens ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE public.artisan_portal_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.artisan_portal_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days');
-- Production : `token` était NOT NULL (00065) ; le CRM ne stocke plus que le hachage.
ALTER TABLE public.artisan_portal_tokens ALTER COLUMN token DROP NOT NULL;
-- 00065 posait une contrainte UNIQUE (artisan_id, is_active) remplacée par 00066.
ALTER TABLE public.artisan_portal_tokens DROP CONSTRAINT IF EXISTS unique_active_token_per_artisan;

CREATE INDEX IF NOT EXISTS idx_artisan_portal_tokens_token_hash
    ON public.artisan_portal_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_artisan_portal_tokens_artisan_id
    ON public.artisan_portal_tokens(artisan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_token_per_artisan
    ON public.artisan_portal_tokens(artisan_id) WHERE is_active = true;

COMMENT ON TABLE public.artisan_portal_tokens IS
    'Jetons d''accès au portail artisan. Seul le hachage SHA-256 (token_hash) est stocké ; lecture/écriture par service_role uniquement.';
COMMENT ON COLUMN public.artisan_portal_tokens.token_hash IS 'SHA-256 hexadécimal du jeton de 64 caractères transmis dans le lien /t/{token}';
COMMENT ON COLUMN public.artisan_portal_tokens.last_used_at IS 'Dernière utilisation du jeton (mise à jour à chaque requête authentifiée du portail)';

ALTER TABLE public.artisan_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Aucune policy anon ni authenticated : les routes passent par le client service_role.
DROP POLICY IF EXISTS "Anonymous can validate tokens" ON public.artisan_portal_tokens;
DROP POLICY IF EXISTS "CRM users can manage portal tokens" ON public.artisan_portal_tokens;
DROP POLICY IF EXISTS "Service role manages portal tokens" ON public.artisan_portal_tokens;
CREATE POLICY "Service role manages portal tokens"
    ON public.artisan_portal_tokens FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Les RPC historiques (00065) manipulaient le jeton en clair : on retire leur
-- exposition à anon/authenticated si elles existent (production), sans les recréer.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'validate_artisan_portal_token') THEN
        REVOKE EXECUTE ON FUNCTION public.validate_artisan_portal_token(TEXT) FROM anon, authenticated, PUBLIC;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'generate_artisan_portal_token') THEN
        REVOKE EXECUTE ON FUNCTION public.generate_artisan_portal_token(UUID, UUID) FROM anon, authenticated, PUBLIC;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. artisan_reports — rapports d'intervention envoyés depuis le portail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artisan_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    -- Colonne historique (00068) : texte libre. Alimentée avec travaux_realises.
    content TEXT,
    photo_ids UUID[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'submitted',
    portal_report_id UUID,
    synced_from_portal BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS portal_report_id UUID;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS travaux_realises TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS duree_minutes INTEGER;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS materiel_utilise TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS reste_a_faire BOOLEAN DEFAULT false;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS reste_a_faire_detail TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS anomalies TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS client_present BOOLEAN;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS submitted_from TEXT DEFAULT 'web';
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS attachment_ids UUID[] DEFAULT '{}';
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS review_comment TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.artisan_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Production : content était NOT NULL (00068) ; le rapport structuré le remplace.
ALTER TABLE public.artisan_reports ALTER COLUMN content DROP NOT NULL;

-- Statuts : submitted / approved / rejected (00068 : draft/submitted/reviewed/approved).
UPDATE public.artisan_reports SET status = 'approved' WHERE status = 'reviewed';
UPDATE public.artisan_reports SET status = 'submitted' WHERE status = 'draft';
ALTER TABLE public.artisan_reports DROP CONSTRAINT IF EXISTS artisan_reports_status_check;
ALTER TABLE public.artisan_reports ADD CONSTRAINT artisan_reports_status_check
    CHECK (status IN ('submitted', 'approved', 'rejected'));

-- reviewed_by référence public.users (cohérent avec assigned_user_id), pas auth.users (00068).
ALTER TABLE public.artisan_reports DROP CONSTRAINT IF EXISTS artisan_reports_reviewed_by_fkey;
ALTER TABLE public.artisan_reports ADD CONSTRAINT artisan_reports_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;

CREATE INDEX IF NOT EXISTS idx_artisan_reports_intervention ON public.artisan_reports(intervention_id);
CREATE INDEX IF NOT EXISTS idx_artisan_reports_artisan ON public.artisan_reports(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_reports_status ON public.artisan_reports(status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_artisan_reports_portal_report_id
    ON public.artisan_reports(portal_report_id) WHERE portal_report_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_artisan_reports_intervention_artisan_version
    ON public.artisan_reports(intervention_id, artisan_id, version);

COMMENT ON TABLE public.artisan_reports IS 'Rapports d''intervention envoyés par les artisans depuis le portail (une ligne par version)';
COMMENT ON COLUMN public.artisan_reports.portal_report_id IS 'Identifiant généré par le portail : clé d''idempotence de POST …/report';
COMMENT ON COLUMN public.artisan_reports.version IS 'Numéro de version : incrémenté quand un rapport rejeté est resoumis';
COMMENT ON COLUMN public.artisan_reports.status IS 'submitted (à vérifier) | approved | rejected';

-- updated_at
DROP TRIGGER IF EXISTS trg_artisan_reports_updated_at ON public.artisan_reports;
DROP FUNCTION IF EXISTS public.update_artisan_reports_updated_at();
CREATE FUNCTION public.update_artisan_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_artisan_reports_updated_at
    BEFORE UPDATE ON public.artisan_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_artisan_reports_updated_at();

ALTER TABLE public.artisan_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read artisan reports" ON public.artisan_reports;
CREATE POLICY "Authenticated users can read artisan reports"
    ON public.artisan_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage artisan reports" ON public.artisan_reports;
CREATE POLICY "Service role can manage artisan reports"
    ON public.artisan_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. Colonnes ajoutées aux tables existantes
-- ----------------------------------------------------------------------------
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS has_portal_report BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.interventions.has_portal_report IS
    'Vrai quand un rapport portail est en attente de vérification (statut submitted). Maintenu par trigger sur artisan_reports ; le CRM affiche « À vérifier ».';

CREATE INDEX IF NOT EXISTS idx_interventions_has_portal_report
    ON public.interventions(has_portal_report) WHERE has_portal_report = true;
CREATE INDEX IF NOT EXISTS idx_interventions_status_portal_report
    ON public.interventions(statut_id, has_portal_report) WHERE has_portal_report = true;

ALTER TABLE public.intervention_attachments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.intervention_attachments.metadata IS
    'Informations complémentaires (portail : {source, phase, comment, artisan_id})';

ALTER TABLE public.artisan_attachments ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved';
ALTER TABLE public.artisan_attachments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.artisan_attachments DROP CONSTRAINT IF EXISTS artisan_attachments_review_status_check;
ALTER TABLE public.artisan_attachments ADD CONSTRAINT artisan_attachments_review_status_check
    CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'rejected'));
COMMENT ON COLUMN public.artisan_attachments.review_status IS
    'pending (déposé depuis le portail, à vérifier) | approved | rejected';
COMMENT ON COLUMN public.artisan_attachments.metadata IS
    'Informations complémentaires (portail : {source, signed_at, signer_name, sha256…})';

-- ----------------------------------------------------------------------------
-- 4. Trigger : interventions.has_portal_report = EXISTS(rapport submitted)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_artisan_reports_sync_flag ON public.artisan_reports;
DROP FUNCTION IF EXISTS public.fn_artisan_reports_sync_flag();
CREATE FUNCTION public.fn_artisan_reports_sync_flag()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.interventions i
    SET has_portal_report = EXISTS (
        SELECT 1 FROM public.artisan_reports r
        WHERE r.intervention_id = NEW.intervention_id AND r.status = 'submitted'
    )
    WHERE i.id = NEW.intervention_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_artisan_reports_sync_flag
    AFTER INSERT OR UPDATE OF status ON public.artisan_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_artisan_reports_sync_flag();

COMMENT ON FUNCTION public.fn_artisan_reports_sync_flag() IS
    'Seul mécanisme qui écrit interventions.has_portal_report (jamais les routes API)';
