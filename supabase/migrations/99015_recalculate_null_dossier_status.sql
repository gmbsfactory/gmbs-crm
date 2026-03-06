-- Simplifier la logique de statut_dossier :
-- 0 doc requis  → INCOMPLET
-- 1-4 docs      → À compléter
-- 5 docs        → COMPLET
-- (plus de dépendance sur les interventions terminées)

CREATE OR REPLACE FUNCTION calculate_artisan_dossier_status(artisan_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  required_kinds text[] := ARRAY['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
  present_kinds text[];
  missing_count int;
  kind text;
BEGIN
  SELECT array_agg(DISTINCT LOWER(artisan_attachments.kind))
  INTO present_kinds
  FROM artisan_attachments
  WHERE artisan_attachments.artisan_id = artisan_uuid
    AND artisan_attachments.kind IS NOT NULL
    AND artisan_attachments.kind != 'autre';

  IF present_kinds IS NULL THEN
    present_kinds := ARRAY[]::text[];
  END IF;

  missing_count := 0;
  FOREACH kind IN ARRAY required_kinds
  LOOP
    IF NOT (LOWER(kind) = ANY(present_kinds)) THEN
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  IF missing_count = 0 THEN
    RETURN 'COMPLET';
  ELSIF missing_count = 5 THEN
    RETURN 'INCOMPLET';
  ELSE
    RETURN 'À compléter';
  END IF;
END;
$$;

-- Recalculer tous les artisans avec la nouvelle logique
UPDATE artisans
SET statut_dossier = calculate_artisan_dossier_status(id)
WHERE is_active = true;
