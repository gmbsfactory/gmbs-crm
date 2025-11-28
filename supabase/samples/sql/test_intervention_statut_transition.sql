-- ========================================
-- TEST ÉTAPE PAR ÉTAPE : Transitions de statut avec chaîne complète
-- ========================================
-- Ce test vérifie que lorsqu'on met à jour une intervention vers INTER_TERMINEE,
-- toutes les transitions intermédiaires sont créées automatiquement
-- Note: Les codes utilisés sont les codes DB (INTER_EN_COURS, INTER_TERMINEE)
-- 
-- INSTRUCTIONS :
-- 1. Exécutez chaque étape dans l'ordre
-- 2. Vérifiez les résultats de chaque étape avant de passer à la suivante
-- 3. L'étape finale nettoie automatiquement les données de test
-- ========================================

-- ========================================
-- ÉTAPE 1 : Créer une intervention de test
-- ========================================
-- Cette étape crée une intervention avec un id_inter unique
-- Exécutez cette requête et notez l'id_inter retourné pour les étapes suivantes

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
  'TEST_' || to_char(now(), 'YYYYMMDDHH') as id_inter,
  'Test automatique - Transitions de statut' as contexte_intervention,
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

-- ⚠️ IMPORTANT : Notez l'id_inter retourné ci-dessus (ex: TEST_20250127143022_a1b2c3d4)
-- Vous devrez remplacer 'VOTRE_ID_INTER' dans les étapes suivantes par cet id_inter

-- ========================================
-- ÉTAPE 2 : Vérifier l'intervention créée
-- ========================================
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

SELECT 
  i.id,
  i.id_inter,
  i.contexte_intervention,
  i.adresse,
  s.code as statut_actuel_code,
  s.label as statut_actuel_label,
  (
    SELECT COUNT(*) 
    FROM intervention_status_transitions ist 
    WHERE ist.intervention_id = i.id
  ) as nb_transitions_existantes
FROM interventions i
LEFT JOIN intervention_statuses s ON i.statut_id = s.id
WHERE i.id_inter = 'YOUR_ID'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
LIMIT 1;

-- ========================================
-- ÉTAPE 3 : Mettre à jour l'intervention vers INTER_TERMINEE
-- ========================================
-- Cette étape met à jour le statut vers INTER_TERMINEE (code DB)
-- Le trigger SQL devrait créer une transition (ou l'API si vous passez par l'API)
-- Remplacez 'YOUR_ID' par l'id_inter de l'étape 1

UPDATE interventions 
SET 
  statut_id = (SELECT id FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1),
  updated_at = now()
WHERE id_inter = 'YOUR_ID'
RETURNING 
  id,
  id_inter,
  contexte_intervention,
  statut_id,
  updated_at;

-- ========================================
-- ÉTAPE 4 : Vérifier toutes les transitions créées
-- ========================================
-- Cette requête affiche toutes les transitions créées pour l'intervention
-- Vérifiez que :
--   1. Toutes les transitions de la chaîne sont présentes
--   2. Chaque transition a source='api' (si créée via AutomaticTransitionService)
--   3. Chaque transition a metadata->>'created_by' = 'AutomaticTransitionService'
--   4. Pas de doublons (chaque transition n'apparaît qu'une fois)
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

SELECT 
  ist.id as transition_id,
  i.id_inter,
  i.contexte_intervention,
  ist.from_status_code as statut_source,
  ist.to_status_code as statut_cible,
  ist.transition_date,
  ist.source,
  COALESCE(ist.metadata->>'created_by', 'N/A') as cree_par,
  COALESCE(ist.metadata->>'updated_via', 'N/A') as mis_a_jour_via,
  COALESCE(ist.metadata->>'is_intermediate', 'N/A') as est_intermediaire,
  COALESCE(ist.metadata->>'final_target_status', 'N/A') as statut_final_cible,
  COALESCE(ist.metadata->>'transition_order', 'N/A') as ordre_transition,
  COALESCE(ist.metadata->>'total_transitions', 'N/A') as total_transitions,
  CASE 
    WHEN ist.source = 'api' AND COALESCE(ist.metadata->>'created_by', '') = 'AutomaticTransitionService' THEN '[OK] Transition API automatique'
    WHEN ist.source = 'trigger' THEN '[WARN] Trigger (modification directe DB)'
    ELSE '[ATTENTION] Source inconnue ou metadata manquante'
  END as verification
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
WHERE i.id_inter = 'YOUR_ID' -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
ORDER BY ist.transition_date ASC;

-- ========================================
-- ÉTAPE 5 : Résumé des transitions créées
-- ========================================
-- Cette requête donne un résumé lisible pour vérification humaine
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

