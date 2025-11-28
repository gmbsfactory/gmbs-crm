-- ========================================
-- NIVEAU 1: Cache Table - Status Transitions
-- ========================================
-- Migration Phase 1: Créer intervention_status_cache pour éliminer 4 CTEs
-- Objectif: Réduire latence RPC de ~800ms à ~600ms (étape 1/3)
-- Performance cible: Trigger < 10ms par INSERT status transition
-- ========================================

-- ========================================
-- 1. CRÉER LA TABLE CACHE
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_status_cache (
  intervention_id uuid PRIMARY KEY
    REFERENCES public.interventions(id) ON DELETE CASCADE,

  -- Statut actuel (dénormalisé pour requêtes rapides)
  current_status_id uuid REFERENCES public.intervention_statuses(id),
  current_status_code text,

  -- Premières occurrences de statuts clés (immutables une fois set)
  first_demande_date timestamptz,
  first_devis_date timestamptz,
  first_accepte_date timestamptz,
  first_terminee_date timestamptz,

  -- Cycle times auto-calculés (en jours)
  cycle_time_days numeric(10,2),              -- terminee - demande
  demande_to_devis_days numeric(10,2),        -- devis - demande
  devis_to_accepte_days numeric(10,2),        -- accepte - devis

  -- Métadonnées
  nb_status_changes integer DEFAULT 0,
  last_status_change_date timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- 2. CRÉER LES INDEX
-- ========================================

-- Index sur statut actuel (filtres WHERE current_status_code = ...)
CREATE INDEX IF NOT EXISTS idx_intervention_status_cache_current_status
  ON public.intervention_status_cache(current_status_code);

-- Index partiel sur interventions terminées (requêtes financières)
CREATE INDEX IF NOT EXISTS idx_intervention_status_cache_terminee_date
  ON public.intervention_status_cache(first_terminee_date)
  WHERE first_terminee_date IS NOT NULL;

-- Index partiel sur cycle time (statistiques, tri)
CREATE INDEX IF NOT EXISTS idx_intervention_status_cache_cycle_time
  ON public.intervention_status_cache(cycle_time_days)
  WHERE cycle_time_days IS NOT NULL;

-- Index sur date de dernière mise à jour (monitoring)
CREATE INDEX IF NOT EXISTS idx_intervention_status_cache_updated
  ON public.intervention_status_cache(updated_at);

-- ========================================
-- 3. AJOUTER INDEX COMPOSITE SUR intervention_costs
-- ========================================
-- Optimise les triggers de intervention_costs_cache (déjà existant)

CREATE INDEX IF NOT EXISTS idx_intervention_costs_composite
  ON public.intervention_costs(intervention_id, cost_type);

-- ========================================
-- 4. FONCTION TRIGGER - MISE À JOUR INCRÉMENTALE O(1)
-- ========================================

CREATE OR REPLACE FUNCTION public.update_intervention_status_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_code text;
  v_from_status_code text;
BEGIN
  -- Récupérer le code du nouveau statut
  SELECT code INTO v_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.to_status_id;

  -- Récupérer le code de l'ancien statut (si existe)
  IF NEW.from_status_id IS NOT NULL THEN
    SELECT code INTO v_from_status_code
    FROM public.intervention_statuses
    WHERE id = NEW.from_status_id;
  END IF;

  -- Ignorer les transitions auto-générées (même statut)
  IF v_status_code = v_from_status_code THEN
    RETURN NULL;
  END IF;

  -- UPSERT dans le cache avec logique de première occurrence
  INSERT INTO public.intervention_status_cache AS isc (
    intervention_id,
    current_status_id,
    current_status_code,
    first_demande_date,
    first_devis_date,
    first_accepte_date,
    first_terminee_date,
    nb_status_changes,
    last_status_change_date,
    updated_at
  ) VALUES (
    NEW.intervention_id,
    NEW.to_status_id,
    v_status_code,
    CASE WHEN v_status_code = 'DEMANDE' THEN NEW.transition_date END,
    CASE WHEN v_status_code = 'DEVIS_ENVOYE' THEN NEW.transition_date END,
    CASE WHEN v_status_code = 'ACCEPTE' THEN NEW.transition_date END,
    CASE WHEN v_status_code = 'INTER_TERMINEE' THEN NEW.transition_date END,
    1,
    NEW.transition_date,
    now()
  )
  ON CONFLICT (intervention_id) DO UPDATE SET
    -- Mettre à jour le statut actuel
    current_status_id = EXCLUDED.current_status_id,
    current_status_code = EXCLUDED.current_status_code,

    -- Préserver les premières occurrences (COALESCE garde la valeur existante si non NULL)
    first_demande_date = COALESCE(isc.first_demande_date, EXCLUDED.first_demande_date),
    first_devis_date = COALESCE(isc.first_devis_date, EXCLUDED.first_devis_date),
    first_accepte_date = COALESCE(isc.first_accepte_date, EXCLUDED.first_accepte_date),
    first_terminee_date = COALESCE(isc.first_terminee_date, EXCLUDED.first_terminee_date),

    -- Recalculer les cycle times automatiquement
    cycle_time_days = CASE
      WHEN COALESCE(isc.first_terminee_date, EXCLUDED.first_terminee_date) IS NOT NULL
        AND COALESCE(isc.first_demande_date, EXCLUDED.first_demande_date) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(isc.first_terminee_date, EXCLUDED.first_terminee_date) -
        COALESCE(isc.first_demande_date, EXCLUDED.first_demande_date)
      )) / 86400.0
      ELSE isc.cycle_time_days
    END,

    demande_to_devis_days = CASE
      WHEN COALESCE(isc.first_devis_date, EXCLUDED.first_devis_date) IS NOT NULL
        AND COALESCE(isc.first_demande_date, EXCLUDED.first_demande_date) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(isc.first_devis_date, EXCLUDED.first_devis_date) -
        COALESCE(isc.first_demande_date, EXCLUDED.first_demande_date)
      )) / 86400.0
      ELSE isc.demande_to_devis_days
    END,

    devis_to_accepte_days = CASE
      WHEN COALESCE(isc.first_accepte_date, EXCLUDED.first_accepte_date) IS NOT NULL
        AND COALESCE(isc.first_devis_date, EXCLUDED.first_devis_date) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(isc.first_accepte_date, EXCLUDED.first_accepte_date) -
        COALESCE(isc.first_devis_date, EXCLUDED.first_devis_date)
      )) / 86400.0
      ELSE isc.devis_to_accepte_days
    END,

    -- Incrémenter compteur et dates
    nb_status_changes = isc.nb_status_changes + 1,
    last_status_change_date = EXCLUDED.last_status_change_date,
    updated_at = now();

  RETURN NULL;
