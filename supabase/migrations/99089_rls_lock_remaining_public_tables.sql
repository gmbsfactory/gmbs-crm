-- ============================================================================
-- 99089 - Active la RLS sur les tables publiques restees sans protection
-- ============================================================================
--
-- CONTEXTE
-- --------
-- Suite de 99088. Le Security Advisor Supabase remonte `rls_disabled_in_public`
-- sur toutes les tables du schema `public` sans RLS : PostgREST les expose avec
-- la cle anon, qui est publique par construction (embarquee dans le bundle JS).
-- Sans RLS, n'importe qui connaissant l'URL du projet peut lire et ecrire.
--
-- Aucune de ces tables n'avait la moindre policy (verifie via pg_policies) :
-- c'est donc une creation, pas une reparation.
--
-- MODELE DE SECURITE RETENU
-- -------------------------
-- Celui deja assume par le projet (cf. 99057) : CRM interne, tout utilisateur
-- authentifie est de confiance. La frontiere utile est `anon`, pas la
-- separation entre collegues - le controle fin des droits metier est assure
-- par la couche applicative (usePermissions / user_permissions).
--
-- Deux regimes selon l'usage reel, audite table par table :
--
--   A. Tables atteintes par le navigateur -> CRUD ouvert `TO authenticated`.
--      Restreindre davantage casserait des parcours existants sans gain reel :
--      un utilisateur authentifie peut de toute facon lire ces donnees via
--      l'interface.
--
--   B. Tables sans aucun acces applicatif -> RLS activee sans aucune policy,
--      soit un deny-all pour anon comme pour authenticated. Seul le
--      service_role (routes serveur, Edge Functions, jobs) y accede encore.
--      C'est volontaire et sur, precisement parce que rien ne les lit :
--      ne PAS reproduire ce schema sur une table utilisee par l'app, c'est le
--      piege qui avait vide les avatars artisans (cf. 99057).
--
-- DEUX FONCTIONS A CORRIGER AVANT D'ACTIVER LA RLS
-- ------------------------------------------------
-- Deux tables du regime B sont accedees indirectement, par des fonctions qui
-- s'executent avec les droits de l'appelant. Activer la RLS sans les corriger
-- casserait des fonctionnalites, dont une en silence :
--
--   search_views_refresh_flags : les triggers flag_*_search_refresh() font un
--     UPDATE sur cette table. Sous RLS, un UPDATE non autorise ne leve PAS
--     d'erreur - il touche 0 ligne. Le flag ne serait donc jamais pose, les
--     vues materialisees de recherche cesseraient d'etre rafraichies et la
--     recherche renverrait des resultats perimes, sans aucun message.
--
--   search_global() : cette fonction de recherche (99073:506) LIT la meme table
--     de flags pour delimiter son buffer live, et n'est pas SECURITY DEFINER
--     non plus. Elle recoit donc une policy SELECT dediee (cf. section 3),
--     plutot que d'elargir ses droits.
--
-- Les triggers passent en SECURITY DEFINER avec search_path fige : c'est le
-- pattern correct pour une fonction qui doit franchir la RLS en ECRITURE de
-- maniere controlee. Pour une simple lecture, une policy SELECT est preferable
-- - moins de privileges accordes.
--
-- podium_periods, en revanche, ne demande aucune correction : verification
-- faite, get_current_podium_period() est un calcul pur sur now() et ne lit pas
-- la table ; seule refresh_current_podium_period() y accede, deja en SECURITY
-- DEFINER.
--
-- Idempotent : DROP POLICY IF EXISTS / CREATE OR REPLACE partout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fonctions accedant aux tables du regime B
-- ---------------------------------------------------------------------------

-- 1.a  Triggers de flag pour le rafraichissement des vues de recherche (00035).
--      Corps inchange, seul le contexte d'execution est corrige.
CREATE OR REPLACE FUNCTION public.flag_interventions_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.search_views_refresh_flags
  SET needs_refresh = true, last_flag_set = now()
  WHERE id IN ('interventions_search_mv', 'global_search_mv');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.flag_artisans_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.search_views_refresh_flags
  SET needs_refresh = true, last_flag_set = now()
  WHERE id IN ('artisans_search_mv', 'global_search_mv');
  RETURN NULL;
END;
$$;

-- 1.b  podium_periods : aucune correction necessaire, verifie.
--      get_current_podium_period() (00048:27, redefinie en 99063) est appelee
--      en RPC par le navigateur mais ne lit PAS podium_periods : c'est un
--      calcul pur sur now(). Les seuls acces reels a la table sont dans
--      refresh_current_podium_period() (00048:97-119), deja SECURITY DEFINER.
--      La table peut donc rester sans policy sans rien casser.

