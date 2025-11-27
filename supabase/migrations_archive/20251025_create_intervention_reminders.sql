-- ========================================
-- ✅ Intervention Reminders Table
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note text,
  due_date timestamptz,
  mentioned_user_ids uuid[] DEFAULT '{}'::uuid[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT note_or_duedate_required CHECK (
    note IS NOT NULL OR due_date IS NOT NULL
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intervention_reminders_intervention
  ON public.intervention_reminders (intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_reminders_user
  ON public.intervention_reminders (user_id);

CREATE INDEX IF NOT EXISTS idx_intervention_reminders_mentioned
  ON public.intervention_reminders USING GIN (mentioned_user_ids);

CREATE INDEX IF NOT EXISTS idx_intervention_reminders_due_date
  ON public.intervention_reminders (due_date)
  WHERE due_date IS NOT NULL;

-- RLS
ALTER TABLE public.intervention_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reminders and mentions" ON public.intervention_reminders;
CREATE POLICY "Users can view own reminders and mentions"
  ON public.intervention_reminders
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() = ANY(mentioned_user_ids)
  );

DROP POLICY IF EXISTS "Users can create own reminders" ON public.intervention_reminders;
CREATE POLICY "Users can create own reminders"
  ON public.intervention_reminders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reminders" ON public.intervention_reminders;
CREATE POLICY "Users can update own reminders"
  ON public.intervention_reminders
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.intervention_reminders;
CREATE POLICY "Users can delete own reminders"
  ON public.intervention_reminders
  FOR DELETE
  USING (user_id = auth.uid());

-- Trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_reminders_updated_at'
  ) THEN
    CREATE TRIGGER trg_intervention_reminders_updated_at
      BEFORE UPDATE ON public.intervention_reminders
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;
