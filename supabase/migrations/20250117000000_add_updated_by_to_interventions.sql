-- Ajouter le champ updated_by à la table interventions
ALTER TABLE public.interventions 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_interventions_updated_by ON public.interventions(updated_by);

-- Fonction trigger pour enregistrer l'utilisateur qui a fait la modification
CREATE OR REPLACE FUNCTION set_intervention_updated_by()
RETURNS trigger AS $$
BEGIN
  -- Enregistrer l'utilisateur authentifié qui fait la modification
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger si il n'existe pas déjà
DROP TRIGGER IF EXISTS trg_interventions_updated_by ON public.interventions;
CREATE TRIGGER trg_interventions_updated_by
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION set_intervention_updated_by();

-- Pour les INSERT, on peut aussi enregistrer l'utilisateur qui crée l'intervention
CREATE OR REPLACE FUNCTION set_intervention_created_by()
RETURNS trigger AS $$
BEGIN
  -- Si updated_by n'est pas déjà défini, utiliser auth.uid()
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_interventions_created_by ON public.interventions;
CREATE TRIGGER trg_interventions_created_by
  BEFORE INSERT ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION set_intervention_created_by();

