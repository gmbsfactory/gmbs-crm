-- ============================================================================
-- 99045 — Podium : borne vendredi 16h en Europe/Paris (pas UTC)
-- ============================================================================
-- get_current_podium_period calcule le vendredi de reference via now(),
-- EXTRACT(HOUR) et date_trunc('day') sur des timestamptz. Sans timezone de
-- fonction, Supabase execute en UTC : en ete, vendredi 16:00 UTC = 18:00 Paris.
--
-- On garde la logique existante (semaine terminee vendredi->vendredi), mais on
-- force le fuseau de la fonction a Europe/Paris pour que "vendredi 16h" signifie
-- vraiment 16:00 heure de Paris, y compris pendant les changements DST.
-- ============================================================================

ALTER FUNCTION public.get_current_podium_period()
  SET search_path = public;

ALTER FUNCTION public.get_current_podium_period()
  SET timezone = 'Europe/Paris';

COMMENT ON FUNCTION public.get_current_podium_period IS
  'Retourne la periode du podium (semaine terminee precedente, de vendredi 16h Europe/Paris a vendredi 16h Europe/Paris).';

-- Recalcule la ligne courante avec la nouvelle borne Paris.
SELECT public.refresh_current_podium_period();

NOTIFY pgrst, 'reload schema';
