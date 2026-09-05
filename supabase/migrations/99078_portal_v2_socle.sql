-- =====================================================================
-- 99078_portal_v2_socle.sql
-- Vision portail artisans v2 — socle (specification §3.1).
--
-- Aucune table nouvelle : des colonnes sur 4 tables existantes, plus la
-- securisation de intervention_artisans (RLS + policies + REVOKE anon),
-- qui n'en avait aucune alors que 00001:738-747 grante ALL a anon.
--
-- Prerequis : 99076 (artisan_reports convergee), 99077 (realtime portail).
--
-- IDEMPOTENTE ET REJOUABLE : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS, DROP CONSTRAINT / POLICY / TRIGGER / FUNCTION IF EXISTS avant
-- chaque CREATE (rappel 99076:17, incident 42P13 en production).
--
-- CORRECTIFS DE REVUE (2026-09-05), reperables par « CORRECTIF DE REVUE » :
--   1  REVOKE nominatif apres le CREATE de calculate_artisan_dossier_status : le DROP+CREATE
--      lui rendait les DEFAULT PRIVILEGES de 00001 et, etant SECURITY DEFINER, elle devenait
--      un oracle non authentifie (verifie : 200 « INCOMPLET » avec la seule cle anon).
--   2  Garde anti-WAL etendue : dossier_validated_at etait inatteignable pour tout dossier
--      deja COMPLET, c'est-a-dire pour 100 % de l'existant.
--   3  Rattrapage 4.c complet et symetrique (compteur PAR SOUS-REQUETE CORRELEE, recalcul du
--      statut, pose et effacement de la date).
--   4  DROP du CHECK de statut par parcours de pg_constraint : artisan_reports vient de
--      depose_docs, son nom de contrainte n'est pas garanti.
--   5  Ordre d'ecriture de la supersession ecrit noir sur blanc (index non deferrable).
--  12  intervention_artisans : TRUNCATE et TRIGGER retires a authenticated.
--  21  REVOKE anon sur artisans, artisan_attachments et artisan_reports.
-- Voir aussi 99081 (chaine d'audit en lecture seule) et 99082 (RLS des tables voisines).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RAPPORTS : versions remplacees, debut de chantier fige
-- ---------------------------------------------------------------------

-- 1.a  version devient NOT NULL (aujourd'hui nullable, DEFAULT 1 — 99076:116)
-- ---------------------------------------------------------------------------
-- BORNE D'ATTENTE DES VERROUS (correctif de recette, constat 1).
--
-- 99077 ajoute intervention_attachments, artisan_reports et artisan_attachments
-- a la publication « supabase_realtime ». Le gestionnaire d'abonnements de
-- Supabase Realtime (application_name « realtime_subscription_manager_pub ») se
-- reveille alors pour lire ces relations (AccessShareLock) au moment meme ou ces
-- migrations demandent un AccessExclusiveLock sur les memes tables ou leurs
-- voisines : un deadlock 40P01 a ete observe une fois sur quatre resets locaux,
-- et la fenetre est ouverte a chaque deploiement en production, ou Realtime est
-- toujours vivant.
--
-- Sans borne, l'attente est infinie et rien ne fait reessayer. Avec elle, la
-- collision devient un echec net (55P03 lock_not_available) sur une migration
-- deja IDEMPOTENTE : il suffit de la rejouer. On prefere un echec lisible et
-- rejouable a un deadlock aleatoire.
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';
UPDATE public.artisan_reports SET version = 1 WHERE version IS NULL;
ALTER TABLE public.artisan_reports ALTER COLUMN version SET NOT NULL;

-- 1.b  Nouvel etat 'superseded' : une v(n) remplacee par une v(n+1) AVANT validation.
--      Le CHECK de 99076:142 n'admettait que submitted | approved | rejected.
--      CORRECTIF DE REVUE (constat 4) : artisan_reports ne nait d'AUCUNE migration de ce
--      depot — elle vient de 00064-00069 de depose_docs, que le CRM ne controle pas. Rien ne
--      garantit que son CHECK de statut s'y appelle « artisan_reports_status_check » : un DROP
--      nominatif ne ferait alors rien, l'ancien CHECK survivrait et rejetterait 'superseded'
--      en 23514 — en production seulement, sur la fonctionnalite centrale du lot.
--      On supprime donc TOUTE contrainte CHECK de la table qui porte sur la colonne status.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.artisan_reports'::regclass
       AND c.contype  = 'c'
       AND EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = c.conrelid
                      AND a.attnum   = ANY (c.conkey)
                      AND a.attname  = 'status')
  LOOP
    EXECUTE format('ALTER TABLE public.artisan_reports DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.artisan_reports
  ADD CONSTRAINT artisan_reports_status_check
  CHECK (status IN ('submitted','approved','rejected','superseded'));

ALTER TABLE public.artisan_reports
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID
      REFERENCES public.artisan_reports(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.artisan_reports.superseded_by IS
  'Version qui remplace celle-ci. Une modification par l''artisan avant validation cree une '
  'nouvelle ligne (version + 1) et bascule la precedente en status = ''superseded''.';

-- 1.c  Au plus UN rapport en attente par couple (intervention, artisan).
--      Garantit que fn_artisan_reports_sync_flag (EXISTS status='submitted') reste sans
--      ambiguite et que la revue sait quel rapport traiter.
--
--      Reprise prealable des donnees, sur le modele de 99076:152-186 (renumerotation des
--      versions avant l'index unique) : la production de depose_docs a pu enregistrer
--      plusieurs rapports 'submitted' pour un meme couple, ce que l'index refuserait.
--      On ne garde en attente que le plus recent ; les precedents deviennent 'superseded'
--      et pointent vers lui. Idempotent : au second passage plus aucune ligne ne matche.
WITH ranked AS (
    SELECT id,
           intervention_id,
           artisan_id,
           first_value(id) OVER (
               PARTITION BY intervention_id, artisan_id
               ORDER BY version DESC, submitted_at DESC NULLS LAST, created_at DESC, id DESC
           ) AS keeper_id,
           row_number() OVER (
               PARTITION BY intervention_id, artisan_id
               ORDER BY version DESC, submitted_at DESC NULLS LAST, created_at DESC, id DESC
           ) AS rn
    FROM public.artisan_reports
    WHERE status = 'submitted'
)
UPDATE public.artisan_reports r
   SET status        = 'superseded',
       superseded_at = COALESCE(r.superseded_at, now()),
       superseded_by = COALESCE(r.superseded_by, ranked.keeper_id)
  FROM ranked
 WHERE ranked.id = r.id
   AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_artisan_reports_one_open
  ON public.artisan_reports(intervention_id, artisan_id)
  WHERE status = 'submitted';

-- ORDRE D'ECRITURE IMPOSE (constat 5) : l'index n'est pas deferrable (un index partiel ne peut
-- pas l'etre) et aucun trigger ne supersede automatiquement. Une modification de rapport avant
-- validation DOIT donc, DANS LA MEME TRANSACTION :
--   1. UPDATE artisan_reports SET status='superseded', superseded_at=now() WHERE id=<v(n)> ;
--   2. INSERT de la version n+1 en status='submitted' ;
--   3. UPDATE artisan_reports SET superseded_by=<v(n+1)> WHERE id=<v(n)>.
-- L'etape 3 vient APRES l'etape 2 : superseded_by est une FK vers artisan_reports, verifiee
-- immediatement, et la v(n+1) n'existe pas encore a l'etape 1.
-- L'ordre inverse (INSERT avant supersession) leve 23505 : verifie en local, et couvert par
-- deux tests d'integration (l'ordre correct passe, l'ordre inverse echoue).
COMMENT ON INDEX public.ux_artisan_reports_one_open IS
  'Au plus UN rapport submitted par couple (intervention, artisan). Non deferrable : la '
  'supersession doit passer v(n) en ''superseded'' AVANT d''inserer v(n+1), dans la meme '
  'transaction — sinon 23505.';

-- 1.d  Debut de chantier recopie sur le rapport a l'envoi : fige la duree reelle.
ALTER TABLE public.artisan_reports
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
COMMENT ON COLUMN public.artisan_reports.started_at IS
  'Copie de intervention_artisans.work_started_at au moment de l''envoi du rapport. '
  'Duree reelle = submitted_at - started_at. Ne pas confondre avec duree_minutes, '
  'qui reste la saisie DECLARATIVE de l''artisan (99076:119).';

COMMENT ON COLUMN public.artisan_reports.status IS
  'submitted (a verifier) | approved | rejected | superseded (remplacee par une version '
  'ulterieure avant validation)';

-- ---------------------------------------------------------------------
-- 2. PAR ARTISAN : prix, demarrage, paiement
--    intervention_artisans a deja UNIQUE(intervention_id, artisan_id) — 00001:343.
--    Elle est deja en realtime (00085:13,26-30) et deja ecoutee par le SSE portail
--    (app/api/portal-external/me/stream/route.ts) : tout ce qu'on ecrit ici remonte
--    dans l'application sans une ligne de SSE en plus.
-- ---------------------------------------------------------------------

ALTER TABLE public.intervention_artisans
  -- A2 : l'artisan accepte ou refuse le prix depuis son application
  ADD COLUMN IF NOT EXISTS price_response TEXT
      CHECK (price_response IS NULL OR price_response IN ('accepted','refused')),
  ADD COLUMN IF NOT EXISTS price_responded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_accepted_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS price_refused_reason  TEXT,
  ADD COLUMN IF NOT EXISTS price_response_source TEXT
      CHECK (price_response_source IS NULL OR price_response_source IN ('portal','crm')),
  ADD COLUMN IF NOT EXISTS price_response_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- A4 : l'artisan declare le debut du chantier
  ADD COLUMN IF NOT EXISTS work_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_started_from TEXT
      CHECK (work_started_from IS NULL OR work_started_from IN ('portal','crm')),
  ADD COLUMN IF NOT EXISTS work_started_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- C11 : ou en est la prise en charge par GMBS, pour CET artisan
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_applicable'
      CHECK (payment_status IN ('not_applicable','awaiting_invoice','in_progress','paid')),
  ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.intervention_artisans.price_accepted_amount IS
  'Montant GELE au moment du oui de l''artisan (copie de intervention_costs.amount, '
  'cost_type = ''sst'', pour son artisan_order). Sans ce gel, la modale e-mail peut modifier le '
  'cout SST a posteriori (EmailEditModal.tsx persiste le prix via upsertCost) sans trace '
  'de ce qui a ete accepte.';

COMMENT ON COLUMN public.intervention_artisans.price_response_source IS
  'portal = l''artisan a repondu depuis son application ; crm = le gestionnaire a saisi une '
  'reponse recue par telephone. Repli indispensable : sans lui, un artisan sans smartphone ne '
  'peut jamais franchir la garde de POST /start.';

COMMENT ON COLUMN public.intervention_artisans.work_started_at IS
  'Debut de chantier DECLARE par l''artisan (ou saisi au CRM). Pose meme si la transition '
  'ACCEPTE -> INTER_EN_COURS echoue : le fait ne meurt pas de l''echec de la projection (P3).';

COMMENT ON COLUMN public.intervention_artisans.payment_status IS
  'Statut de paiement DE CET ARTISAN, saisi par le gestionnaire. Ne jamais deriver de '
  'intervention_payments.is_received : c''est un encaissement CLIENT, et acompte_sst n''a pas '
  'd''artisan_order (00001:360-371) — faux sur une intervention a deux artisans.';

CREATE INDEX IF NOT EXISTS idx_intervention_artisans_payment
  ON public.intervention_artisans(payment_status)
  WHERE payment_status <> 'not_applicable';

-- ---------------------------------------------------------------------
-- 2.b  SECURITE de intervention_artisans — CORRECTIF.
--      00001:738-747 grante ALL ON ALL TABLES a anon ET pose ALTER DEFAULT PRIVILEGES.
--      Or intervention_artisans n'a NI RLS NI REVOKE, contrairement a
--      artisan_attachments (couverte par 99057).
--      Poser price_accepted_amount / paid_at / payment_status ici rendrait le montant du a
--      chaque artisan lisible avec la cle anon — la fuite deja constatee sur les tables enfant.
--      Policies « authenticated = confiance » : meme modele que 99057, DANS LA MEME
--      MIGRATION, sinon RLS sans policy = deny-all et on reproduit le lockout de l'avatar.
-- ---------------------------------------------------------------------

ALTER TABLE public.intervention_artisans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users"   ON public.intervention_artisans;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.intervention_artisans;
DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.intervention_artisans;
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.intervention_artisans;
DROP POLICY IF EXISTS "service_role full access"                    ON public.intervention_artisans;

CREATE POLICY "Allow read access for authenticated users"
  ON public.intervention_artisans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access for authenticated users"
  ON public.intervention_artisans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access for authenticated users"
  ON public.intervention_artisans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access for authenticated users"
  ON public.intervention_artisans FOR DELETE TO authenticated USING (true);
CREATE POLICY "service_role full access"
  ON public.intervention_artisans FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.intervention_artisans FROM anon;

-- CORRECTIF DE REVUE (constat 12) : le REVOKE ne visait qu'anon, or authenticated conservait
-- ALL — TRUNCATE (D) et TRIGGER (t) compris. TRUNCATE ne passe par AUCUNE policy RLS : un
-- simple compte connecte pouvait vider la table que cette migration securise. Meme
-- raisonnement que 99079:98-102 pour le journal : REVOKE ALL puis GRANT des quatre verbes.
REVOKE ALL ON public.intervention_artisans FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_artisans TO authenticated;

-- ---------------------------------------------------------------------
-- 3. PIECES DU DOSSIER : verification par le gestionnaire (D16, D17)
--    review_status existe deja (99076:236-240) mais aucune UI ni route ne l'ecrit.
-- ---------------------------------------------------------------------

ALTER TABLE public.artisan_attachments
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_comment TEXT;

COMMENT ON COLUMN public.artisan_attachments.reviewed_at IS
  'Discriminant « reellement verifiee » : review_status a pour DEFAULT ''approved'' (99076:236), '
  'donc « validee » et « jamais regardee » sont indiscernables sur l''historique. '
  'reviewed_at IS NOT NULL = une decision humaine a ete prise apres la mise en service.';

COMMENT ON COLUMN public.artisan_attachments.review_comment IS
  'Motif du refus, obligatoire quand review_status = ''rejected'' (garde applicative). '
  'Affiche EN ENTIER a l''artisan dans le portail.';

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_pending
  ON public.artisan_attachments(artisan_id) WHERE review_status = 'pending';

-- Compteur denormalise : indispensable. Un filtre par embed artisan_attachments!inner(...)
-- casserait le count exact de la pagination (doublons de jointure) et les puces lancent deja
-- 6+ count en parallele (useArtisanFilterCounts.ts).
ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS pieces_a_verifier    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dossier_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dossier_validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.artisans.pieces_a_verifier IS
  'Nombre de pieces du dossier en attente de verification (artisan_attachments.review_status '
  '= ''pending''). Maintenu par trg_artisan_dossier_sync ; alimente la pastille violette de la '
  'colonne Dossier et la puce de filtre « Pieces a verifier ».';
COMMENT ON COLUMN public.artisans.dossier_validated_at IS
  'Date du premier passage a COMPLET ; remise a NULL si le dossier redevient incomplet. '
  'Affichee a l''artisan : « Dossier complet valide le … ».';

-- ---------------------------------------------------------------------
-- 4. statut_dossier tient enfin compte de la verification
--    Regle actuelle (99015:7-43) : compte les kinds requis, IGNORE review_status
--    => un depot portail 'pending' fait passer le dossier a COMPLET sans verification.
--    DROP avant CREATE : obligatoire (99076:17, incident 42P13 en production).
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.calculate_artisan_dossier_status(UUID);
CREATE FUNCTION public.calculate_artisan_dossier_status(artisan_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_required TEXT[] := ARRAY['kbis','assurance','cni_recto_verso','iban','decharge_partenariat'];
  v_ok INTEGER;
BEGIN
  -- COALESCE, PAS « IN ('approved', NULL) » : en SQL, x IN (…, NULL) ne vaut jamais vrai
  -- pour NULL, et le CHECK de 99076:239-240 tolere explicitement NULL. Ecrit autrement,
  -- des artisans aujourd'hui COMPLET basculeraient — l'inverse de la non-regression voulue.
  -- Le DEFAULT 'approved' de review_status protege les milliers de pieces historiques :
  -- seuls les depots portail ('pending') attendent desormais une verification.
  SELECT COUNT(DISTINCT lower(kind)) INTO v_ok
  FROM public.artisan_attachments
  WHERE artisan_id = artisan_uuid
    AND lower(kind) = ANY(v_required)
    AND COALESCE(review_status, 'approved') = 'approved';

  IF v_ok >= 5 THEN RETURN 'COMPLET';
  ELSIF v_ok = 0 THEN RETURN 'INCOMPLET';
  ELSE RETURN 'À compléter';
  END IF;
END $$;

COMMENT ON FUNCTION public.calculate_artisan_dossier_status(UUID) IS
  'Statut du dossier d''un artisan : COMPLET (5 pieces requises VALIDEES) | À compléter | '
  'INCOMPLET. Seules les pieces dont review_status vaut ''approved'' (ou NULL, historique) '
  'comptent — sans quoi un depot portail non verifie ferait mentir le badge COMPLET.';

-- CORRECTIF DE REVUE (constats 1 et 13) — REGRESSION DE SECURITE, la plus grave du lot.
-- Le DROP + CREATE ci-dessus fait repasser la fonction par les ALTER DEFAULT PRIVILEGES de
-- 00001 : elle repart grantee a PUBLIC, anon ET authenticated. Combinee au SECURITY DEFINER
-- (qui contourne la RLS d'artisan_attachments), elle devenait un ORACLE NON AUTHENTIFIE sur
-- l'etat documentaire de n'importe quel artisan dont on devine l'UUID :
--   POST /rest/v1/rpc/calculate_artisan_dossier_status avec la seule cle anon => 200 'INCOMPLET'.
-- Avant la migration la fonction n'etait pas DEFINER : anon lisait a travers la RLS et
-- n'obtenait rien d'exploitable. Motif repris de 99076:85-90 et du memo projet
-- « DEFAULT PRIVILEGES Supabase exposent les fonctions » : REVOKE nominatif obligatoire.
REVOKE ALL ON FUNCTION public.calculate_artisan_dossier_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_artisan_dossier_status(UUID) TO authenticated, service_role;

-- 4.b  Recalcul + compteur « a verifier » + date de validation du dossier.
--      Les triggers de 00008:89-99 n'ecoutent QUE INSERT et DELETE : valider une piece est un
--      UPDATE, il ne recalculait donc rien.
DROP FUNCTION IF EXISTS public.fn_artisan_dossier_sync() CASCADE;
CREATE FUNCTION public.fn_artisan_dossier_sync()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_artisan UUID := COALESCE(NEW.artisan_id, OLD.artisan_id);
  v_statut  TEXT;
  v_pending INTEGER;
BEGIN
  IF v_artisan IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  v_statut := public.calculate_artisan_dossier_status(v_artisan);
  SELECT COUNT(*) INTO v_pending
    FROM public.artisan_attachments
   WHERE artisan_id = v_artisan AND review_status = 'pending';

  UPDATE public.artisans a
     SET statut_dossier       = v_statut,
         pieces_a_verifier    = v_pending,
         -- horodatage pose au premier passage a COMPLET, efface si le dossier redevient incomplet
         dossier_validated_at = CASE
             WHEN v_statut = 'COMPLET' AND a.dossier_validated_at IS NULL THEN now()
             WHEN v_statut <> 'COMPLET' THEN NULL
             ELSE a.dossier_validated_at END
   WHERE a.id = v_artisan
     -- garde anti-ecriture inutile : artisans est en REPLICA IDENTITY FULL (00085:10),
     -- chaque UPDATE sans changement coute du WAL logique et un evenement realtime.
     -- CORRECTIF DE REVUE (constat 2) : la garde ne testait que le statut et le compteur.
     -- Un artisan DEJA COMPLET dont dossier_validated_at est NULL (c'est le cas de 100 % de
     -- l'existant avant cette migration) voyait l'UPDATE filtre : le CASE n'etait jamais
     -- evalue et la date restait NULL indefiniment, alors que le portail affiche
     -- « Dossier complet valide le … ». On ajoute les deux transitions de la date.
     AND (a.statut_dossier IS DISTINCT FROM v_statut
          OR a.pieces_a_verifier IS DISTINCT FROM v_pending
          OR (v_statut =  'COMPLET' AND a.dossier_validated_at IS NULL)
          OR (v_statut <> 'COMPLET' AND a.dossier_validated_at IS NOT NULL));

  RETURN COALESCE(NEW, OLD);
END $$;

-- Meme traitement par principe pour la fonction de trigger (constat 13) : PostgREST refuse
-- les fonctions trigger (404 PGRST202), l'exposition y est theorique, mais on ne laisse pas
-- une fonction SECURITY DEFINER grantee a anon. Verifie en local : le trigger continue de
-- s'executer pour authenticated (le privilege EXECUTE d'une fonction de trigger n'est
-- controle qu'au CREATE TRIGGER).
REVOKE ALL ON FUNCTION public.fn_artisan_dossier_sync() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_artisan_dossier_sync() IS
  'Seul ecrivain de artisans.statut_dossier et artisans.pieces_a_verifier depuis '
  'artisan_attachments. Remplace les deux triggers INSERT/DELETE de 00008 : valider une piece '
  'est un UPDATE de review_status, qu''ils ne voyaient pas.';

-- CORRECTIF : supprimer les deux anciens triggers, sinon DEUX ecrivains de statut_dossier
-- sur le meme INSERT, sur une table publiee en realtime (doublon d'ecriture gratuit).
DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_insert ON public.artisan_attachments;
DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_delete ON public.artisan_attachments;

DROP TRIGGER IF EXISTS trg_artisan_dossier_sync ON public.artisan_attachments;
CREATE TRIGGER trg_artisan_dossier_sync
  AFTER INSERT OR DELETE OR UPDATE OF review_status, kind
  ON public.artisan_attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_artisan_dossier_sync();

-- 4.c  Rattrapage de l'existant — COMPLET ET SYMETRIQUE (correctifs de revue 2 et 3).
--
--      L'ancienne version ne rattrapait que le compteur, et le faisait par une JOINTURE
--      INTERNE sur les artisans ayant au moins une piece 'pending' : un artisan dont le
--      compteur serait reste non nul alors qu'il n'a plus aucune piece en attente n'etait
--      jamais remis a zero (le COALESCE(p.n, 0) etait mort, p.n ne pouvant pas etre NULL).
--      Elle ne recalculait pas non plus statut_dossier, alors que la migration CHANGE la
--      regle de calcul — 99015:47-49 faisait deja ce recalcul pour la meme raison.

--   (1) Compteur : sous-requete CORRELEE, donc tous les artisans sont couverts.
UPDATE public.artisans a
   SET pieces_a_verifier = COALESCE((
         SELECT COUNT(*) FROM public.artisan_attachments x
          WHERE x.artisan_id = a.id AND x.review_status = 'pending'), 0)
 WHERE a.pieces_a_verifier IS DISTINCT FROM COALESCE((
         SELECT COUNT(*) FROM public.artisan_attachments x
          WHERE x.artisan_id = a.id AND x.review_status = 'pending'), 0);

--   (2) Statut : sans ce recalcul, la colonne denormalisee reste figee sur l'ANCIENNE regle
--       jusqu'a la prochaine ecriture sur une piece de l'artisan. Un dossier dont une piece
--       requise est 'pending' afficherait COMPLET tout en portant la pastille « n pieces a
--       verifier ». Le risque est nul au premier deploiement (review_status prend partout le
--       DEFAULT 'approved') mais reel des que 99076 et 99078 sont appliquees separement.
UPDATE public.artisans a
   SET statut_dossier = public.calculate_artisan_dossier_status(a.id)
 WHERE a.statut_dossier IS DISTINCT FROM public.calculate_artisan_dossier_status(a.id);

--   (3) Date de validation : tous les dossiers COMPLET anterieurs a cette migration ont
--       dossier_validated_at a NULL et, sans ce rattrapage, ne l'obtiendraient JAMAIS
--       (constat 2). Symetrique : un dossier qui n'est plus COMPLET perd sa date.
UPDATE public.artisans
   SET dossier_validated_at = now()
 WHERE statut_dossier = 'COMPLET' AND dossier_validated_at IS NULL;

UPDATE public.artisans
   SET dossier_validated_at = NULL
 WHERE statut_dossier IS DISTINCT FROM 'COMPLET' AND dossier_validated_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. CORRECTIF DE REVUE (constat 21) — defense en profondeur sur les trois autres tables
--    enrichies par cette migration. Leur RLS neutralise deja anon (probes : 200 []), mais
--    elles conservaient anon=arwdDxtm : TRUNCATE (D) ne passe par aucune policy RLS.
--    C'est l'argument que 99079:98-100 developpe pour son propre journal ; on l'applique ici.
--    La RLS continue de porter le controle fin pour authenticated : rien n'est touche de ce cote.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.artisans            FROM anon;
REVOKE ALL ON public.artisan_attachments FROM anon;
REVOKE ALL ON public.artisan_reports     FROM anon;
