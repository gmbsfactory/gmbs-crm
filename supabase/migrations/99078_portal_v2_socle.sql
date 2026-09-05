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
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RAPPORTS : versions remplacees, debut de chantier fige
-- ---------------------------------------------------------------------

-- 1.a  version devient NOT NULL (aujourd'hui nullable, DEFAULT 1 — 99076:116)
UPDATE public.artisan_reports SET version = 1 WHERE version IS NULL;
ALTER TABLE public.artisan_reports ALTER COLUMN version SET NOT NULL;

-- 1.b  Nouvel etat 'superseded' : une v(n) remplacee par une v(n+1) AVANT validation.
--      Le CHECK de 99076:142 n'admettait que submitted | approved | rejected.
ALTER TABLE public.artisan_reports DROP CONSTRAINT IF EXISTS artisan_reports_status_check;
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
     AND (a.statut_dossier IS DISTINCT FROM v_statut
          OR a.pieces_a_verifier IS DISTINCT FROM v_pending);

  RETURN COALESCE(NEW, OLD);
END $$;

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

-- 4.c  Rattrapage du compteur sur l'existant.
UPDATE public.artisans a
   SET pieces_a_verifier = COALESCE(p.n, 0)
  FROM (SELECT artisan_id, COUNT(*) n FROM public.artisan_attachments
         WHERE review_status = 'pending' GROUP BY artisan_id) p
 WHERE a.id = p.artisan_id
   AND a.pieces_a_verifier IS DISTINCT FROM COALESCE(p.n, 0);
