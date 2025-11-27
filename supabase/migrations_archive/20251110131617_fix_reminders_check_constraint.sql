-- ========================================
-- ✅ Suppression de la contrainte CHECK pour les reminders
-- ========================================
-- Permet les reminders sans note ni date
-- La contrainte originale empêchait la création de reminders vides
-- On la supprime pour permettre la sauvegarde même sans note ni date

ALTER TABLE public.intervention_reminders
  DROP CONSTRAINT IF EXISTS note_or_duedate_required;

