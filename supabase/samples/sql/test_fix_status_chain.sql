-- ========================================
-- TEST DE VÉRIFICATION : Fix chaîne de statut
-- ========================================
-- Ce test vérifie que le fix pour INTER_EN_COURS et INTER_TERMINEE fonctionne
-- ========================================

-- ÉTAPE 1 : Vérifier que les statuts INTER_EN_COURS et INTER_TERMINEE existent dans la DB
SELECT 
  'Vérification des statuts DB' as test,
  code,
  label,
  CASE 
    WHEN code = 'INTER_EN_COURS' THEN '[OK] Statut INTER_EN_COURS existe'
    WHEN code = 'INTER_TERMINEE' THEN '[OK] Statut INTER_TERMINEE existe'
    ELSE '[INFO] Autre statut'
  END as status
FROM intervention_statuses
WHERE code IN ('INTER_EN_COURS', 'INTER_TERMINEE', 'EN_COURS', 'TERMINE')
ORDER BY code;

-- ÉTAPE 2 : Créer une intervention de test
INSERT INTO interventions (
  id_inter,
  contexte_intervention,
  adresse,
  ville,
  code_postal,
  statut_id,
  agence_id,
  date,
  is_active,
  created_at,
  updated_at
) 
SELECT 
  'TEST_FIX_' || to_char(now(), 'YYYYMMDDHH24MISS') as id_inter,
  'Test fix chaîne de statut' as contexte_intervention,
  '123 Rue de Test' as adresse,
  'Paris' as ville,
  '75001' as code_postal,
  (SELECT id FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1) as statut_id,
  (SELECT id FROM agencies WHERE is_active = true LIMIT 1) as agence_id,
  now() as date,
  true as is_active,
  now() as created_at,
  now() as updated_at
RETURNING 
  id,
  id_inter,
  contexte_intervention,
  statut_id,
  created_at;

-- ⚠️ IMPORTANT : Notez l'id_inter retourné ci-dessus
-- Remplacez 'YOUR_TEST_ID' dans les requêtes suivantes par cet id_inter

-- ÉTAPE 3 : Mettre à jour vers INTER_TERMINEE (code DB) avec chaîne complète
-- Remplacez YOUR_TEST_ID par l'id_inter de l'étape 2
-- UTILISER LA FONCTION SQL (pas UPDATE direct) pour créer la chaîne complète
SELECT update_intervention_status_with_chain(
  (SELECT id FROM interventions WHERE id_inter = 'YOUR_TEST_ID' LIMIT 1),
  'INTER_TERMINEE',
  NULL,
  '{"test": true, "note": "Test fix chaîne de statut"}'::jsonb
) as result;

-- ÉTAPE 4 : Vérifier les transitions créées
-- Remplacez YOUR_TEST_ID par l'id_inter de l'étape 2
SELECT 
  ist.id as transition_id,
  i.id_inter,
  ist.from_status_code as statut_source,
  ist.to_status_code as statut_cible,
  ist.transition_date,
  ist.source,
  COALESCE(ist.metadata->>'created_by', 'N/A') as cree_par,
  CASE 
    WHEN ist.source = 'api' AND COALESCE(ist.metadata->>'created_by', '') = 'AutomaticTransitionService' THEN '[OK] Transition API automatique'
    WHEN ist.source = 'trigger' THEN '[OK] Trigger (modification directe DB)'
    ELSE '[ATTENTION] Source inconnue'
  END as verification
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
WHERE i.id_inter = 'YOUR_TEST_ID'
ORDER BY ist.transition_date ASC;

-- ÉTAPE 5 : Vérifier que toutes les transitions attendues sont présentes
-- Remplacez YOUR_TEST_ID par l'id_inter de l'étape 2
WITH expected_chain AS (
  SELECT unnest(ARRAY[
    'DEMANDE',
    'DEVIS_ENVOYE', 
    'VISITE_TECHNIQUE',
    'ACCEPTE',
    'INTER_EN_COURS',  -- Code DB
    'INTER_TERMINEE'   -- Code DB
  ]) as status_code
),
actual_transitions AS (
  SELECT DISTINCT ist.to_status_code
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON ist.intervention_id = i.id
  WHERE i.id_inter = 'YOUR_TEST_ID'
    AND ist.transition_date > now() - INTERVAL '1 hour'
)
SELECT 
  ec.status_code as statut_attendu,
  CASE 
    WHEN at.to_status_code IS NOT NULL THEN '[OK] Présent'
    ELSE '[ERREUR] Manquant'
  END as statut_verification,
  at.to_status_code as statut_trouve
FROM expected_chain ec
LEFT JOIN actual_transitions at ON ec.status_code = at.to_status_code
ORDER BY 
  CASE ec.status_code
    WHEN 'DEMANDE' THEN 1
    WHEN 'DEVIS_ENVOYE' THEN 2
    WHEN 'VISITE_TECHNIQUE' THEN 3
    WHEN 'ACCEPTE' THEN 4
    WHEN 'INTER_EN_COURS' THEN 5
    WHEN 'INTER_TERMINEE' THEN 6
  END;

-- ÉTAPE 6 : NETTOYAGE - Supprimer l'intervention de test
-- Remplacez YOUR_TEST_ID par l'id_inter de l'étape 2
DELETE FROM interventions
WHERE id_inter = 'YOUR_TEST_ID'
RETURNING 
  id,
  id_inter,
  'Intervention de test supprimée' as message;

-- ========================================
-- RÉSULTAT ATTENDU
-- ========================================
-- ÉTAPE 4 doit montrer 6 transitions :
--   DEMANDE → DEVIS_ENVOYE
--   DEVIS_ENVOYE → VISITE_TECHNIQUE
--   VISITE_TECHNIQUE → ACCEPTE
--   ACCEPTE → INTER_EN_COURS
--   INTER_EN_COURS → INTER_TERMINEE
--   (peut-être une 7ème : NULL → DEMANDE lors de la création)
--
-- ÉTAPE 5 doit montrer tous les statuts comme "[OK] Présent"
-- ========================================



