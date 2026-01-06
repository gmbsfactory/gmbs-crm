-- Migration: Add 'archived' value to user_status enum
-- Description: Extends the user_status enum to include 'archived' for soft-deleted users
--              This allows users to be marked as archived while preserving their data

-- Add 'archived' to the user_status enum
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'archived';
