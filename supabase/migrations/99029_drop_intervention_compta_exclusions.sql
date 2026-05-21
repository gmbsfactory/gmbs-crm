-- ========================================
-- Suppression de la table intervention_compta_exclusions (obsolète)
--
-- Introduite par 99023 (Issue #20 : exclure des lignes du tableau compta).
-- La fonctionnalité n'est plus câblée : aucun code applicatif (API, hooks,
-- composants, edge functions) ni objet SQL (trigger, fonction, vue) ne
-- référence cette table au 2026-05-21. On la supprime pour éliminer du code
-- mort et la RLS orpheline.
--
-- DROP ... CASCADE retire aussi l'index et les policies RLS associés.
-- ========================================

DROP TABLE IF EXISTS public.intervention_compta_exclusions CASCADE;
