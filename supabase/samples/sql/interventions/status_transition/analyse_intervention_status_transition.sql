SELECT
  ist.intervention_id,
  i.id_inter,
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  i.agence_id,
  i.assigned_user_id as gestionnaire_id,
  i.metier_id
FROM intervention_status_transitions ist
INNER JOIN interventions i ON i.id = ist.intervention_id
WHERE ist.transition_date >= '2025-01-01'::timestamptz
  AND ist.transition_date <= '2025-12-31'::timestamptz
ORDER BY ist.intervention_id, ist.transition_date
LIMIT 50;



SELECT
  ist.intervention_id,
  i.id_inter,
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  i.agence_id,
  i.assigned_user_id as gestionnaire_id,
  i.metier_id
FROM intervention_status_transitions ist
INNER JOIN interventions i ON i.id = ist.intervention_id
WHERE ist.transition_date >= '2025-01-01'::timestamptz
  AND ist.transition_date <= '2025-12-31'::timestamptz
  AND i.id_inter == '10906'
ORDER BY ist.intervention_id, ist.transition_date
LIMIT 50;



