-- ========================================
-- Fix : statut_dossier NULL → INCOMPLET
-- ========================================
-- Pour les artisans importés sans statut_dossier, on force INCOMPLET.
-- La valeur sera recalculée automatiquement dès qu'un document sera ajouté.
--
-- Idempotent : ne touche que les lignes avec statut_dossier IS NULL.

-- Vérification avant
SELECT COUNT(*) AS artisans_sans_statut_dossier
FROM public.artisans
WHERE is_active = true
  AND statut_dossier IS NULL;

-- Fix
UPDATE public.artisans
SET statut_dossier = 'INCOMPLET'
WHERE is_active = true
  AND statut_dossier IS NULL;

-- Vérification après
SELECT statut_dossier, COUNT(*) AS nb
FROM public.artisans
WHERE is_active = true
GROUP BY statut_dossier
ORDER BY nb DESC;
