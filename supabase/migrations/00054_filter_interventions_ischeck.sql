-- Migration: Ajouter une fonction RPC pour filtrer les interventions isCheck côté serveur
-- Description: Permet de filtrer les interventions en retard (date_prevue <= aujourd'hui ET statut VISITE_TECHNIQUE ou INTER_EN_COURS)
-- Date: 2025-12-30

-- ========================================
-- FONCTION RPC: filter_interventions_ischeck
-- ========================================
-- Cette fonction retourne les IDs des interventions qui sont en état "isCheck"
-- isCheck = statut IN ('VISITE_TECHNIQUE', 'INTER_EN_COURS') ET date_prevue <= CURRENT_DATE

CREATE OR REPLACE FUNCTION public.filter_interventions_ischeck(
  p_user_id UUID DEFAULT NULL,
  p_include_check BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(intervention_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visite_technique_id UUID;
  v_inter_en_cours_id UUID;
BEGIN
  -- Récupérer les IDs des statuts concernés
  SELECT id INTO v_visite_technique_id
  FROM public.intervention_statuses
  WHERE code = 'VISITE_TECHNIQUE'
  LIMIT 1;

  SELECT id INTO v_inter_en_cours_id
  FROM public.intervention_statuses
  WHERE code = 'INTER_EN_COURS'
  LIMIT 1;

  -- Si on n'a pas trouvé les statuts, retourner vide
  IF v_visite_technique_id IS NULL OR v_inter_en_cours_id IS NULL THEN
    RETURN;
  END IF;

  -- Retourner les interventions qui correspondent au critère isCheck
  IF p_include_check = TRUE THEN
    -- Filtrer pour AVOIR les interventions isCheck
    RETURN QUERY
    SELECT i.id
    FROM public.interventions i
    WHERE i.is_active = TRUE
      AND i.statut_id IN (v_visite_technique_id, v_inter_en_cours_id)
      AND i.date_prevue IS NOT NULL
      AND i.date_prevue <= CURRENT_DATE
      AND (p_user_id IS NULL OR i.assigned_user_id = p_user_id);
  ELSE
    -- Filtrer pour EXCLURE les interventions isCheck
    RETURN QUERY
    SELECT i.id
    FROM public.interventions i
    WHERE i.is_active = TRUE
      AND (p_user_id IS NULL OR i.assigned_user_id = p_user_id)
      AND NOT (
        i.statut_id IN (v_visite_technique_id, v_inter_en_cours_id)
        AND i.date_prevue IS NOT NULL
        AND i.date_prevue <= CURRENT_DATE
      );
  END IF;
END;
$$;

-- Donner les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.filter_interventions_ischeck(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_interventions_ischeck(UUID, BOOLEAN) TO anon;

-- Ajouter un commentaire pour la documentation
COMMENT ON FUNCTION public.filter_interventions_ischeck IS
'Filtre les interventions selon le critère isCheck (en retard).
isCheck = TRUE : retourne les interventions avec statut VISITE_TECHNIQUE ou INTER_EN_COURS ET date_prevue <= aujourd''hui
isCheck = FALSE : retourne les interventions qui ne sont PAS en état isCheck
p_user_id : optionnel, filtre par utilisateur assigné';
