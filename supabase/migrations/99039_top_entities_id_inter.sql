-- ============================================================
-- Migration 99039: get_top_entities → libellé dossier = id_inter (pas RF agence)
--
-- Le libellé des dossiers "intervention" utilisait `reference_agence` (référence
-- agence externe, souvent nulle) au lieu du vrai numéro de dossier `id_inter`.
-- On bascule sur id_inter, avec un identifiant provisoire (INT-<8 car. de l'uuid>)
-- quand id_inter est nul. CREATE OR REPLACE — même signature, seul le libellé
-- intervention change (les artisans gardent raison sociale / nom).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_top_entities(
  p_date_start timestamptz,
  p_date_end   timestamptz,
  p_limit      int    DEFAULT 10,
  p_user_ids   uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.user_has_role('dev') THEN
    RAISE EXCEPTION 'forbidden: dev role required' USING errcode = '42501';
  END IF;

  WITH base AS (
    SELECT 'intervention'::text AS entity_type, ial.intervention_id AS entity_id,
           COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8)) AS label,
           ial.occurred_at, ial.action_type,
           ial.actor_user_id, ial.actor_display, ial.actor_color
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i ON i.id = ial.intervention_id
    WHERE ial.occurred_at >= p_date_start AND ial.occurred_at <= p_date_end
    UNION ALL
    SELECT 'artisan'::text, aal.artisan_id,
           COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)), aal.occurred_at, aal.action_type,
           aal.actor_user_id, aal.actor_display, aal.actor_color
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a ON a.id = aal.artisan_id
    WHERE aal.occurred_at >= p_date_start AND aal.occurred_at <= p_date_end
  ),
  filtered AS (
    SELECT * FROM base WHERE (p_user_ids IS NULL OR actor_user_id = ANY(p_user_ids))
  ),
  agg AS (
    SELECT entity_type, entity_id, MAX(label) AS label, COUNT(*) AS cnt, MAX(occurred_at) AS last_at
    FROM filtered GROUP BY entity_type, entity_id
    ORDER BY cnt DESC
    LIMIT GREATEST(p_limit, 0)
  ),
  last_row AS (
    SELECT DISTINCT ON (f.entity_type, f.entity_id)
      f.entity_type, f.entity_id, f.action_type AS last_action_type,
      f.actor_user_id AS last_actor_id, f.actor_display AS last_actor_display, f.actor_color AS last_actor_color
    FROM filtered f
    JOIN agg ON agg.entity_type = f.entity_type AND agg.entity_id = f.entity_id
    ORDER BY f.entity_type, f.entity_id, f.occurred_at DESC
  ),
  mix AS (
    SELECT t.entity_type, t.entity_id,
      jsonb_agg(jsonb_build_object('actor_user_id', t.actor_user_id, 'color', t.actor_color, 'count', t.c)
                ORDER BY t.c DESC) AS actors
    FROM (
      SELECT f.entity_type, f.entity_id, f.actor_user_id, MAX(f.actor_color) AS actor_color, COUNT(*) AS c
      FROM filtered f
      JOIN agg ON agg.entity_type = f.entity_type AND agg.entity_id = f.entity_id
      GROUP BY f.entity_type, f.entity_id, f.actor_user_id
    ) t
    GROUP BY t.entity_type, t.entity_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entity_type',     a.entity_type,
    'entity_id',       a.entity_id,
    'entity_label',    a.label,
    'count',           a.cnt,
    'last_action_at',  a.last_at,
    'last_action_type', l.last_action_type,
    'last_actor', jsonb_build_object('user_id', l.last_actor_id, 'display', l.last_actor_display, 'color', l.last_actor_color),
    'actors',          m.actors
  ) ORDER BY a.cnt DESC), '[]'::jsonb)
  INTO result
  FROM agg a
  LEFT JOIN last_row l ON l.entity_type = a.entity_type AND l.entity_id = a.entity_id
  LEFT JOIN mix m ON m.entity_type = a.entity_type AND m.entity_id = a.entity_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_entities(timestamptz, timestamptz, int, uuid[]) TO authenticated;
