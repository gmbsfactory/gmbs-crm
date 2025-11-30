CREATE OR REPLACE FUNCTION log_intervention_status_transition_safety()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  from_status_code text;
  to_status_code text;
  existing_transition_id uuid;
BEGIN
  -- Si le statut n'a pas changé, ne rien faire
  IF OLD.statut_id = NEW.statut_id THEN
    RETURN NEW;
  END IF;

  -- CORRECTION : Si le nouveau statut est NULL, ne pas créer de transition
  -- (to_status_id a une contrainte NOT NULL dans la table)
  IF NEW.statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si une transition API existe déjà dans les 5 dernières secondes
  -- Cela évite les doublons quand l'API crée la transition avant l'UPDATE
  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND (
      -- Transition créée via API dans les 5 dernières secondes
      (source = 'api' AND transition_date > now() - INTERVAL '5 seconds')
      -- OU transition créée récemment (fallback pour sécurité)
      OR (transition_date > now() - INTERVAL '2 seconds')
    )
  LIMIT 1;

  -- Si une transition existe déjà, ne pas créer de doublon
  -- Le trigger sert uniquement de filet de sécurité pour les modifications directes en DB
  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer les codes de statut pour l'historique
  SELECT code INTO from_status_code
  FROM public.intervention_statuses WHERE id = OLD.statut_id;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses WHERE id = NEW.statut_id;

  -- CORRECTION : Vérifier que le code de statut cible existe
  -- Si le statut n'existe pas dans intervention_statuses, ne pas créer de transition
  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Créer la transition uniquement si elle n'existe pas déjà
  -- Ceci est un filet de sécurité pour les modifications directes en DB
  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, OLD.statut_id, NEW.statut_id, from_status_code, to_status_code, NULL,
    now(), 'trigger',
    jsonb_build_object(
      'date_termine', NEW.date_termine, 
      'updated_at', NEW.updated_at,
      'note', 'Enregistré automatiquement par trigger (modification directe en DB)',
      'safety_net', true
    )
  );

  RETURN NEW;
END;
$$;