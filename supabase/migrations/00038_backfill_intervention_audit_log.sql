-- ========================================
-- Backfill intervention audit log (idempotent)
-- ========================================

-- 1) CREATE events from interventions
INSERT INTO public.intervention_audit_log (
  intervention_id,
  actor_user_id, actor_display, actor_code, actor_color,
  action_type,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  i.id,
  u.id,
  COALESCE(NULLIF(BTRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, u.email, 'system'),
  u.code_gestionnaire,
  u.color,
  'CREATE',
  to_jsonb(i),
  'backfill',
  COALESCE(i.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_interventions')
FROM public.interventions i
LEFT JOIN public.users u ON u.id = COALESCE(i.created_by, i.updated_by)
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.intervention_id = i.id
    AND a.action_type = 'CREATE'
);

-- 2) STATUS_CHANGE events from intervention_status_transitions
INSERT INTO public.intervention_audit_log (
  intervention_id,
  actor_user_id, actor_display, actor_code, actor_color,
  action_type,
  related_entity_type, related_entity_id,
  status_transition_id,
  old_values, new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  t.intervention_id,
  u.id,
  COALESCE(NULLIF(BTRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, u.email, 'system'),
  u.code_gestionnaire,
  u.color,
  'STATUS_CHANGE',
  'status_transition', t.id,
  t.id,
  jsonb_build_object('status_code', t.from_status_code, 'status_id', t.from_status_id),
  jsonb_build_object('status_code', t.to_status_code, 'status_id', t.to_status_id),
  'backfill',
  COALESCE(t.transition_date, now()),
  COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object('backfill_reason', 'historical_transitions', 'original_source', t.source)
FROM public.intervention_status_transitions t
LEFT JOIN public.users u ON u.id = t.changed_by_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.status_transition_id = t.id
);

-- 3) COST_ADD events from intervention_costs
INSERT INTO public.intervention_audit_log (
  intervention_id,
  action_type,
  related_entity_type, related_entity_id,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  c.intervention_id,
  'COST_ADD',
  'cost', c.id,
  to_jsonb(c),
  'backfill',
  COALESCE(c.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_costs')
FROM public.intervention_costs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.related_entity_type = 'cost'
    AND a.related_entity_id = c.id
    AND a.action_type = 'COST_ADD'
);

-- 4) PAYMENT_ADD events from intervention_payments
INSERT INTO public.intervention_audit_log (
  intervention_id,
  action_type,
  related_entity_type, related_entity_id,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  p.intervention_id,
  'PAYMENT_ADD',
  'payment', p.id,
  to_jsonb(p),
  'backfill',
  COALESCE(p.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_payments')
FROM public.intervention_payments p
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.related_entity_type = 'payment'
    AND a.related_entity_id = p.id
    AND a.action_type = 'PAYMENT_ADD'
);

-- 5) DOCUMENT_ADD events from intervention_attachments
INSERT INTO public.intervention_audit_log (
  intervention_id,
  actor_user_id, actor_display, actor_code, actor_color,
  action_type,
  related_entity_type, related_entity_id,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  d.intervention_id,
  d.created_by,
  COALESCE(
    d.created_by_display,
    NULLIF(BTRIM(CONCAT(u.firstname, ' ', u.lastname)), ''),
    u.username,
    u.email,
    'system'
  ),
  COALESCE(d.created_by_code, u.code_gestionnaire),
  COALESCE(d.created_by_color, u.color),
  'DOCUMENT_ADD',
  'document', d.id,
  jsonb_build_object('id', d.id, 'kind', d.kind, 'filename', d.filename, 'mime_type', d.mime_type, 'url', d.url),
  'backfill',
  COALESCE(d.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_documents')
FROM public.intervention_attachments d
LEFT JOIN public.users u ON u.id = d.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.related_entity_type = 'document'
    AND a.related_entity_id = d.id
    AND a.action_type = 'DOCUMENT_ADD'
);

-- 6) COMMENT_ADD events from comments
INSERT INTO public.intervention_audit_log (
  intervention_id,
  actor_user_id, actor_display, actor_code, actor_color,
  action_type,
  related_entity_type, related_entity_id,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  c.entity_id,
  u.id,
  COALESCE(NULLIF(BTRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, u.email, 'system'),
  u.code_gestionnaire,
  u.color,
  'COMMENT_ADD',
  'comment', c.id,
  jsonb_build_object(
    'id', c.id,
    'content', LEFT(c.content, 200),
    'comment_type', c.comment_type,
    'reason_type', c.reason_type,
    'is_internal', c.is_internal
  ),
  'backfill',
  COALESCE(c.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_comments')
FROM public.comments c
LEFT JOIN public.users u ON u.id = c.author_id
WHERE c.entity_type = 'intervention'
  AND NOT EXISTS (
    SELECT 1 FROM public.intervention_audit_log a
    WHERE a.related_entity_type = 'comment'
      AND a.related_entity_id = c.id
      AND a.action_type = 'COMMENT_ADD'
  );

-- 7) ARTISAN_ASSIGN events from intervention_artisans
INSERT INTO public.intervention_audit_log (
  intervention_id,
  action_type,
  related_entity_type, related_entity_id,
  new_values,
  source,
  occurred_at,
  metadata
)
SELECT
  ia.intervention_id,
  'ARTISAN_ASSIGN',
  'artisan', ia.artisan_id,
  to_jsonb(ia),
  'backfill',
  COALESCE(ia.assigned_at, ia.created_at, now()),
  jsonb_build_object('backfill_reason', 'historical_artisans', 'intervention_artisan_id', ia.id)
FROM public.intervention_artisans ia
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_audit_log a
  WHERE a.related_entity_type = 'artisan'
    AND a.related_entity_id = ia.artisan_id
    AND a.intervention_id = ia.intervention_id
    AND a.action_type = 'ARTISAN_ASSIGN'
);
