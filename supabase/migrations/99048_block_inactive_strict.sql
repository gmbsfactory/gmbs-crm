-- ============================================================================
-- 99048 — Garde inactif : politique stricte (gel total sauf réactivation)
-- ============================================================================
-- 99047 tentait d'autoriser les bumps techniques (updated_at/updated_by) via une
-- comparaison de diff. En pratique cette exception ne se déclenchait pas de façon
-- fiable et la garde se comportait déjà de manière stricte. On l'assume
-- explicitement : une intervention inactive (supprimée du CRM) est GELÉE.
--
-- Seule la réactivation (is_active -> true) est permise. Toute autre modification
-- est bloquée, y compris les cascades déclenchées par une modification d'un enfant
-- (coût, paiement, commentaire, document, artisan) : c'est voulu — on ne modifie
-- pas les données d'une intervention supprimée, on la réactive d'abord.
--
-- Le ré-archivage (active -> inactive) et l'édition d'une inter active restent
-- autorisés (OLD.is_active = true). Réversible : DROP TRIGGER + DROP FUNCTION.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_inactive_intervention_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- La ligne était inactive et le reste (NEW.is_active pas passé à true) :
  -- on interdit toute modification. La réactivation échappe à la condition.
  IF OLD.is_active IS FALSE AND NEW.is_active IS FALSE THEN
    RAISE EXCEPTION
      'Intervention archivée (supprimée du CRM) : modification interdite. Réactivez-la d''abord.'
      USING errcode = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- Le trigger trg_block_inactive_intervention_modification (99047) pointe déjà sur
-- cette fonction ; le CREATE OR REPLACE ci-dessus suffit à appliquer la nouvelle
-- politique. On le recrée par sécurité (idempotent).
DROP TRIGGER IF EXISTS trg_block_inactive_intervention_modification ON public.interventions;
CREATE TRIGGER trg_block_inactive_intervention_modification
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.block_inactive_intervention_modification();
