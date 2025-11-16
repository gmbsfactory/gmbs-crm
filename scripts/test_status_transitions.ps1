# Script de test pour les transitions de statut (PowerShell)
# Usage: .\scripts\test_status_transitions.ps1

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SQL_TEST_FILE = Join-Path $ROOT_DIR "supabase\samples\sql\test_status_transitions.sql"

Write-Host "🧪 Test des Transitions de Statut" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Supabase est démarré
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Vérification de l'environnement..." -ForegroundColor Yellow
try {
    supabase status | Out-Null
    Write-Host "✅ Supabase est démarré" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Supabase n'est pas démarré. Démarrage..." -ForegroundColor Yellow
    supabase start
}

Write-Host ""
Write-Host "Choisissez une option :" -ForegroundColor Cyan
Write-Host "1. Vérifier la structure (table, trigger, fonction)"
Write-Host "2. Test rapide (créer une transition de test)"
Write-Host "3. Vérifier les transitions récentes"
Write-Host "4. Rapport de santé général"
Write-Host "5. Exécuter tous les tests SQL"
Write-Host ""

$choice = Read-Host "Votre choix (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🔍 Vérification de la structure..." -ForegroundColor Yellow
        $sql = @"
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
"@
        supabase db connect --command $sql
    }
    
    "2" {
        Write-Host ""
        Write-Host "🧪 Test rapide : Création d'une transition..." -ForegroundColor Yellow
        $sql = @"
-- Créer une transition de test
DO `$\$\$
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
"@
        supabase db connect --command $sql
    }
    
    "3" {
        Write-Host ""
        Write-Host "📊 Transitions récentes (10 dernières)..." -ForegroundColor Yellow
        $sql = @"
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
"@
        supabase db connect --command $sql
    }
    
    "4" {
        Write-Host ""
        Write-Host "📈 Rapport de santé général..." -ForegroundColor Yellow
        $sql = @"
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
"@
        supabase db connect --command $sql
    }
    
    "5" {
        Write-Host ""
        Write-Host "🚀 Exécution de tous les tests SQL..." -ForegroundColor Yellow
        if (Test-Path $SQL_TEST_FILE) {
            Get-Content $SQL_TEST_FILE | supabase db connect
        } else {
            Write-Host "❌ Fichier de test non trouvé : $SQL_TEST_FILE" -ForegroundColor Red
            exit 1
        }
    }
    
    default {
        Write-Host "❌ Choix invalide" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Test terminé" -ForegroundColor Green


