-- Migration 99086 : exprimer « rapport d'artisan à vérifier » dans les chemins
-- de comptage et de tri serveur (vue « Mes vérifications »).
--
-- Contexte
-- --------
-- La puce « Mes vérifications » (entre « Market » et « Mes demandes ») liste les
-- interventions assignées à l'utilisateur dont un rapport portail est en attente
-- de vérification : `interventions.has_portal_report = true` (drapeau posé par le
-- trigger `trg_artisan_reports_sync_flag`, migration 99076) ET un statut pour
-- lequel le CRM affiche le badge violet « À vérifier ».
--
-- Piège évité (même que p_user_is_null en 99067) : un critère que la fonction de
-- comptage ne sait pas exprimer est silencieusement abandonné — la liste paraît
-- juste mais le compteur de la puce compte AVANT filtrage. On ajoute donc un
-- drapeau dédié à chacune des deux fonctions concernées :
--   * get_intervention_filter_counts : compteurs des puces statut/agence/métier
--     affichées à l'intérieur de la vue ;
--   * get_sorted_intervention_ids    : chemin de tri sur les colonnes de coûts,
--     qui pagine lui-même et court-circuite donc les filtres PostgREST.
--
-- Statuts de revue : ils sont ici désignés par leur CODE, en miroir de
-- `src/lib/interventions/portal-report-status.ts` (PORTAL_REPORT_REVIEW_STATUSES,
-- élargie à INTER_TERMINEE en vague 1). Un test unitaire compare les deux listes
-- pour interdire toute dérive.
--
-- Migration idempotente : DROP ... IF EXISTS puis CREATE (une signature qui
-- change doit être supprimée, sinon PostgreSQL crée une surcharge ambiguë).

-- ----------------------------------------------------------------------------
-- 0. Source de vérité SQL des statuts « À vérifier »
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_report_review_status_codes()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  -- Miroir de PORTAL_REPORT_REVIEW_STATUSES (src/lib/interventions/portal-report-status.ts)
  SELECT ARRAY['ACCEPTE', 'INTER_EN_COURS', 'SAV', 'INTER_TERMINEE']::TEXT[];
$$;

COMMENT ON FUNCTION public.portal_report_review_status_codes() IS
  'Statuts pour lesquels un rapport portail en attente est affiché « À vérifier ». Miroir de PORTAL_REPORT_REVIEW_STATUSES côté application.';

REVOKE ALL ON FUNCTION public.portal_report_review_status_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_report_review_status_codes() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Comptage des puces de filtre : drapeau p_has_portal_report
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT);

CREATE FUNCTION public.get_intervention_filter_counts(
  p_group_column TEXT,
  p_statut_id UUID DEFAULT NULL,
  p_agence_id UUID DEFAULT NULL,
  p_metier_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_is_null BOOLEAN DEFAULT FALSE,
  p_has_portal_report BOOLEAN DEFAULT FALSE,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
) RETURNS TABLE(group_value TEXT, cnt BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Valider le nom de colonne (protection injection SQL)
  IF p_group_column NOT IN ('metier_id', 'agence_id', 'statut_id', 'assigned_user_id') THEN
    RAISE EXCEPTION 'Colonne non autorisee: %', p_group_column;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT %I::TEXT, COUNT(*)
     FROM interventions
     WHERE is_active = true
       AND ($1 IS NULL OR statut_id = $1)
       AND ($2 IS NULL OR agence_id = $2)
       AND ($3 IS NULL OR metier_id = $3)
       AND (CASE WHEN $7 THEN assigned_user_id IS NULL
                 ELSE ($4 IS NULL OR assigned_user_id = $4) END)
       AND ($5 IS NULL OR date >= $5::DATE)
       AND ($6 IS NULL OR date <= $6::DATE)
       AND (NOT $8 OR (
             has_portal_report = true
             AND statut_id IN (
               SELECT s.id FROM intervention_statuses s
               WHERE s.code = ANY(public.portal_report_review_status_codes())
             )
           ))
       AND %I IS NOT NULL
     GROUP BY %I',
    p_group_column, p_group_column, p_group_column
  )
  USING p_statut_id, p_agence_id, p_metier_id, p_user_id, p_start_date, p_end_date,
        p_user_is_null, p_has_portal_report;
END;
$$;

COMMENT ON FUNCTION public.get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT) IS
  'Compteurs des puces de filtre. p_user_is_null = « non assignée » (99067), p_has_portal_report = « rapport à vérifier » (99086).';

