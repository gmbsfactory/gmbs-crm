-- ========================================
-- Script SQL : Créer un artisan avec statut dossier "À compléter"
-- ========================================
-- Description: Crée un nouvel artisan avec le statut_dossier défini à "À compléter"
-- 
-- Usage: 
--   1. Modifiez les valeurs ci-dessous selon vos besoins
--   2. Exécutez le script dans Supabase SQL Editor
-- ========================================

-- Créer un artisan avec statut dossier "À compléter"
INSERT INTO public.artisans (
  prenom,
  nom,
  email,
  telephone,
  departement,
  raison_sociale,
  siret,
  statut_juridique,
  adresse_siege_social,
  ville_siege_social,
  code_postal_siege_social,
  adresse_intervention,
  ville_intervention,
  code_postal_intervention,
  statut_id,
  statut_dossier,
  gestionnaire_id,           -- gestionnaire_id (optionnel - voir options ci-dessous)
  date_ajout,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'Jean',                    -- prenom (modifiez selon vos besoins)
  'Dupont',                  -- nom (modifiez selon vos besoins)
  'jean.dupont@example.com', -- email (modifiez selon vos besoins - doit être unique)
  '0123456789',              -- telephone (modifiez selon vos besoins)
  75,                        -- departement (modifiez selon vos besoins)
  'Entreprise Dupont SARL',  -- raison_sociale (modifiez selon vos besoins)
  '12345678901234',          -- siret (modifiez selon vos besoins - doit être unique)
  'SARL',                    -- statut_juridique (modifiez selon vos besoins)
  '123 Rue de la Paix',      -- adresse_siege_social (modifiez selon vos besoins)
  'Paris',                   -- ville_siege_social (modifiez selon vos besoins)
  '75001',                   -- code_postal_siege_social (modifiez selon vos besoins)
  '123 Rue de la Paix',      -- adresse_intervention (modifiez selon vos besoins)
  'Paris',                   -- ville_intervention (modifiez selon vos besoins)
  '75001',                   -- code_postal_intervention (modifiez selon vos besoins)
  (SELECT id FROM public.artisan_statuses WHERE code = 'NOVICE' LIMIT 1), -- statut_id (utilise le statut NOVICE par défaut, modifiez le code si nécessaire)
  'À compléter',             -- statut_dossier (fixé à "À compléter")
  -- Option 1: Attribuer un gestionnaire par code_gestionnaire (décommentez et modifiez)
  -- (SELECT id FROM public.users WHERE code_gestionnaire = 'GEST001' LIMIT 1),
  -- Option 2: Attribuer un gestionnaire par username (décommentez et modifiez)
  -- (SELECT id FROM public.users WHERE username = 'gestionnaire1' LIMIT 1),
  -- Option 3: Attribuer un gestionnaire par ID direct (décommentez et modifiez)
  -- 'VOTRE_GESTIONNAIRE_UUID'::uuid,
  NULL,                      -- gestionnaire_id (NULL par défaut - décommentez une option ci-dessus pour attribuer)
  CURRENT_DATE,              -- date_ajout (date du jour)
  true,                      -- is_active (actif par défaut)
  now(),                     -- created_at
  now()                      -- updated_at
)
RETURNING id, prenom, nom, email, statut_dossier, gestionnaire_id;

-- ========================================
-- ATTRIBUTION D'UN GESTIONNAIRE APRÈS CRÉATION
-- ========================================
-- Si vous avez créé l'artisan sans gestionnaire et souhaitez l'attribuer après,
-- utilisez l'une des options ci-dessous (remplacez les valeurs selon vos besoins)
-- ========================================

-- Option A: Attribuer un gestionnaire par code_gestionnaire
/*
UPDATE public.artisans
SET 
  gestionnaire_id = (SELECT id FROM public.users WHERE code_gestionnaire = 'GEST001' LIMIT 1),
  updated_at = now()
WHERE email = 'jean.dupont@example.com'  -- ⚠️ REMPLACEZ par l'email de l'artisan créé
RETURNING id, prenom, nom, email, gestionnaire_id;
*/

-- Option B: Attribuer un gestionnaire par username
/*
UPDATE public.artisans
SET 
  gestionnaire_id = (SELECT id FROM public.users WHERE username = 'gestionnaire1' LIMIT 1),
  updated_at = now()
WHERE email = 'jean.dupont@example.com'  -- ⚠️ REMPLACEZ par l'email de l'artisan créé
RETURNING id, prenom, nom, email, gestionnaire_id;
*/

-- Option C: Attribuer un gestionnaire par ID direct
/*
UPDATE public.artisans
SET 
  gestionnaire_id = 'VOTRE_GESTIONNAIRE_UUID'::uuid,  -- ⚠️ REMPLACEZ par l'UUID du gestionnaire
  updated_at = now()
WHERE email = 'jean.dupont@example.com'  -- ⚠️ REMPLACEZ par l'email de l'artisan créé
RETURNING id, prenom, nom, email, gestionnaire_id;



UPDATE public.artisans
SET 
  gestionnaire_id = '00000000-0000-0000-0000-000000000010'::uuid,
  updated_at = now()
WHERE email = 'jean.dupont@example.com'  -- ⚠️ REMPLACEZ par l'email de l'artisan créé
RETURNING id, prenom, nom, email, gestionnaire_id;


*/

-- Option D: Attribuer un gestionnaire par ID de l'artisan (si vous connaissez l'ID)
/*
UPDATE public.artisans
SET 
  gestionnaire_id = (SELECT id FROM public.users WHERE code_gestionnaire = 'GEST001' LIMIT 1),
  updated_at = now()
WHERE id = 'VOTRE_ARTISAN_UUID'::uuid  -- ⚠️ REMPLACEZ par l'UUID de l'artisan
RETURNING id, prenom, nom, email, gestionnaire_id;
*/


