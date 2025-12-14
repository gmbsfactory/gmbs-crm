-- Migration: Lateness Tracking System
-- Description: Adds columns to track user lateness (late logins after 10 AM on business days)
-- Date: 2025-12-12

-- Add lateness tracking columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lateness_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lateness_count_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  ADD COLUMN IF NOT EXISTS last_lateness_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lateness_notification_shown_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT NULL;

-- Add comments to document the columns
COMMENT ON COLUMN public.users.lateness_count IS 'Number of times user has logged in late (after 10:00 AM on business days) in the current year';
COMMENT ON COLUMN public.users.lateness_count_year IS 'Year for which the lateness_count is tracked. Used to detect year change and reset counter.';
COMMENT ON COLUMN public.users.last_lateness_date IS 'Last date when user was marked late. Used to prevent counting multiple logins on same day.';
COMMENT ON COLUMN public.users.lateness_notification_shown_at IS 'Timestamp when lateness notification was last shown to user. Used to prevent showing toast multiple times per day.';
COMMENT ON COLUMN public.users.last_activity_date IS 'Last calendar date (YYYY-MM-DD) when user had any activity. Used to detect first activity of day for lateness tracking.';

-- Create index for performance on year-based queries
CREATE INDEX IF NOT EXISTS idx_users_lateness_year
  ON public.users(lateness_count_year);

-- Create index on last_lateness_date for efficient date comparisons
CREATE INDEX IF NOT EXISTS idx_users_last_lateness_date
  ON public.users(last_lateness_date)
  WHERE last_lateness_date IS NOT NULL;

-- Create index on last_activity_date for efficient daily activity detection
CREATE INDEX IF NOT EXISTS idx_users_last_activity_date
  ON public.users(last_activity_date)
  WHERE last_activity_date IS NOT NULL;
