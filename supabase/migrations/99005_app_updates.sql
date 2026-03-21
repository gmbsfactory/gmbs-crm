-- ============================================================
-- Migration 99005: App Updates system
-- Tables app_updates + app_update_views avec RLS, index et seed
-- ============================================================

-- Table principale des mises à jour
CREATE TABLE IF NOT EXISTS public.app_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  audience text[] NOT NULL DEFAULT '{all}',
  target_user_ids uuid[] DEFAULT '{}',
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Contraintes de validation
ALTER TABLE public.app_updates
  DROP CONSTRAINT IF EXISTS app_updates_severity_check,
  DROP CONSTRAINT IF EXISTS app_updates_status_check;
ALTER TABLE public.app_updates
  ADD CONSTRAINT app_updates_severity_check CHECK (severity IN ('info', 'important', 'breaking')),
  ADD CONSTRAINT app_updates_status_check CHECK (status IN ('draft', 'published'));

-- Table de suivi des vues/acquittements
CREATE TABLE IF NOT EXISTS public.app_update_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL REFERENCES public.app_updates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  UNIQUE(update_id, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_app_updates_status_published ON public.app_updates(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_update_views_user ON public.app_update_views(user_id, update_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_update_views ENABLE ROW LEVEL SECURITY;

-- app_updates policies
DROP POLICY IF EXISTS "app_updates_select_published" ON public.app_updates;
CREATE POLICY "app_updates_select_published"
  ON public.app_updates FOR SELECT
  TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "app_updates_insert_admin" ON public.app_updates;
CREATE POLICY "app_updates_insert_admin"
  ON public.app_updates FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS "app_updates_update_admin" ON public.app_updates;
CREATE POLICY "app_updates_update_admin"
  ON public.app_updates FOR UPDATE
  TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS "app_updates_delete_admin" ON public.app_updates;
CREATE POLICY "app_updates_delete_admin"
  ON public.app_updates FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- app_update_views policies
DROP POLICY IF EXISTS "app_update_views_select_own" ON public.app_update_views;
CREATE POLICY "app_update_views_select_own"
  ON public.app_update_views FOR SELECT
  TO authenticated
  USING (user_id = public.get_public_user_id());

DROP POLICY IF EXISTS "app_update_views_select_admin" ON public.app_update_views;
CREATE POLICY "app_update_views_select_admin"
  ON public.app_update_views FOR SELECT
  TO authenticated
  USING (public.user_has_role('admin'));

DROP POLICY IF EXISTS "app_update_views_insert_own" ON public.app_update_views;
CREATE POLICY "app_update_views_insert_own"
  ON public.app_update_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.get_public_user_id());

DROP POLICY IF EXISTS "app_update_views_update_own" ON public.app_update_views;
CREATE POLICY "app_update_views_update_own"
  ON public.app_update_views FOR UPDATE
  TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());

-- ============================================================
-- Seed : 4 updates initiales
-- ============================================================

INSERT INTO public.app_updates (version, title, content, audience, severity, status, published_at) VALUES
(
  '1.0',
  'Page comptabilité — vitesse, lisibilité, liens de copie',
  E'## Refonte de la page comptabilité\n\n- **Chargement ultra-rapide** : les données sont maintenant mises en cache et se chargent instantanément\n- **Lisibilité améliorée** : colonnes réorganisées, montants alignés, codes couleur par statut\n- **Copie rapide** : cliquez sur un numéro d''intervention ou un montant pour le copier dans le presse-papier\n- **Filtres persistants** : vos filtres sont sauvegardés entre les sessions',
  '{all}',
  'info',
  'published',
  now()
),
(
  '1.1',
  'Blocage modals (édition simultanée) — verrouillage concurrent',
  E'## Verrouillage des fiches en édition\n\n- **Détection automatique** : quand un gestionnaire ouvre une fiche, les autres voient un indicateur de verrouillage\n- **Prévention des conflits** : impossible de modifier une fiche déjà en cours d''édition par un collègue\n- **Libération automatique** : le verrou se libère quand le gestionnaire ferme la fiche ou après un délai d''inactivité\n- **Notification** : un message indique qui est en train d''éditer la fiche',
  '{all}',
  'info',
  'published',
  now()
),
(
  '1.2',
  'Blocage changement de statut — héritage cumulatif',
  E'## Règles de transition de statut renforcées\n\n- **Héritage cumulatif** : chaque statut hérite des blocages des statuts précédents\n- **Vérification automatique** : le système vérifie que toutes les conditions sont remplies avant d''autoriser un changement de statut\n- **Messages explicites** : en cas de blocage, un message détaillé indique les champs manquants ou les conditions non remplies\n- **Règles configurables** : les règles de transition sont centralisées et facilement modifiables',
  '{all}',
  'info',
  'published',
  now()
),
(
  '1.3',
  'Présence gestionnaires temps réel — avatars par page',
  E'## Présence en temps réel\n\n- **Avatars en direct** : voyez qui est connecté et sur quelle page grâce aux avatars affichés dans la barre supérieure\n- **Indicateur de page** : survolez un avatar pour voir sur quelle page se trouve le gestionnaire\n- **Statuts de présence** : en ligne (vert), occupé (orange), ne pas déranger (rouge)\n- **Mise à jour instantanée** : les changements de page et de statut sont reflétés en temps réel',
  '{all}',
  'info',
  'published',
  now()
)
ON CONFLICT DO NOTHING;
