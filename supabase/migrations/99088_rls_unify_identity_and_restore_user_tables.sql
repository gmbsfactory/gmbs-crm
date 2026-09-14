-- ============================================================================
-- 99088 - Unifie la resolution d'identite et restaure la RLS sur
--         user_preferences / intervention_reminders / email_logs
-- ============================================================================
--
-- CONTEXTE / BUG
-- --------------
-- Ces trois tables ont `ENABLE ROW LEVEL SECURITY` dans l'historique des
-- migrations (00003_user_features.sql) mais ressortaient a
-- `relrowsecurity = false` en production : la RLS avait ete desactivee a la
-- main apres que les policies ont casse l'application. Le Security Advisor
-- Supabase les remonte donc en `rls_disabled_in_public` (critique) : tout le
-- schema `public` est expose via PostgREST avec la cle anon, qui est publique.
--
-- Les policies n'avaient pas ete supprimees, seulement neutralisees. Cette
-- migration corrige leur logique AVANT de reactiver la RLS.
--
-- POURQUOI ELLES CASSAIENT
-- ------------------------
-- Dans ce projet `auth.users.id` != `public.users.id`. Mesure en prod sur
-- 32 utilisateurs : seuls 10 ont des identifiants identiques. Toute policy
-- qui compare directement `auth.uid()` a une colonne referencant
-- `public.users(id)` est donc fausse pour la majorite des comptes.
--
--   user_preferences : `auth.uid()::text = user_id::text` -> KO pour ~22/32.
--                      Le cast ::text masquait l'incoherence de type sans
--                      resoudre le fond. Table vide (0 ligne) en prod : la
--                      fonctionnalite n'a jamais reellement fonctionne.
--
--   intervention_reminders : policies deja corrigees par 00031 via
--                      `get_current_user_id()`, qui resout par
--                      `users.auth_user_id`. Mais 5 utilisateurs sur 32 ont
--                      `auth_user_id IS NULL` : la fonction renvoie NULL et
--                      TOUS leurs rappels disparaissent. 00031 remplissait la
--                      colonne une seule fois par email et prevoyait un
--                      trigger de synchro qui n'a jamais ete cree
--                      ("sera cree manuellement dans Supabase Dashboard").
--
--   email_logs       : `sent_by = auth.uid()` -> KO. Deja neutralise en prod
--                      par l'ajout de `email_logs_read_all_authenticated`
--                      (USING true), les policies permissives s'additionnant
--                      en OR. Les deux anciennes restrictives subsistent sans
--                      effet utile.
--
-- CAUSE RACINE : TROIS MECANISMES DE TRADUCTION CONCURRENTS
-- ---------------------------------------------------------
-- auth.uid() -> public.users.id se resout de trois facons differentes,
-- introduites a des moments distincts et qui s'ignorent mutuellement :
--
--   1. `users.auth_user_id`            (00031) -> get_current_user_id()
--   2. `auth_user_mapping` + email     (00041) -> get_public_user_id()
--   3. `users.auth_user_id` OU email   (TS)    -> resolvePublicUserId()
--                                                 (src/lib/api/remindersApi.ts)
--
-- Couverture mesuree en prod : auth_user_id 27/32, auth_user_mapping 18/32.
-- Un utilisateur satisfaisant un mecanisme mais pas l'autre est autorise par
-- le code TS puis refuse par la policy. C'est la meme classe de bug, repetee.
--
-- CORRECTIF
-- ---------
--   1. Backfill des deux sources de mapping (idempotent).
--   2. `get_public_user_id()` devient l'unique point d'entree et essaie les
--      trois chemins dans l'ordre : auth_user_mapping -> users.auth_user_id
--      -> email (compare en lower(), comme le `ilike` du code TS).
--      `get_current_user_id()` delegue, pour ne pas avoir a reecrire les
--      policies existantes qui l'utilisent.
--   3. Policies reecrites sur les trois tables, puis RLS reactivee.
--
-- L'elargissement de get_public_user_id() ne peut qu'autoriser davantage
-- d'utilisateurs legitimes : aucune policy ne devient plus permissive envers
-- un tiers, seuls des comptes jusqu'ici non resolus le deviennent.
--
-- Idempotent : DROP ... IF EXISTS / CREATE OR REPLACE partout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Backfill des liaisons d'identite
-- ---------------------------------------------------------------------------

