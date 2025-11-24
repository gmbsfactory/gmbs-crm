-- ========================================
-- Vérification des transitions pour l'intervention H1
-- ========================================
-- Affiche toutes les transitions de statut dans l'ordre chronologique

-- Vue chronologique complète de toutes les transitions
SELECT 
  ist.transition_date,
  ist.from_status_code as statut_depart,
  ist.to_status_code as statut_arrivee,
  i.id_inter,
  ist.intervention_id,
  ist.source,
  CASE 
    WHEN ist.from_status_code IS NULL THEN 'Création initiale'
    ELSE ist.from_status_code || ' → ' || ist.to_status_code
  END as transition
FROM public.intervention_status_transitions ist
INNER JOIN public.interventions i ON i.id = ist.intervention_id
WHERE i.id_inter = 'H1'
ORDER BY ist.transition_date ASC;

-- Résumé : Liste de tous les statuts uniques par lesquels H1 est passé
SELECT 
  ist.to_status_code as statut_code,
  COUNT(*) as nb_transitions_vers_ce_statut,
  MIN(ist.transition_date) as premiere_transition,
  MAX(ist.transition_date) as derniere_transition
FROM public.intervention_status_transitions ist
INNER JOIN public.interventions i ON i.id = ist.intervention_id
WHERE i.id_inter = 'H1'
GROUP BY ist.to_status_code
ORDER BY MIN(ist.transition_date) ASC;

-- Vérification par statut spécifique (tous les statuts possibles)
-- DEMANDE
SELECT 
  'DEMANDE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'DEMANDE'
WHERE i.id_inter = 'H1';

-- DEVIS_ENVOYE
SELECT 
  'DEVIS_ENVOYE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'DEVIS_ENVOYE'
WHERE i.id_inter = 'H1';

-- ACCEPTE
SELECT 
  'ACCEPTE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'ACCEPTE'
WHERE i.id_inter = 'H1';

-- INTER_EN_COURS
SELECT 
  'INTER_EN_COURS' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'INTER_EN_COURS'
WHERE i.id_inter = 'H1';

-- INTER_TERMINEE
SELECT 
  'INTER_TERMINEE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'INTER_TERMINEE'
WHERE i.id_inter = 'H1';

-- VISITE_TECHNIQUE
SELECT 
  'VISITE_TECHNIQUE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'VISITE_TECHNIQUE'
WHERE i.id_inter = 'H1';

-- REFUSE
SELECT 
  'REFUSE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'REFUSE'
WHERE i.id_inter = 'H1';

-- ANNULE
SELECT 
  'ANNULE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'ANNULE'
WHERE i.id_inter = 'H1';

-- STAND_BY
SELECT 
  'STAND_BY' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'STAND_BY'
WHERE i.id_inter = 'H1';

-- TERMINE
SELECT 
  'TERMINE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'TERMINE'
WHERE i.id_inter = 'H1';

-- SAV
SELECT 
  'SAV' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'SAV'
WHERE i.id_inter = 'H1';

-- ATT_ACOMPTE
SELECT 
  'ATT_ACOMPTE' as statut_code,
  i.id_inter,
  ist.transition_date,
  CASE WHEN ist.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as est_passe_par_ce_statut
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist 
  ON ist.intervention_id = i.id 
  AND ist.to_status_code = 'ATT_ACOMPTE'
WHERE i.id_inter = 'H1';