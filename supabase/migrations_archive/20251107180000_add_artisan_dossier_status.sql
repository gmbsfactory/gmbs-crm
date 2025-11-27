-- Migration: Ajouter statut_dossier aux artisans
-- Objectif: Distinguer le statut de l'artisan (candidat, novice, etc.) du statut du dossier (complet, incomplet, à compléter)
-- Règle ARC-002: Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"

ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS statut_dossier text;

-- Limiter les valeurs autorisées
ALTER TABLE public.artisans
  DROP CONSTRAINT IF EXISTS artisans_statut_dossier_check;

ALTER TABLE public.artisans
  ADD CONSTRAINT artisans_statut_dossier_check
  CHECK (statut_dossier IS NULL OR statut_dossier IN ('INCOMPLET', 'À compléter', 'COMPLET'));

COMMENT ON COLUMN public.artisans.statut_dossier IS 'Statut du dossier de l''artisan (documents) : INCOMPLET, À compléter, COMPLET';

-- Fonction pour calculer le statut de dossier basé sur les documents
CREATE OR REPLACE FUNCTION calculate_artisan_dossier_status(artisan_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  required_kinds text[] := ARRAY['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
  present_kinds text[];
  missing_count int;
  has_intervention boolean;
  kind text;
BEGIN
  -- Récupérer les kinds de documents présents pour cet artisan
  SELECT array_agg(DISTINCT LOWER(artisan_attachments.kind))
  INTO present_kinds
  FROM artisan_attachments
  WHERE artisan_attachments.artisan_id = artisan_uuid
    AND artisan_attachments.kind IS NOT NULL
    AND artisan_attachments.kind != 'autre';

  -- Si aucun document, retourner INCOMPLET
  IF present_kinds IS NULL THEN
    present_kinds := ARRAY[]::text[];
  END IF;

  -- Compter les documents manquants parmi les requis
  missing_count := 0;
  FOREACH kind IN ARRAY required_kinds
  LOOP
    IF NOT (LOWER(kind) = ANY(present_kinds)) THEN
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  -- Vérifier si l'artisan a effectué au moins une intervention terminée
  SELECT EXISTS (
    SELECT 1
    FROM intervention_artisans ia
    JOIN interventions i ON i.id = ia.intervention_id
    JOIN intervention_statuses ist ON ist.id = i.statut_id
    WHERE ia.artisan_id = artisan_uuid
      AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
  ) INTO has_intervention;

  -- Calculer le statut
  IF missing_count = 0 THEN
    RETURN 'COMPLET';
  ELSIF has_intervention AND (missing_count = array_length(required_kinds, 1) OR missing_count = 1) THEN
    -- À compléter : dossier vide (tous manquants) OU 1 seul fichier manquant ET artisan a effectué une intervention
    RETURN 'À compléter';
  ELSE
    RETURN 'INCOMPLET';
  END IF;
END;
$$;

COMMENT ON FUNCTION calculate_artisan_dossier_status IS 'Calcule le statut de dossier d''un artisan basé sur ses documents et ses interventions terminées';

-- Trigger pour mettre à jour automatiquement le statut de dossier quand des documents sont ajoutés/supprimés
CREATE OR REPLACE FUNCTION update_artisan_dossier_status_on_attachment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  artisan_uuid uuid;
  new_dossier_status text;
BEGIN
  -- Déterminer l'artisan_id selon l'opération
  IF TG_OP = 'DELETE' THEN
    artisan_uuid := OLD.artisan_id;
  ELSE
    artisan_uuid := NEW.artisan_id;
  END IF;

  -- Calculer le nouveau statut de dossier
  SELECT calculate_artisan_dossier_status(artisan_uuid)
  INTO new_dossier_status;

  -- Mettre à jour le statut de dossier de l'artisan
  UPDATE artisans
  SET statut_dossier = new_dossier_status,
      updated_at = now()
  WHERE id = artisan_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION update_artisan_dossier_status_on_attachment_change IS 'Met à jour automatiquement le statut de dossier quand des documents sont ajoutés/supprimés';

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_insert ON artisan_attachments;
CREATE TRIGGER trigger_update_dossier_status_on_attachment_insert
  AFTER INSERT ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change();

DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_delete ON artisan_attachments;
CREATE TRIGGER trigger_update_dossier_status_on_attachment_delete
  AFTER DELETE ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change();

-- Initialiser le statut de dossier pour les artisans existants
UPDATE artisans
SET statut_dossier = calculate_artisan_dossier_status(id)
WHERE statut_dossier IS NULL;

