-- Cursor-friendly indexes for interventions keyset pagination
CREATE INDEX IF NOT EXISTS idx_interventions_date_id_desc
  ON public.interventions (date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_assigned_status_date_id_desc
  ON public.interventions (assigned_user_id, statut_id, date DESC, id DESC);
