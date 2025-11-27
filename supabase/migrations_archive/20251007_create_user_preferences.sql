-- Migration: Create user_preferences table
-- Description: Store user preferences for UI customization (speedometer visibility, etc.)

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  speedometer_margin_average_show_percentage boolean DEFAULT true,
  speedometer_margin_total_show_percentage boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- RLS Policies
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own preferences
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Trigger to update updated_at
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

-- Comments
COMMENT ON TABLE public.user_preferences IS 'User preferences for UI customization';
COMMENT ON COLUMN public.user_preferences.speedometer_margin_average_show_percentage IS 'Whether to show percentage under margin average speedometer';
COMMENT ON COLUMN public.user_preferences.speedometer_margin_total_show_percentage IS 'Whether to show percentage under margin total speedometer';