-- 1.a  users.auth_user_id depuis auth.users, par email (rejoue 00031 etape 3).
--
-- `auth_user_id` est UNIQUE. Deux garde-fous, car une violation ferait echouer
-- toute la migration :
--   - on n'ecrase pas une liaison deja attribuee a un autre compte ;
--   - `DISTINCT ON` garantit qu'un meme auth.users.id n'est pas attribue a deux
--     lignes public.users partageant le meme email au sein de cet UPDATE
--     (le NOT EXISTS ne voit pas les lignes modifiees par la meme instruction).
-- Un doublon d'email laisse donc une des deux lignes non liee, plutot que de
-- faire echouer la migration : a traiter comme une anomalie de donnees.
WITH candidats AS (
  SELECT DISTINCT ON (lower(au.email))
         u.id AS public_user_id,
         au.id AS auth_user_id
  FROM public.users u
  JOIN auth.users au ON lower(u.email) = lower(au.email)
  WHERE u.auth_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.users u2 WHERE u2.auth_user_id = au.id
    )
  ORDER BY lower(au.email), u.created_at NULLS LAST, u.id
)
UPDATE public.users u
SET auth_user_id = c.auth_user_id
FROM candidats c
WHERE u.id = c.public_user_id;

-- 1.b  auth_user_mapping depuis users.auth_user_id, pour les lignes manquantes.
INSERT INTO public.auth_user_mapping (auth_user_id, public_user_id)
SELECT u.auth_user_id, u.id
FROM public.users u
WHERE u.auth_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.auth_user_mapping m
    WHERE m.auth_user_id = u.auth_user_id
  )
ON CONFLICT (auth_user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Resolution d'identite unifiee
-- ---------------------------------------------------------------------------

-- Ordre : mapping explicite -> colonne de liaison -> email.
-- SECURITY DEFINER pour lire auth.users et court-circuiter la RLS des tables
-- consultees ; search_path fige pour eviter toute capture de schema.
CREATE OR REPLACE FUNCTION public.get_public_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- 1. auth_user_mapping (00041)
    (SELECT m.public_user_id
       FROM public.auth_user_mapping m
      WHERE m.auth_user_id = auth.uid()
      LIMIT 1),
    -- 2. users.auth_user_id (00031)
    (SELECT u.id
       FROM public.users u
      WHERE u.auth_user_id = auth.uid()
      LIMIT 1),
    -- 3. Repli par email, insensible a la casse (equivalent du ilike cote TS)
    (SELECT u.id
       FROM public.users u
       JOIN auth.users au ON lower(au.email) = lower(u.email)
      WHERE au.id = auth.uid()
      LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.get_public_user_id() IS
  'Resout auth.uid() vers public.users.id. Ordre : auth_user_mapping, puis '
  'users.auth_user_id, puis email (lower). Point d''entree unique : toute '
  'policy ou fonction ayant besoin de cette traduction doit passer par ici.';

-- Conserve pour compatibilite : les policies de 00031 l'appellent encore.
-- Delegue desormais, pour qu'il n'existe plus qu'une seule logique.
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.get_public_user_id();
$$;

COMMENT ON FUNCTION public.get_current_user_id() IS
  'Alias historique (00031) de get_public_user_id(). Conserve pour les '
  'policies existantes ; ne pas utiliser dans du nouveau code.';

-- ---------------------------------------------------------------------------
-- 3. user_preferences
-- ---------------------------------------------------------------------------
-- Acces applicatif actuel : uniquement app/api/user-preferences/route.ts via
-- supabaseAdmin (service_role), qui ignore la RLS. Ces policies sont donc de
-- la defense en profondeur contre un acces PostgREST direct : aucun risque de
-- regression fonctionnelle, et la table est vide.

DROP POLICY IF EXISTS "Users can view their own preferences"   ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;

CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (user_id = public.get_public_user_id());

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_public_user_id());

-- WITH CHECK autant que USING : sans lui, un utilisateur pourrait reaffecter
-- sa ligne a un autre user_id via UPDATE.
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. intervention_reminders
-- ---------------------------------------------------------------------------
-- Lue depuis le navigateur (src/lib/api/remindersApi.ts) avec la cle anon :
-- la RLS est ici une vraie frontiere, pas de la defense en profondeur.
-- Le perimetre metier (ses propres rappels + ceux ou l'on est mentionne) est
-- celui de 00031 ; on le conserve, en le faisant reposer sur le resolveur
-- unifie et en ajoutant TO authenticated + le WITH CHECK manquant.
--
-- NOTE Realtime : les abonnements (src/lib/realtime/realtime-client.ts:178)
-- appliquent la policy SELECT. Un utilisateur cessera de recevoir les
-- evenements portant sur les rappels d'autrui - c'est le comportement
-- attendu, mais c'est un changement par rapport a la RLS desactivee.

DROP POLICY IF EXISTS "Users can view own reminders and mentions" ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can create own reminders"            ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can update own reminders"            ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can delete own reminders"            ON public.intervention_reminders;

CREATE POLICY "Users can view own reminders and mentions"
  ON public.intervention_reminders FOR SELECT TO authenticated
  USING (
    user_id = public.get_public_user_id()
    OR public.get_public_user_id() = ANY (mentioned_user_ids)
  );

CREATE POLICY "Users can create own reminders"
  ON public.intervention_reminders FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_public_user_id());

CREATE POLICY "Users can update own reminders"
  ON public.intervention_reminders FOR UPDATE TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());

