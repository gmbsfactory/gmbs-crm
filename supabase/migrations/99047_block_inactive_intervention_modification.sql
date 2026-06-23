-- ============================================================================
-- 99047 — Garde serveur : interdire la modification d'une intervention inactive
-- ============================================================================
-- Une intervention inactive (is_active = false) est "supprimée du CRM". Le
-- masquage du formulaire côté client ne suffit pas : un utilisateur avec droit
-- d'écriture pouvait encore la modifier en connaissant son lien, via les
-- sous-routes /status, /assign ou un appel supabase direct (RLS = rôle, sans
-- condition is_active).
--
-- Ce trigger BEFORE UPDATE bloque, au niveau DB (donc TOUS les chemins), toute
-- modification d'une ligne inactive — SAUF :
--   * la réactivation (is_active passe à true),
--   * les bumps techniques updated_at / updated_by (ex. cascade enfant via
--     touch_intervention_on_child_change), qui ne changent aucune donnée métier.
-- Le ré-archivage (active -> inactive) et l'édition d'une inter active restent
-- autorisés. Réversible : DROP TRIGGER + DROP FUNCTION.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_inactive_intervention_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- La ligne était inactive et le reste après cet UPDATE.
  IF OLD.is_active IS FALSE AND NEW.is_active IS FALSE THEN
    -- Bloquer dès qu'un champ métier change (tout sauf les bumps techniques).
    IF (to_jsonb(NEW) - 'updated_at' - 'updated_by')
         IS DISTINCT FROM
       (to_jsonb(OLD) - 'updated_at' - 'updated_by') THEN
      RAISE EXCEPTION
        'Intervention archivée (supprimée du CRM) : modification interdite. Réactivez-la d''abord.'
        USING errcode = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_inactive_intervention_modification ON public.interventions;
CREATE TRIGGER trg_block_inactive_intervention_modification
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.block_inactive_intervention_modification();
