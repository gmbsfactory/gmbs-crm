-- Table pour les tokens de reset password persistants (multi-usage, 24h)
-- Les tokens custom remplacent les liens Supabase à usage unique
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_prt_token ON public.password_reset_tokens(token);
CREATE INDEX idx_prt_user_id ON public.password_reset_tokens(user_id);

-- RLS : seul le service role accède à cette table
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