-- ---------------------------------------------------------------------------
-- 2. Regime A : tables atteintes par le navigateur
-- ---------------------------------------------------------------------------

-- 2.a  zones
--      Lue et ecrite depuis le client (src/lib/api/enumsApi.ts, 6 appels).
--      L'insertion n'est PAS reservee a l'admin : une zone inconnue est creee a
--      la volee lors de la creation d'un artisan ou d'un import. Une policy
--      admin-only casserait ce parcours.
--      Egalement lue en embed : artisan_zones ( zones ( ... ) ).
DROP POLICY IF EXISTS zones_select_authenticated ON public.zones;
DROP POLICY IF EXISTS zones_insert_authenticated ON public.zones;
DROP POLICY IF EXISTS zones_update_authenticated ON public.zones;
DROP POLICY IF EXISTS zones_delete_authenticated ON public.zones;

CREATE POLICY zones_select_authenticated
  ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY zones_insert_authenticated
  ON public.zones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY zones_update_authenticated
  ON public.zones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY zones_delete_authenticated
  ON public.zones FOR DELETE TO authenticated USING (true);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- 2.b  artisan_metiers
--      Table de jonction artisan <-> metier, lue en embed depuis le client
--      (src/lib/api/artisans/artisans-crud.ts, 5 requetes ; searchApi.ts).
--      Sans policy SELECT, l'embed renvoie null en silence et les metiers
--      disparaissent des fiches artisan - exactement le bug de 99057.
--      Meme jeu de policies que sa table soeur artisan_zones.
DROP POLICY IF EXISTS artisan_metiers_select_authenticated ON public.artisan_metiers;
DROP POLICY IF EXISTS artisan_metiers_insert_authenticated ON public.artisan_metiers;
DROP POLICY IF EXISTS artisan_metiers_update_authenticated ON public.artisan_metiers;
DROP POLICY IF EXISTS artisan_metiers_delete_authenticated ON public.artisan_metiers;

CREATE POLICY artisan_metiers_select_authenticated
  ON public.artisan_metiers FOR SELECT TO authenticated USING (true);
CREATE POLICY artisan_metiers_insert_authenticated
  ON public.artisan_metiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY artisan_metiers_update_authenticated
  ON public.artisan_metiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY artisan_metiers_delete_authenticated
  ON public.artisan_metiers FOR DELETE TO authenticated USING (true);

ALTER TABLE public.artisan_metiers ENABLE ROW LEVEL SECURITY;

-- 2.c  agency_config
--      Lue et surtout ECRITE depuis le client : agenciesApi.updateRequiresReference()
--      fait un upsert (src/lib/api/agenciesApi.ts:212). INSERT et UPDATE sont
--      donc tous deux necessaires - un upsert PostgREST echoue si l'un manque.
DROP POLICY IF EXISTS agency_config_select_authenticated ON public.agency_config;
DROP POLICY IF EXISTS agency_config_insert_authenticated ON public.agency_config;
DROP POLICY IF EXISTS agency_config_update_authenticated ON public.agency_config;
DROP POLICY IF EXISTS agency_config_delete_admin        ON public.agency_config;

CREATE POLICY agency_config_select_authenticated
  ON public.agency_config FOR SELECT TO authenticated USING (true);
CREATE POLICY agency_config_insert_authenticated
  ON public.agency_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY agency_config_update_authenticated
  ON public.agency_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- Suppression reservee a l'admin : aucun parcours applicatif ne supprime une
-- configuration d'agence, seule une intervention manuelle le justifierait.
CREATE POLICY agency_config_delete_admin
  ON public.agency_config FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

ALTER TABLE public.agency_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Regime B : tables sans acces applicatif -> deny-all sauf service_role
-- ---------------------------------------------------------------------------
-- Audit : aucune occurrence dans src/, app/ ou supabase/functions/.
--   tasks, task_statuses  : presentes uniquement dans supabase/seeds/.
--                           La feature n'a jamais ete branchee cote app.
--   sync_logs             : aucune reference.
--   podium_periods        : lue via get_current_podium_period() (cf. 1.b).
--   search_views_refresh_flags : ecrite par trigger (cf. 1.a).
--
-- Volontairement sans policy. Si l'une de ces tables devait etre exposee plus
-- tard, ajouter une policy SELECT explicite plutot que de desactiver la RLS.

ALTER TABLE public.tasks                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_statuses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podium_periods             ENABLE ROW LEVEL SECURITY;

