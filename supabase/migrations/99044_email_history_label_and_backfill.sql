-- ============================================================================
-- 99044 — Emails : libellé historique + backfill des envois déjà existants
-- ============================================================================
-- 99040 journalise les nouveaux emails dans intervention_audit_log. Cette migration
-- ajoute le libellé lisible dans l'historique intervention et reprend les logs
-- historiques status='sent' sans dupliquer ceux déjà créés par le trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_intervention_history(
  p_intervention_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  action_type text,
  action_label text,
  actor_display text,
  actor_code text,
  actor_color text,
  occurred_at timestamptz,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  related_entity_type text,
  related_entity_id uuid,
  source text,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.id,
    a.action_type,
    CASE a.action_type
      WHEN 'CREATE' THEN 'Intervention creee'
      WHEN 'UPDATE' THEN 'Modification'
      WHEN 'ARCHIVE' THEN 'Archivee'
      WHEN 'RESTORE' THEN 'Restauree'
      WHEN 'STATUS_CHANGE' THEN 'Changement de statut'
      WHEN 'COST_ADD' THEN 'Cout ajoute'
      WHEN 'COST_UPDATE' THEN 'Cout modifie'
      WHEN 'COST_DELETE' THEN 'Cout supprime'
      WHEN 'PAYMENT_ADD' THEN 'Paiement ajoute'
      WHEN 'PAYMENT_UPDATE' THEN 'Paiement modifie'
      WHEN 'PAYMENT_DELETE' THEN 'Paiement supprime'
      WHEN 'ARTISAN_ASSIGN' THEN 'Artisan assigne'
      WHEN 'ARTISAN_UPDATE' THEN 'Artisan modifie'
      WHEN 'ARTISAN_UNASSIGN' THEN 'Artisan retire'
      WHEN 'DOCUMENT_ADD' THEN 'Document ajoute'
      WHEN 'DOCUMENT_UPDATE' THEN 'Document modifie'
      WHEN 'DOCUMENT_DELETE' THEN 'Document supprime'
      WHEN 'COMMENT_ADD' THEN 'Commentaire ajoute'
      WHEN 'COMMENT_UPDATE' THEN 'Commentaire modifie'
      WHEN 'COMMENT_DELETE' THEN 'Commentaire supprime'
      WHEN 'EMAIL_SENT' THEN 'Email envoye'
      ELSE a.action_type
    END AS action_label,
    a.actor_display,
    a.actor_code,
    a.actor_color,
    a.occurred_at,
    a.old_values,
    a.new_values,
    a.changed_fields,
    a.related_entity_type,
    a.related_entity_id,
    a.source,
    a.metadata
  FROM public.intervention_audit_log a
  WHERE a.intervention_id = p_intervention_id
  ORDER BY a.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

INSERT INTO public.intervention_audit_log (
  intervention_id,
  actor_user_id,
  actor_display,
  actor_code,
  actor_color,
  action_type,
  related_entity_type,
  related_entity_id,
  old_values,
  new_values,
  changed_fields,
  source,
  occurred_at
)
SELECT
  el.intervention_id,
  actor.actor_user_id,
  actor.actor_display,
  actor.actor_code,
  actor.actor_color,
  'EMAIL_SENT',
  'email',
  el.id,
  '{}'::jsonb,
  jsonb_build_object(
    'recipient_email', el.recipient_email,
    'subject', el.subject,
    'email_type', el.email_type,
    'artisan_id', el.artisan_id
  ),
  ARRAY[]::text[],
  'backfill',
  COALESCE(el.sent_at, el.created_at, now())
FROM public.email_logs el
LEFT JOIN LATERAL public.get_actor_snapshot(public.resolve_actor_user_id(el.sent_by, NULL)) actor ON true
WHERE el.status = 'sent'
  AND el.intervention_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.intervention_audit_log ial
    WHERE ial.related_entity_type = 'email'
      AND ial.related_entity_id = el.id
      AND ial.action_type = 'EMAIL_SENT'
  );

GRANT EXECUTE ON FUNCTION public.get_intervention_history(uuid, integer, integer) TO authenticated;
