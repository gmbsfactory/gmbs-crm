-- ============================================================================
-- 99091 - Vague 3 : RLS sur les tables coeur + security_invoker sur les vues
-- ============================================================================
--
-- CONTEXTE
-- --------
-- Troisieme et derniere vague, apres 99088 (tables utilisateur) et 99089
-- (tables peripheriques). Elle traite les 10 tables que le pied de 99089
-- annoncait comme restantes, plus les deux vues remontees par le Security
-- Advisor en `security_definer_view`.
--
-- Ce sont les tables les plus exposees du schema : contrairement a la vague 2,
-- la majorite est atteinte directement par le navigateur avec la cle anon, et
-- quatre d'entre elles sont lues en EMBED PostgREST depuis la requete
-- principale des interventions (_select-clauses.ts). Un embed sans policy
-- SELECT ne leve pas d'erreur : il renvoie null en silence. C'est exactement
-- le bug qui avait vide les avatars artisans (cf. 99057), et il se
-- manifesterait ici sur les clients, les artisans assignes et les couts.
--
-- MODELE DE SECURITE
-- ------------------
-- Identique a 99088 / 99089 : CRM interne, tout utilisateur authentifie est de
-- confiance, la frontiere utile est `anon`. Le controle fin des droits metier
-- reste applicatif (usePermissions / user_permissions).
--
-- CE QUI N'A PAS ETE NECESSAIRE (verifie, contrairement a 99089)
-- --------------------------------------------------------------
-- Toutes les fonctions qui ECRIVENT dans ces tables sont deja SECURITY DEFINER
-- avec search_path fige, donc insensibles a l'activation de la RLS :
--   - log_intervention_status_transition_on_insert(), _safety(),
--     audit_status_transition(), audit_intervention_cost(),
--     audit_intervention_artisan()          -> 99054
--   - update_intervention_cost_cache(), refresh_dashboard_cache()
--                                           -> 00016
--   - get_sorted_intervention_ids()         -> 99022
-- Aucun correctif prealable n'est donc requis. C'etait le point le plus risque
-- de la vague : un trigger non-DEFINER inserant sous RLS aurait leve une erreur
-- a chaque changement de statut.
--
-- Idempotent : DROP POLICY IF EXISTS / CREATE partout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Regime A : tables atteintes par le navigateur
-- ---------------------------------------------------------------------------

-- 1.a  tenants  (clients)  -- src/lib/api/tenantsApi.ts : 16 requetes, CRUD complet
-- 1.b  owner    (factures) -- src/lib/api/ownersApi.ts  : 14 requetes, CRUD complet
--      Toutes deux egalement lues en embed : `tenants ( ... )` et `owner ( ... )`
--      dans _select-clauses.ts, et resolues par l'historique des interventions
--      (InterventionHistoryPanel). Ecrites aussi par l'import CSV
--      (interventions-import.ts) qui tourne cote navigateur.
DROP POLICY IF EXISTS tenants_select_authenticated ON public.tenants;
DROP POLICY IF EXISTS tenants_insert_authenticated ON public.tenants;
DROP POLICY IF EXISTS tenants_update_authenticated ON public.tenants;
DROP POLICY IF EXISTS tenants_delete_authenticated ON public.tenants;

CREATE POLICY tenants_select_authenticated
  ON public.tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY tenants_insert_authenticated
  ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tenants_update_authenticated
  ON public.tenants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tenants_delete_authenticated
  ON public.tenants FOR DELETE TO authenticated USING (true);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_select_authenticated ON public.owner;
DROP POLICY IF EXISTS owner_insert_authenticated ON public.owner;
DROP POLICY IF EXISTS owner_update_authenticated ON public.owner;
DROP POLICY IF EXISTS owner_delete_authenticated ON public.owner;

CREATE POLICY owner_select_authenticated
  ON public.owner FOR SELECT TO authenticated USING (true);
CREATE POLICY owner_insert_authenticated
  ON public.owner FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY owner_update_authenticated
  ON public.owner FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY owner_delete_authenticated
  ON public.owner FOR DELETE TO authenticated USING (true);

ALTER TABLE public.owner ENABLE ROW LEVEL SECURITY;

