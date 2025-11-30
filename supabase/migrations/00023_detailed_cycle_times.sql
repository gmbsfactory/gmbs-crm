-- Migration 00023: Fonction Temps de Cycle Détaillés
-- Calcule les délais moyens pour chaque étape du processus

CREATE OR REPLACE FUNCTION get_detailed_cycle_times(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_agence_id uuid DEFAULT NULL,
  p_gestionnaire_id uuid DEFAULT NULL,
  p_metier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cycle_times AS (
    SELECT
      ROUND(AVG(isc.demande_to_devis_days), 1) as avg_demande_to_devis,
      ROUND(AVG(isc.devis_to_accepte_days), 1) as avg_devis_to_accepte,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (isc.first_terminee_date - isc.first_accepte_date)) / 86400
      ), 1) as avg_accepte_to_terminee,
      ROUND(AVG(isc.cycle_time_days), 1) as avg_total_cycle_time
    FROM intervention_status_cache isc
    INNER JOIN interventions i ON i.id = isc.intervention_id
    WHERE isc.first_demande_date >= p_period_start
      AND isc.first_demande_date <= p_period_end
      AND isc.cycle_time_days IS NOT NULL
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  )
  SELECT jsonb_build_object(
    'demandeToDevis', COALESCE(avg_demande_to_devis, 0),
    'devisToAccepte', COALESCE(avg_devis_to_accepte, 0),
    'accepteToTerminee', COALESCE(avg_accepte_to_terminee, 0),
    'totalCycleTime', COALESCE(avg_total_cycle_time, 0)
  ) INTO v_result
  FROM cycle_times;

  RETURN v_result;
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION get_detailed_cycle_times IS 'Calcule les délais moyens pour chaque étape du processus (Demande→Devis, Devis→Acceptation, Acceptation→Terminé)';
