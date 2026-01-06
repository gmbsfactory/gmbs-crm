-- Migration: Add soft delete columns for users
-- Description: Adds archived_at and restored_at columns to support soft delete functionality
--              Users are archived instead of deleted to preserve their history (interventions, etc.)

-- Add archived_at column (timestamp when user was archived/soft-deleted)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Add restored_at column (timestamp when user was restored from archive)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for filtering active users (status != 'archived')
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Create index for archived_at for potential cleanup queries
CREATE INDEX IF NOT EXISTS idx_users_archived_at ON public.users(archived_at) 
WHERE archived_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.users.archived_at IS 'Timestamp when the user was soft-deleted/archived. NULL means active.';
COMMENT ON COLUMN public.users.restored_at IS 'Timestamp when the user was restored from archive. NULL if never restored.';
