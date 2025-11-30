-- Requête pour compter le nombre d'interventions ayant atteint des statuts spécifiques
-- Statuts: DEMANDE, ACCEPTE, DEVIS_ENVOYE, INTER_EN_COURS, INTER_TERMINEE

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= '2025-01-01'::timestamptz
    AND ist.transition_date <= '2026-01-01'::timestamptz
    AND ist.to_status_code IN ('DEMANDE', 'ACCEPTE', 'DEVIS_ENVOYE', 'INTER_EN_COURS', 'INTER_TERMINEE')
),
-- Interventions avec leur statut actuel/final
current_status AS (
  SELECT
    i.id as intervention_id,
    is_status.code as current_status_code
  FROM interventions i
  INNER JOIN intervention_statuses is_status ON is_status.id = i.statut_id
  WHERE i.is_active = true
    AND is_status.code IN ('DEMANDE', 'ACCEPTE', 'DEVIS_ENVOYE', 'INTER_EN_COURS', 'INTER_TERMINEE')
),
-- Agrégation des statuts atteints
status_reached_summary AS (
  SELECT
    to_status_code,
    COUNT(DISTINCT intervention_id) as nb_interventions_reached,
    COUNT(*) as nb_total_transitions
  FROM status_reached
  GROUP BY to_status_code
),
-- Agrégation des statuts finaux
status_final_summary AS (
  SELECT
    current_status_code,
    COUNT(DISTINCT intervention_id) as nb_interventions_final_status
  FROM current_status
  GROUP BY current_status_code
)
SELECT
  COALESCE(srs.to_status_code, sfs.current_status_code) as to_status_code,
  COALESCE(srs.nb_interventions_reached, 0) as nb_interventions_reached,
  COALESCE(srs.nb_total_transitions, 0) as nb_total_transitions,
  COALESCE(sfs.nb_interventions_final_status, 0) as nb_interventions_final_status
FROM status_reached_summary srs
FULL OUTER JOIN status_final_summary sfs ON srs.to_status_code = sfs.current_status_code
ORDER BY 
  CASE COALESCE(srs.to_status_code, sfs.current_status_code)
    WHEN 'DEMANDE' THEN 1
    WHEN 'ACCEPTE' THEN 2
    WHEN 'DEVIS_ENVOYE' THEN 3
    WHEN 'INTER_EN_COURS' THEN 4
    WHEN 'INTER_TERMINEE' THEN 5
    ELSE 6
  END;

