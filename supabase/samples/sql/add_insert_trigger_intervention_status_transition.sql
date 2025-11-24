-- ========================================
-- SCRIPT DE BACKFILL POUR INTERVENTION_STATUS_TRANSITIONS
-- ========================================
-- Ce script remplit la table intervention_status_transitions pour toutes
-- les interventions existantes qui n'ont pas encore de transition.
-- 
-- UTILISATION:
-- 1. Exécuter d'abord la section "VÉRIFICATION" pour voir combien d'interventions
--    n'ont pas de transition
-- 2. Exécuter la section "BACKFILL" pour créer les transitions manquantes
-- 3. Vérifier les résultats avec la section "VÉRIFICATION FINALE"
--
-- SÉCURITÉ: Ce script peut être exécuté plusieurs fois sans créer de doublons
-- car il vérifie l'existence avant d'insérer.

-- ========================================
-- VÉRIFICATION INITIALE
-- ========================================
-- Voir combien d'interventions n'ont pas de transition

SELECT 
  COUNT(*) as total_interventions,
  COUNT(DISTINCT i.id) FILTER (WHERE ist.id IS NULL) as interventions_sans_transition,
  COUNT(DISTINCT i.id) FILTER (WHERE ist.id IS NOT NULL) as interventions_avec_transition
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist ON ist.intervention_id = i.id
WHERE i.is_active = true;

-- Détail des interventions sans transition (premières 10)
SELECT 
  i.id,
  i.id_inter,
  i.statut_id,
  ist.code as statut_code,
  i.created_at,
  i.date_termine
FROM public.interventions i
LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
LEFT JOIN public.intervention_status_transitions tr ON tr.intervention_id = i.id
WHERE i.is_active = true
  AND tr.id IS NULL
ORDER BY i.created_at DESC
LIMIT 10;

-- ========================================
-- BACKFILL DES TRANSITIONS MANQUANTES
-- ========================================
-- Crée les transitions initiales pour toutes les interventions qui n'en ont pas

INSERT INTO public.intervention_status_transitions (
  intervention_id,
  from_status_id,
  to_status_id,
  from_status_code,
  to_status_code,
  changed_by_user_id,
  transition_date,
  source,
  metadata
)
SELECT 
  i.id as intervention_id,
  NULL as from_status_id, -- Pas de statut précédent lors de la création
  COALESCE(i.statut_id, 
    (SELECT id FROM public.intervention_statuses WHERE code = 'DEMANDE' LIMIT 1)
  ) as to_status_id,
  NULL as from_status_code,
  ist.code as to_status_code,
  NULL as changed_by_user_id,
  COALESCE(i.created_at, i.date, now()) as transition_date,
  'trigger' as source,
  jsonb_build_object(
    'backfilled', true,
    'backfill_date', now(),
    'note', 'Migration des données existantes - transition initiale créée par script de backfill',
    'original_created_at', i.created_at,
    'original_date', i.date,
    'date_termine', i.date_termine
  ) as metadata
FROM public.interventions i
LEFT JOIN public.intervention_statuses ist ON ist.id = COALESCE(
  i.statut_id,
  (SELECT id FROM public.intervention_statuses WHERE code = 'DEMANDE' LIMIT 1)
)
LEFT JOIN public.intervention_status_transitions existing ON existing.intervention_id = i.id
WHERE i.is_active = true
  -- Ne créer que si aucune transition n'existe déjà pour cette intervention
  AND existing.id IS NULL
  -- Ne créer que si on a trouvé un statut valide
  AND ist.id IS NOT NULL;

-- ========================================
-- BACKFILL DES TRANSITIONS VERS TERMINÉ
-- ========================================
-- Pour les interventions terminées avec date_termine, créer une transition
-- vers INTER_TERMINEE si elle n'existe pas déjà

INSERT INTO public.intervention_status_transitions (
  intervention_id,
  from_status_id,
  to_status_id,
  from_status_code,
  to_status_code,
  changed_by_user_id,
  transition_date,
  source,
  metadata
)
SELECT 
  i.id as intervention_id,
  i.statut_id as from_status_id,
  terminated_status.id as to_status_id,
  current_status.code as from_status_code,
  terminated_status.code as to_status_code,
  NULL as changed_by_user_id,
  i.date_termine as transition_date,
  'trigger' as source,
  jsonb_build_object(
    'backfilled', true,
    'backfill_date', now(),
    'note', 'Migration des données existantes - transition vers terminé créée par script de backfill',
    'original_date_termine', i.date_termine
  ) as metadata
FROM public.interventions i
INNER JOIN public.intervention_statuses terminated_status ON terminated_status.code = 'INTER_TERMINEE'
LEFT JOIN public.intervention_statuses current_status ON current_status.id = i.statut_id
LEFT JOIN public.intervention_status_transitions existing 
  ON existing.intervention_id = i.id 
  AND existing.to_status_id = terminated_status.id
WHERE i.is_active = true
  AND i.date_termine IS NOT NULL
  AND i.statut_id = terminated_status.id
  -- Ne créer que si cette transition spécifique n'existe pas déjà
  AND existing.id IS NULL;

-- ========================================
-- VÉRIFICATION FINALE
-- ========================================
-- Vérifier le résultat du backfill

SELECT 
  COUNT(*) as total_interventions,
  COUNT(DISTINCT i.id) FILTER (WHERE ist.id IS NULL) as interventions_sans_transition,
  COUNT(DISTINCT i.id) FILTER (WHERE ist.id IS NOT NULL) as interventions_avec_transition,
  COUNT(DISTINCT ist.id) as total_transitions_creees
FROM public.interventions i
LEFT JOIN public.intervention_status_transitions ist ON ist.intervention_id = i.id
WHERE i.is_active = true;

-- Statistiques par source
SELECT 
  source,
  COUNT(*) as nombre_transitions,
  MIN(transition_date) as premiere_transition,
  MAX(transition_date) as derniere_transition
FROM public.intervention_status_transitions
GROUP BY source
ORDER BY source;

-- Vérifier les interventions qui n'ont toujours pas de transition (problèmes potentiels)
SELECT 
  i.id,
  i.id_inter,
  i.statut_id,
  i.created_at,
  i.date_termine,
  CASE 
    WHEN i.statut_id IS NULL THEN 'Pas de statut assigné'
    WHEN ist.id IS NULL THEN 'Statut introuvable dans intervention_statuses'
    ELSE 'Autre problème'
  END as raison
FROM public.interventions i
LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
LEFT JOIN public.intervention_status_transitions tr ON tr.intervention_id = i.id
WHERE i.is_active = true
  AND tr.id IS NULL
ORDER BY i.created_at DESC;