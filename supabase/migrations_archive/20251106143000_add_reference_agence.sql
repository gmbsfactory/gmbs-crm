-- Migration: Add reference_agence field for agencies requiring a reference
-- Related rule: BR-AGN-001 (ImoDirect, AFEDIM, Oqoro)
-- Date: 2025-11-06

-- Step 1: Add reference_agence column to interventions
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS reference_agence TEXT;

COMMENT ON COLUMN public.interventions.reference_agence IS 'External agency reference captured when required (BR-AGN-001).';

-- Step 2: Create agency_config table to toggle agency-specific requirements
CREATE TABLE IF NOT EXISTS public.agency_config (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  requires_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agency_config IS 'Feature toggles per agency (e.g. reference_agence requirement for BR-AGN-001).';
COMMENT ON COLUMN public.agency_config.requires_reference IS 'When true, reference_agence becomes mandatory for interventions linked to this agency.';

-- Step 3: Populate configuration for agencies requiring a reference
-- Agencies covered: ImoDirect, AFEDIM, Oqoro (BR-AGN-001 scope)
INSERT INTO public.agency_config (agency_id, requires_reference)
SELECT a.id, true
FROM public.agencies a
WHERE LOWER(a.label) IN ('imodirect', 'afedim', 'oqoro')
   OR LOWER(a.code) IN ('imodirect', 'afedim', 'oqoro')
ON CONFLICT (agency_id) DO UPDATE
SET requires_reference = EXCLUDED.requires_reference;

-- Step 4: Add an index to speed up lookups by reference_agence
CREATE INDEX IF NOT EXISTS idx_interventions_reference_agence
  ON public.interventions (reference_agence);