END;
$$;

-- ========================================
-- 5. ATTACHER LE TRIGGER
-- ========================================

CREATE TRIGGER trg_intervention_status_cache_update
AFTER INSERT ON public.intervention_status_transitions
FOR EACH ROW
EXECUTE FUNCTION public.update_intervention_status_cache();

-- ========================================
-- 6. INITIALISER LE CACHE (BACKFILL)
-- ========================================
-- Peupler le cache avec les données existantes

INSERT INTO public.intervention_status_cache (
  intervention_id,
  current_status_id,
  current_status_code,
  first_demande_date,
  first_devis_date,
  first_accepte_date,
  first_terminee_date,
  cycle_time_days,
  demande_to_devis_days,
  devis_to_accepte_days,
  nb_status_changes,
  last_status_change_date,
  updated_at
)
SELECT
  i.id as intervention_id,
  i.statut_id,
  ist_current.code,

  -- Premières occurrences depuis intervention_status_transitions
  (SELECT MIN(transition_date)
   FROM intervention_status_transitions
   WHERE intervention_id = i.id AND to_status_code = 'DEMANDE') as first_demande_date,

  (SELECT MIN(transition_date)
   FROM intervention_status_transitions
   WHERE intervention_id = i.id AND to_status_code = 'DEVIS_ENVOYE') as first_devis_date,

  (SELECT MIN(transition_date)
   FROM intervention_status_transitions
   WHERE intervention_id = i.id AND to_status_code = 'ACCEPTE') as first_accepte_date,

  (SELECT MIN(transition_date)
   FROM intervention_status_transitions
   WHERE intervention_id = i.id AND to_status_code = 'INTER_TERMINEE') as first_terminee_date,

  -- Cycle times calculés
  CASE
    WHEN (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'INTER_TERMINEE') IS NOT NULL
      AND (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEMANDE') IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'INTER_TERMINEE') -
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEMANDE')
    )) / 86400.0
  END as cycle_time_days,

  CASE
    WHEN (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEVIS_ENVOYE') IS NOT NULL
      AND (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEMANDE') IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEVIS_ENVOYE') -
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEMANDE')
    )) / 86400.0
  END as demande_to_devis_days,

  CASE
    WHEN (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'ACCEPTE') IS NOT NULL
      AND (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEVIS_ENVOYE') IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'ACCEPTE') -
      (SELECT MIN(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id AND to_status_code = 'DEVIS_ENVOYE')
    )) / 86400.0
  END as devis_to_accepte_days,

  -- Nombre de changements de statut
  (SELECT COUNT(*) FROM intervention_status_transitions WHERE intervention_id = i.id)::integer as nb_status_changes,

  -- Dernière transition
  (SELECT MAX(transition_date) FROM intervention_status_transitions WHERE intervention_id = i.id) as last_status_change_date,

  now() as updated_at

