-- ========================================
-- MIGRATION: Table d'historique des transitions de statut
-- ========================================
-- Date: 2025-11-15
-- Objectif: Enregistrer toutes les transitions de statut pour le dashboard admin
-- Approche hybride: API explicite + trigger de sécurité

-- ========================================
-- TABLE D'HISTORIQUE DES TRANSITIONS
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES public.intervention_statuses(id),
  to_status_id uuid NOT NULL REFERENCES public.intervention_statuses(id),
  from_status_code text,
  to_status_code text,
  changed_by_user_id uuid REFERENCES public.users(id),
  transition_date timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'trigger' CHECK (source IN ('api', 'trigger')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour les performances des requêtes du dashboard
CREATE INDEX IF NOT EXISTS idx_intervention_status_transitions_intervention_id 
  ON public.intervention_status_transitions(intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_status_transitions_to_status_code 
  ON public.intervention_status_transitions(to_status_code);

CREATE INDEX IF NOT EXISTS idx_intervention_status_transitions_transition_date 
  ON public.intervention_status_transitions(transition_date);

CREATE INDEX IF NOT EXISTS idx_intervention_status_transitions_to_status_date 
  ON public.intervention_status_transitions(to_status_code, transition_date);

CREATE INDEX IF NOT EXISTS idx_intervention_status_transitions_intervention_date 
  ON public.intervention_status_transitions(intervention_id, transition_date);

-- Commentaires
COMMENT ON TABLE public.intervention_status_transitions IS 
  'Historique complet de toutes les transitions de statut des interventions pour le dashboard administrateur';

COMMENT ON COLUMN public.intervention_status_transitions.transition_date IS 
  'Date exacte de la transition (utilisée pour filtrer par période dans le dashboard)';

COMMENT ON COLUMN public.intervention_status_transitions.source IS 
  'Source de l''enregistrement: "api" pour enregistrement explicite depuis l''API, "trigger" pour enregistrement automatique par trigger';

-- ========================================
-- TRIGGER POUR INSERT (Création initiale)
-- ========================================
-- Ce trigger enregistre automatiquement la transition initiale lors de la création
-- d'une intervention avec un statut

CREATE OR REPLACE FUNCTION log_intervention_status_transition_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
BEGIN
  -- Ne rien faire si l'intervention n'a pas de statut
  IF NEW.statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si une transition a déjà été enregistrée récemment (dans les 2 secondes)
  -- Cela évite les doublons si l'API a déjà enregistré
  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  -- Si une transition existe déjà (enregistrée par l'API), ne pas créer de doublon
  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer le code du statut initial
  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  -- Si le statut n'existe pas, ne rien faire
  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insérer la transition initiale (création)
  INSERT INTO public.intervention_status_transitions (
    intervention_id,
    from_status_id,
    to_status_id,
    from_status_code,
    to_status_code,
    changed_by_user_id,
    transition_date,
    source,
    metadata
  ) VALUES (
    NEW.id,
    NULL, -- Pas de statut précédent lors de la création
    NEW.statut_id,
    NULL,
    to_status_code,
    NULL, -- On ne peut pas récupérer l'utilisateur dans le trigger
    COALESCE(NEW.date, NEW.created_at, now()), -- Utiliser la date de l'intervention (depuis CSV) ou created_at en fallback
    'trigger', -- Marque que c'est venu du trigger
    jsonb_build_object(
      'date_termine', NEW.date_termine,
      'created_at', NEW.created_at,
      'note', 'Enregistré automatiquement par trigger lors de la création de l''intervention'
    )
  );

  RETURN NEW;
END;
$$;

-- Créer le trigger pour INSERT
DROP TRIGGER IF EXISTS trg_log_intervention_status_transition_on_insert ON public.interventions;
CREATE TRIGGER trg_log_intervention_status_transition_on_insert
  AFTER INSERT ON public.interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION log_intervention_status_transition_on_insert();

-- ========================================
-- TRIGGER DE SÉCURITÉ (Filet de secours pour UPDATE)
-- ========================================
-- Ce trigger enregistre automatiquement les transitions si l'API ne l'a pas fait
-- Il évite les doublons en vérifiant s'il existe déjà une transition récente

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
  -- Ne rien faire si le statut n'a pas changé
  IF OLD.statut_id = NEW.statut_id THEN
    RETURN NEW;
  END IF;

  -- Vérifier si une transition a déjà été enregistrée récemment (dans les 2 secondes)
  -- Cela évite les doublons si l'API a déjà enregistré
  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  -- Si une transition existe déjà (enregistrée par l'API), ne pas créer de doublon
  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer les codes de statut
  SELECT code INTO from_status_code
  FROM public.intervention_statuses
  WHERE id = OLD.statut_id;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  -- Insérer la transition (filet de sécurité)
  INSERT INTO public.intervention_status_transitions (
    intervention_id,
    from_status_id,
    to_status_id,
    from_status_code,
    to_status_code,
    changed_by_user_id,
    transition_date,
    source,
    metadata
  ) VALUES (
    NEW.id,
    OLD.statut_id,
    NEW.statut_id,
    from_status_code,
    to_status_code,
    NULL, -- On ne peut pas récupérer l'utilisateur dans le trigger
    now(),
    'trigger', -- Marque que c'est venu du trigger
    jsonb_build_object(
      'date_termine', NEW.date_termine,
      'updated_at', NEW.updated_at,
      'note', 'Enregistré automatiquement par trigger (modification directe en DB ou API sans enregistrement explicite)'
    )
  );

  RETURN NEW;
END;
$$;

-- Créer le trigger pour UPDATE
DROP TRIGGER IF EXISTS trg_log_intervention_status_transition_safety ON public.interventions;
CREATE TRIGGER trg_log_intervention_status_transition_safety
  AFTER UPDATE OF statut_id ON public.interventions
  FOR EACH ROW
  WHEN (OLD.statut_id IS DISTINCT FROM NEW.statut_id)
  EXECUTE FUNCTION log_intervention_status_transition_safety();

-- ========================================
-- FONCTION POUR ENREGISTREMENT EXPLICITE DEPUIS L'API
-- ========================================

CREATE OR REPLACE FUNCTION log_status_transition_from_api(
  p_intervention_id uuid,
  p_from_status_id uuid,
  p_to_status_id uuid,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  from_status_code text;
  to_status_code text;
  transition_id uuid;
BEGIN
  -- Récupérer les codes de statut
  IF p_from_status_id IS NOT NULL THEN
    SELECT code INTO from_status_code
    FROM public.intervention_statuses
    WHERE id = p_from_status_id;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = p_to_status_id;

  -- Insérer la transition avec source='api'
  INSERT INTO public.intervention_status_transitions (
    intervention_id,
    from_status_id,
    to_status_id,
    from_status_code,
    to_status_code,
    changed_by_user_id,
    transition_date,
    source,
    metadata
  ) VALUES (
    p_intervention_id,
    p_from_status_id,
    p_to_status_id,
    from_status_code,
    to_status_code,
    p_changed_by_user_id,
    now(),
    'api',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO transition_id;

  RETURN transition_id;
END;
$$;

-- ========================================
-- FONCTION HELPER POUR CALCULER LES DATES DE PÉRIODE
-- ========================================

CREATE OR REPLACE FUNCTION get_period_dates(
  period_type TEXT, -- 'day', 'month', 'year'
  reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (period_start DATE, period_end DATE) 
LANGUAGE plpgsql
AS $$
BEGIN
  CASE period_type
    WHEN 'day' THEN
      RETURN QUERY SELECT 
        reference_date as period_start,
        reference_date as period_end;
    
    WHEN 'month' THEN
      RETURN QUERY SELECT 
        DATE_TRUNC('month', reference_date)::DATE as period_start,
        (DATE_TRUNC('month', reference_date) + INTERVAL '1 month - 1 day')::DATE as period_end;
    
    WHEN 'year' THEN
      RETURN QUERY SELECT 
        DATE_TRUNC('year', reference_date)::DATE as period_start,
        (DATE_TRUNC('year', reference_date) + INTERVAL '1 year - 1 day')::DATE as period_end;
    
    ELSE
      RAISE EXCEPTION 'Invalid period_type. Must be: day, month, or year';
  END CASE;
END;
$$;

-- ========================================
-- FONCTION DE BACKFILL (Optionnelle)
-- ========================================
-- Cette fonction peut être appelée une fois pour migrer les données existantes
-- en supposant que la date de création = première transition vers DEMANDE
-- et date_termine = transition vers INTER_TERMINEE

CREATE OR REPLACE FUNCTION backfill_status_transitions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  intervention_record RECORD;
  demande_status_id uuid;
  current_status_id uuid;
  current_status_code text;
  terminated_status_id uuid;
BEGIN
  -- Récupérer l'ID du statut DEMANDE
  SELECT id INTO demande_status_id
  FROM public.intervention_statuses
  WHERE code = 'DEMANDE'
  LIMIT 1;

  -- Récupérer l'ID du statut INTER_TERMINEE
  SELECT id INTO terminated_status_id
  FROM public.intervention_statuses
  WHERE code = 'INTER_TERMINEE'
  LIMIT 1;

  -- Pour chaque intervention existante
  FOR intervention_record IN 
    SELECT id, statut_id, created_at, date_termine, updated_at
    FROM public.interventions
    WHERE is_active = true
  LOOP
    -- Transition initiale vers le statut actuel (ou DEMANDE si pas de statut)
    current_status_id := COALESCE(intervention_record.statut_id, demande_status_id);
    
    SELECT code INTO current_status_code
    FROM public.intervention_statuses
    WHERE id = current_status_id;

    -- Insérer la transition initiale (création)
    INSERT INTO public.intervention_status_transitions (
      intervention_id,
      from_status_id,
      to_status_id,
      from_status_code,
      to_status_code,
      transition_date,
      source,
      metadata
    ) VALUES (
      intervention_record.id,
      NULL, -- Pas de statut précédent
      current_status_id,
      NULL,
      current_status_code,
      intervention_record.created_at,
      'trigger',
      jsonb_build_object('backfilled', true, 'note', 'Migration des données existantes')
    ) ON CONFLICT DO NOTHING;

    -- Si l'intervention est terminée et a une date_termine, créer une transition
    IF intervention_record.date_termine IS NOT NULL 
       AND terminated_status_id IS NOT NULL
       AND current_status_id = terminated_status_id THEN
      INSERT INTO public.intervention_status_transitions (
        intervention_id,
        from_status_id,
        to_status_id,
        from_status_code,
        to_status_code,
        transition_date,
        source,
        metadata
      ) VALUES (
        intervention_record.id,
        current_status_id,
        terminated_status_id,
        current_status_code,
        'INTER_TERMINEE',
        intervention_record.date_termine,
        'trigger',
        jsonb_build_object('backfilled', true, 'note', 'Migration des données existantes - transition vers terminé')
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION backfill_status_transitions() IS 
  'Fonction optionnelle pour migrer les données existantes. À exécuter une seule fois après la création de la table.';

