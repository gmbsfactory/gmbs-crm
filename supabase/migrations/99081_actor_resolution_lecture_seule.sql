-- =====================================================================
-- 99081_actor_resolution_lecture_seule.sql
-- CORRECTIF DE REVUE DU SOCLE (constat 15) — get_current_user_id() est declaree STABLE
-- mais ecrit.
--
-- Symptome, reproduit sur la base de demo avec le vrai jeton de badr@gmbs.fr :
--   PATCH /rest/v1/intervention_artisans?id=eq.<uuid> {"payment_status":"awaiting_invoice"}
--   => 400  0A000  « UPDATE is not allowed in a non-volatile function »
--   CONTEXT: UPDATE public.users SET auth_user_id = current_auth_id …
--            get_current_user_id() -> resolve_actor_user_id() -> audit_intervention_artisan()
--
-- Ce n'est PAS une regression de 99078 : la RLS n'est pas en cause (la meme requete passe
-- des que users.auth_user_id est renseigne, verifie en transaction annulee). Mais TOUTE
-- ecriture faite par un client authentifie — price_response et payment_status en L1/L6, mais
-- aussi le simple depot d'une piece de dossier en L5 — echoue tant que auth_user_id est NULL,
-- et c'est le cas des 13 comptes de la base de demo.
--
-- Deux corrections, ici et dans scripts/demo/load-seed.sh :
--   1. sortir l'auto-reparation de auth_user_id du chemin de LECTURE (cette migration) ;
--   2. renseigner users.auth_user_id (backfill ci-dessous + seed de demo).
--
-- Pourquoi retirer l'UPDATE plutot que declarer la fonction VOLATILE : la fonction est
-- appelee par les policies RLS d'intervention_reminders (4 policies). VOLATILE y interdirait
-- toute mise en cache du resultat par le planificateur — une regression de performance sur
-- un chemin RLS, pour une auto-reparation dont le backfill ci-dessous fait le travail.
--
-- CREATE OR REPLACE, PAS DROP + CREATE : la signature et le type de retour sont inchanges, et
-- un DROP … CASCADE supprimerait les quatre policies qui dependent de la fonction.
--
-- IDEMPOTENTE ET REJOUABLE.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_auth_id  uuid;
  resolved_user_id uuid;
BEGIN
  current_auth_id := auth.uid();

  IF current_auth_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Mapping direct
  SELECT u.id INTO resolved_user_id
  FROM public.users u
  WHERE u.auth_user_id = current_auth_id
  LIMIT 1;

  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;

  -- 2. Repli par l'e-mail de auth.users.
  --    AUCUNE ecriture ici : la fonction est STABLE et elle est appelee depuis des triggers
  --    d'audit, donc dans des contextes en lecture seule. Le mapping est pose par le
  --    backfill ci-dessous et par le seed, pas au fil des lectures.
  SELECT u.id INTO resolved_user_id
  FROM public.users u
  JOIN auth.users au ON LOWER(u.email) = LOWER(au.email)
  WHERE au.id = current_auth_id
  LIMIT 1;

  RETURN resolved_user_id;
END;
$function$;

COMMENT ON FUNCTION public.get_current_user_id() IS
  'Retourne le public.users.id correspondant a auth.uid(), via auth_user_id puis par repli sur '
  'l''e-mail. LECTURE SEULE depuis 99081 : l''auto-reparation de auth_user_id qui vivait ici '
  'levait 0A000 « UPDATE is not allowed in a non-volatile function » des qu''un trigger d''audit '
  'l''appelait (constat 15). Le mapping est desormais pose par le backfill de 99081.';

-- Backfill du mapping, sur le modele de 00031:14-20. Idempotent : au second passage plus
-- aucune ligne n'a auth_user_id NULL avec un e-mail connu de auth.users.
UPDATE public.users u
   SET auth_user_id = au.id
  FROM auth.users au
 WHERE LOWER(u.email) = LOWER(au.email)
   AND u.auth_user_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.users x WHERE x.auth_user_id = au.id);