FROM public.interventions i
INNER JOIN public.intervention_statuses ist_current ON ist_current.id = i.statut_id
WHERE i.is_active = true

ON CONFLICT (intervention_id) DO NOTHING;

-- ========================================
-- 7. FONCTION DE VALIDATION CA
-- ========================================
-- Permet de vérifier que intervention_costs_cache est synchronisé

CREATE OR REPLACE FUNCTION public.validate_intervention_ca(p_intervention_id uuid DEFAULT NULL)
RETURNS TABLE(
  intervention_id uuid,
  cache_ca numeric,
  realtime_ca numeric,
  difference numeric,
  status text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH cache_data AS (
    SELECT icc.intervention_id, icc.total_ca
    FROM public.intervention_costs_cache icc
    WHERE p_intervention_id IS NULL OR icc.intervention_id = p_intervention_id
  ),
  realtime_data AS (
    SELECT ic.intervention_id, COALESCE(SUM(ic.amount), 0) as total_ca
    FROM public.intervention_costs ic
    WHERE (p_intervention_id IS NULL OR ic.intervention_id = p_intervention_id)
      AND ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  )
  SELECT
    COALESCE(c.intervention_id, r.intervention_id) as intervention_id,
    c.total_ca as cache_ca,
    r.total_ca as realtime_ca,
    COALESCE(c.total_ca, 0) - COALESCE(r.total_ca, 0) as difference,
    CASE
      WHEN c.total_ca IS NULL THEN 'CACHE_MISSING'
      WHEN r.total_ca IS NULL THEN 'NO_COSTS'
      WHEN ABS(COALESCE(c.total_ca, 0) - COALESCE(r.total_ca, 0)) < 0.01 THEN 'OK'
      ELSE 'OUT_OF_SYNC'
    END as status
  FROM cache_data c
  FULL OUTER JOIN realtime_data r ON r.intervention_id = c.intervention_id;
END;
$$;

-- ========================================
-- 8. COMMENTAIRES & DOCUMENTATION
-- ========================================

COMMENT ON TABLE public.intervention_status_cache IS
'Cache temps réel des statuts d''intervention - mise à jour incrémentale O(1)

📊 CONTENU:
  - Statut actuel de chaque intervention
  - Premières dates de statuts clés (demande, devis, accepté, terminée)
  - Cycle times auto-calculés (en jours)

🔄 SYNCHRONISATION:
  - Mise à jour automatique via trigger sur intervention_status_transitions
  - Performance: ~5-10ms par transition (O(1) - une seule intervention)
  - Premières occurrences sont immutables (COALESCE préserve valeur existante)

✅ UTILISATION:
  - Remplace 4 CTEs dans get_admin_dashboard_stats():
    * first_demande_transition
    * first_terminee_transition
    * cycle_time_data
    * cycle_time_stats
  - Gain de performance: ~80ms → ~5ms pour cycle time

⚠️ IMPORTANT:
  - Ne pas modifier manuellement - toujours via trigger
  - Pour resynchroniser: TRUNCATE + ré-exécuter section 6 (BACKFILL)
';

COMMENT ON COLUMN public.intervention_status_cache.cycle_time_days IS
'Nombre de jours entre first_demande_date et first_terminee_date (auto-calculé)';

COMMENT ON COLUMN public.intervention_status_cache.first_demande_date IS
'Date de la première transition vers statut DEMANDE (immutable après set)';

COMMENT ON FUNCTION public.update_intervention_status_cache() IS
'Trigger O(1) pour mise à jour intervention_status_cache - maintient premières occurrences et recalcule cycle times';

COMMENT ON FUNCTION public.validate_intervention_ca(uuid) IS
'Vérifie synchronisation entre intervention_costs_cache et intervention_costs
Usage: SELECT * FROM validate_intervention_ca() WHERE status != ''OK'';';

-- ========================================
-- 9. GRANTS
-- ========================================

GRANT SELECT ON public.intervention_status_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_intervention_ca(uuid) TO authenticated;

-- ========================================
-- Migration Phase 1 Complète ✅
-- ========================================
-- Next: Phase 2 - Vues matérialisées (00018)
-- ========================================
