-- ============================================================================
-- 99064 — Bilan S1 : points à traiter en réunion (écran 3 interactif)
-- ============================================================================
-- L'écran 3 de /bilan-s1 liste les demandes de clarification à traiter en
-- réunion. Chaque point est cliquable ; les personnes ayant accès à la page
-- (devs + visibilité accordée, cf. page_visibility) peuvent répondre. Les
-- réponses sont horodatées et rattachées à leur auteur (avatar). À la
-- première réponse, le point passe de « À qualifier » à « Répondu ».
--
-- Écritures via les routes API serveur uniquement (service role) — le gate
-- canViewBilan y est appliqué. Lecture pour authenticated.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bilan_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordre integer NOT NULL DEFAULT 0,
  titre text NOT NULL,
  detail text,
  origine text,
  statut text NOT NULL DEFAULT 'a_qualifier' CHECK (statut IN ('a_qualifier', 'repondu')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bilan_points IS
  'Points à traiter en réunion (écran 3 de /bilan-s1). Statut a_qualifier par défaut, repondu dès la première réponse.';

CREATE TABLE IF NOT EXISTS public.bilan_point_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id uuid NOT NULL REFERENCES public.bilan_points(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bilan_point_replies_point_id
  ON public.bilan_point_replies(point_id);

COMMENT ON TABLE public.bilan_point_replies IS
  'Réponses horodatées aux points de réunion, rattachées à leur auteur (avatar affiché sur /bilan-s1).';

ALTER TABLE public.bilan_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bilan_point_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bilan_points_select_authenticated ON public.bilan_points;
CREATE POLICY bilan_points_select_authenticated
  ON public.bilan_points FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bilan_point_replies_select_authenticated ON public.bilan_point_replies;
CREATE POLICY bilan_point_replies_select_authenticated
  ON public.bilan_point_replies FOR SELECT TO authenticated USING (true);

-- Seed : les points identifiés pendant la semaine 1 (WhatsApp + tri du bilan)
INSERT INTO public.bilan_points (ordre, titre, detail, origine) VALUES
  (1, 'Sortie d''archives artisan', 'Qui a le droit de désarchiver, et vers quel statut de retour ? Contournement manuel fait en attendant (Delannoy → expert).', 'Andrea · WhatsApp lun 29/06 10:59 (n°2)'),
  (2, 'Limite pièces jointes 3,2 Mo (Gmail)', 'La limite d''envoi pénalise les missions à 3 documents. Alternatives : lien de téléchargement, compression, autre canal.', 'Andrea · WhatsApp mar 30/06 15:36 (n°10)'),
  (3, 'Workflow acompte : valider le sens des transitions', 'Saisie du montant → « Attente acompte », clic « reçu » → « Accepté » ; « En cours » reste bloquant. À confirmer et cadrer l''automatisme.', 'Andrea + Gabriel · WhatsApp mer 01/07 (n°12)'),
  (4, 'Garde-fou anti-doublon à la création d''intervention', 'Double saisie simultanée constatée (même demande AFEDIM saisie par deux gestionnaires à la même minute). Périmètre de l''avertissement : agence + référence + adresse normalisée ?', 'Gabriel · WhatsApp jeu 02/07 12:45 (n°18)'),
  (5, 'Requalifier : « délai d''affichage du nom artisan sur le suivi »', 'Signalement resté sans reproduction claire — à requalifier avec Andrea (seul bug encore ouvert du bilan).', 'Andrea · WhatsApp lun 29/06 16:52 (n°4)'),
  (6, 'Lien cliquable dans les commentaires', 'Demande d''évolution — passera en devis supplémentaire (à chiffrer).', 'Gabriel · WhatsApp jeu 02/07 18:53 (n°22)'),
  (7, 'Correcteur d''orthographe sur la consigne artisan', 'Demande d''évolution — passera en devis supplémentaire (à chiffrer).', 'Gabriel · WhatsApp jeu 02/07 18:54 (n°23)'),
  (8, 'Mettre les ID en gras', 'Accepté sur le principe — périmètre exact (quels écrans, quels ID) à définir ensemble.', 'Gabriel · WhatsApp jeu 02/07 18:56 (n°24)')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIN MIGRATION 99064
-- ============================================================================
