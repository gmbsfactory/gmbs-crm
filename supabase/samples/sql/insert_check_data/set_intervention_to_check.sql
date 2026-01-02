-- ========================================
-- Script SQL : Mettre une intervention à "Check"
-- ========================================
-- Description: Met une intervention existante en statut "Check"
-- 
-- Le statut "Check" est un statut visuel qui apparaît quand:
--   - Le statut est "VISITE_TECHNIQUE" ou "INTER_EN_COURS"
--   - ET la due_date (date_prevue) est dépassée (dans le passé)
--
-- Usage: 
--   1. Remplacez 'VOTRE_INTERVENTION_ID' par l'ID réel de l'intervention
--   2. Choisissez le statut: 'VISITE_TECHNIQUE' ou 'INTER_EN_COURS'
--   3. La due_date sera automatiquement mise à hier pour déclencher le statut Check
--   4. Exécutez le script dans Supabase SQL Editor
-- ========================================

-- Option 1: Mettre une intervention spécifique à "Check" avec statut VISITE_TECHNIQUE
UPDATE public.interventions
SET 
  statut_id = (SELECT id FROM public.intervention_statuses WHERE code = 'VISITE_TECHNIQUE' LIMIT 1),
  date_prevue = CURRENT_DATE - INTERVAL '1 day', -- Date d'hier pour déclencher le Check
  due_date = CURRENT_DATE - INTERVAL '1 day',    -- Date d'hier pour déclencher le Check
  updated_at = now()
WHERE id = 'VOTRE_INTERVENTION_ID'::uuid  -- ⚠️ REMPLACEZ par l'ID réel de l'intervention
RETURNING id, id_inter, statut_id, date_prevue, due_date;

-- ========================================
-- Option 2: Mettre une intervention spécifique à "Check" avec statut INTER_EN_COURS
-- ========================================
-- Décommentez cette section si vous préférez le statut INTER_EN_COURS

/*
UPDATE public.interventions
SET 
  statut_id = (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_EN_COURS' LIMIT 1),
  date_prevue = CURRENT_DATE - INTERVAL '1 day', -- Date d'hier pour déclencher le Check
  due_date = CURRENT_DATE - INTERVAL '1 day',     -- Date d'hier pour déclencher le Check
  updated_at = now()
WHERE id = 'VOTRE_INTERVENTION_ID'::uuid  -- ⚠️ REMPLACEZ par l'ID réel de l'intervention
RETURNING id, id_inter, statut_id, date_prevue, due_date;
*/

-- ========================================
-- Option 3: Mettre plusieurs interventions à "Check" par ID_INTER
-- ========================================
-- Utile si vous connaissez les id_inter plutôt que les UUID

/*
UPDATE public.interventions
SET 
  statut_id = (SELECT id FROM public.intervention_statuses WHERE code = 'VISITE_TECHNIQUE' LIMIT 1),
  date_prevue = CURRENT_DATE - INTERVAL '1 day',
  due_date = CURRENT_DATE - INTERVAL '1 day',
  updated_at = now()
WHERE id_inter IN ('INT-001', 'INT-002', 'INT-003')  -- ⚠️ REMPLACEZ par les id_inter réels
RETURNING id, id_inter, statut_id, date_prevue, due_date;
*/

-- ========================================
-- Option 4: Mettre toutes les interventions VISITE_TECHNIQUE ou INTER_EN_COURS à "Check"
-- ========================================
-- ⚠️ ATTENTION: Ce script mettra TOUTES les interventions concernées à Check
-- Utilisez avec précaution et ajoutez des filtres si nécessaire

/*
UPDATE public.interventions
SET 
  date_prevue = COALESCE(date_prevue, CURRENT_DATE - INTERVAL '1 day'),
  due_date = COALESCE(due_date, CURRENT_DATE - INTERVAL '1 day'),
  updated_at = now()
WHERE statut_id IN (
  SELECT id FROM public.intervention_statuses 
  WHERE code IN ('VISITE_TECHNIQUE', 'INTER_EN_COURS')
)
AND (date_prevue IS NULL OR date_prevue > CURRENT_DATE)
RETURNING id, id_inter, statut_id, date_prevue, due_date;
*/

-- ========================================
-- Vérification: Voir les interventions en statut "Check"
-- ========================================
-- Exécutez cette requête pour voir toutes les interventions qui devraient afficher "Check"

/*
SELECT 
  i.id,
  i.id_inter,
  ist.code as statut_code,
  ist.label as statut_label,
  i.date_prevue,
  i.due_date,
  CASE 
    WHEN i.date_prevue IS NOT NULL AND i.date_prevue <= CURRENT_DATE 
         AND ist.code IN ('VISITE_TECHNIQUE', 'INTER_EN_COURS')
    THEN 'OUI (Check)'
    ELSE 'NON'
  END as is_check
FROM public.interventions i
JOIN public.intervention_statuses ist ON ist.id = i.statut_id
WHERE ist.code IN ('VISITE_TECHNIQUE', 'INTER_EN_COURS')
  AND i.date_prevue IS NOT NULL
  AND i.date_prevue <= CURRENT_DATE
ORDER BY i.date_prevue ASC;
*/

