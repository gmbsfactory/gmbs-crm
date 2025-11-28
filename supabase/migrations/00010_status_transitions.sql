-- ========================================
-- Status Transitions History & Auto-Creation
-- ========================================

-- ========================================
-- TABLE: Historique des transitions
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

COMMENT ON TABLE public.intervention_status_transitions IS 
  'Historique complet de toutes les transitions de statut des interventions pour le dashboard administrateur';
COMMENT ON COLUMN public.intervention_status_transitions.source IS 
  'Source de l''enregistrement: "api" pour enregistrement explicite depuis l''API, "trigger" pour enregistrement automatique par trigger';

-- ========================================
-- TRIGGER: Log transition on INSERT
-- ========================================

CREATE OR REPLACE FUNCTION log_intervention_status_transition_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
BEGIN
  IF NEW.statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, NULL, NEW.statut_id, NULL, to_status_code, NULL,
    COALESCE(NEW.date, NEW.created_at, now()), 'trigger',
    jsonb_build_object('date_termine', NEW.date_termine, 'created_at', NEW.created_at, 
      'note', 'Enregistré automatiquement par trigger lors de la création')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_intervention_status_transition_on_insert ON public.interventions;
CREATE TRIGGER trg_log_intervention_status_transition_on_insert
  AFTER INSERT ON public.interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION log_intervention_status_transition_on_insert();

-- ========================================
-- TRIGGER: Safety log on UPDATE
-- ========================================

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
  IF OLD.statut_id = NEW.statut_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT code INTO from_status_code
  FROM public.intervention_statuses WHERE id = OLD.statut_id;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses WHERE id = NEW.statut_id;

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, OLD.statut_id, NEW.statut_id, from_status_code, to_status_code, NULL,
    now(), 'trigger',
    jsonb_build_object('date_termine', NEW.date_termine, 'updated_at', NEW.updated_at,
      'note', 'Enregistré automatiquement par trigger (modification directe)')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_intervention_status_transition_safety ON public.interventions;
CREATE TRIGGER trg_log_intervention_status_transition_safety
  AFTER UPDATE OF statut_id ON public.interventions
  FOR EACH ROW
  WHEN (OLD.statut_id IS DISTINCT FROM NEW.statut_id)
  EXECUTE FUNCTION log_intervention_status_transition_safety();

-- ========================================
-- FONCTION: API pour enregistrer une transition
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
  IF p_from_status_id IS NOT NULL THEN
    SELECT code INTO from_status_code
    FROM public.intervention_statuses WHERE id = p_from_status_id;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses WHERE id = p_to_status_id;

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    p_intervention_id, p_from_status_id, p_to_status_id, from_status_code, to_status_code,
    p_changed_by_user_id, now(), 'api', COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO transition_id;

  RETURN transition_id;
END;
$$;

-- ========================================
-- FONCTION: Créer transitions automatiques à la création
-- ========================================

CREATE OR REPLACE FUNCTION create_automatic_status_transitions_on_creation(
  p_intervention_id uuid,
  p_to_status_code text,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- CORRECTION : Utiliser les codes DB (INTER_EN_COURS, INTER_TERMINEE) au lieu des codes frontend
  status_chain text[] := ARRAY['DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE'];
  to_index integer;
  i integer;
  current_from_code text;
  current_to_code text;
  current_from_status_id uuid;
  current_to_status_id uuid;
  transitions_created integer := 0;
  transition_date_base timestamptz;
  transition_delay_ms integer := 1;
BEGIN
  to_index := array_position(status_chain, p_to_status_code);
  
  DELETE FROM public.intervention_status_transitions
  WHERE intervention_id = p_intervention_id
    AND source = 'trigger'
    AND transition_date > now() - INTERVAL '2 seconds';
  
  IF to_index IS NULL THEN
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses WHERE code = p_to_status_code;
    
    IF current_to_status_id IS NULL THEN
      RETURN 0;
    END IF;
    
    PERFORM log_status_transition_from_api(
      p_intervention_id, NULL, current_to_status_id, p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('is_initial_creation', true)
    );
    
    RETURN 1;
  END IF;
  
  IF to_index = 1 THEN
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses WHERE code = p_to_status_code;
    
    IF current_to_status_id IS NULL THEN
      RETURN 0;
    END IF;
    
    PERFORM log_status_transition_from_api(
      p_intervention_id, NULL, current_to_status_id, p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('is_initial_creation', true)
    );
    
    RETURN 1;
  END IF;
  
  transition_date_base := now();
  
  FOR i IN 1..to_index LOOP
    IF i = 1 THEN
      current_from_code := NULL;
      current_to_code := status_chain[1];
    ELSE
      current_from_code := status_chain[i - 1];
      current_to_code := status_chain[i];
    END IF;
    
    IF current_from_code IS NOT NULL THEN
      SELECT id INTO current_from_status_id
      FROM public.intervention_statuses WHERE code = current_from_code;
    ELSE
      current_from_status_id := NULL;
    END IF;
    
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses WHERE code = current_to_code;
    
    IF current_to_status_id IS NULL THEN
      CONTINUE;
    END IF;
    
    PERFORM log_status_transition_from_api(
      p_intervention_id, current_from_status_id, current_to_status_id, p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'is_initial_creation', true, 'is_intermediate', i < to_index,
        'final_target_status', p_to_status_code, 'transition_order', i, 'total_transitions', to_index
      )
    );
    
    UPDATE public.intervention_status_transitions
    SET transition_date = transition_date_base + ((i - 1) * transition_delay_ms * INTERVAL '1 millisecond')
    WHERE id = (
      SELECT id FROM public.intervention_status_transitions
      WHERE intervention_id = p_intervention_id
        AND to_status_id = current_to_status_id
        AND transition_date > transition_date_base - INTERVAL '1 second'
      ORDER BY created_at DESC
      LIMIT 1
    );
    
    transitions_created := transitions_created + 1;
  END LOOP;
  
  RETURN transitions_created;
END;
$$;

COMMENT ON FUNCTION create_automatic_status_transitions_on_creation IS 
  'Crée automatiquement toutes les transitions de statut intermédiaires lors de la création d''une intervention';

-- ========================================
-- FONCTION HELPER: Dates de période
-- ========================================

CREATE OR REPLACE FUNCTION get_period_dates(
  period_type TEXT,
  reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (period_start DATE, period_end DATE) 
LANGUAGE plpgsql
AS $$
BEGIN
  CASE period_type
    WHEN 'day' THEN
      RETURN QUERY SELECT reference_date, reference_date;
    WHEN 'month' THEN
      RETURN QUERY SELECT 
        DATE_TRUNC('month', reference_date)::DATE,
        (DATE_TRUNC('month', reference_date) + INTERVAL '1 month - 1 day')::DATE;
    WHEN 'year' THEN
      RETURN QUERY SELECT 
        DATE_TRUNC('year', reference_date)::DATE,
        (DATE_TRUNC('year', reference_date) + INTERVAL '1 year - 1 day')::DATE;
    ELSE
      RAISE EXCEPTION 'Invalid period_type. Must be: day, month, or year';
  END CASE;
END;
$$;

