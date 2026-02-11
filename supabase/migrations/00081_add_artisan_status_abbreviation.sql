-- Add abbreviation column to artisan_statuses
ALTER TABLE public.artisan_statuses ADD COLUMN IF NOT EXISTS abbreviation text;

-- Populate existing statuses with abbreviations
UPDATE public.artisan_statuses SET abbreviation = 'CAN' WHERE code = 'CANDIDAT';
UPDATE public.artisan_statuses SET abbreviation = 'POT' WHERE code = 'POTENTIEL';
UPDATE public.artisan_statuses SET abbreviation = 'NOV' WHERE code = 'NOVICE';
UPDATE public.artisan_statuses SET abbreviation = 'FORM' WHERE code = 'FORMATION';
UPDATE public.artisan_statuses SET abbreviation = 'CONF' WHERE code = 'CONFIRME';
UPDATE public.artisan_statuses SET abbreviation = 'EXP' WHERE code = 'EXPERT';
UPDATE public.artisan_statuses SET abbreviation = 'ONE' WHERE code = 'ONE_SHOT';
UPDATE public.artisan_statuses SET abbreviation = 'INA' WHERE code = 'INACTIF';
UPDATE public.artisan_statuses SET abbreviation = 'ARC' WHERE code = 'ARCHIVE';
