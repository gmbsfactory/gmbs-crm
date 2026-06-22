-- ============================================================================
-- 99040 — Les envois d'email comptent comme une action (flux de monitoring)
-- ============================================================================
-- Les emails (table email_logs) n'apparaissaient pas dans le flux d'activité car
-- intervention_audit_log n'est alimenté que par des triggers, et aucun ne visait
-- email_logs. On ajoute :
--   1) EMAIL_SENT à la contrainte action_type, 'email' à related_entity_type
--   2) un trigger AFTER INSERT ON email_logs qui journalise l'envoi (status=sent)
--      dans intervention_audit_log -> remonte automatiquement dans
--      get_global_activity_feed / get_top_entities / get_intervention_history.
--
-- Le trigger est protégé par EXCEPTION : une erreur d'audit ne doit JAMAIS faire
-- échouer l'enregistrement de l'email. Réversible (DROP TRIGGER + revert CHECK).
-- ============================================================================

-- 1) Étendre la contrainte action_type (drop dynamique robuste au nom auto)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.intervention_audit_log'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%action_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.intervention_audit_log DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.intervention_audit_log
  ADD CONSTRAINT intervention_audit_log_action_type_check CHECK (action_type IN (
    'CREATE','UPDATE','ARCHIVE','RESTORE','STATUS_CHANGE',
    'COST_ADD','COST_UPDATE','COST_DELETE',
    'PAYMENT_ADD','PAYMENT_UPDATE','PAYMENT_DELETE',
    'ARTISAN_ASSIGN','ARTISAN_UPDATE','ARTISAN_UNASSIGN',
    'DOCUMENT_ADD','DOCUMENT_UPDATE','DOCUMENT_DELETE',
    'COMMENT_ADD','COMMENT_UPDATE','COMMENT_DELETE',
    'EMAIL_SENT'
  ));

-- 2) Étendre la contrainte related_entity_type (+ 'email')
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.intervention_audit_log'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%related_entity_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.intervention_audit_log DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.intervention_audit_log
  ADD CONSTRAINT intervention_audit_log_related_entity_type_check CHECK (
    related_entity_type IS NULL OR related_entity_type IN (
      'cost','payment','artisan','document','comment','status_transition','email'
    )
  );

-- 3) Trigger : journalise chaque email envoyé comme action EMAIL_SENT
CREATE OR REPLACE FUNCTION public.audit_email_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
BEGIN
  -- Uniquement les emails réellement envoyés et rattachés à une intervention
  IF NEW.status = 'sent' AND NEW.intervention_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO actor
      FROM public.get_actor_snapshot(public.resolve_actor_user_id(NEW.sent_by, NULL));

      INSERT INTO public.intervention_audit_log (
        intervention_id, actor_user_id, actor_display, actor_code, actor_color,
        action_type, related_entity_type, related_entity_id,
        old_values, new_values, changed_fields, source, occurred_at
      ) VALUES (
        NEW.intervention_id, actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
        'EMAIL_SENT', 'email', NEW.id,
        '{}'::jsonb,
        jsonb_build_object(
          'recipient_email', NEW.recipient_email,
          'subject', NEW.subject,
          'email_type', NEW.email_type,
          'artisan_id', NEW.artisan_id
        ),
        ARRAY[]::text[], 'trigger', COALESCE(NEW.sent_at, now())
      );
    EXCEPTION WHEN OTHERS THEN
      -- L'audit ne doit jamais bloquer l'enregistrement de l'email.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_email_log ON public.email_logs;
CREATE TRIGGER trg_audit_email_log
  AFTER INSERT ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_email_log();
