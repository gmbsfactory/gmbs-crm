-- ========================================
-- Fonction SQL pour mettre à jour le statut avec chaîne complète
-- ========================================
-- Cette fonction réplique la logique de AutomaticTransitionService
-- pour permettre les updates SQL directs avec création de la chaîne complète
-- ========================================

CREATE OR REPLACE FUNCTION update_intervention_status_with_chain(
  p_intervention_id uuid,
  p_to_status_code text,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Chaîne de statuts DB (même que DEFAULT_STATUS_CHAIN dans le code)
  status_chain text[] := ARRAY[
    'DEMANDE', 
    'DEVIS_ENVOYE', 
    'VISITE_TECHNIQUE', 
    'ACCEPTE', 
    'INTER_EN_COURS', 
    'INTER_TERMINEE'
  ];
  
  v_current_status_id uuid;
  v_current_status_code text;
  v_to_status_id uuid;
  v_from_index integer;
  v_to_index integer;
  v_current_from_code text;
  v_current_to_code text;
  v_current_from_status_id uuid;
  v_current_to_status_id uuid;
  v_transitions_created integer := 0;
  v_transition_date_base timestamptz;
  v_transition_delay_ms integer := 1;
  v_result jsonb;
BEGIN
  -- 1. Récupérer le statut actuel de l'intervention
  SELECT statut_id INTO v_current_status_id
  FROM public.interventions
  WHERE id = p_intervention_id;
  
  IF v_current_status_id IS NULL THEN
    RAISE EXCEPTION 'Intervention % non trouvée ou sans statut', p_intervention_id;
  END IF;
  
  -- 2. Récupérer le code du statut actuel
  SELECT code INTO v_current_status_code
  FROM public.intervention_statuses
  WHERE id = v_current_status_id;
  
  -- 3. Récupérer l'ID du statut cible
  SELECT id INTO v_to_status_id
  FROM public.intervention_statuses
  WHERE code = p_to_status_code;
  
  IF v_to_status_id IS NULL THEN
    RAISE EXCEPTION 'Statut cible % non trouvé', p_to_status_code;
  END IF;
  
  -- 4. Si le statut ne change pas, ne rien faire
  IF v_current_status_id = v_to_status_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'transitions_created', 0,
      'message', 'Statut inchangé'
    );
  END IF;
  
  -- 5. Trouver les positions dans la chaîne
  v_from_index := array_position(status_chain, v_current_status_code);
  v_to_index := array_position(status_chain, p_to_status_code);
  
  -- 6. Si l'un des statuts n'est pas dans la chaîne, transition directe simple
  IF v_from_index IS NULL OR v_to_index IS NULL THEN
    -- Transition directe sans intermédiaires
    PERFORM log_status_transition_from_api(
      p_intervention_id,
      v_current_status_id,
      v_to_status_id,
      p_changed_by_user_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'updated_via', 'sql_function',
        'created_by', 'update_intervention_status_with_chain'
      )
    );
    
    v_transitions_created := 1;
  ELSE
    -- 7. Créer les transitions intermédiaires
    v_transition_date_base := now();
    
    -- Parcourir de from_index+1 à to_index (inclus)
    FOR i IN (v_from_index + 1)..v_to_index LOOP
      IF i = 1 THEN
        v_current_from_code := NULL;
        v_current_from_status_id := NULL;
      ELSE
        v_current_from_code := status_chain[i - 1];
        SELECT id INTO v_current_from_status_id
        FROM public.intervention_statuses
        WHERE code = v_current_from_code;
      END IF;
      
      v_current_to_code := status_chain[i];
      
      SELECT id INTO v_current_to_status_id
      FROM public.intervention_statuses
      WHERE code = v_current_to_code;
      
      IF v_current_to_status_id IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Créer la transition
      PERFORM log_status_transition_from_api(
        p_intervention_id,
        v_current_from_status_id,
        v_current_to_status_id,
        p_changed_by_user_id,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'created_by', 'update_intervention_status_with_chain',
          'service_version', '1.0',
          'is_intermediate', i < v_to_index,
          'final_target_status', p_to_status_code,
          'transition_order', i - v_from_index,
          'total_transitions', v_to_index - v_from_index,
          'updated_via', 'sql_function'
        )
      );
      
      -- Ajuster la date de transition pour préserver l'ordre
      UPDATE public.intervention_status_transitions
      SET transition_date = v_transition_date_base + ((i - v_from_index - 1) * v_transition_delay_ms * INTERVAL '1 millisecond')
      WHERE id = (
        SELECT id 
        FROM public.intervention_status_transitions
        WHERE intervention_id = p_intervention_id
          AND to_status_id = v_current_to_status_id
          AND transition_date > v_transition_date_base - INTERVAL '1 second'
        ORDER BY created_at DESC
        LIMIT 1
      );
      
      v_transitions_created := v_transitions_created + 1;
    END LOOP;
  END IF;
  
  -- 8. Mettre à jour le statut de l'intervention
  UPDATE public.interventions
  SET 
    statut_id = v_to_status_id,
    updated_at = now()
  WHERE id = p_intervention_id;
  
  -- 9. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'transitions_created', v_transitions_created,
    'from_status', v_current_status_code,
    'to_status', p_to_status_code,
    'intervention_id', p_intervention_id
  );
END;
$$;

COMMENT ON FUNCTION update_intervention_status_with_chain IS 
  'Met à jour le statut d''une intervention en créant automatiquement toutes les transitions intermédiaires de la chaîne';

-- ========================================
-- Exemple d'utilisation :
-- ========================================
-- SELECT update_intervention_status_with_chain(
--   'intervention-uuid',
--   'INTER_TERMINEE',
--   'user-uuid',
--   '{"note": "Intervention terminée"}'::jsonb
-- );
-- ========================================

