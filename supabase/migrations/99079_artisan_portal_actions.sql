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
-- IDEMPOTENTE ET REJOUABLE.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.artisan_portal_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Acteur : jamais nul des deux cotes a la fois (lecon d'artisan_audit_log, 92 % sans acteur).
  artisan_id      UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL, -- rempli si source='crm'
  source          TEXT NOT NULL DEFAULT 'portal'
                  CHECK (source IN ('portal','crm')),

  -- Objet
  intervention_id UUID REFERENCES public.interventions(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_artisan_portal_actions_event_uid
  ON public.artisan_portal_actions(event_uid) WHERE event_uid IS NOT NULL;
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
  '(index unique partiel). Absente pour les evenements poses par le CRM.';

-- ---------------------------------------------------------------------
-- Securite : ALTER DEFAULT PRIVILEGES (00001:732-747) grante ALL a anon et a
-- authenticated sur toute table CREEE dans public. On revoque nominativement.
--
-- Immuabilite APPLICATIVE, volontairement sans trigger : un
-- BEFORE UPDATE OR DELETE … RAISE EXCEPTION combine aux FK ON DELETE CASCADE de
-- cette meme table rendrait IMPOSSIBLE la suppression d'un artisan ou d'une
-- intervention — pour tout le monde, service_role compris — alors que le CRM
-- supprime reellement des interventions.
-- ---------------------------------------------------------------------
ALTER TABLE public.artisan_portal_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.artisan_portal_actions;
DROP POLICY IF EXISTS "service_role full access"                  ON public.artisan_portal_actions;

CREATE POLICY "Allow read access for authenticated users"
  ON public.artisan_portal_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role full access"
  ON public.artisan_portal_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

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
