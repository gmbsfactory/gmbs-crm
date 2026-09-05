-- =====================================================================
-- 99079_artisan_portal_actions.sql
-- Journal append-only des actions de l'artisan depuis le portail (et de leur
-- equivalent saisi au CRM). Repond a « historique des actions de l'artisan »
-- (specification §3.2), que la seule liste des versions ne couvrait pas.
--
-- CE QUE CETTE TABLE N'EST PAS :
--   - pas une source de verite : les etats vivent sur intervention_artisans et
--     artisan_reports, ecrits par les routes serveur dans la meme transaction ;
--   - pas un moteur : aucun trigger de projection, aucune logique metier en PL/pgSQL
--     (CLAUDE.md : la logique metier vit dans la couche API) ;
--   - pas publiee en realtime : le journal se lit a la demande, il n'alourdit pas le WAL.
--
-- IDEMPOTENTE ET REJOUABLE. Le CREATE TABLE etant « IF NOT EXISTS », les correctifs de revue
-- qui changent la table sont ecrits en ALTER dans un bloc de convergence dedie, sans quoi ils
-- ne s'appliqueraient jamais a une base ou la table existe deja.
--
-- CORRECTIFS DE REVUE (2026-09-05) :
--   6  event_uid unique PAR ARTISAN (il etait unique globalement : collision entre deux
--      telephones = action perdue sous un 200 de « rejeu », et trace rendue au mauvais artisan).
--   7/20  CHECK d'acteur : une action saisie au CRM porte son acteur (FK ou payload.actor).
--   8/16  intervention_id en ON DELETE SET NULL (le CASCADE effacait l'historique) et trigger
--      d'immuabilite BEFORE UPDATE seulement — l'objection d'origine ne valait que pour DELETE.
--   9  Bornes d'occurred_at posees en base (elles ne vivaient que dans un COMMENT).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.artisan_portal_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Acteur : jamais nul des deux cotes a la fois (lecon d'artisan_audit_log, 92 % sans acteur).
  -- La promesse est TENUE PAR UNE CONTRAINTE (voir artisan_portal_actions_acteur_check plus
  -- bas), pas par la discipline des routes — c'est exactement ainsi qu'artisan_audit_log a
  -- derive. actor_user_id restant ON DELETE SET NULL, les routes recopient AUSSI une identite
  -- immuable (e-mail ou nom) dans payload.actor, pour que l'attribution survive a la
  -- suppression du compte.
  artisan_id      UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL, -- rempli si source='crm'
  source          TEXT NOT NULL DEFAULT 'portal'
                  CHECK (source IN ('portal','crm')),

  -- Objet
  -- ON DELETE SET NULL, comme report_id (constats 8 et 16) : le CRM supprime reellement des
  -- interventions, et un CASCADE effacait PRICE_ACCEPTED, WORK_STARTED, REPORT_SUBMITTED…
  -- au moment precis ou la trace sert (litige sur un prix accepte, sur une heure de demarrage).
  -- Les routes denormalisent la reference lisible (numero, id_inter, adresse) dans payload
  -- a l'ECRITURE, pour que la ligne reste interpretable apres la suppression de son objet.
  intervention_id UUID REFERENCES public.interventions(id) ON DELETE SET NULL,
  report_id       UUID REFERENCES public.artisan_reports(id) ON DELETE SET NULL,
  attachment_id   UUID,   -- volontairement SANS FK : cible artisan_attachments OU
                          -- intervention_attachments selon action_type.

  action_type     TEXT NOT NULL CHECK (action_type IN (
                    'PRICE_ACCEPTED','PRICE_REFUSED',
                    'WORK_STARTED',
                    'REPORT_SUBMITTED','REPORT_REPLACED',
                    'PHOTO_UPLOADED',
                    'DOCUMENT_UPLOADED','DOCUMENT_APPROVED','DOCUMENT_REJECTED',
                    'AVATAR_CHANGED','DECHARGE_SIGNED',
                    'REPORT_APPROVED','REPORT_REJECTED')),

  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Deux horloges : le telephone travaille hors ligne et rejoue.
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- declare par le client, borne cote serveur
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- pose par le serveur, fait foi pour l'audit

  -- Idempotence : meme mecanisme que portal_report_id (index unique partiel, 99076:186-187).
  event_uid       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CONVERGENCE D'UNE TABLE DEJA CREEE (le CREATE TABLE ci-dessus est IF NOT EXISTS :
-- au rejeu, il ne rejoue AUCUN des correctifs de revue ci-dessous). Chaque bloc est
-- ecrit DROP … IF EXISTS puis ADD, donc rejouable a l'identique.
-- ---------------------------------------------------------------------

-- Constats 8 et 16 : intervention_id passe de ON DELETE CASCADE a ON DELETE SET NULL.
ALTER TABLE public.artisan_portal_actions
  DROP CONSTRAINT IF EXISTS artisan_portal_actions_intervention_id_fkey;
