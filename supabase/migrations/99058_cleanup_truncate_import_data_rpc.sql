-- ============================================================================
-- 99058 — RPC de table rase pour le ré-import (TRUNCATE CASCADE)
-- ----------------------------------------------------------------------------
-- PROBLÈME RÉSOLU
-- Le cleanup par DELETE ordonnés (cleanup-data.js) échoue en production :
--   1. Le trigger de gel `block_inactive_intervention_modification` (99048)
--      bloque toute cascade qui touche une intervention archivée (is_active=false)
--      → DELETE des enfants (coûts, paiements, artisans, commentaires) en échec.
--   2. Les triggers AFTER DELETE réinsèrent dans `intervention_audit_log` en
--      référençant la ligne supprimée → violation de FK sur DELETE de `interventions`.
-- Résultat : la table `interventions` (et les artisans) ne sont jamais vidés,
-- et le ré-import empile des doublons/fusions par-dessus les survivants.
--
-- SOLUTION
-- `TRUNCATE … CASCADE` ne déclenche NI les triggers BEFORE UPDATE (gel) NI les
-- AFTER DELETE (réinsertion audit) au niveau ligne → contourne nativement les
-- deux verrous. CASCADE gère l'ordre des FK. Exécuté dans un RPC SECURITY DEFINER
-- (owner = postgres, propriétaire des tables) pour disposer du privilège TRUNCATE.
--
-- GARDE-FOUS
--   • p_confirm obligatoire et exact (anti-déclenchement accidentel).
--   • ALLOWLIST en dur : seules les tables de données d'import sont éligibles.
--     Les référentiels, users, agences, billing NE PEUVENT PAS être truncatés,
--     même si l'appelant passe leur nom.
--   • Vérification d'existence (to_regclass) : tables absentes ignorées sans erreur.
--   • EXECUTE de l'allowlist uniquement → pas d'injection de nom de table.
--
-- PÉRIMÈTRE (validé avec l'équipe) : interventions + enfants, artisans + enfants,
-- clients (tenants/owner), IA/messagerie, logs opérationnels. PRÉSERVÉ : tout le
-- reste (référentiels métier, auth/users, agences, billing, app_updates).
--
-- Réversible : DROP FUNCTION public.cleanup_truncate_import_data(text, text[]).
-- ⚠️  IRRÉVERSIBLE à l'exécution une fois la transaction commitée — backup requis.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_truncate_import_data(
  p_confirm text,
  p_tables  text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Seules ces tables peuvent être vidées. Tout le reste est protégé par omission.
  c_allowlist constant text[] := ARRAY[
    -- Logs & audit
    'email_logs', 'sync_logs', 'artisan_audit_log',
    -- IA & conversations
    'message_attachments', 'messages', 'conversation_participants', 'conversations',
    'chat_messages', 'chat_sessions', 'ai_assistants',
    -- Reminders, tâches, commentaires
    'intervention_reminders', 'tasks', 'comments',
    -- Interventions + enfants
    'intervention_compta_checks', 'intervention_attachments', 'intervention_costs_cache',
    'intervention_payments', 'intervention_status_transitions', 'intervention_artisans',
    'intervention_audit_log', 'intervention_costs', 'interventions',
    -- Artisans + enfants
    'artisan_attachments', 'artisan_absences', 'artisan_status_history',
    'artisan_metiers', 'artisan_zones', 'artisans',
    -- Clients
    'tenants', 'owner'
  ];
  v_requested  text[];
  v_targets    text[];
  v_counts     jsonb := '{}'::jsonb;
  v_t          text;
  v_n          bigint;
  v_sql        text;
BEGIN
  -- (1) Confirmation explicite.
  IF p_confirm IS DISTINCT FROM 'TRUNCATE_GMBS_IMPORT_DATA' THEN
    RAISE EXCEPTION
      'Confirmation invalide. Passez p_confirm => ''TRUNCATE_GMBS_IMPORT_DATA'' pour exécuter la table rase.'
      USING errcode = 'P0001';
  END IF;

  -- (2) Liste demandée = p_tables si fourni, sinon toute l'allowlist.
  --     Intersection STRICTE avec l'allowlist (défense en profondeur).
  v_requested := COALESCE(p_tables, c_allowlist);

  SELECT array_agg(t)
  INTO v_targets
  FROM unnest(v_requested) AS t
  WHERE t = ANY(c_allowlist)              -- jamais hors allowlist
    AND to_regclass('public.' || t) IS NOT NULL;  -- jamais une table absente

  IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'truncated', '[]'::jsonb, 'note', 'aucune table éligible');
  END IF;

  -- (3) Compter avant (pour le rapport renvoyé à l'appelant).
  FOREACH v_t IN ARRAY v_targets LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_t) INTO v_n;
    v_counts := v_counts || jsonb_build_object(v_t, v_n);
  END LOOP;

  -- (4) Table rase atomique. RESTART IDENTITY remet les séquences à zéro.
  --     %I sur chaque table (issue de l'allowlist) → pas d'injection.
  SELECT string_agg(format('public.%I', t), ', ')
  INTO v_sql
  FROM unnest(v_targets) AS t;

  EXECUTE 'TRUNCATE TABLE ' || v_sql || ' RESTART IDENTITY CASCADE';

  RETURN jsonb_build_object(
    'ok', true,
    'truncated_count', array_length(v_targets, 1),
    'rows_before', v_counts
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_truncate_import_data(text, text[]) IS
  'Table rase des données d''import (TRUNCATE CASCADE) pour ré-import propre. '
  'Contourne les triggers de gel (99048) et de réinsertion audit qui bloquent les DELETE. '
  'p_confirm obligatoire = ''TRUNCATE_GMBS_IMPORT_DATA''. p_tables optionnel (sous-ensemble de '
  'l''allowlist ; NULL = tout). Préserve référentiels, users, agences, billing. IRRÉVERSIBLE.';

-- Moindre privilège : exécutable uniquement par le service role (cleanup Node).
REVOKE ALL ON FUNCTION public.cleanup_truncate_import_data(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_truncate_import_data(text, text[]) TO service_role;

NOTIFY pgrst, 'reload schema';
