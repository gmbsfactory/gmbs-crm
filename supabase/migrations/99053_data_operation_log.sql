-- ============================================================================
-- 99053 — Socle « opérations de données » (import / export) — PHASE 1 / socle DB
-- ----------------------------------------------------------------------------
-- Chantier Monitoring Dev V3 : un import/export est un ACTE HUMAIN UNIQUE
-- (« Harold a importé 5 000 lignes à 14h32 »), distinct des milliers d'écritures
-- SYSTÈME qu'il génère. Cette migration pose UNIQUEMENT le socle, additif et
-- réversible :
--   1. table `data_operation_log`  (le journal des opérations globales)
--   2. colonne `operation_id`       sur intervention_audit_log + status_transitions
--   3. extension de la contrainte `source` des transitions à 'import'
--
-- Elle NE MODIFIE AUCUNE LOGIQUE (triggers, route import, RPC) : ces étapes
-- viennent dans des migrations/PR ultérieures, après validation.
-- Aucune donnée historique n'est touchée.
-- ============================================================================

-- ── 1) Journal des opérations de données globales ───────────────────────────
-- Volontairement HORS intervention_audit_log : cette dernière impose
-- intervention_id NOT NULL (00037), or un import/export ne cible aucune
-- intervention précise. C'est une opération de périmètre « système ».
CREATE TABLE IF NOT EXISTS public.data_operation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  operation_type  text NOT NULL CHECK (operation_type IN (
                    'IMPORT_INTERVENTIONS', 'EXPORT_INTERVENTIONS'
                  )),
  resource_type   text NOT NULL DEFAULT 'interventions',

  -- L'humain qui a lancé l'opération (légitime : c'est l'acte qu'on veut tracer).
  -- FK en SET NULL, mais le snapshot ci-dessous préserve « Harold a importé… »
  -- même si l'utilisateur est renommé ou supprimé plus tard (comme l'audit log).
  actor_user_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_display   text,
  actor_code      text,
  actor_color     text,

  status          text NOT NULL DEFAULT 'running' CHECK (status IN (
                    'running', 'success', 'failed', 'cancelled'
                  )),

  -- Spécifique import
  file_name       text,
  file_hash       text,        -- détecte les ré-imports du même fichier
  mode            text CHECK (mode IS NULL OR mode IN ('create', 'update', 'upsert')),
  dry_run         boolean,

  -- Compteurs (import : volumétrie réelle ; export : total_count = lignes sorties).
  -- CHECK : jamais négatif quand renseigné.
  total_count     integer CHECK (total_count    IS NULL OR total_count    >= 0),
  inserted_count  integer CHECK (inserted_count IS NULL OR inserted_count >= 0),
  updated_count   integer CHECK (updated_count  IS NULL OR updated_count  >= 0),
  skipped_count   integer CHECK (skipped_count  IS NULL OR skipped_count  >= 0),
  error_count     integer CHECK (error_count    IS NULL OR error_count    >= 0),

  -- Filtres (export : période, gestionnaires, mode étendu…) + détails non sensibles.
  -- NE JAMAIS stocker le CSV brut ni de données personnelles ici.
  filters         jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,

  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_operation_log IS
  'Journal des opérations de données globales (import/export). Un acte humain = une ligne ; les écritures métier générées restent attribuées au système (actor NULL, source=''import'').';

CREATE INDEX IF NOT EXISTS idx_data_operation_log_started_at
  ON public.data_operation_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_operation_log_actor
  ON public.data_operation_log(actor_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_operation_log_type
  ON public.data_operation_log(operation_type, started_at DESC);

-- RLS : même posture que intervention_audit_log → aucune lecture client directe.
-- Le Monitoring lira via une RPC SECURITY DEFINER (UNION, étape ultérieure) ;
-- la route import écrira sous service_role (qui bypasse la RLS).
ALTER TABLE public.data_operation_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.data_operation_log TO service_role;

-- ── 2) Rattachement des écritures à leur opération (lignée dossier → import) ──
-- Colonne structurée (indexable), nullable : 100 % rétro-compatible.
ALTER TABLE public.intervention_audit_log
  ADD COLUMN IF NOT EXISTS operation_id uuid
  REFERENCES public.data_operation_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_operation_id
  ON public.intervention_audit_log(operation_id) WHERE operation_id IS NOT NULL;

ALTER TABLE public.intervention_status_transitions
  ADD COLUMN IF NOT EXISTS operation_id uuid
  REFERENCES public.data_operation_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ist_operation_id
  ON public.intervention_status_transitions(operation_id) WHERE operation_id IS NOT NULL;

-- ── 3) Autoriser source='import' sur les transitions de statut ───────────────
-- intervention_audit_log.source autorise déjà 'import' (00037) ; les transitions
-- étaient limitées à ('api','trigger') (00010). On élargit sans rien réécrire.
ALTER TABLE public.intervention_status_transitions
  DROP CONSTRAINT IF EXISTS intervention_status_transitions_source_check;
ALTER TABLE public.intervention_status_transitions
  ADD CONSTRAINT intervention_status_transitions_source_check
  CHECK (source IN ('api', 'trigger', 'import'));
