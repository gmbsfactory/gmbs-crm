-- Add color columns to agencies and metiers tables for Enum Management UI
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.agencies.color IS 'Hex color code for agency badge display (#RRGGBB format)';

ALTER TABLE public.metiers
ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.metiers.color IS 'Hex color code for metier badge display (#RRGGBB format)';

-- Populate metiers with colors from metier-colors.ts
UPDATE public.metiers SET color = '#3B82F6' WHERE code = 'PLOMBERIE';
UPDATE public.metiers SET color = '#F59E0B' WHERE code = 'ELECTRICITE';
UPDATE public.metiers SET color = '#EF4444' WHERE code = 'CHAUFFAGE';
UPDATE public.metiers SET color = '#06B6D4' WHERE code = 'CLIMATISATION';
UPDATE public.metiers SET color = '#8B5CF6' WHERE code = 'PEINTURE';
UPDATE public.metiers SET color = '#10B981' WHERE code = 'MENUISIER';
UPDATE public.metiers SET color = '#F97316' WHERE code = 'SERRURERIE';
UPDATE public.metiers SET color = '#EC4899' WHERE code = 'VITRERIE';
UPDATE public.metiers SET color = '#22C55E' WHERE code = 'JARDINAGE';
UPDATE public.metiers SET color = '#6366F1' WHERE code = 'BRICOLAGE';
UPDATE public.metiers SET color = '#6B7280' WHERE code = 'AUTRES';
UPDATE public.metiers SET color = '#84CC16' WHERE code = 'CAMION';
UPDATE public.metiers SET color = '#0EA5E9' WHERE code = 'ELECTROMENAGER';
UPDATE public.metiers SET color = '#14B8A6' WHERE code = 'ENTRETIEN_GENERAL';
UPDATE public.metiers SET color = '#A855F7' WHERE code = 'MULTI-SERVICE';
UPDATE public.metiers SET color = '#FB7185' WHERE code = 'MENAGE';
UPDATE public.metiers SET color = '#34D399' WHERE code = 'NETTOYAGE';
UPDATE public.metiers SET color = '#F87171' WHERE code = 'NUISIBLE';
UPDATE public.metiers SET color = '#60A5FA' WHERE code = 'RDF';
UPDATE public.metiers SET color = '#C084FC' WHERE code = 'RENOVATION';
UPDATE public.metiers SET color = '#818CF8' WHERE code = 'VOLET-STORE';