SELECT 
  i.id_inter,
  i.contexte_intervention as intervention,
  COUNT(ist.id) as nombre_transitions,
  COUNT(DISTINCT ist.to_status_code) as statuts_uniques,
  STRING_AGG(
    COALESCE(ist.from_status_code, 'NULL') || ' → ' || ist.to_status_code, 
    ' | ' 
    ORDER BY ist.transition_date ASC
  ) as chaine_transitions,
  MIN(ist.transition_date) as premiere_transition,
  MAX(ist.transition_date) as derniere_transition,
  COUNT(*) FILTER (WHERE ist.source = 'api') as transitions_api,
  COUNT(*) FILTER (WHERE ist.source = 'trigger') as transitions_trigger,
  COUNT(*) FILTER (WHERE COALESCE(ist.metadata->>'created_by', '') = 'AutomaticTransitionService') as transitions_automatiques
FROM interventions i
INNER JOIN intervention_status_transitions ist ON ist.intervention_id = i.id
WHERE i.id_inter = 'YOUR_ID'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
GROUP BY i.id_inter, i.contexte_intervention;

-- ========================================
-- ÉTAPE 6 : Vérification des doublons
-- ========================================
-- Cette requête détecte les doublons potentiels
-- Résultat attendu : 0 lignes (pas de doublons)
-- Remplacez 'YOUR_ID' par l'id_inter de l'étape 1

SELECT 
  i.id_inter,
  ist.to_status_code,
  COUNT(*) as nombre_occurrences,
  STRING_AGG(ist.id::text, ', ') as ids_transitions,
  STRING_AGG(ist.transition_date::text, ', ') as dates_transitions,
  STRING_AGG(ist.source, ', ') as sources
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
WHERE i.id_inter = 'VOTRE_ID_INTER'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
  AND ist.transition_date > now() - INTERVAL '1 hour'  -- Seulement les transitions récentes
GROUP BY i.id_inter, ist.to_status_code
HAVING COUNT(*) > 1
ORDER BY nombre_occurrences DESC;

-- ========================================
-- ÉTAPE 7 : Vérification de la chaîne complète
-- ========================================
-- Cette requête vérifie que toutes les transitions attendues sont présentes
-- Résultat attendu : Tous les statuts doivent être "[OK] Présent"
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

WITH expected_chain AS (
  SELECT unnest(ARRAY[
    'DEMANDE',
    'DEVIS_ENVOYE', 
    'VISITE_TECHNIQUE',
    'ACCEPTE',
    'INTER_EN_COURS',  -- Code DB (pas EN_COURS)
    'INTER_TERMINEE'   -- Code DB (pas TERMINE)
  ]) as status_code
),
actual_transitions AS (
  SELECT DISTINCT ist.to_status_code
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON ist.intervention_id = i.id
  WHERE i.id_inter = 'YOUR_ID'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
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
    WHEN 'INTER_EN_COURS' THEN 5  -- Code DB
    WHEN 'INTER_TERMINEE' THEN 6  -- Code DB
  END;

-- ========================================
-- ÉTAPE 8 : NETTOYAGE - Supprimer l'intervention de test
-- ========================================
-- Cette étape supprime l'intervention de test et toutes ses transitions
-- (Les transitions seront supprimées automatiquement grâce à ON DELETE CASCADE)
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

-- ⚠️ ATTENTION : Cette étape supprime définitivement l'intervention de test
-- Assurez-vous d'avoir terminé toutes les vérifications avant d'exécuter cette étape

DELETE FROM interventions
WHERE id_inter = 'YOUR_ID'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1
RETURNING 
  id,
  id_inter,
  contexte_intervention,
  'Intervention de test supprimée' as message;

-- ========================================
-- ÉTAPE 9 (OPTIONNELLE) : Vérifier le nettoyage
-- ========================================
-- Vérifiez que l'intervention et ses transitions ont bien été supprimées
-- Remplacez 'VOTRE_ID_INTER' par l'id_inter de l'étape 1

SELECT 
  'Intervention' as type,
  COUNT(*) as nombre_restant
FROM interventions
WHERE id_inter = 'YOUR_ID'  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1

UNION ALL

SELECT 
  'Transitions' as type,
  COUNT(*) as nombre_restant
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
WHERE i.id_inter = 'YOUR_ID';  -- ⚠️ REMPLACER PAR L'ID_INTER DE L'ÉTAPE 1

-- Résultat attendu : 0 pour les deux (tout a été supprimé)

-- ========================================
-- NOTES IMPORTANTES
-- ========================================
-- 1. Remplacez 'VOTRE_ID_INTER' par l'id_inter retourné à l'ÉTAPE 1 dans toutes les requêtes
-- 2. Exécutez les étapes dans l'ordre (1 → 2 → 3 → 4 → 5 → 6 → 7 → 8)
-- 3. Vérifiez les résultats de chaque étape avant de passer à la suivante
-- 4. L'ÉTAPE 6 doit retourner 0 lignes (pas de doublons)
-- 5. L'ÉTAPE 7 doit montrer tous les statuts comme "[OK] Présent"
-- 6. L'ÉTAPE 8 supprime définitivement l'intervention de test
--
-- Si vous testez via l'API (transitionStatus ou interventionsApi.update),
-- les transitions seront créées AVANT l'UPDATE et auront source='api'
-- Le trigger SQL détectera ces transitions et ne créera pas de doublon
-- ========================================