CREATE POLICY "Users can delete own reminders"
  ON public.intervention_reminders FOR DELETE TO authenticated
  USING (user_id = public.get_public_user_id());

ALTER TABLE public.intervention_reminders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. email_logs
-- ---------------------------------------------------------------------------
-- Lue depuis le navigateur par intervention (src/hooks/useEmailLogs.ts:75),
-- jamais par utilisateur : l'onglet affiche l'historique des envois de toute
-- l'equipe sur une intervention. Une policy par utilisateur masquerait les
-- envois des collegues et casserait cet historique.
-- On applique donc le modele assume du projet (cf. 99057) : CRM interne, tout
-- utilisateur authentifie est de confiance. La restriction utile est que le
-- role `anon` n'ait aucun acces - c'est precisement l'objet de l'alerte.
-- Les ecritures reelles passent par app/api/interventions/[id]/send-email
-- en service_role ; la policy INSERT couvre le reste.

-- Legs de 00003 : inoperantes (auth.uid() compare a un FK public.users) et
-- rendues sans effet par email_logs_read_all_authenticated. On nettoie.
DROP POLICY IF EXISTS "Users can view own email logs"   ON public.email_logs;
DROP POLICY IF EXISTS "Admins can view all email logs"  ON public.email_logs;

-- Recreees explicitement TO authenticated : les versions presentes en prod ont
-- ete ajoutees hors migration, on ne peut pas presumer du role cible.
DROP POLICY IF EXISTS email_logs_read_all_authenticated ON public.email_logs;
DROP POLICY IF EXISTS email_logs_insert_authenticated   ON public.email_logs;

CREATE POLICY email_logs_read_all_authenticated
  ON public.email_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY email_logs_insert_authenticated
  ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION (a executer apres la migration)
-- ============================================================================
--
-- 1. Les trois tables ont bien la RLS active :
--
--    SELECT c.relname, c.relrowsecurity
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('user_preferences','intervention_reminders','email_logs');
--    -- attendu : relrowsecurity = true partout
--
-- 2. Plus aucune policy ne compare auth.uid() a un FK public.users :
--
--    SELECT tablename, policyname, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('user_preferences','intervention_reminders','email_logs');
--    -- attendu : aucune occurrence de auth.uid() dans qual / with_check
--
-- 3. Tous les utilisateurs sont resolvables (le point qui cassait les rappels) :
--
--    SELECT count(*) AS total,
--           count(*) FILTER (WHERE u.auth_user_id IS NOT NULL) AS with_auth_user_id,
--           count(*) FILTER (WHERE EXISTS (
--             SELECT 1 FROM public.auth_user_mapping m WHERE m.public_user_id = u.id
--           )) AS with_mapping
--    FROM public.users u;
--    -- avant : 32 / 27 / 18. Attendu apres : with_mapping >= with_auth_user_id.
--    -- Un compte encore non resolu n'a ni liaison ni email correspondant dans
--    -- auth.users : c'est un compte sans acces, a traiter separement.
--
-- 4. Verification fonctionnelle, connecte avec un compte non-admin :
--    - la liste des rappels s'affiche (dont ceux ou l'on est mentionne) ;
--    - la creation / modification / suppression d'un rappel fonctionne ;
--    - l'historique des emails d'une intervention affiche aussi les envois
--      des collegues, avec le nom de l'expediteur (embed sur public.users,
--      couvert par users_select_authenticated).
-- ============================================================================