ALTER TABLE public.artisan_portal_actions
  ADD  CONSTRAINT artisan_portal_actions_intervention_id_fkey
  FOREIGN KEY (intervention_id) REFERENCES public.interventions(id) ON DELETE SET NULL;

-- Constats 7 et 20 : la promesse « acteur jamais nul des deux cotes » devient une contrainte.
-- Sans elle, une ligne source='crm' avec actor_user_id NULL passait sans erreur — la derive
-- exacte d'artisan_audit_log (92 % de lignes sans acteur), laissee a la discipline des routes.
ALTER TABLE public.artisan_portal_actions
  DROP CONSTRAINT IF EXISTS artisan_portal_actions_acteur_check;
ALTER TABLE public.artisan_portal_actions
  ADD  CONSTRAINT artisan_portal_actions_acteur_check
  CHECK (source <> 'crm' OR actor_user_id IS NOT NULL OR payload ? 'actor');
-- Le troisieme terme n'est pas une echappatoire, c'est la SECONDE moitie du correctif
-- (constat 20) : actor_user_id est ON DELETE SET NULL, donc la suppression d'un compte
-- effacerait l'attribution de toutes ses saisies. La contrainte oblige les routes a recopier
-- une identite immuable dans payload.actor (e-mail ou nom) — et c'est ce qui permet a la
-- neutralisation par la cle etrangere de rester valide au lieu de bloquer la suppression.

-- Constat 9 : les bornes d'occurred_at n'existaient que dans un COMMENT et dans le contrat
-- d'API — la base acceptait n'importe quelle date, et l'index (artisan_id, occurred_at DESC)
-- qui sert la timeline aurait remonte en tete une valeur arbitraire. Le CHECK est un FILET :
-- les routes continuent de recaler la valeur et de poser payload.clock_skew ; un fait n'est
-- jamais rejete pour une horloge fausse, il est recale AVANT l'insertion.
-- Compare les deux colonnes (pas now()) : l'expression reste immuable, donc acceptable en CHECK.
ALTER TABLE public.artisan_portal_actions
  DROP CONSTRAINT IF EXISTS artisan_portal_actions_occurred_at_check;
ALTER TABLE public.artisan_portal_actions
  ADD  CONSTRAINT artisan_portal_actions_occurred_at_check
  CHECK (occurred_at <= recorded_at + INTERVAL '5 minutes'
     AND occurred_at >= recorded_at - INTERVAL '7 days');

