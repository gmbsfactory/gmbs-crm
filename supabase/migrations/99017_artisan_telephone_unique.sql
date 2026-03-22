-- Add partial unique index on artisan telephone field
-- Prevents duplicate phone numbers across artisans, NULL values allowed

-- Step 1: Nullify duplicate phone numbers, keeping only the most recently updated artisan
UPDATE public.artisans a
SET telephone = NULL
WHERE telephone IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (telephone) id
    FROM public.artisans
    WHERE telephone IS NOT NULL
    ORDER BY telephone, updated_at DESC NULLS LAST
  )
  AND telephone IN (
    SELECT telephone
    FROM public.artisans
    WHERE telephone IS NOT NULL
    GROUP BY telephone
    HAVING COUNT(*) > 1
  );

-- Step 2: Create the unique index (now safe)
DROP INDEX IF EXISTS unique_artisan_telephone;
DROP INDEX IF EXISTS idx_artisans_telephone;

CREATE UNIQUE INDEX unique_artisan_telephone ON public.artisans(telephone)
WHERE telephone IS NOT NULL;
