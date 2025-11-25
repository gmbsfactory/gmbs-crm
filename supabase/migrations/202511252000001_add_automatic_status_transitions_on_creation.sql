-- ========================================
-- MIGRATION: Transitions automatiques lors de la création
-- ========================================
-- Date: 2025-12-02
-- Objectif: Créer automatiquement les transitions de statut intermédiaires
-- lors de la création d'une intervention avec un statut avancé dans la chaîne

-- ========================================
-- FONCTION POUR CRÉER LES TRANSITIONS AUTOMATIQUES LORS DE LA CRÉATION
-- ========================================
-- Cette fonction crée automatiquement toutes les transitions intermédiaires
-- si une intervention est créée avec un statut qui n'est pas le premier de la chaîne

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
  -- Chaîne de progression par défaut (doit correspondre à DEFAULT_STATUS_CHAIN dans TypeScript)
  status_chain text[] := ARRAY['DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE', 'EN_COURS', 'TERMINE'];
  to_index integer;
  i integer;
  current_from_code text;
  current_to_code text;
  current_from_status_id uuid;
  current_to_status_id uuid;
  transitions_created integer := 0;
  transition_date_base timestamptz;
  transition_delay_ms integer := 1; -- 1ms entre chaque transition
BEGIN
  -- Trouver l'index du statut cible dans la chaîne
  to_index := array_position(status_chain, p_to_status_code);
  
  -- Supprimer toute transition créée par le trigger pour cette intervention
  -- (le trigger crée une transition directe, mais on veut créer toutes les transitions intermédiaires)
  DELETE FROM public.intervention_status_transitions
  WHERE intervention_id = p_intervention_id
    AND source = 'trigger'
    AND transition_date > now() - INTERVAL '2 seconds';
  
  -- Si le statut cible n'est pas dans la chaîne, créer seulement la transition directe
  IF to_index IS NULL THEN
    -- Récupérer l'ID du statut cible
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses
    WHERE code = p_to_status_code;
    
    IF current_to_status_id IS NULL THEN
      RETURN 0;
    END IF;
    
    -- Créer la transition directe (NULL -> statut cible)
    PERFORM log_status_transition_from_api(
      p_intervention_id,
      NULL,
      current_to_status_id,
      p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('is_initial_creation', true)
    );
    
    RETURN 1;
  END IF;
  
  -- Si le statut cible est le premier de la chaîne (index 1), pas de transitions intermédiaires
  IF to_index = 1 THEN
    -- Récupérer l'ID du statut cible
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses
    WHERE code = p_to_status_code;
    
    IF current_to_status_id IS NULL THEN
      RETURN 0;
    END IF;
    
    -- Créer la transition directe (NULL -> statut cible)
    PERFORM log_status_transition_from_api(
      p_intervention_id,
      NULL,
      current_to_status_id,
      p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('is_initial_creation', true)
    );
    
    RETURN 1;
  END IF;
  
  -- Créer toutes les transitions depuis le premier statut jusqu'au statut cible
  -- Exemple: si to_index = 3 (VISITE_TECHNIQUE), créer:
  -- 1. NULL -> DEMANDE
  -- 2. DEMANDE -> DEVIS_ENVOYE
  -- 3. DEVIS_ENVOYE -> VISITE_TECHNIQUE
  
  transition_date_base := now();
  
  FOR i IN 1..to_index LOOP
    -- Déterminer les codes de statut pour cette transition
    IF i = 1 THEN
      -- Première transition: NULL -> premier statut de la chaîne
      current_from_code := NULL;
      current_to_code := status_chain[1];
    ELSE
      -- Transitions suivantes: statut précédent -> statut actuel
      current_from_code := status_chain[i - 1];
      current_to_code := status_chain[i];
    END IF;
    
    -- Récupérer les IDs des statuts
    IF current_from_code IS NOT NULL THEN
      SELECT id INTO current_from_status_id
      FROM public.intervention_statuses
      WHERE code = current_from_code;
    ELSE
      current_from_status_id := NULL;
    END IF;
    
    SELECT id INTO current_to_status_id
    FROM public.intervention_statuses
    WHERE code = current_to_code;
    
    -- Si un des statuts n'existe pas, continuer avec le suivant
    IF current_to_status_id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Créer la transition avec un délai pour préserver l'ordre chronologique
    PERFORM log_status_transition_from_api(
      p_intervention_id,
      current_from_status_id,
      current_to_status_id,
      p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'is_initial_creation', true,
        'is_intermediate', i < to_index,
        'final_target_status', p_to_status_code,
        'transition_order', i,
        'total_transitions', to_index
      )
    );
    
    -- Mettre à jour la date de transition pour préserver l'ordre
    -- (la fonction log_status_transition_from_api utilise now() par défaut,
    -- donc on doit mettre à jour manuellement)
    UPDATE public.intervention_status_transitions
    SET transition_date = transition_date_base + ((i - 1) * transition_delay_ms * INTERVAL '1 millisecond')
    WHERE intervention_id = p_intervention_id
      AND to_status_id = current_to_status_id
      AND transition_date > transition_date_base - INTERVAL '1 second'
    ORDER BY created_at DESC
    LIMIT 1;
    
    transitions_created := transitions_created + 1;
  END LOOP;
  
  RETURN transitions_created;
END;
$$;

COMMENT ON FUNCTION create_automatic_status_transitions_on_creation IS 
  'Crée automatiquement toutes les transitions de statut intermédiaires lors de la création d''une intervention avec un statut avancé dans la chaîne de progression';

