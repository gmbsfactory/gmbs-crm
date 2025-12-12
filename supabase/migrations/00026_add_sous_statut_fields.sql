-- Migration: Add sous_statut_text, sous_statut_text_color and sous_statut_bg_color columns to interventions table
-- These fields allow users to add a custom sub-status with custom text and background colors

-- Add sous_statut_text column for the sub-status text (max 25 characters like in the original system)
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS sous_statut_text text;

-- Add sous_statut_text_color column for the text color (hex color format)
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS sous_statut_text_color text DEFAULT '#000000';

-- Add sous_statut_bg_color column for the background/highlight color (hex color format)
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS sous_statut_bg_color text DEFAULT 'transparent';

-- Add comments for documentation
COMMENT ON COLUMN public.interventions.sous_statut_text IS 'Texte personnalisé de sous-statut (max 25 caractères)';
COMMENT ON COLUMN public.interventions.sous_statut_text_color IS 'Couleur du texte de sous-statut (format hex, ex: #FF0000)';
COMMENT ON COLUMN public.interventions.sous_statut_bg_color IS 'Couleur de surlignage/fond du sous-statut (format hex, ex: #FFFF00)';

-- Create index for filtering by sous_statut_text
CREATE INDEX IF NOT EXISTS idx_interventions_sous_statut_text 
ON public.interventions(sous_statut_text) 
WHERE sous_statut_text IS NOT NULL;

-- Refresh materialized views if they include intervention data
-- This ensures the new columns are available in search views
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'search_interventions_full') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_interventions_full;
  END IF;
END $$;