-- Le DROP a retiré les grants : les restaurer explicitement (RPC appelé depuis le client).
GRANT EXECUTE ON FUNCTION public.get_intervention_filter_counts(TEXT, UUID, UUID, UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Tri serveur par colonne de coût : mêmes critères que la liste
-- ----------------------------------------------------------------------------
-- Ce RPC pagine lui-même (LIMIT/OFFSET) et renvoie total_count : le filtre doit
-- y être appliqué, sinon la vue triée par coût afficherait d'autres lignes que
-- la vue triée par date, avec un total différent.
DROP FUNCTION IF EXISTS public.get_sorted_intervention_ids(text, text, int, int, uuid[], uuid, uuid[], uuid, boolean, date, date);
DROP FUNCTION IF EXISTS public.get_sorted_intervention_ids(text, text, int, int, uuid[], uuid, uuid[], uuid, boolean, boolean, uuid[], date, date);

CREATE FUNCTION public.get_sorted_intervention_ids(
  p_sort_property text DEFAULT NULL,
  p_sort_dir text DEFAULT 'desc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  -- Filtres existants (optionnels)
  p_statut_ids uuid[] DEFAULT NULL,
  p_agence_id uuid DEFAULT NULL,
  p_metier_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_user_is_null boolean DEFAULT false,
  -- Vue « Mes vérifications » (99086)
  p_has_portal_report boolean DEFAULT false,
  p_portal_report_statut_ids uuid[] DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  intervention_id uuid,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_order_column text;
  v_order_asc boolean;
  v_needs_cost_join boolean := false;
  v_portal_statut_ids uuid[];
BEGIN
  -- Whitelist stricte : mapping propriété frontend → colonne DB
  v_order_column := CASE p_sort_property
    -- Colonnes directes table interventions
    WHEN 'date'              THEN 'i.created_at'
    WHEN 'created_at'        THEN 'i.created_at'
    WHEN 'dateIntervention'  THEN 'i.date'
    WHEN 'datePrevue'        THEN 'i.date_prevue'
    WHEN 'date_prevue'       THEN 'i.date_prevue'
    WHEN 'date_termine'      THEN 'i.date_termine'
    WHEN 'due_date'          THEN 'i.due_date'
    WHEN 'id_inter'          THEN 'i.id_inter'
    WHEN 'updated_at'        THEN 'i.updated_at'
    -- Colonnes via intervention_costs_cache
    WHEN 'coutIntervention'  THEN 'cc.total_ca'
    WHEN 'coutSST'           THEN 'cc.total_sst'
    WHEN 'coutMateriel'      THEN 'cc.total_materiel'
    WHEN 'marge'             THEN 'cc.total_marge'
    -- Défaut
    ELSE 'i.created_at'
  END;

  v_needs_cost_join := v_order_column LIKE 'cc.%';
  v_order_asc := COALESCE(p_sort_dir, 'desc') = 'asc';

  -- L'appelant fournit les statuts de revue déjà résolus ; sinon on retombe sur
  -- la source de vérité SQL pour ne jamais élargir le filtre par accident.
  IF p_has_portal_report THEN
    v_portal_statut_ids := COALESCE(
      p_portal_report_statut_ids,
      ARRAY(
        SELECT s.id FROM public.intervention_statuses s
        WHERE s.code = ANY(public.portal_report_review_status_codes())
      )
    );
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT i.id AS intervention_id, count(*) OVER() AS total_count
     FROM public.interventions i
     %s
     WHERE i.is_active = true
       %s %s %s %s %s %s %s
     ORDER BY %s %s NULLS LAST, i.id DESC
     LIMIT %s OFFSET %s',
    -- LEFT JOIN conditionnel
    CASE WHEN v_needs_cost_join
      THEN 'LEFT JOIN public.intervention_costs_cache cc ON cc.intervention_id = i.id'
      ELSE ''
    END,
    -- Filtres conditionnels
    CASE WHEN p_statut_ids IS NOT NULL
      THEN format('AND i.statut_id = ANY(%L::uuid[])', p_statut_ids)
      ELSE ''
    END,
    CASE WHEN p_agence_id IS NOT NULL
      THEN format('AND i.agence_id = %L', p_agence_id)
      ELSE ''
    END,
    CASE WHEN p_metier_ids IS NOT NULL
      THEN format('AND i.metier_id = ANY(%L::uuid[])', p_metier_ids)
      ELSE ''
    END,
    CASE WHEN p_user_is_null
      THEN 'AND i.assigned_user_id IS NULL'
      WHEN p_user_id IS NOT NULL
      THEN format('AND i.assigned_user_id = %L', p_user_id)
      ELSE ''
    END,
    CASE WHEN p_has_portal_report
      THEN format(
        'AND i.has_portal_report = true AND i.statut_id = ANY(%L::uuid[])',
        COALESCE(v_portal_statut_ids, ARRAY[]::uuid[])
      )
      ELSE ''
    END,
    CASE WHEN p_start_date IS NOT NULL
      THEN format('AND i.date >= %L', p_start_date)
      ELSE ''
    END,
    CASE WHEN p_end_date IS NOT NULL
      THEN format('AND i.date <= %L', p_end_date)
      ELSE ''
    END,
    -- ORDER BY
    v_order_column,
    CASE WHEN v_order_asc THEN 'ASC' ELSE 'DESC' END,
    -- LIMIT / OFFSET
    p_limit,
    p_offset
  );
END;
$$;

-- Permissions (identiques à 99022 : jamais exposé à anon).
-- REVOKE explicite : les DEFAULT PRIVILEGES Supabase accordent l'exécution de
-- toute nouvelle fonction à anon et authenticated.
REVOKE ALL ON FUNCTION public.get_sorted_intervention_ids(text, text, int, int, uuid[], uuid, uuid[], uuid, boolean, boolean, uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sorted_intervention_ids(text, text, int, int, uuid[], uuid, uuid[], uuid, boolean, boolean, uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sorted_intervention_ids(text, text, int, int, uuid[], uuid, uuid[], uuid, boolean, boolean, uuid[], date, date) TO service_role;
