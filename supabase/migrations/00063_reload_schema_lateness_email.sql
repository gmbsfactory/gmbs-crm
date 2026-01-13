-- Migration: Reload PostgREST schema cache
-- Description: Force PostgREST to recognize the new lateness_email_config table
-- Date: 2026-01-13

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
