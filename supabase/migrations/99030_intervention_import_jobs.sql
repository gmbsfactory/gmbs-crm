-- ============================================================================
-- Pipeline d'import CSV asynchrone — table d'état des jobs
-- ============================================================================
-- Source de vérité d'un import CSV d'interventions, observée par le client via
-- Supabase Realtime. Permet : suivi de progression, survie à la fermeture
-- d'onglet, historique, annulation.
--
-- Slice vertical (cf. docs/architecture/imports-async.md, ADR-5) :
--   - le CSV et le résultat sont stockés en base (PAS dans un bucket Storage),
--     mais dans une table SIDECAR `intervention_import_job_data` distincte ;
--   - le worker est une route Next.js nodejs réutilisant `runImport()` TS,
--     PAS une Edge Function Deno ;
--   - heartbeat / reprise sur timeout : reportés (non couverts ici).
--
-- IMPORTANT — séparation jobs / data :
-- La table `intervention_import_jobs` est publiée sur Realtime, donc CHAQUE
-- UPDATE rediffuse la ligne entière au client abonné. Les colonnes lourdes
-- (`csv_content` jusqu'à 10 Mo, `result`/`preview` jusqu'à 10 000 lignes en
-- dry-run) DOIVENT donc rester hors de cette table : sinon chaque tick de
-- progression rediffuserait des Mo, et le message terminal dépasserait la
-- limite de taille Realtime (~256 Ko) → événement perdu. On les isole dans
-- `intervention_import_job_data` (NON publiée). La table jobs reste légère :
-- statut, stage, compteurs.
--
-- Cette migration n'altère aucun comportement existant : l'endpoint synchrone
-- `POST /api/imports/interventions` reste le seul chemin actif jusqu'à la
-- bascule UI (PR-3).
-- ============================================================================

CREATE TYPE import_job_status AS ENUM
  ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS public.intervention_import_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by     uuid NOT NULL REFERENCES auth.users(id),

  -- Entrée (légère — diffusée sur Realtime)
  mode           text NOT NULL CHECK (mode IN ('create', 'update', 'upsert')),
  dry_run        boolean NOT NULL DEFAULT false,
  resolutions    jsonb,                                  -- arbitrages de conflits (Phase B, petit)

  -- État
  status         import_job_status NOT NULL DEFAULT 'pending',
  stage          text,                                   -- parsing | validating | lookup | persisting
  total_rows     int,
  processed_rows int NOT NULL DEFAULT 0,
  inserted_rows  int NOT NULL DEFAULT 0,
  updated_rows   int NOT NULL DEFAULT 0,
  failed_rows    int NOT NULL DEFAULT 0,
  error_message  text,                                   -- erreur fatale (court)

  -- Audit
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Sidecar NON publiée sur Realtime : porte les données volumineuses (entrée +
-- sortie) pour garder la table jobs légère. 1:1 avec le job, cascade à la
-- suppression.
CREATE TABLE IF NOT EXISTS public.intervention_import_job_data (
  job_id       uuid PRIMARY KEY
               REFERENCES public.intervention_import_jobs(id) ON DELETE CASCADE,
  csv_content  text NOT NULL,                            -- contenu brut du CSV (entrée)
  result       jsonb,                                    -- ImportResponse complet (sortie)
  preview      jsonb                                     -- ImportResponse.preview (dry-run)
);

-- Historique par utilisateur (liste « mes imports », tri antéchronologique).
CREATE INDEX IF NOT EXISTS idx_iij_created_by_created_at
  ON public.intervention_import_jobs (created_by, created_at DESC);

-- Jobs encore actifs (claim worker, détection de jobs en cours).
CREATE INDEX IF NOT EXISTS idx_iij_active_status
  ON public.intervention_import_jobs (status)
  WHERE status IN ('pending', 'running');

-- updated_at auto sur chaque UPDATE (progression worker, transitions d'état).
CREATE OR REPLACE FUNCTION public.set_intervention_import_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_iij_updated_at
  BEFORE UPDATE ON public.intervention_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_intervention_import_jobs_updated_at();

-- ============================================================================
-- RLS — chaque utilisateur ne voit/écrit que ses propres jobs (doc §9).
-- Le worker écrit via le client service-role (bypass RLS) ; ces policies
-- couvrent l'accès client / SSR (abonnement Realtime, historique, annulation).
-- ============================================================================

ALTER TABLE public.intervention_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY iij_select ON public.intervention_import_jobs
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY iij_insert ON public.intervention_import_jobs
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY iij_update ON public.intervention_import_jobs
  FOR UPDATE USING (created_by = auth.uid());

-- Sidecar : même règle d'appartenance, via le job parent. L'utilisateur peut
-- lire (réaffichage du résultat/preview) et insérer (création du job) ses
-- propres données. Les écritures de sortie (`result`/`preview`) passent par le
-- worker en service-role (bypass RLS).
ALTER TABLE public.intervention_import_job_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY iijd_select ON public.intervention_import_job_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.intervention_import_jobs j
      WHERE j.id = intervention_import_job_data.job_id
        AND j.created_by = auth.uid()
    )
  );

CREATE POLICY iijd_insert ON public.intervention_import_job_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intervention_import_jobs j
      WHERE j.id = intervention_import_job_data.job_id
        AND j.created_by = auth.uid()
    )
  );

-- ============================================================================
-- Realtime (pattern migration 99016). SEULE la table jobs (légère) est publiée.
-- La sidecar `intervention_import_job_data` ne l'est volontairement PAS.
-- REPLICA IDENTITY FULL pour que les UPDATE de progression diffusent la ligne
-- complète au client abonné.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_import_jobs;
ALTER TABLE public.intervention_import_jobs REPLICA IDENTITY FULL;
