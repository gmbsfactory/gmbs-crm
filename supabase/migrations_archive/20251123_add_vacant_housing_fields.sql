-- Add vacant housing fields to interventions table
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS is_vacant boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS key_code text,
ADD COLUMN IF NOT EXISTS floor text,
ADD COLUMN IF NOT EXISTS apartment_number text,
ADD COLUMN IF NOT EXISTS vacant_housing_instructions text;
