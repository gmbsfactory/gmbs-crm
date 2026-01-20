-- Migration: Add has_portal_report flag to interventions table
-- Description: Add a boolean flag to track when an intervention has a submitted report from portal_gmbs
-- Date: 2026-01-20

-- Add the has_portal_report column
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS has_portal_report BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.interventions.has_portal_report IS
'Indicates if a report has been submitted from portal_gmbs for this intervention. When true and status is INTER_EN_COURS, the UI displays "À vérifier" badge.';

-- Create index for performance when filtering interventions with portal reports
CREATE INDEX IF NOT EXISTS idx_interventions_has_portal_report
ON public.interventions(has_portal_report)
WHERE has_portal_report = true;

-- Create compound index for status display query optimization
CREATE INDEX IF NOT EXISTS idx_interventions_status_portal_report
ON public.interventions(statut_id, has_portal_report)
WHERE has_portal_report = true;
