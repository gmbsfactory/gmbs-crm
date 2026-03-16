-- Add UNIQUE constraint on artisan telephone field
-- Prevents duplicate phone numbers across artisans

-- Add UNIQUE constraint on telephone (NULL values are allowed)
ALTER TABLE public.artisans
ADD CONSTRAINT unique_artisan_telephone
UNIQUE (telephone)
WHERE telephone IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX idx_artisans_telephone ON public.artisans(telephone)
WHERE telephone IS NOT NULL;

COMMENT ON CONSTRAINT unique_artisan_telephone ON public.artisans IS 'Ensures no two active artisans can have the same phone number. NULL values are allowed (multiple artisans without phone).';
