-- ============================================================================
-- 99084 — Le démarrage déclaré par l'artisan, visible en liste et en kanban
-- ============================================================================
-- Décision client du 2026-09-05 (spécification §10.1) : le CRM garde la main
-- sur les statuts. Quand l'artisan déclare un démarrage alors que la fiche est
-- incomplète, le fait est enregistré mais le statut reste `ACCEPTE`. Le
-- gestionnaire doit malgré tout VOIR ce démarrage — pas seulement dans l'onglet
-- « Rapport » du modal, mais partout où il regarde ses interventions : en liste
-- et en kanban (spécification §7.7, lot L2 point 7).
--
-- Or la liste et le kanban lisent les colonnes DIRECTES de `interventions`
-- (`DEFAULT_INTERVENTION_COLUMNS` de l'Edge Function) : le démarrage vit, lui,
-- sur `intervention_artisans`. On applique donc EXACTEMENT la mécanique déjà
-- retenue pour le badge « À vérifier » (`has_portal_report`, migration 99076) :
-- une colonne projetée sur `interventions`, écrite par un trigger et par lui
-- seul, jamais par une route.
--
-- Ce que la base ne fait PAS : recalculer les quatorze champs d'entrée
-- d'`INTER_EN_COURS`. Ces règles vivent dans `src/config/workflow-rules.ts` et
-- nulle part ailleurs — les redire en SQL, c'est les voir diverger. La route
-- écrit le COMPTE qu'elle a constaté (`work_start_missing_count`), le trigger
-- se contente de le projeter.
--
-- IDEMPOTENTE ET REJOUABLE : ADD COLUMN IF NOT EXISTS, DROP avant CREATE pour
-- la fonction et le trigger, CREATE INDEX IF NOT EXISTS.
-- Aucune table nouvelle : la RLS des deux tables touchées est inchangée.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La dette de saisie constatée au moment de la déclaration
-- ----------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- BORNE D'ATTENTE DES VERROUS (correctif de recette, constat 1).
--
-- 99077 ajoute intervention_attachments, artisan_reports et artisan_attachments
-- a la publication « supabase_realtime ». Le gestionnaire d'abonnements de
-- Supabase Realtime (application_name « realtime_subscription_manager_pub ») se
-- reveille alors pour lire ces relations (AccessShareLock) au moment meme ou ces
-- migrations demandent un AccessExclusiveLock sur les memes tables ou leurs
-- voisines : un deadlock 40P01 a ete observe une fois sur quatre resets locaux,
-- et la fenetre est ouverte a chaque deploiement en production, ou Realtime est
-- toujours vivant.
--
-- Sans borne, l'attente est infinie et rien ne fait reessayer. Avec elle, la
-- collision devient un echec net (55P03 lock_not_available) sur une migration
-- deja IDEMPOTENTE : il suffit de la rejouer. On prefere un echec lisible et
-- rejouable a un deadlock aleatoire.
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';
ALTER TABLE public.intervention_artisans
  ADD COLUMN IF NOT EXISTS work_start_missing_count SMALLINT;

COMMENT ON COLUMN public.intervention_artisans.work_start_missing_count IS
  'Nombre de champs d''entrée d''INTER_EN_COURS encore manquants au moment où '
  'l''artisan a déclaré son démarrage. Écrit par la route de démarrage '
  '(src/lib/portal-external/work-start.ts) à partir de la configuration du '
  'workflow ; jamais recalculé en SQL. NULL = démarrage antérieur à 99084.';

-- ----------------------------------------------------------------------------
-- 2. Les deux colonnes projetées sur l'intervention
-- ----------------------------------------------------------------------------
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS portal_work_started_at TIMESTAMPTZ;
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS portal_work_missing_count SMALLINT;

COMMENT ON COLUMN public.interventions.portal_work_started_at IS
  'Plus ancien intervention_artisans.work_started_at de l''intervention. '
  'Projection de lecture pour la liste et le kanban ; écrite par le seul '
  'trigger trg_intervention_artisans_sync_work_start.';
COMMENT ON COLUMN public.interventions.portal_work_missing_count IS
  'work_start_missing_count de l''affectation qui a démarré la première. '
  'Alimente le badge « Démarré · n champs manquants » en liste et en kanban.';

-- Une seule ligne sur mille porte un démarrage sans statut avancé : index
-- partiel, comme celui de has_portal_report.
CREATE INDEX IF NOT EXISTS idx_interventions_portal_work_started
  ON public.interventions(portal_work_started_at)
  WHERE portal_work_started_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Trigger de projection — seul mécanisme d'écriture des deux colonnes
-- ----------------------------------------------------------------------------
-- Couvre le DELETE (désaffectation d'un artisan) pour que le badge ne reste
-- pas figé sur une intervention dont plus personne n'a déclaré de démarrage.
DROP TRIGGER IF EXISTS trg_intervention_artisans_sync_work_start ON public.intervention_artisans;
DROP FUNCTION IF EXISTS public.fn_intervention_artisans_sync_work_start();
CREATE FUNCTION public.fn_intervention_artisans_sync_work_start()
RETURNS TRIGGER AS $$
DECLARE
    v_intervention_id UUID := COALESCE(NEW.intervention_id, OLD.intervention_id);
    v_started_at TIMESTAMPTZ;
    v_missing SMALLINT;
BEGIN
    SELECT ia.work_started_at, ia.work_start_missing_count
      INTO v_started_at, v_missing
      FROM public.intervention_artisans ia
     WHERE ia.intervention_id = v_intervention_id
       AND ia.work_started_at IS NOT NULL
     ORDER BY ia.work_started_at ASC
     LIMIT 1;

    UPDATE public.interventions i
       SET portal_work_started_at    = v_started_at,
           portal_work_missing_count = v_missing
     WHERE i.id = v_intervention_id
       AND (i.portal_work_started_at    IS DISTINCT FROM v_started_at
         OR i.portal_work_missing_count IS DISTINCT FROM v_missing);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_intervention_artisans_sync_work_start
    AFTER INSERT OR UPDATE OF work_started_at, work_start_missing_count OR DELETE
    ON public.intervention_artisans
    FOR EACH ROW EXECUTE FUNCTION public.fn_intervention_artisans_sync_work_start();

COMMENT ON FUNCTION public.fn_intervention_artisans_sync_work_start() IS
  'Seul mécanisme qui écrit interventions.portal_work_started_at et '
  'portal_work_missing_count (jamais les routes API)';

-- ----------------------------------------------------------------------------
-- 4. Rattrapage des démarrages déjà déclarés
-- ----------------------------------------------------------------------------
UPDATE public.interventions i
   SET portal_work_started_at    = d.work_started_at,
       portal_work_missing_count = d.work_start_missing_count
  FROM (
    SELECT DISTINCT ON (ia.intervention_id)
           ia.intervention_id,
           ia.work_started_at,
           ia.work_start_missing_count
      FROM public.intervention_artisans ia
     WHERE ia.work_started_at IS NOT NULL
     ORDER BY ia.intervention_id, ia.work_started_at ASC
  ) d
 WHERE i.id = d.intervention_id
   AND i.portal_work_started_at IS DISTINCT FROM d.work_started_at;
