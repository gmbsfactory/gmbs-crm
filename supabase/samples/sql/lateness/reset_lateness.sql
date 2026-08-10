-- Reset Lateness Data
-- Description: Reinitialise les compteurs de retard (tests, correction d'un
--              comptage errone, remise a zero decidee par la direction).
--
-- ATTENTION : ce fichier ne s'execute PAS d'un bloc. Chaque option est
-- commentee volontairement. Decommentez UNIQUEMENT celle dont vous avez besoin.
-- L'option "tous les utilisateurs" est irreversible et sans filtre.
--
-- Colonnes a remettre a zero, systematiquement :
--   lateness_count                 compteur annuel
--   lateness_count_year            annee de reference du compteur
--   last_lateness_date             dernier jour compte en retard
--   last_activity_date             dernier jour pointe (debloque un nouveau pointage)
--   lateness_notification_shown_at derniere notification affichee
--   lateness_email_sent_at         dernier email envoye
--
-- Deux pieges :
--   - Oublier `lateness_email_sent_at` : s'il reste a la date du jour, aucun
--     email ne partira aujourd'hui meme en cas de retard reel. Le reset semble
--     avoir fonctionne alors qu'il a casse la notification.
--   - Oublier `last_activity_date` : la personne est consideree comme ayant
--     deja pointe, rien ne se passera avant demain.
--
-- L'annee de reference est calculee a Paris, pas dans le fuseau de la base :
-- les regles de retard sont des regles RH francaises (cf. business-timezone.ts).
-- `EXTRACT(YEAR FROM CURRENT_DATE)` ecrirait la mauvaise annee entre le 31/12
-- 22h et minuit UTC.
--
-- ---------------------------------------------------------------------------
-- Cote client : le navigateur met en cache le pointage du jour.
-- Sans ce nettoyage, l'utilisateur ne repointera pas avant demain.
-- Dans la console du navigateur de la personne concernee :
--   Object.keys(localStorage)
--     .filter(k => k.startsWith('last_activity_check_'))
--     .forEach(k => localStorage.removeItem(k))
-- ---------------------------------------------------------------------------

-- ============================================================================
-- OPTION 1: Reinitialiser un utilisateur par email  (cas le plus courant)
-- ============================================================================
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris')),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL,
  lateness_email_sent_at = NULL
WHERE email = 'user@example.com';
*/

-- ============================================================================
-- OPTION 2: Reinitialiser un utilisateur par username
-- ============================================================================
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris')),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL,
  lateness_email_sent_at = NULL
WHERE username = 'username';
*/

-- ============================================================================
-- OPTION 3: Reinitialiser un utilisateur par ID
-- ============================================================================
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris')),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL,
  lateness_email_sent_at = NULL
WHERE id = 'user-uuid-here';
*/

-- ============================================================================
-- OPTION 4: Annuler UNIQUEMENT le retard du jour (sans purger l'historique)
-- ============================================================================
-- A privilegier pour corriger un comptage errone ponctuel (ex. personne en
-- conge comptee en retard) : decremente le compteur au lieu de l'ecraser.
-- La clause sur `last_lateness_date` rend la requete rejouable : une seconde
-- execution ne touche aucune ligne, donc pas de double decrement.
/*
UPDATE public.users
SET
  lateness_count = GREATEST(0, COALESCE(lateness_count, 0) - 1),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_email_sent_at = NULL
WHERE email = 'user@example.com'
  AND last_lateness_date = (now() AT TIME ZONE 'Europe/Paris')::date;
*/

-- ============================================================================
-- OPTION 5: Reinitialiser TOUS les utilisateurs
-- ============================================================================
-- IRREVERSIBLE. Efface l'historique de retard de toute l'equipe.
-- Executez d'abord la requete de controle en bas de ce fichier.
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris')),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL,
  lateness_email_sent_at = NULL;
*/

-- ============================================================================
-- Controle : etat des compteurs (a executer AVANT et APRES)
-- ============================================================================
SELECT
  u.username,
  u.email,
  u.lateness_count,
  u.lateness_count_year,
  u.last_lateness_date,
  u.last_activity_date,
  u.lateness_email_sent_at
FROM public.users u
ORDER BY u.lateness_count DESC NULLS LAST, u.username;