-- search_views_refresh_flags : exception au deny-all, une policy SELECT est
-- indispensable. La fonction search_global() (99073:506) est `STABLE` sans
-- SECURITY DEFINER et lit `last_refresh` pour delimiter le buffer live :
--   SELECT last_refresh INTO v_last_refresh
--   FROM public.search_views_refresh_flags WHERE id = 'global_search_mv';
--   IF v_last_refresh IS NULL THEN v_last_refresh := '1970-01-01' END IF;
-- Sans droit de lecture, elle retomberait sur 1970 et considererait TOUTES les
-- lignes comme plus recentes que la vue materialisee : la branche "live"
-- scannerait l'integralite des tables a chaque recherche. Degradation massive
-- des performances, sans erreur.
-- La table ne contient que des booleens et des horodatages : aucune donnee
-- sensible a proteger. Les ecritures restent fermees (les triggers passent par
-- SECURITY DEFINER, cf. 1.a).
DROP POLICY IF EXISTS search_views_refresh_flags_select_authenticated
  ON public.search_views_refresh_flags;

CREATE POLICY search_views_refresh_flags_select_authenticated
  ON public.search_views_refresh_flags FOR SELECT TO authenticated USING (true);

ALTER TABLE public.search_views_refresh_flags ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tasks IS
  'Feature non branchee cote application (seeds uniquement). RLS active sans '
  'policy : accessible au service_role seul.';
COMMENT ON TABLE public.task_statuses IS
  'Table de reference de tasks, non branchee cote application. RLS active sans '
  'policy : accessible au service_role seul.';

-- ---------------------------------------------------------------------------
-- 4. Tables d'archive creees hors migration
-- ---------------------------------------------------------------------------
-- Ces tables n'existent dans aucune migration ni dans le code : elles ont ete
-- creees manuellement lors d'un archivage ponctuel. Volumes constates :
-- 154 / 154 / 93 / 93 / 373 lignes, moins de 400 ko au total.
--
-- Elles sont verrouillees, pas supprimees : leur contenu n'a pas ete verifie et
-- une suppression est irreversible. Une fois confirme que les donnees sont
-- redondantes avec intervention_audit_log / intervention_status_transitions,
-- un DROP dans une migration ulterieure est preferable a une policy - c'est la
-- seule facon de faire disparaitre definitivement l'alerte les concernant.
--
-- `IF EXISTS` via DO : ces tables ne sont pas garanties presentes hors prod
-- (elles ne sont creees par aucune migration, donc absentes d'une base neuve).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_pr2_archive_audit',
    '_pr2_archive_audit_meta',
    '_pr2_archive_transitions',
    '_pr2_archive_transitions_meta',
    'user_page_sessions_cleanup_backup'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'COMMENT ON TABLE public.%I IS %L', t,
        'Archive creee hors migration. RLS active sans policy (service_role '
        'seul). Candidate a la suppression apres verification du contenu.'
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- VERIFICATION (a executer apres la migration)
-- ============================================================================
--
-- 1. Il ne reste plus de table publique sans RLS :
--
--    SELECT c.relname
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
--    ORDER BY 1;
--    -- Attendu apres 99088 + 99089, d'apres le releve de production : seules
--    -- subsistent les tables de la vague 3, soit
--    --   conversations, intervention_artisans, intervention_costs,
--    --   intervention_costs_cache, intervention_payments,
--    --   intervention_status_transitions, message_attachments, messages,
--    --   owner, tenants
--    -- Toute autre table dans ce resultat est une regression de cette migration.
--
-- 2. Les fonctions corrigees sont bien SECURITY DEFINER :
--
--    SELECT p.proname, p.prosecdef, p.proconfig
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('flag_interventions_search_refresh',
--                        'flag_artisans_search_refresh');
--    -- attendu : prosecdef = true, proconfig contenant search_path
--
-- 3. Verification fonctionnelle, connecte avec un compte non-admin :
--    - fiche artisan : les metiers et les zones s'affichent (embeds) ;
--    - creation d'un artisan avec une zone inedite : la zone est creee ;
--    - parametres agence : le basculement "reference obligatoire" est persiste
--      (upsert sur agency_config) ;
--    - le podium s'affiche avec sa periode courante et son classement ;
--    - modifier une intervention puis la rechercher par un terme modifie : le
--      resultat remonte, et la recherche reste rapide. C'est le point le plus
--      important : les deux modes d'echec ici sont silencieux (vues qui cessent
--      d'etre rafraichies, ou buffer live qui scanne tout depuis 1970).
--
-- 4. Le flag de recherche est bien repositionne apres une modification :
--
--    SELECT id, needs_refresh, last_flag_set FROM public.search_views_refresh_flags;
--    -- last_flag_set doit avancer apres une modification d'intervention
-- ============================================================================
