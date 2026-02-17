-- ========================================
-- Artisan audit system
-- Calque sur intervention_audit_log (migration 00037)
-- Reutilise les helpers: resolve_actor_user_id(), get_actor_snapshot(), jsonb_diff()
-- ========================================

-- ========================================
-- 1) Table artisan_audit_log
-- ========================================
CREATE TABLE IF NOT EXISTS public.artisan_audit_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id           uuid NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,

  -- Actor snapshot (fige au moment de l'action)
  actor_user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_display        text,
  actor_code           text,
  actor_color          text,

  -- Type d'action
  action_type          text NOT NULL CHECK (action_type IN (
    'CREATE',
    'UPDATE',
    'ARCHIVE',
    'RESTORE',
    'STATUS_CHANGE',
    'METIER_ADD',
    'METIER_REMOVE',
    'ZONE_ADD',
    'ZONE_REMOVE',
    'ABSENCE_ADD',
    'ABSENCE_UPDATE',
    'ABSENCE_DELETE',
    'DOCUMENT_ADD',
    'DOCUMENT_UPDATE',
    'DOCUMENT_DELETE',
    'COMMENT_ADD',
    'COMMENT_UPDATE',
    'COMMENT_DELETE'
  )),

  -- Sous-entite liee
  related_entity_type  text CHECK (related_entity_type IS NULL OR related_entity_type IN (
    'metier', 'zone', 'absence', 'document', 'comment', 'status'
  )),
  related_entity_id    uuid,

  -- Diff
  old_values           jsonb DEFAULT '{}'::jsonb,
  new_values           jsonb DEFAULT '{}'::jsonb,
  changed_fields       text[] DEFAULT '{}',

  -- Metadata technique
  source               text DEFAULT 'trigger' CHECK (source IN (
    'api', 'trigger', 'import', 'system', 'manual', 'backfill'
  )),
  metadata             jsonb DEFAULT '{}'::jsonb,
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_artisan_audit_log_artisan_id
  ON public.artisan_audit_log(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_audit_log_occurred_at
  ON public.artisan_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_audit_log_artisan_occurred
  ON public.artisan_audit_log(artisan_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_audit_log_action_type
  ON public.artisan_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_artisan_audit_log_actor_user_id
  ON public.artisan_audit_log(actor_user_id);

COMMENT ON TABLE public.artisan_audit_log IS
  'Audit log for artisans and related entities (metiers, zones, absences, documents, comments)';

-- ========================================
-- 2) RLS
-- ========================================
ALTER TABLE public.artisan_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view artisan audit log"
  ON public.artisan_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Artisan audit log can only be inserted by trigger"
  ON public.artisan_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ========================================
-- 3) Trigger #1 : audit_artisan_insert (AFTER INSERT on artisans)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.created_by, NEW.updated_by)
  );

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    new_values,
    source,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    'CREATE',
    to_jsonb(NEW),
    'trigger',
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_insert ON public.artisans;
CREATE TRIGGER trg_audit_artisan_insert
  AFTER INSERT ON public.artisans
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_insert();

-- ========================================
-- 4) Trigger #2 : audit_artisan_update (AFTER UPDATE on artisans)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text := 'UPDATE';
  excluded_keys text[] := ARRAY[
    'updated_at', 'updated_by', 'created_at', 'created_by',
    'statut_id'
  ];