-- 1.c  intervention_artisans
--      Jonction intervention <-> artisan. Trois usages cumules, chacun
--      suffisant a exiger une policy SELECT :
--        - embed `intervention_artisans ( ... )` dans _select-clauses.ts ;
--        - CRUD direct (interventions-status.ts : 14 requetes, searchApi,
--          artisans-stats, import CSV) ;
--        - REALTIME : souscrite en postgres_changes (realtime-client.ts:159).
--          Le Realtime respecte la RLS - sans policy SELECT, la table cesse
--          simplement d'emettre des evenements, sans erreur, et le cache
--          TanStack Query decroche silencieusement.
DROP POLICY IF EXISTS intervention_artisans_select_authenticated ON public.intervention_artisans;
DROP POLICY IF EXISTS intervention_artisans_insert_authenticated ON public.intervention_artisans;
DROP POLICY IF EXISTS intervention_artisans_update_authenticated ON public.intervention_artisans;
DROP POLICY IF EXISTS intervention_artisans_delete_authenticated ON public.intervention_artisans;

CREATE POLICY intervention_artisans_select_authenticated
  ON public.intervention_artisans FOR SELECT TO authenticated USING (true);
CREATE POLICY intervention_artisans_insert_authenticated
  ON public.intervention_artisans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY intervention_artisans_update_authenticated
  ON public.intervention_artisans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY intervention_artisans_delete_authenticated
  ON public.intervention_artisans FOR DELETE TO authenticated USING (true);

ALTER TABLE public.intervention_artisans ENABLE ROW LEVEL SECURITY;

-- 1.d  intervention_costs
--      Embed `intervention_costs ( ... )` + CRUD complet depuis
--      interventions-costs.ts (9 requetes), analyticsApi, import CSV et
--      l'export serveur.
DROP POLICY IF EXISTS intervention_costs_select_authenticated ON public.intervention_costs;
DROP POLICY IF EXISTS intervention_costs_insert_authenticated ON public.intervention_costs;
DROP POLICY IF EXISTS intervention_costs_update_authenticated ON public.intervention_costs;
DROP POLICY IF EXISTS intervention_costs_delete_authenticated ON public.intervention_costs;

CREATE POLICY intervention_costs_select_authenticated
  ON public.intervention_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY intervention_costs_insert_authenticated
  ON public.intervention_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY intervention_costs_update_authenticated
  ON public.intervention_costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY intervention_costs_delete_authenticated
  ON public.intervention_costs FOR DELETE TO authenticated USING (true);

ALTER TABLE public.intervention_costs ENABLE ROW LEVEL SECURITY;

-- 1.e  intervention_payments
--      CRUD complet depuis interventions-costs.ts (308-377). Le DELETE est
--      indispensable : la suppression de paiement est une fonctionnalite
--      recemment livree (commit 67bde3a).
DROP POLICY IF EXISTS intervention_payments_select_authenticated ON public.intervention_payments;
DROP POLICY IF EXISTS intervention_payments_insert_authenticated ON public.intervention_payments;
DROP POLICY IF EXISTS intervention_payments_update_authenticated ON public.intervention_payments;
DROP POLICY IF EXISTS intervention_payments_delete_authenticated ON public.intervention_payments;

CREATE POLICY intervention_payments_select_authenticated
  ON public.intervention_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY intervention_payments_insert_authenticated
  ON public.intervention_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY intervention_payments_update_authenticated
  ON public.intervention_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY intervention_payments_delete_authenticated
  ON public.intervention_payments FOR DELETE TO authenticated USING (true);

ALTER TABLE public.intervention_payments ENABLE ROW LEVEL SECURITY;

