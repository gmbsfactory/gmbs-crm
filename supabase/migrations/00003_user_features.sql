-- ========================================
-- User Features: Preferences, Reminders
-- ========================================

-- ========================================
-- USER PREFERENCES
-- ========================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  speedometer_margin_average_show_percentage boolean DEFAULT true,
  speedometer_margin_total_show_percentage boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

COMMENT ON TABLE public.user_preferences IS 'User preferences for UI customization';

-- ========================================
-- INTERVENTION REMINDERS
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  note text,
  due_date timestamptz,
  is_completed boolean DEFAULT false,
  is_active boolean DEFAULT true,
  mentioned_user_ids uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_reminders_intervention_id 
  ON public.intervention_reminders(intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_reminders_user_id 
  ON public.intervention_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_reminders_mentioned
  ON public.intervention_reminders USING GIN (mentioned_user_ids);
CREATE INDEX IF NOT EXISTS idx_intervention_reminders_due_date 
  ON public.intervention_reminders(due_date) WHERE due_date IS NOT NULL;

ALTER TABLE public.intervention_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders and mentions"
  ON public.intervention_reminders FOR SELECT
  USING (
    auth.uid() = user_id 
    OR auth.uid() = ANY(mentioned_user_ids)
  );

CREATE POLICY "Users can create own reminders"
  ON public.intervention_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON public.intervention_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON public.intervention_reminders FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_intervention_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_intervention_reminders_updated_at
  BEFORE UPDATE ON public.intervention_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_intervention_reminders_updated_at();

COMMENT ON TABLE public.intervention_reminders IS 'Reminders for interventions with user mentions';

-- ========================================
-- EMAIL LOGS RLS
-- ========================================

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (sent_by = auth.uid());

CREATE POLICY "Admins can view all email logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- ========================================
-- AGENCY CONFIG DATA
-- ========================================
-- Populate configuration for agencies requiring a reference (BR-AGN-001)

INSERT INTO public.agency_config (agency_id, requires_reference)
SELECT a.id, true
FROM public.agencies a
WHERE LOWER(a.label) IN ('imodirect', 'afedim', 'oqoro')
   OR LOWER(a.code) IN ('imodirect', 'afedim', 'oqoro')
ON CONFLICT (agency_id) DO UPDATE
SET requires_reference = EXCLUDED.requires_reference;

