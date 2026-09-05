-- =====================================================================
-- 99082_rls_tables_enfant_intervention.sql
-- CORRECTIFS DE REVUE DU SOCLE (constats 17 et 18).
--
-- 1. Le REVOKE de 99078 sur intervention_artisans est contourne par la table voisine.
--    Verifie en local avec la seule cle anon, AVANT cette migration :
--      GET    /rest/v1/intervention_costs?select=cost_type,amount,artisan_order
--             => 200 [{"cost_type":"sst","amount":120.00,"artisan_order":1}, …]
--      DELETE /rest/v1/intervention_costs?id=eq.<uuid>   => 204
--    Or intervention_costs.amount (cost_type='sst') est EXACTEMENT la valeur dont
--    intervention_artisans.price_accepted_amount est la copie gelee : sans ce correctif, le
--    REVOKE de 99078 ne deplace la fuite que d'une table. intervention_attachments porte les
--    photos que PHOTO_UPLOADED reference, meme situation (ni RLS ni REVOKE).
--
-- 2. Les ALTER DEFAULT PRIVILEGES de 00001 ne sont jamais neutralises : pg_default_acl porte
--    toujours postgres|r|anon=arwdDxtm et postgres|f|anon=X. CHAQUE table et CHAQUE fonction
--    future de public repart donc grantee a anon, et chaque lot doit y penser — ce que L0
--    avait fait pour sa table (99079) et OUBLIE pour sa fonction (constat 1). On coupe a la
--    racine, une fois pour toutes.
--
-- Motif repris de 99057 : ENABLE RLS + policies authenticated + service_role + REVOKE anon
-- DANS LA MEME MIGRATION. Activer la RLS sans policy = deny-all, c'est le lockout de l'avatar.
--
-- IDEMPOTENTE ET REJOUABLE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. intervention_costs et intervention_attachments
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['intervention_costs','intervention_attachments'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "Allow read access for authenticated users"   ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role full access"                    ON public.%I', t);

    EXECUTE format('CREATE POLICY "Allow read access for authenticated users"   ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Allow insert access for authenticated users" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Allow update access for authenticated users" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Allow delete access for authenticated users" ON public.%I FOR DELETE TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "service_role full access"                    ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);

    -- REVOKE ALL puis GRANT des quatre verbes, et non « REVOKE SELECT, INSERT … » :
    -- ce dernier laisserait TRUNCATE (D) et TRIGGER (t), qui ne passent par aucune policy.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Plus aucun privilege par defaut pour anon dans public.
--    N'affecte QUE les objets crees APRES cette migration : les tables existantes gardent
--    leurs grants (celles qui doivent etre revoquees le sont nominativement, ici et en 99078).
--    Le bloc est garde : « ALTER DEFAULT PRIVILEGES FOR ROLE <r> » exige d'etre membre de <r>,
--    ce qui n'est pas garanti pour supabase_admin en production.
--
--    LIMITE MESUREE, a connaitre avant d'ecrire une migration : ce mecanisme ferme les TABLES
--    (verifie : une table creee ensuite n'a plus d'entree anon) mais PAS les FONCTIONS.
--    PostgreSQL ajoute « =X » (EXECUTE a PUBLIC) a toute fonction neuve EN PLUS des privileges
--    par defaut, et ce « =X » ne peut pas etre retire par ALTER DEFAULT PRIVILEGES — verifie
--    en local : apres le REVOKE ci-dessous, une fonction creee ensuite porte encore
--    « =X/postgres ». anon faisant partie de PUBLIC, la seule protection fiable d'une fonction
--    reste le REVOKE NOMINATIF juste apres son CREATE (motif 99076:85-90, applique en 99078).
--    Le REVOKE ON FUNCTIONS est conserve ci-dessous pour la defense en profondeur, sans etre
--    suffisant a lui seul. Un test d'integration garde les fonctions du socle.
-- ---------------------------------------------------------------------
DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres','supabase_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES    FROM anon', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon', r);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE '99082 : privileges par defaut du role % non modifies (droits insuffisants)', r;
    END;
  END LOOP;
END $$;
