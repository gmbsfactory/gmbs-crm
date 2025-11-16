-- ========================================
-- TESTS POUR LES TRANSITIONS DE STATUT
-- ========================================
-- Ce fichier contient des requêtes SQL pour tester
-- le système de tracking des transitions de statut

-- ========================================
-- 1. VÉRIFIER QUE LA TABLE EXISTE
-- ========================================

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'intervention_status_transitions'
ORDER BY ordinal_position;

-- ========================================
-- 2. VÉRIFIER QUE LE TRIGGER EXISTE
-- ========================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'interventions'
  AND trigger_name = 'trg_log_intervention_status_transition_safety';

-- ========================================
-- 3. VÉRIFIER QUE LA FONCTION SQL EXISTE
-- ========================================

SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'log_status_transition_from_api';

-- ========================================
-- 4. TEST : MODIFIER UNE INTERVENTION ET VÉRIFIER LA TRANSITION
-- ========================================

-- 4.1 Créer une intervention de test (si nécessaire)
-- Note: Utilisez une intervention existante pour le test

-- 4.2 Récupérer une intervention existante avec son statut actuel
SELECT 
  i.id,
  i.id_inter,
  i.statut_id as statut_actuel_id,
  s.code as statut_actuel_code,
  s.label as statut_actuel_label
FROM interventions i
LEFT JOIN intervention_statuses s ON i.statut_id = s.id
WHERE i.is_active = true
LIMIT 1;

-- 4.3 Noter l'ID de l'intervention et son statut actuel
-- Exemple: intervention_id = 'xxx', statut_actuel = 'DEMANDE'

-- 4.4 Modifier le statut de l'intervention (à faire via l'API ou directement)
-- UPDATE interventions 
-- SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'ACCEPTE')
-- WHERE id = 'VOTRE_INTERVENTION_ID';

-- 4.5 Vérifier que la transition a été enregistrée
SELECT 
  ist.id,
  ist.intervention_id,
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  ist.source,
  ist.changed_by_user_id,
  ist.metadata
FROM intervention_status_transitions ist
WHERE ist.intervention_id = 'VOTRE_INTERVENTION_ID'
ORDER BY ist.transition_date DESC;

-- ========================================
-- 5. TEST : VÉRIFIER QUE LE TRIGGER FONCTIONNE
-- ========================================

-- 5.1 Compter les transitions avant modification
SELECT COUNT(*) as nb_transitions_avant
FROM intervention_status_transitions;

-- 5.2 Modifier directement une intervention en base (sans passer par l'API)
-- Cela devrait déclencher le trigger
UPDATE interventions 
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'DEVIS_ENVOYE')
WHERE id = (
  SELECT id FROM interventions 
  WHERE is_active = true 
  LIMIT 1
)
RETURNING id, statut_id;

-- 5.3 Vérifier qu'une nouvelle transition a été créée (source = 'trigger')
SELECT COUNT(*) as nb_transitions_apres
FROM intervention_status_transitions;

-- La différence doit être de 1
-- Vérifier que la dernière transition a source = 'trigger'
SELECT 
  ist.*,
  i.id_inter
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
ORDER BY ist.transition_date DESC
LIMIT 5;

-- ========================================
-- 6. TEST : VÉRIFIER QUE L'ENREGISTREMENT EXPLICITE FONCTIONNE
-- ========================================

-- 6.1 Appeler la fonction SQL directement
SELECT log_status_transition_from_api(
  p_intervention_id := (SELECT id FROM interventions WHERE is_active = true LIMIT 1),
  p_from_status_id := (SELECT id FROM intervention_statuses WHERE code = 'DEMANDE'),
  p_to_status_id := (SELECT id FROM intervention_statuses WHERE code = 'ACCEPTE'),
  p_changed_by_user_id := (SELECT id FROM users LIMIT 1),
  p_metadata := '{"test": true, "note": "Test manuel"}'::jsonb
) as transition_id;

-- 6.2 Vérifier que la transition a été créée avec source = 'api'
SELECT 
  ist.*,
  u.username as changed_by_username
FROM intervention_status_transitions ist
LEFT JOIN users u ON ist.changed_by_user_id = u.id
WHERE ist.source = 'api'
ORDER BY ist.transition_date DESC
LIMIT 10;

-- ========================================
-- 7. TEST : VÉRIFIER L'HISTORIQUE D'UNE INTERVENTION
-- ========================================

-- 7.1 Récupérer l'historique complet d'une intervention
SELECT 
  ist.id,
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  ist.source,
  u.username as changed_by,
  ist.metadata
FROM intervention_status_transitions ist
LEFT JOIN users u ON ist.changed_by_user_id = u.id
WHERE ist.intervention_id = (
  SELECT id FROM interventions WHERE is_active = true LIMIT 1
)
ORDER BY ist.transition_date ASC;

-- ========================================
-- 8. TEST : VÉRIFIER LES STATISTIQUES DU DASHBOARD
-- ========================================

-- 8.1 Interventions terminées aujourd'hui (via transitions)
SELECT COUNT(*) as nb_terminees_aujourdhui
FROM intervention_status_transitions ist
WHERE ist.to_status_code = 'INTER_TERMINEE'
  AND ist.transition_date >= CURRENT_DATE
  AND ist.transition_date < CURRENT_DATE + INTERVAL '1 day';

