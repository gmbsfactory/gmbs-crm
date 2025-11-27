-- ========================================
-- Attachments Constraints (Final Version)
-- ========================================
-- Contraintes CHECK sur les types de documents

-- ========================================
-- INTERVENTION ATTACHMENTS
-- ========================================

ALTER TABLE public.intervention_attachments
ADD CONSTRAINT intervention_attachments_kind_check
CHECK (kind IN (
  'devis',
  'photos',
  'facturesGMBS',
  'facturesArtisans',
  'facturesMateriel',
  'autre',
  'a_classe'
));

COMMENT ON CONSTRAINT intervention_attachments_kind_check ON public.intervention_attachments
IS 'Contrainte des types de documents intervention (devis, photos, factures*, autre, a_classe).';

-- ========================================
-- ARTISAN ATTACHMENTS
-- ========================================

ALTER TABLE public.artisan_attachments
ADD CONSTRAINT artisan_attachments_kind_check
CHECK (kind IN (
  'kbis',
  'assurance',
  'cni_recto_verso',
  'iban',
  'decharge_partenariat',
  'photo_profil',
  'portfolio',
  'autre',
  'a_classe'
));

COMMENT ON CONSTRAINT artisan_attachments_kind_check ON public.artisan_attachments
IS 'Contrainte des types de documents artisan (kbis, assurance, portfolio, photo_profil, etc.).';

-- ========================================
-- INDEXES FOR ATTACHMENTS
-- ========================================

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_content_hash 
ON public.artisan_attachments(content_hash) 
WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_kind 
ON public.artisan_attachments(kind) 
WHERE kind = 'photo_profil';

CREATE INDEX IF NOT EXISTS idx_intervention_attachments_intervention_id
ON public.intervention_attachments(intervention_id);

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_artisan_id
ON public.artisan_attachments(artisan_id);

