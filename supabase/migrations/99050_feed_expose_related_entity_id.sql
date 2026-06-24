-- ========================================
-- Flux global : exposer related_entity_id
-- ----------------------------------------
-- Un COST_UPDATE ne journalise que le champ modifié (ex. { amount }), pas le
-- cost_type. Pour afficher le type de coût (SST / Matériel / …) côté monitoring,
-- on doit pouvoir remonter à la ligne intervention_costs via son id, qui n'était
-- pas exposé par get_global_activity_feed. On l'ajoute (related_entity_id) — sert
-- aussi pour résoudre l'artisan d'un coût, etc.
-- Basé sur la version 99043 (libellé = id_inter, fallback INT-<uuid>) + 1 champ.
-- ========================================
CREATE OR REPLACE FUNCTION public.get_global_activity_feed(
  p_date_start    timestamptz,
  p_date_end      timestamptz,
  p_user_ids      uuid[]  DEFAULT NULL,
  p_action_types  text[]  DEFAULT NULL,
  p_entity_types  text[]  DEFAULT NULL,
  p_limit         int     DEFAULT 200,
  p_offset        int     DEFAULT 0
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

  WITH feed AS (
    SELECT
      ial.id,
      ial.action_type,
      'intervention'::text AS entity_type,
      ial.intervention_id AS entity_id,
      COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8)) AS entity_label,
      jsonb_build_object(
        'id_inter',     i.id_inter,
        'date',         i.date,
        'statut_code',  ist.code,
        'statut_label', ist.label,
        'statut_color', ist.color
      ) AS entity_meta,
      ial.actor_user_id,
      ial.actor_display,
      ial.actor_code,
      ial.actor_color,
      ial.occurred_at,
      ial.changed_fields,
      ial.old_values,
      ial.new_values,
      ial.related_entity_id
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i ON i.id = ial.intervention_id
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE ial.occurred_at >= p_date_start
      AND ial.occurred_at <= p_date_end

    UNION ALL

    SELECT
      aal.id,
      aal.action_type,
      'artisan'::text AS entity_type,
      aal.artisan_id AS entity_id,
      COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) AS entity_label,
      jsonb_build_object(
        'nom',           a.nom,
        'prenom',        a.prenom,
        'raison_sociale', a.raison_sociale,
        'statut_code',   ast.code,
        'statut_label',  ast.label,
        'statut_color',  ast.color
      ) AS entity_meta,
      aal.actor_user_id,
      aal.actor_display,
      aal.actor_code,
      aal.actor_color,
      aal.occurred_at,
      aal.changed_fields,
      aal.old_values,
      aal.new_values,
      aal.related_entity_id
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a ON a.id = aal.artisan_id
    LEFT JOIN public.artisan_statuses ast ON ast.id = a.statut_id
    WHERE aal.occurred_at >= p_date_start
      AND aal.occurred_at <= p_date_end
  ),
  filtered AS (
    SELECT *
    FROM feed
    WHERE (p_user_ids     IS NULL OR actor_user_id = ANY(p_user_ids))
      AND (p_action_types IS NULL OR action_type   = ANY(p_action_types))
      AND (p_entity_types IS NULL OR entity_type    = ANY(p_entity_types))
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',                f.id,
        'action_type',       f.action_type,
        'entity_type',       f.entity_type,
        'entity_id',         f.entity_id,
        'entity_label',      f.entity_label,
        'entity_meta',       f.entity_meta,
        'occurred_at',       f.occurred_at,
        'changed_fields',    f.changed_fields,
        'old_values',        f.old_values,
        'new_values',        f.new_values,
        'related_entity_id', f.related_entity_id,
        'actor', jsonb_build_object(
          'user_id', f.actor_user_id,
          'display', f.actor_display,
          'code',    f.actor_code,
          'color',   f.actor_color
        )
      ) ORDER BY f.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT *
        FROM filtered
        ORDER BY occurred_at DESC
        LIMIT GREATEST(p_limit, 0)
        OFFSET GREATEST(p_offset, 0)
      ) f
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated;

COMMENT ON FUNCTION public.get_global_activity_feed IS
  'Flux global des actions (interventions + artisans) sur une periode, avec auteur, related_entity_id, filtres et pagination. Reserve au role dev.';