BEGIN
  -- Status change is handled separately
  IF OLD.statut_id IS DISTINCT FROM NEW.statut_id THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
    );

    INSERT INTO public.artisan_audit_log (
      artisan_id,
      actor_user_id, actor_display, actor_code, actor_color,
      action_type,
      related_entity_type,
      old_values, new_values,
      source,
      occurred_at
    ) VALUES (
      NEW.id,
      actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
      'STATUS_CHANGE',
      'status',
      jsonb_build_object('statut_id', OLD.statut_id),
      jsonb_build_object('statut_id', NEW.statut_id),
      'trigger',
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  -- Archive / Restore detection
  IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
    action_name := 'ARCHIVE';
  ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
    action_name := 'RESTORE';
  END IF;

  -- Compute diff for other fields
  SELECT * INTO diff
  FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), excluded_keys);

  IF array_length(diff.changed_fields, 1) IS NULL OR array_length(diff.changed_fields, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
  );

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    old_values, new_values, changed_fields,
    source,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    diff.old_values, diff.new_values, diff.changed_fields,
    'trigger',
    COALESCE(NEW.updated_at, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_update ON public.artisans;
CREATE TRIGGER trg_audit_artisan_update
  AFTER UPDATE ON public.artisans
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_update();

-- ========================================
-- 5) Trigger #3 : audit_artisan_metier (AFTER INSERT/DELETE on artisan_metiers)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_metier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  action_name text;
  target_artisan_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  occurred timestamptz;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'METIER_ADD';
    target_artisan_id := NEW.artisan_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'METIER_REMOVE';
    target_artisan_id := OLD.artisan_id;
    old_val := to_jsonb(OLD);
    occurred := now();
  END IF;

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values,
    source,
    occurred_at
  ) VALUES (
    target_artisan_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'metier', COALESCE(NEW.id, OLD.id),
    old_val, new_val,
    'trigger',
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_metier ON public.artisan_metiers;
CREATE TRIGGER trg_audit_artisan_metier
  AFTER INSERT OR DELETE ON public.artisan_metiers
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_metier();

-- ========================================
-- 6) Trigger #4 : audit_artisan_zone (AFTER INSERT/DELETE on artisan_zones)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  action_name text;
  target_artisan_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  occurred timestamptz;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'ZONE_ADD';
    target_artisan_id := NEW.artisan_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'ZONE_REMOVE';
    target_artisan_id := OLD.artisan_id;
    old_val := to_jsonb(OLD);
    occurred := now();
  END IF;

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values,
    source,
    occurred_at
  ) VALUES (
    target_artisan_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'zone', COALESCE(NEW.id, OLD.id),
    old_val, new_val,
    'trigger',
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_zone ON public.artisan_zones;
CREATE TRIGGER trg_audit_artisan_zone
  AFTER INSERT OR DELETE ON public.artisan_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_zone();

-- ========================================
-- 7) Trigger #5 : audit_artisan_absence (AFTER INSERT/UPDATE/DELETE on artisan_absences)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_artisan_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'ABSENCE_ADD';
    target_artisan_id := NEW.artisan_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'ABSENCE_UPDATE';
    target_artisan_id := NEW.artisan_id;

    SELECT * INTO diff
    FROM public.jsonb_diff(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['updated_at', 'created_at']
    );

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := now();

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'ABSENCE_DELETE';
    target_artisan_id := OLD.artisan_id;
    old_val := to_jsonb(OLD);
    occurred := now();
  END IF;

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    occurred_at
  ) VALUES (
    target_artisan_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'absence', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_absence ON public.artisan_absences;
CREATE TRIGGER trg_audit_artisan_absence
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_absences
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_absence();

-- ========================================
-- 8) Trigger #6 : audit_artisan_attachment (AFTER INSERT/UPDATE/DELETE on artisan_attachments)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_artisan_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.created_by, NULL)
    );

    action_name := 'DOCUMENT_ADD';
    target_artisan_id := NEW.artisan_id;
    new_val := jsonb_build_object(
      'id', NEW.id,
      'kind', NEW.kind,
      'filename', NEW.filename,
      'mime_type', NEW.mime_type,
      'url', NEW.url
    );
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NULL, COALESCE(NEW.created_by, OLD.created_by))
    );

    action_name := 'DOCUMENT_UPDATE';
    target_artisan_id := NEW.artisan_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'kind', OLD.kind,
      'filename', OLD.filename,
      'mime_type', OLD.mime_type,
      'url', OLD.url,
      'file_size', OLD.file_size
    );
    new_val := jsonb_build_object(
      'id', NEW.id,
      'kind', NEW.kind,
      'filename', NEW.filename,
      'mime_type', NEW.mime_type,
      'url', NEW.url,
      'file_size', NEW.file_size
    );

    SELECT * INTO diff
    FROM public.jsonb_diff(old_val, new_val, ARRAY[]::text[]);

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := now();

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(OLD.created_by, NULL)
    );

    action_name := 'DOCUMENT_DELETE';
    target_artisan_id := OLD.artisan_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'kind', OLD.kind,
      'filename', OLD.filename,
      'mime_type', OLD.mime_type,
      'url', OLD.url
    );
    occurred := now();
  END IF;

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    occurred_at
  ) VALUES (
    target_artisan_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'document', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_attachment ON public.artisan_attachments;
CREATE TRIGGER trg_audit_artisan_attachment
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_attachment();

-- ========================================
-- 9) Trigger #7 : audit_artisan_comment (AFTER INSERT/UPDATE/DELETE on comments WHERE entity_type = 'artisan')
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_artisan_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_type <> 'artisan' THEN
      RETURN NEW;
    END IF;

    action_name := 'COMMENT_ADD';
    target_artisan_id := NEW.entity_id;
    new_val := jsonb_build_object(
      'id', NEW.id,
      'content', LEFT(NEW.content, 200),
      'comment_type', NEW.comment_type,
      'reason_type', NEW.reason_type,
      'is_internal', NEW.is_internal
    );
    occurred := COALESCE(NEW.created_at, now());

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.author_id, NULL)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.entity_type <> 'artisan' THEN
      RETURN NEW;
    END IF;

    action_name := 'COMMENT_UPDATE';
    target_artisan_id := NEW.entity_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'content', LEFT(OLD.content, 200),
      'comment_type', OLD.comment_type,
      'reason_type', OLD.reason_type,
      'is_internal', OLD.is_internal
    );
    new_val := jsonb_build_object(
      'id', NEW.id,
      'content', LEFT(NEW.content, 200),
      'comment_type', NEW.comment_type,
      'reason_type', NEW.reason_type,
      'is_internal', NEW.is_internal
    );

    SELECT * INTO diff
    FROM public.jsonb_diff(old_val, new_val, ARRAY[]::text[]);

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := COALESCE(NEW.updated_at, now());

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.author_id, NULL)
    );
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.entity_type <> 'artisan' THEN
      RETURN OLD;
    END IF;

    action_name := 'COMMENT_DELETE';
    target_artisan_id := OLD.entity_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'content', LEFT(OLD.content, 200),
      'comment_type', OLD.comment_type,
      'reason_type', OLD.reason_type,
      'is_internal', OLD.is_internal
    );
    occurred := now();

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(OLD.author_id, NULL)
    );
  END IF;

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    occurred_at
  ) VALUES (
    target_artisan_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'comment', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_artisan_comment ON public.comments;
CREATE TRIGGER trg_audit_artisan_comment
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_artisan_comment();

-- ========================================
-- 10) RPC get_artisan_history
-- ========================================
CREATE OR REPLACE FUNCTION public.get_artisan_history(
  p_artisan_id uuid,
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
      WHEN 'CREATE' THEN 'Artisan cree'
      WHEN 'UPDATE' THEN 'Modification'
      WHEN 'ARCHIVE' THEN 'Archive'
      WHEN 'RESTORE' THEN 'Restaure'
      WHEN 'STATUS_CHANGE' THEN 'Changement de statut'
      WHEN 'METIER_ADD' THEN 'Metier ajoute'
      WHEN 'METIER_REMOVE' THEN 'Metier retire'
      WHEN 'ZONE_ADD' THEN 'Zone ajoutee'
      WHEN 'ZONE_REMOVE' THEN 'Zone retiree'
      WHEN 'ABSENCE_ADD' THEN 'Absence ajoutee'
      WHEN 'ABSENCE_UPDATE' THEN 'Absence modifiee'
      WHEN 'ABSENCE_DELETE' THEN 'Absence supprimee'
      WHEN 'DOCUMENT_ADD' THEN 'Document ajoute'
      WHEN 'DOCUMENT_UPDATE' THEN 'Document modifie'
      WHEN 'DOCUMENT_DELETE' THEN 'Document supprime'
      WHEN 'COMMENT_ADD' THEN 'Commentaire ajoute'
      WHEN 'COMMENT_UPDATE' THEN 'Commentaire modifie'
      WHEN 'COMMENT_DELETE' THEN 'Commentaire supprime'
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
  FROM public.artisan_audit_log a
  WHERE a.artisan_id = p_artisan_id
  ORDER BY a.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.get_artisan_history IS
  'Returns unified artisan history from the audit log';

-- ========================================
-- 11) Backfill from artisan_status_history
-- ========================================
INSERT INTO public.artisan_audit_log (
  artisan_id,
  actor_user_id, actor_display, actor_code, actor_color,
  action_type,
  related_entity_type,
  old_values, new_values,
  source,
  occurred_at,
  created_at
)
SELECT
  ash.artisan_id,
  snap.actor_user_id, snap.actor_display, snap.actor_code, snap.actor_color,
  'STATUS_CHANGE',
  'status',
  jsonb_build_object('statut_id', ash.old_status_id),
  jsonb_build_object('statut_id', ash.new_status_id),
  'backfill',
  ash.changed_at,
  ash.created_at
FROM public.artisan_status_history ash
LEFT JOIN LATERAL (
  SELECT * FROM public.get_actor_snapshot(ash.changed_by)
) snap ON true;
