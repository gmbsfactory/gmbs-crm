-- 99076 — Documents : tri par date d'ajout sans coût
--
-- Contexte : l'Edge Function `documents` renvoyait la liste sans ORDER BY et
-- plafonnée à 50 lignes. Sur l'intervention 22757 (107 pièces jointes, dont 96
-- photos importées en bloc), les factures artisans tombaient au-delà de la 50e
-- ligne et n'atteignaient jamais le modal : chaque nouvel upload semblait
-- disparaître, ce qui a produit 9 doublons de la même facture.
--
-- L'Edge Function trie désormais par `created_at DESC` et ne plafonne plus par
-- défaut. Ces index couvrent (entité, date) pour que le tri reste un simple
-- parcours d'index au lieu d'un tri en mémoire.
--
-- Les index mono-colonne existants (idx_*_attachments_*_id) deviennent
-- redondants avec ces index composites, mais on les conserve : les supprimer
-- est un geste séparé, à faire une fois ces nouveaux index observés en prod.

CREATE INDEX IF NOT EXISTS idx_intervention_attachments_intervention_created
  ON public.intervention_attachments (intervention_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_artisan_created
  ON public.artisan_attachments (artisan_id, created_at DESC);

COMMENT ON INDEX public.idx_intervention_attachments_intervention_created IS
  'Liste des documents d''une intervention triée par date d''ajout (Edge Function documents).';

COMMENT ON INDEX public.idx_artisan_attachments_artisan_created IS
  'Liste des documents d''un artisan triée par date d''ajout (Edge Function documents).';
