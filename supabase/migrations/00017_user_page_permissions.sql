-- ========================================
-- Permissions d'accès aux pages par utilisateur
-- ========================================

CREATE TABLE IF NOT EXISTS public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  has_access boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, page_key)
);

-- Index pour accélérer les recherches par utilisateur ou page
CREATE INDEX IF NOT EXISTS idx_user_page_permissions_user_id ON public.user_page_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_page_permissions_page_key ON public.user_page_permissions(page_key);

-- Trigger pour maintenir updated_at à jour
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_page_permissions_updated_at') THEN
      CREATE TRIGGER trg_user_page_permissions_updated_at
        BEFORE UPDATE ON public.user_page_permissions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END $$;