-- 1.f  intervention_status_transitions
--      Journal des transitions de statut. Regime A partiel, volontairement :
--        - SELECT : lu massivement cote navigateur (comptaApi, statistiques
--          utilisateur, historique d'intervention, dashboard) ;
--        - UPDATE : automatic-transition-service.ts:280 corrige la
--          transition_date apres coup ;
--        - INSERT / DELETE : AUCUNE policy. Les lignes sont ecrites
--          exclusivement par du SECURITY DEFINER, qui franchit la RLS en tant
--          qu'owner. Verifie sur la DERNIERE definition de chaque fonction,
--          les redefinitions successives etant nombreuses :
--            . triggers log_intervention_status_transition_on_insert() /
--              _safety(), audit_status_transition()        -> 99031, 99054
--            . RPC log_status_transition_from_api(), appele par
--              automatic-transition-service.ts:263          -> 99031
--            . RPC create_automatic_status_transitions_on_creation() -> 99031
--          Laisser INSERT/DELETE fermes protege l'integrite du journal
--          d'audit : aucune transition ne peut etre fabriquee ni effacee
--          depuis le navigateur.
DROP POLICY IF EXISTS intervention_status_transitions_select_authenticated ON public.intervention_status_transitions;
DROP POLICY IF EXISTS intervention_status_transitions_update_authenticated ON public.intervention_status_transitions;

CREATE POLICY intervention_status_transitions_select_authenticated
  ON public.intervention_status_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY intervention_status_transitions_update_authenticated
  ON public.intervention_status_transitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.intervention_status_transitions ENABLE ROW LEVEL SECURITY;

-- La RLS raisonne par LIGNE, jamais par colonne : la policy UPDATE ci-dessus
-- autoriserait, telle quelle, la reecriture de `to_status_code` ou de
-- `intervention_id` sur une ligne existante - soit la falsification du journal
-- d'audit par un autre chemin que l'INSERT qu'on vient de fermer.
-- Le mecanisme adapte est le GRANT par colonne, qui se combine a la RLS : les
-- deux doivent autoriser l'operation. Le seul UPDATE client legitime porte sur
-- `transition_date` (automatic-transition-service.ts:280, qui corrige la date
-- apres l'appel RPC), on n'accorde donc que celle-la.
REVOKE UPDATE ON public.intervention_status_transitions FROM authenticated;
GRANT  UPDATE (transition_date) ON public.intervention_status_transitions TO authenticated;

COMMENT ON TABLE public.intervention_status_transitions IS
  'Journal des transitions de statut. RLS : SELECT authenticated, UPDATE '
  'restreint a la seule colonne transition_date (GRANT par colonne), '
  'INSERT/DELETE fermes au client - alimentee uniquement par du SECURITY '
  'DEFINER (99031, 99054).';

-- ---------------------------------------------------------------------------
-- 2. Regime B : tables sans acces applicatif -> deny-all sauf service_role
-- ---------------------------------------------------------------------------

-- 2.a  Messagerie : conversations, messages, message_attachments
--      Audit : zero occurrence dans src/, app/ ou supabase/functions/. La
--      feature n'a jamais ete branchee cote application. Verrouillees plutot
--      que supprimees, le contenu n'ayant pas ete verifie.
--      Si la messagerie est branchee un jour, ajouter des policies explicites
--      (probablement scopees par participant) - ne PAS desactiver la RLS.
ALTER TABLE public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.conversations IS
  'Messagerie non branchee cote application. RLS active sans policy : '
  'accessible au service_role seul.';

-- 2.b  intervention_costs_cache
--      Cache de couts agrege (00016). Jamais lu directement par le navigateur :
--      les deux seuls chemins d'acces passent par du SECURITY DEFINER, qui
--      franchit la RLS en tant qu'owner :
--        - get_sorted_intervention_ids() (99022) pour le tri serveur ;
--        - update_intervention_cost_cache() / refresh_dashboard_cache() (00016)
--          pour l'alimentation.
--      Le deny-all est donc sur. Consequence assumee, cf. section 3 : la vue
--      interventions_ca, une fois en security_invoker, renverra 0 ligne si elle
--      est interrogee directement par un utilisateur authentifie. Aucun code ne
--      le fait ; ses seuls lecteurs sont les fonctions dashboard SECURITY
--      DEFINER de 00011.
ALTER TABLE public.intervention_costs_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.intervention_costs_cache IS
  'Cache des couts par intervention. RLS active sans policy : alimentee et lue '
  'uniquement via des fonctions SECURITY DEFINER (00016, 99022).';

-- ---------------------------------------------------------------------------
-- 3. Vues : security_invoker
-- ---------------------------------------------------------------------------
-- Le lint `security_definer_view` est trompeur : PostgreSQL n'a pas de vue
-- SECURITY DEFINER. Il signale l'absence de `security_invoker = true`, option
-- introduite en PG 15. Par defaut une vue est evaluee avec les droits de son
-- createur (postgres), qui contourne la RLS des tables sous-jacentes : la vue
-- devient une porte derobee autour des policies qu'on vient de poser.
--
-- 3.a  interventions_ca (00016:111) -> intervention_costs_cache
--      Sans risque de regression : ses seuls lecteurs sont
--      get_admin_dashboard_stats() et get_podium_ranking_by_period() (00011),
--      toutes deux SECURITY DEFINER. A l'interieur de celles-ci, l'utilisateur
--      effectif est l'owner, qui contourne la RLS - la vue continue donc de
--      renvoyer toutes les lignes.
ALTER VIEW public.interventions_ca SET (security_invoker = true);

-- 3.b  v_user_permissions_debug (00045:13) -> SUPPRIMEE
--      Vue de confort pour le diagnostic : elle aplatissait la chaine
--      users -> user_roles -> roles -> role_permissions -> permissions en une
--      ligne par utilisateur, pour repondre d'une requete a "pourquoi ce
--      gestionnaire ne voit-il pas tel bouton ?".
--
--      Deux problemes cumules :
--        - le GRANT SELECT TO authenticated de 00045 la rendait lisible par
--          n'importe quel compte connecte ;
--        - sans security_invoker, elle s'executait avec les droits de son
--          createur et contournait donc la RLS de public.users que 99088 vient
--          de restaurer.
--      Resultat : n'importe quel viewer pouvait lire l'email et le jeu de
--      permissions de tous ses collegues, admins compris - une cartographie
--      complete des droits offerte a qui connaissait son nom.
--
--      Aucun code applicatif ne l'utilise (verifie : les seules occurrences
--      dans database.types.ts sont des artefacts de cles etrangeres generes
--      par Supabase, pas des lectures). L'application passe par usePermissions
--      / user_permissions, un chemin totalement distinct.
--
--      Un security_invoker aurait suffi a eteindre l'alerte, mais aurait laisse
--      la vue en place. La suppression est preferable : elle fait disparaitre
--      la surface d'exposition elle-meme, et ne detruit aucune donnee - une vue
--      n'est qu'une requete enregistree. Pour un diagnostic ponctuel, rejouer
--      la requete ci-dessous dans le SQL Editor (en service_role, sans GRANT).
--
--      SELECT u.id AS user_id, u.email, u.username, r.name AS role_name,
--             array_agg(DISTINCT p.key ORDER BY p.key) AS permissions
--      FROM public.users u
--      LEFT JOIN public.user_roles ur       ON u.id = ur.user_id
--      LEFT JOIN public.roles r             ON ur.role_id = r.id
--      LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
--      LEFT JOIN public.permissions p       ON rp.permission_id = p.id
--      GROUP BY u.id, u.email, u.username, r.name;
--
--      Pas de CASCADE : si un objet en dependait, le DROP doit echouer et nous
--      le signaler plutot que d'emporter silencieusement autre chose.
DROP VIEW IF EXISTS public.v_user_permissions_debug;

-- ============================================================================
-- VERIFICATION (a executer apres la migration)
-- ============================================================================
--
-- 1. Plus AUCUNE table publique sans RLS - le resultat doit etre vide :
--
--    SELECT c.relname
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
--    ORDER BY 1;
--
-- 2. Etat des deux vues :
--
--    SELECT c.relname, c.reloptions
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('interventions_ca', 'v_user_permissions_debug');
--    -- attendu : UNE seule ligne, interventions_ca, avec reloptions
--    --           contenant security_invoker=true.
--    --           v_user_permissions_debug ne doit plus exister.
--
-- 2b. Regenerer les types apres application - database.types.ts contient encore
--     des references a la vue supprimee (artefacts de cles etrangeres) :
--
--     npx supabase gen types typescript --linked > src/lib/database.types.ts
--
-- 3. Verification fonctionnelle, connecte avec un compte NON-ADMIN. Les modes
--    d'echec des embeds sont silencieux (null, pas d'erreur) : il faut regarder
--    l'ecran, pas la console.
--    - liste des interventions : le nom du client (tenants), le nom de
--      facturation (owner), les artisans assignes et les couts s'affichent ;
--    - fiche intervention : onglet couts complet, ajout PUIS suppression d'un
--      paiement ;
--    - historique d'intervention : les transitions de statut sont listees ;
--    - changement de statut d'une intervention : aucune erreur (valide que les
--      triggers DEFINER franchissent bien la RLS) puis la transition apparait
--      dans l'historique ;
--    - tri du tableau par colonne de cout (RPC get_sorted_intervention_ids) ;
--    - dashboard admin : CA, marges et podium non nuls (valide interventions_ca
--      en security_invoker) ;
--    - comptabilite : la liste des interventions terminees se remplit ;
--    - REALTIME : ouvrir deux onglets, assigner un artisan dans l'un, verifier
--      que l'autre se met a jour sans rechargement. C'est le seul test qui
--      couvre la souscription intervention_artisans.
-- ============================================================================
