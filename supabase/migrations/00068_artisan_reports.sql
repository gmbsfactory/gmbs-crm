-- ============================================
-- GMBS CRM - Artisan Reports (from Portal)
-- ============================================
-- Stores reports submitted by artisans via portal_gmbs

CREATE TABLE IF NOT EXISTS public.artisan_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    
    -- Report content
    content TEXT NOT NULL,
    
    -- Photo references (photos uploaded with the report)
    photo_ids UUID[] DEFAULT '{}',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved')),
    
    -- Sync tracking (from portal)
    portal_report_id UUID, -- ID from portal_gmbs if applicable
    synced_from_portal BOOLEAN DEFAULT false,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.artisan_reports IS 'Reports submitted by artisans via portal_gmbs';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artisan_reports_intervention ON public.artisan_reports(intervention_id);
CREATE INDEX IF NOT EXISTS idx_artisan_reports_artisan ON public.artisan_reports(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_reports_status ON public.artisan_reports(status);

-- Enable RLS
ALTER TABLE public.artisan_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read artisan reports"
ON public.artisan_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage artisan reports"
ON public.artisan_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Update trigger
CREATE OR REPLACE FUNCTION update_artisan_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artisan_reports_updated_at ON public.artisan_reports;
CREATE TRIGGER trg_artisan_reports_updated_at
BEFORE UPDATE ON public.artisan_reports
FOR EACH ROW EXECUTE FUNCTION update_artisan_reports_updated_at();

-- ============================================
-- Table for report photos (from artisan via portal)
-- ============================================
CREATE TABLE IF NOT EXISTS public.artisan_report_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    report_id UUID REFERENCES public.artisan_reports(id) ON DELETE CASCADE,
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    
    -- File info
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    
    -- Comment/caption
    comment TEXT,
    
    -- Sync tracking
    portal_photo_id UUID,
    synced_from_portal BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.artisan_report_photos IS 'Photos uploaded by artisans with their reports';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artisan_report_photos_report ON public.artisan_report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_artisan_report_photos_intervention ON public.artisan_report_photos(intervention_id);

-- Enable RLS
ALTER TABLE public.artisan_report_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read report photos"
ON public.artisan_report_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage report photos"
ON public.artisan_report_photos FOR ALL TO service_role USING (true) WITH CHECK (true);
