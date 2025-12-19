-- Migration: Add IBAN to artisans

ALTER TABLE public.artisans
ADD COLUMN IF NOT EXISTS iban text;

COMMENT ON COLUMN public.artisans.iban IS 'IBAN for artisan bank account';
