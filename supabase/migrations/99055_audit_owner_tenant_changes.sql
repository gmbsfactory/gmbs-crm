-- ============================================================================
-- 99055 — Traçabilité des modifications de contact (facturation / client)
-- ----------------------------------------------------------------------------
-- Problème : les champs nom/prénom/téléphone/email de facturation (table `owner`)
-- et client (table `tenants`) vivent dans des tables séparées de `interventions`.
-- Aucune de ces tables n'avait de trigger d'audit → modifier ces valeurs ne
-- laissait AUCUNE trace dans `intervention_audit_log`. Seuls les changements de
-- lien (owner_id/tenant_id sur l'intervention) étaient enregistrés, sous forme
-- de swaps d'UUID illisibles.
--
-- Solution : triggers AFTER UPDATE sur `owner` et `tenants` qui, pour chaque
-- intervention liée, écrivent une entrée lisible (OWNER_UPDATE / TENANT_UPDATE)
-- avec le diff champ-par-champ. L'acteur est résolu via auth.uid() (l'app édite
-- en tant qu'utilisateur authentifié). Le contexte d'import est respecté
-- (acteur neutralisé, source = 'import') comme pour les autres triggers (99054).
--
-- Couplé côté app à l'édition « en place » du record lié (au lieu de créer un
-- nouveau record à chaque modif), ces triggers rendent l'historique complet.
-- ============================================================================

-- ── 1) Étendre les contraintes CHECK ────────────────────────────────────────
ALTER TABLE public.intervention_audit_log
  DROP CONSTRAINT IF EXISTS intervention_audit_log_action_type_check;
ALTER TABLE public.intervention_audit_log
  ADD CONSTRAINT intervention_audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'CREATE','UPDATE','ARCHIVE','RESTORE','STATUS_CHANGE',
    'COST_ADD','COST_UPDATE','COST_DELETE',
    'PAYMENT_ADD','PAYMENT_UPDATE','PAYMENT_DELETE',
    'ARTISAN_ASSIGN','ARTISAN_UPDATE','ARTISAN_UNASSIGN',
    'DOCUMENT_ADD','DOCUMENT_UPDATE','DOCUMENT_DELETE',
    'COMMENT_ADD','COMMENT_UPDATE','COMMENT_DELETE',
    'EMAIL_SENT',
    'OWNER_UPDATE','TENANT_UPDATE'
  ]));

ALTER TABLE public.intervention_audit_log
  DROP CONSTRAINT IF EXISTS intervention_audit_log_related_entity_type_check;
ALTER TABLE public.intervention_audit_log
  ADD CONSTRAINT intervention_audit_log_related_entity_type_check
  CHECK (related_entity_type IS NULL OR related_entity_type = ANY (ARRAY[
    'cost','payment','artisan','document','comment','status_transition','email',
    'owner','tenant'
  ]));

-- ── 2) Trigger d'audit sur `owner` (facturation) ────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_owner_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor record;
  diff record;
  v_op_id uuid := public.current_data_operation_context();
  excluded_keys text[] := ARRAY['id','created_at','updated_at'];
  r record;
BEGIN
  SELECT * INTO diff
  FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), excluded_keys);

  IF array_length(diff.changed_fields, 1) IS NULL OR array_length(diff.changed_fields, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  -- Une entrée par intervention référençant ce propriétaire (record mutualisé).
  FOR r IN SELECT id FROM public.interventions WHERE owner_id = NEW.id LOOP
    INSERT INTO public.intervention_audit_log (
      intervention_id,
      actor_user_id, actor_display, actor_code, actor_color,
      action_type, related_entity_type, related_entity_id,
      old_values, new_values, changed_fields,
      source, operation_id, transaction_id, occurred_at
    ) VALUES (
      r.id,
      CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
      'OWNER_UPDATE', 'owner', NEW.id,
      diff.old_values, diff.new_values, diff.changed_fields,
      CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
      v_op_id, txid_current(), now()
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- L'audit ne doit JAMAIS bloquer l'édition du contact : on journalise et on continue.
  RAISE WARNING 'audit_owner_update (owner %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 3) Trigger d'audit sur `tenants` (client) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_tenant_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor record;
  diff record;
  v_op_id uuid := public.current_data_operation_context();
  excluded_keys text[] := ARRAY['id','created_at','updated_at'];
  r record;
BEGIN
  SELECT * INTO diff
  FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), excluded_keys);

  IF array_length(diff.changed_fields, 1) IS NULL OR array_length(diff.changed_fields, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  FOR r IN SELECT id FROM public.interventions WHERE tenant_id = NEW.id LOOP
    INSERT INTO public.intervention_audit_log (
      intervention_id,
      actor_user_id, actor_display, actor_code, actor_color,
      action_type, related_entity_type, related_entity_id,
      old_values, new_values, changed_fields,
      source, operation_id, transaction_id, occurred_at
    ) VALUES (
      r.id,
      CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
      CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
      'TENANT_UPDATE', 'tenant', NEW.id,
      diff.old_values, diff.new_values, diff.changed_fields,
      CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
      v_op_id, txid_current(), now()
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- L'audit ne doit JAMAIS bloquer l'édition du contact : on journalise et on continue.
  RAISE WARNING 'audit_tenant_update (tenant %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 4) Brancher les triggers (AFTER UPDATE) ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_owner_update ON public.owner;
CREATE TRIGGER trg_audit_owner_update
  AFTER UPDATE ON public.owner
  FOR EACH ROW EXECUTE FUNCTION public.audit_owner_update();

DROP TRIGGER IF EXISTS trg_audit_tenant_update ON public.tenants;
CREATE TRIGGER trg_audit_tenant_update
  AFTER UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_update();

-- ── 5) Libellés lisibles pour les nouveaux types dans l'historique ──────────
CREATE OR REPLACE FUNCTION public.get_intervention_history(
  p_intervention_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, action_type text, action_label text, actor_display text,
  actor_code text, actor_color text, occurred_at timestamp with time zone,
  old_values jsonb, new_values jsonb, changed_fields text[],
  related_entity_type text, related_entity_id uuid, source text, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      WHEN 'OWNER_UPDATE' THEN 'Facturation modifiee'
      WHEN 'TENANT_UPDATE' THEN 'Client modifie'
      ELSE a.action_type
    END AS action_label,
    a.actor_display, a.actor_code, a.actor_color, a.occurred_at,
    a.old_values, a.new_values, a.changed_fields,
    a.related_entity_type, a.related_entity_id, a.source, a.metadata
  FROM public.intervention_audit_log a
  WHERE a.intervention_id = p_intervention_id
  ORDER BY a.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

NOTIFY pgrst, 'reload schema';