-- CORRECTIF DE REVUE (constat 6) : la cle d'idempotence est LOCALE A L'ARTISAN.
-- Unique globalement, deux telephones produisant la meme chaine (« evt-1 », un compteur
-- local, un horodatage a la seconde) se bloquaient mutuellement : la seconde action partait
-- en 23505 et, la route traitant ce conflit comme un rejeu (contrat : « un event_uid deja
-- connu renvoie 200 avec le resultat deja enregistre »), elle etait silencieusement PERDUE —
-- et le 200 rendait la trace d'un artisan A a un artisan B.
-- DROP inconditionnel : au rejeu, un « CREATE INDEX IF NOT EXISTS » laisserait en place
-- l'ancienne definition mono-colonne.
DROP INDEX IF EXISTS public.ux_artisan_portal_actions_event_uid;
CREATE UNIQUE INDEX ux_artisan_portal_actions_event_uid
  ON public.artisan_portal_actions(artisan_id, event_uid) WHERE event_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artisan_portal_actions_artisan
  ON public.artisan_portal_actions(artisan_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_portal_actions_intervention
  ON public.artisan_portal_actions(intervention_id, occurred_at DESC)
  WHERE intervention_id IS NOT NULL;

COMMENT ON TABLE public.artisan_portal_actions IS
  'Journal append-only des actions de l''artisan (portail) et de leurs equivalents saisis au CRM. '
  'Lecture seule pour authenticated ; ecriture par les routes serveur uniquement (service_role).';
COMMENT ON COLUMN public.artisan_portal_actions.occurred_at IS
  'Horodatage DECLARE. Borne cote serveur a [now - 7 jours, now + 5 min] : hors bornes, on garde '
  'la valeur brute dans payload.occurred_at_declared, on aligne occurred_at sur recorded_at et on '
  'pose payload.clock_skew = true. Le fait n''est JAMAIS rejete pour une horloge fausse.';
COMMENT ON COLUMN public.artisan_portal_actions.recorded_at IS
  'Horodatage pose par le serveur a l''enregistrement : fait foi pour l''audit.';
COMMENT ON COLUMN public.artisan_portal_actions.attachment_id IS
  'Volontairement sans cle etrangere : selon action_type, cible artisan_attachments '
  '(DOCUMENT_*, AVATAR_CHANGED, DECHARGE_SIGNED) ou intervention_attachments (PHOTO_UPLOADED).';
COMMENT ON COLUMN public.artisan_portal_actions.event_uid IS
  'Cle d''idempotence generee par le telephone : un rejeu hors ligne ne cree pas de doublon '
  '(index unique partiel). Unique PAR ARTISAN, pas globalement : le lookup d''idempotence des '
  'routes est (artisan_id, event_uid). Absente pour les evenements poses par le CRM.';
COMMENT ON COLUMN public.artisan_portal_actions.payload IS
  'Contexte denormalise a l''ecriture, pour que la ligne reste interpretable quand son objet '
  'disparait : payload.intervention (id, id_inter, adresse) et payload.actor (e-mail ou nom) '
  'au minimum, plus occurred_at_declared / clock_skew en cas d''horloge fausse.';

-- ---------------------------------------------------------------------
-- Securite : ALTER DEFAULT PRIVILEGES (00001:732-747) grante ALL a anon et a
-- authenticated sur toute table CREEE dans public. On revoque nominativement.
--
-- Immuabilite : un trigger BEFORE UPDATE **seulement** (correctif de revue, constat 16).
-- L'objection d'origine — « un trigger d'immuabilite rendrait impossible la suppression
-- d'une intervention » — ne vaut que pour DELETE, jamais pour UPDATE. Or service_role est
-- precisement le role de TOUTES les routes serveur qui ecrivent ce journal : sans garde,
-- « append-only » n'etait qu'une intention, et une ligne pouvait etre reecrite sans trace.
-- BEFORE UPDATE seul n'entre en conflit avec aucune FK ON DELETE.
-- ---------------------------------------------------------------------
ALTER TABLE public.artisan_portal_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.artisan_portal_actions;
DROP POLICY IF EXISTS "service_role full access"                  ON public.artisan_portal_actions;

CREATE POLICY "Allow read access for authenticated users"
  ON public.artisan_portal_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role full access"
  ON public.artisan_portal_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER  IF EXISTS trg_artisan_portal_actions_no_update ON public.artisan_portal_actions;
DROP FUNCTION IF EXISTS public.fn_artisan_portal_actions_no_update();
CREATE FUNCTION public.fn_artisan_portal_actions_no_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- SEULE ecriture toleree : la neutralisation d'une cle etrangere par ON DELETE SET NULL
  -- (intervention supprimee, rapport supprime, compte supprime). Elle ne peut que passer la
  -- colonne a NULL, jamais la changer de valeur, et ne touche a rien d'autre. Sans cette
  -- tolerance, le trigger rendrait la suppression d'une intervention IMPOSSIBLE — c'est
  -- l'objection d'origine, ici levee sans renoncer a l'immuabilite du contenu.
  IF NEW.id             IS DISTINCT FROM OLD.id
     OR NEW.artisan_id    IS DISTINCT FROM OLD.artisan_id
     OR NEW.source        IS DISTINCT FROM OLD.source
     OR NEW.action_type   IS DISTINCT FROM OLD.action_type
     OR NEW.attachment_id IS DISTINCT FROM OLD.attachment_id
     OR NEW.payload       IS DISTINCT FROM OLD.payload
     OR NEW.occurred_at   IS DISTINCT FROM OLD.occurred_at
     OR NEW.recorded_at   IS DISTINCT FROM OLD.recorded_at
     OR NEW.event_uid     IS DISTINCT FROM OLD.event_uid
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at
     OR (NEW.intervention_id IS DISTINCT FROM OLD.intervention_id AND NEW.intervention_id IS NOT NULL)
     OR (NEW.report_id       IS DISTINCT FROM OLD.report_id       AND NEW.report_id       IS NOT NULL)
     OR (NEW.actor_user_id   IS DISTINCT FROM OLD.actor_user_id   AND NEW.actor_user_id   IS NOT NULL)
  THEN
    RAISE EXCEPTION 'artisan_portal_actions est append-only : UPDATE interdit (ligne %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.fn_artisan_portal_actions_no_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_artisan_portal_actions_no_update
  BEFORE UPDATE ON public.artisan_portal_actions
  FOR EACH ROW EXECUTE FUNCTION public.fn_artisan_portal_actions_no_update();

REVOKE ALL ON public.artisan_portal_actions FROM anon;
-- REVOKE ALL puis GRANT SELECT, et non « REVOKE INSERT, UPDATE, DELETE » : ce dernier
-- laisserait TRUNCATE (qui ne passe par aucune policy RLS et viderait le journal) et
-- TRIGGER a authenticated.
REVOKE ALL ON public.artisan_portal_actions FROM authenticated;
GRANT  SELECT ON public.artisan_portal_actions TO authenticated;

-- Pas de ALTER PUBLICATION : le journal n'est pas publie en temps reel. Cela evite
-- d'alourdir le WAL logique (quota Presence deja a ~30 %) et supprime le piege
-- d'idempotence de « ALTER PUBLICATION … ADD TABLE » nu, qui echoue au rejeu
-- (duplicate_object) et sur une base sans publication. Si le besoin apparaissait,
-- reprendre le motif garde de 99077:17-34.
