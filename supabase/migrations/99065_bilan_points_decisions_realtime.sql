-- ============================================================================
-- 99065 — Points de réunion : décisions à boutons + temps réel
-- ============================================================================
-- Ajustements demandés avant la réunion (03/07 13h) :
-- 1. Certains points ne demandent PAS de commentaire : juste une décision
--    « Valider — devis supplémentaire » ou « Refuser » (sortie d'archives,
--    lien cliquable, correcteur d'orthographe). → colonne reponse_type.
-- 2. Points réordonnés par nature : décisions d'abord, cadrages ensuite.
-- 3. Les réponses doivent apparaître en temps réel chez tous les
--    participants autorisés → tables ajoutées à la publication realtime
--    (les événements respectent la RLS : SELECT authenticated).
--
-- Reseed complet : vérifié au préalable, aucune réponse en base (0 ligne).
-- ============================================================================

ALTER TABLE public.bilan_points
  ADD COLUMN IF NOT EXISTS reponse_type text NOT NULL DEFAULT 'texte'
  CHECK (reponse_type IN ('texte', 'decision'));

COMMENT ON COLUMN public.bilan_points.reponse_type IS
  'decision = boutons Valider (devis supp) / Refuser, sans commentaire ; texte = réponse libre.';

-- Reseed ordonné (aucune réponse existante — cascade sans perte)
DELETE FROM public.bilan_points;

INSERT INTO public.bilan_points (ordre, titre, detail, origine, reponse_type) VALUES
  -- Décisions : valider (devis supplémentaire) ou refuser
  (1, 'Sortie d''archives artisan', 'À valider ou refuser — si validé, part en devis supplémentaire (désarchivage avec choix du statut de retour).', 'Andrea · WhatsApp lun 29/06 10:59 (n°2)', 'decision'),
  (2, 'Lien cliquable dans les commentaires', 'À valider ou refuser — si validé, part en devis supplémentaire. Comportement attendu à préciser ensemble : ouverture dans un nouvel onglet ?', 'Gabriel · WhatsApp jeu 02/07 18:53 (n°22)', 'decision'),
  (3, 'Correcteur d''orthographe sur la consigne artisan', 'À valider ou refuser — si validé, part en devis supplémentaire.', 'Gabriel · WhatsApp jeu 02/07 18:54 (n°23)', 'decision'),
  -- Cadrages : réponse libre attendue
  (4, 'IDs en gras : définir le périmètre', 'Accepté sur le principe. À préciser : quels écrans et quels identifiants (tableaux, fiches, mails ?).', 'Gabriel · WhatsApp jeu 02/07 18:56 (n°24)', 'texte'),
  (5, 'Workflow acompte : valider le sens des transitions', 'Confirmer : saisie du montant → « Attente acompte », clic « reçu » → « Accepté » ; « En cours » reste bloquant.', 'Andrea + Gabriel · WhatsApp mer 01/07 (n°12)', 'texte'),
  (6, 'Garde-fou anti-doublon à la création d''intervention', 'Quel périmètre d''avertissement : agence + référence + adresse normalisée ? Bloquant ou simple alerte ?', 'Gabriel · WhatsApp jeu 02/07 12:45 (n°18)', 'texte'),
  (7, 'Pièces jointes > 3,2 Mo : quelle alternative ?', 'Limite d''envoi Gmail atteinte. Options : lien de téléchargement, compression automatique, statu quo.', 'Andrea · WhatsApp mar 30/06 15:36 (n°10)', 'texte'),
  (8, 'Requalifier : « délai d''affichage du nom artisan sur le suivi »', 'Seul bug encore ouvert du bilan — préciser où il se manifeste et comment le reproduire.', 'Andrea · WhatsApp lun 29/06 16:52 (n°4)', 'texte');

-- Temps réel : événements INSERT (réponses) et UPDATE (statuts) vers les clients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bilan_points'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bilan_points;
      RAISE NOTICE 'bilan_points ajoutée à supabase_realtime';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bilan_point_replies'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bilan_point_replies;
      RAISE NOTICE 'bilan_point_replies ajoutée à supabase_realtime';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN MIGRATION 99065
-- ============================================================================
