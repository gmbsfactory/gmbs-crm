-- ========================================
-- Script SQL : Mettre un artisan à "Dossier à compléter" via intervention terminée
-- ========================================
-- Description: Crée une intervention avec statut INTER_TERMINEE et lie un artisan
--              Le trigger mettra automatiquement le statut_dossier à "À compléter"
-- 
-- Selon la documentation (calcul_statut_artisan_claude.md):
-- - Si un artisan a une intervention terminée (même avec 0 documents) → "À compléter"
-- - Le trigger se déclenche automatiquement lors de la création/mise à jour
-- 
-- Usage: 
--   1. Remplacez 'VOTRE_ARTISAN_ID' par l'ID réel de l'artisan
--   2. Modifiez les valeurs de l'intervention selon vos besoins
--   3. Exécutez le script dans Supabase SQL Editor
-- ========================================

-- Créer une intervention terminée

INSERT INTO public.interventions (
  agence_id,
  statut_id,
  metier_id,
  assigned_user_id,  -- ⬅️ Ajout du gestionnaire
  date,
  date_termine,
  contexte_intervention,
  adresse,
  code_postal,
  ville,
  is_active,
  created_at,
  updated_at
)
VALUES (
  -- Option 1: Utiliser la première agence disponible (décommentez si besoin)
  -- (SELECT id FROM public.agencies LIMIT 1),
  -- Option 2: Utiliser une agence spécifique par ID (décommentez et modifiez)
  -- 'VOTRE_AGENCE_UUID'::uuid,
  -- Option 3: NULL si pas d'agence requise
  NULL,  -- ⚠️ MODIFIEZ selon vos besoins
  
  -- Statut INTER_TERMINEE (obligatoire)
  (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1),
  
  -- Option 1: Utiliser le premier métier disponible (décommentez si besoin)
  -- (SELECT id FROM public.metiers LIMIT 1),
  -- Option 2: Utiliser un métier spécifique par code (décommentez et modifiez)
  -- (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE' LIMIT 1),
  -- Option 3: NULL si pas de métier requis
  NULL,  -- ⚠️ MODIFIEZ selon vos besoins
  
  -- Option 1: Utiliser un gestionnaire par code_gestionnaire (décommentez et modifiez)
  -- (SELECT id FROM public.users WHERE code_gestionnaire = 'GEST001' LIMIT 1),
  -- Option 2: Utiliser un gestionnaire par username (décommentez et modifiez)
  -- (SELECT id FROM public.users WHERE username = 'gestionnaire1' LIMIT 1),
  -- Option 3: Utiliser un gestionnaire par ID direct (décommentez et modifiez)
  -- 'VOTRE_GESTIONNAIRE_UUID'::uuid,
  -- Option 4: NULL si pas de gestionnaire
  NULL,  -- ⚠️ MODIFIEZ selon vos besoins
  
  CURRENT_DATE,              -- date (obligatoire)
  CURRENT_DATE,              -- date_termine (date de fin = aujourd'hui)
  'Intervention de test pour mettre le dossier à compléter',  -- contexte_intervention (obligatoire)
  '123 Rue de la Paix',      -- adresse (obligatoire - modifiez selon vos besoins)
  '75001',                   -- code_postal (modifiez selon vos besoins)
  'Paris',                   -- ville (modifiez selon vos besoins)
  true,                      -- is_active
  now(),                     -- created_at
  now()                      -- updated_at
)
RETURNING id;  -- ⬅️ Important : retourner l'ID pour la suite


-- Lier l'artisan à l'intervention comme artisan PRIMARY
INSERT INTO public.intervention_artisans (
  intervention_id,
  artisan_id,
  role,
  is_primary,
  assigned_at,
  created_at
)
VALUES (
  'VOTRE_INTERVENTION_ID'::uuid,  -- ⚠️ Collez l'ID de l'étape 1 ici
  'VOTRE_ARTISAN_ID'::uuid,        -- ⚠️ REMPLACEZ par l'ID réel de l'artisan
  'primary',
  true,
  now(),
  now()
)
RETURNING 
  intervention_id, 
  artisan_id, 
  is_primary;

-- ========================================
-- VÉRIFICATION: Vérifier que le statut de dossier a été mis à jour
-- ========================================
-- Exécutez cette requête après la création pour vérifier le résultat
/*
SELECT 
  a.id,
  a.prenom,
  a.nom,
  a.statut_dossier,
  s.label as statut_artisan,
  (SELECT COUNT(*) 
   FROM intervention_artisans ia
   JOIN interventions i ON ia.intervention_id = i.id
   JOIN intervention_statuses ist ON i.statut_id = ist.id
   WHERE ia.artisan_id = a.id
     AND ia.is_primary = true
     AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
  ) as interventions_terminees
FROM public.artisans a
LEFT JOIN public.artisan_statuses s ON a.statut_id = s.id
WHERE a.id = 'VOTRE_ARTISAN_ID'::uuid  -- ⚠️ REMPLACEZ par l'ID réel de l'artisan
*/