-- 8.2 Interventions terminées ce mois
SELECT COUNT(*) as nb_terminees_ce_mois
FROM intervention_status_transitions ist
WHERE ist.to_status_code = 'INTER_TERMINEE'
  AND ist.transition_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND ist.transition_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- 8.3 Distribution des transitions par source
SELECT 
  source,
  COUNT(*) as nombre,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM intervention_status_transitions
GROUP BY source
ORDER BY nombre DESC;

-- ========================================
-- 9. TEST : VÉRIFIER QU'IL N'Y A PAS DE DOUBLONS
-- ========================================

-- 9.1 Vérifier les doublons potentiels (même intervention, même statut, même date)
SELECT 
  intervention_id,
  to_status_code,
  DATE_TRUNC('second', transition_date) as transition_second,
  COUNT(*) as nb_occurrences
FROM intervention_status_transitions
GROUP BY intervention_id, to_status_code, DATE_TRUNC('second', transition_date)
HAVING COUNT(*) > 1;

-- Devrait retourner 0 lignes (pas de doublons)

-- ========================================
-- 10. TEST : VÉRIFIER LA COHÉRENCE DES DONNÉES
-- ========================================

-- 10.1 Vérifier que toutes les transitions pointent vers des interventions existantes
SELECT 
  ist.id,
  ist.intervention_id,
  ist.to_status_code
FROM intervention_status_transitions ist
LEFT JOIN interventions i ON ist.intervention_id = i.id
WHERE i.id IS NULL;

-- Devrait retourner 0 lignes (toutes les transitions sont valides)

-- 10.2 Vérifier que les codes de statut sont valides
SELECT DISTINCT
  ist.to_status_code,
  CASE 
    WHEN s.code IS NULL THEN 'INVALIDE'
    ELSE 'VALIDE'
  END as statut_validation
FROM intervention_status_transitions ist
LEFT JOIN intervention_statuses s ON ist.to_status_code = s.code
WHERE s.code IS NULL;

-- Devrait retourner 0 lignes (tous les codes sont valides)

-- ========================================
-- 11. TEST : PERFORMANCE DES INDEX
-- ========================================

-- 11.1 Vérifier que les index existent
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'intervention_status_transitions'
ORDER BY indexname;

-- 11.2 Test de performance sur une requête typique du dashboard
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM intervention_status_transitions ist
WHERE ist.to_status_code = 'INTER_TERMINEE'
  AND ist.transition_date >= CURRENT_DATE - INTERVAL '30 days'
  AND ist.transition_date < CURRENT_DATE;

-- Vérifier que l'index est utilisé (devrait voir "Index Scan" dans le plan)

-- ========================================
-- 12. TEST : BACKFILL (si nécessaire)
-- ========================================

-- 12.1 Vérifier combien d'interventions n'ont pas de transition initiale
SELECT COUNT(*) as interventions_sans_transition
FROM interventions i
WHERE i.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM intervention_status_transitions ist 
    WHERE ist.intervention_id = i.id
  );

-- 12.2 Si nécessaire, exécuter le backfill
-- SELECT backfill_status_transitions();

-- 12.3 Vérifier après backfill
SELECT COUNT(*) as interventions_avec_transition
FROM interventions i
WHERE i.is_active = true
  AND EXISTS (
    SELECT 1 
    FROM intervention_status_transitions ist 
    WHERE ist.intervention_id = i.id
  );

-- ========================================
-- 13. TEST : SCÉNARIO COMPLET
-- ========================================

-- 13.1 Créer un scénario de test complet
-- 1. Récupérer une intervention
-- 2. Noter son statut actuel
-- 3. Changer le statut via l'API (devrait créer une transition avec source='api')
-- 4. Changer le statut directement en DB (devrait créer une transition avec source='trigger')
-- 5. Vérifier l'historique complet

-- Exemple de scénario :
/*
-- Étape 1: Récupérer une intervention
SELECT id, statut_id, id_inter 
FROM interventions 
WHERE is_active = true 
LIMIT 1;

-- Étape 2: Noter le statut actuel (ex: DEMANDE)
-- Étape 3: Via l'API, changer vers ACCEPTE
-- Étape 4: Vérifier la transition
SELECT * FROM intervention_status_transitions 
WHERE intervention_id = 'VOTRE_ID'
ORDER BY transition_date DESC;

-- Étape 5: Changer directement en DB vers DEVIS_ENVOYE
UPDATE interventions 
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'DEVIS_ENVOYE')
WHERE id = 'VOTRE_ID';

-- Étape 6: Vérifier qu'une nouvelle transition a été créée (source='trigger')
SELECT * FROM intervention_status_transitions 
WHERE intervention_id = 'VOTRE_ID'
ORDER BY transition_date DESC;
*/

-- ========================================
-- 14. RAPPORT DE SANTÉ GÉNÉRAL
-- ========================================

SELECT 
  'Total transitions' as metric,
  COUNT(*)::text as value
FROM intervention_status_transitions
UNION ALL
SELECT 
  'Transitions API',
  COUNT(*)::text
FROM intervention_status_transitions
WHERE source = 'api'
UNION ALL
SELECT 
  'Transitions Trigger',
  COUNT(*)::text
FROM intervention_status_transitions
WHERE source = 'trigger'
UNION ALL
SELECT 
  'Interventions avec historique',
  COUNT(DISTINCT intervention_id)::text
FROM intervention_status_transitions
UNION ALL
SELECT 
  'Dernière transition',
  MAX(transition_date)::text
FROM intervention_status_transitions;


