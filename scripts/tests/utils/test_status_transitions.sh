#!/usr/bin/env bash
# Script de test pour les transitions de statut
# Usage: bash scripts/test_status_transitions.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_TEST_FILE="$ROOT_DIR/supabase/samples/sql/test_status_transitions.sql"

echo "🧪 Test des Transitions de Statut"
echo "=================================="
echo ""

# Vérifier que Supabase est démarré
if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ Supabase CLI n'est pas installé"
  exit 1
fi

echo "📋 Vérification de l'environnement..."
if ! supabase status >/dev/null 2>&1; then
  echo "⚠️  Supabase n'est pas démarré. Démarrage..."
  supabase start
fi

echo ""
echo "✅ Supabase est démarré"
echo ""

# Afficher les options
echo "Choisissez une option :"
echo "1. Vérifier la structure (table, trigger, fonction)"
echo "2. Test rapide (créer une transition de test)"
echo "3. Vérifier les transitions récentes"
echo "4. Rapport de santé général"
echo "5. Exécuter tous les tests SQL"
echo ""

read -p "Votre choix (1-5) : " choice

case $choice in
  1)
    echo ""
    echo "🔍 Vérification de la structure..."
    supabase db connect <<EOF
-- Vérifier la table
SELECT 
  'Table' as type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intervention_status_transitions') 
    THEN '✅ Existe' 
    ELSE '❌ Manquante' 
  END as status;

-- Vérifier le trigger
SELECT 
  'Trigger' as type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trg_log_intervention_status_transition_safety') 
    THEN '✅ Existe' 
    ELSE '❌ Manquant' 
  END as status;

-- Vérifier la fonction
SELECT 
  'Fonction' as type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'log_status_transition_from_api') 
    THEN '✅ Existe' 
    ELSE '❌ Manquante' 
  END as status;
EOF
    ;;
    
  2)
    echo ""
    echo "🧪 Test rapide : Création d'une transition..."
    supabase db connect <<EOF
-- Créer une transition de test
DO \$\$
DECLARE
  test_intervention_id uuid;
  test_user_id uuid;
  demande_status_id uuid;
  accepte_status_id uuid;
  transition_id uuid;
BEGIN
  -- Récupérer une intervention de test
  SELECT id INTO test_intervention_id FROM interventions WHERE is_active = true LIMIT 1;
  
  IF test_intervention_id IS NULL THEN
    RAISE EXCEPTION 'Aucune intervention active trouvée pour le test';
  END IF;
  
  -- Récupérer un utilisateur
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  -- Récupérer les statuts
  SELECT id INTO demande_status_id FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT id INTO accepte_status_id FROM intervention_statuses WHERE code = 'ACCEPTE' LIMIT 1;
  
  -- Créer la transition
  SELECT log_status_transition_from_api(
    test_intervention_id,
    demande_status_id,
    accepte_status_id,
    test_user_id,
    '{"test": true, "note": "Test automatique"}'::jsonb
  ) INTO transition_id;
  
  RAISE NOTICE '✅ Transition créée avec succès. ID: %', transition_id;
  
  -- Afficher la transition
  SELECT 
    id,
    intervention_id,
    from_status_code,
    to_status_code,
    source,
    transition_date
  FROM intervention_status_transitions
  WHERE id = transition_id;
END;
\$\$;
EOF
    ;;
    
  3)
    echo ""
    echo "📊 Transitions récentes (10 dernières)..."
    supabase db connect <<EOF
SELECT 
  ist.transition_date,
  ist.from_status_code,
  ist.to_status_code,
  ist.source,
  i.id_inter,
  u.username as changed_by
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
LEFT JOIN users u ON ist.changed_by_user_id = u.id
ORDER BY ist.transition_date DESC
LIMIT 10;
EOF
    ;;
    
  4)
    echo ""
    echo "📈 Rapport de santé général..."
    supabase db connect <<EOF
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
EOF
    ;;
    
  5)
    echo ""
    echo "🚀 Exécution de tous les tests SQL..."
    if [ -f "$SQL_TEST_FILE" ]; then
      supabase db connect -f "$SQL_TEST_FILE"
    else
      echo "❌ Fichier de test non trouvé : $SQL_TEST_FILE"
      exit 1
    fi
    ;;
    
  *)
    echo "❌ Choix invalide"
    exit 1
    ;;
esac

echo ""
echo "✅ Test terminé"


