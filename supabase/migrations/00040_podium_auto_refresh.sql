-- ========================================
-- Système de rafraîchissement automatique du podium
-- Rafraîchit les résultats chaque vendredi à 16h
-- ========================================

-- Table pour tracker les périodes de podium
CREATE TABLE IF NOT EXISTS public.podium_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  is_current boolean DEFAULT false
);

-- Unique index pour garantir qu'une seule période peut être courante à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_podium_periods_current_unique 
  ON public.podium_periods(is_current) 
  WHERE is_current = true;

-- Index pour améliorer les performances des requêtes sur is_current
CREATE INDEX IF NOT EXISTS idx_podium_periods_current ON public.podium_periods(is_current) WHERE is_current = true;
CREATE INDEX idx_podium_periods_dates ON public.podium_periods(period_start, period_end);

-- Fonction pour calculer la période de podium actuelle
-- Le podium se rafraîchit chaque vendredi à 16h
-- La période va du vendredi 16h au vendredi suivant 16h
CREATE OR REPLACE FUNCTION public.get_current_podium_period()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now timestamptz;
  v_current_friday timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_day_of_week int;
  v_current_hour int;
BEGIN
  -- Obtenir l'heure actuelle en UTC
  v_now := now();

  -- Extraire le jour de la semaine (0 = Dimanche, 5 = Vendredi)
  v_day_of_week := EXTRACT(DOW FROM v_now);

  -- Extraire l'heure actuelle
  v_current_hour := EXTRACT(HOUR FROM v_now);

  -- Calculer le vendredi de référence à 16h
  -- Si on est vendredi et qu'il est >= 16h, on utilise ce vendredi
  -- Sinon, on utilise le vendredi précédent
  IF v_day_of_week = 5 AND v_current_hour >= 16 THEN
    -- On est vendredi après 16h, on utilise aujourd'hui à 16h
    v_current_friday := date_trunc('day', v_now) + interval '16 hours';
  ELSIF v_day_of_week = 5 AND v_current_hour < 16 THEN
    -- On est vendredi avant 16h, on utilise le vendredi dernier
    v_current_friday := date_trunc('day', v_now) - interval '7 days' + interval '16 hours';
  ELSE
    -- On n'est pas vendredi, calculer le vendredi précédent
    -- Nombre de jours à soustraire pour atteindre le vendredi précédent
    v_current_friday := date_trunc('day', v_now) -
                        interval '1 day' * ((v_day_of_week + 2) % 7) +
                        interval '16 hours';
  END IF;

  -- La période commence au vendredi à 16h et se termine le vendredi suivant à 16h
  v_period_start := v_current_friday;
  v_period_end := v_current_friday + interval '7 days';

  RETURN jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'is_active', true
  );
END;
$$;

-- Fonction pour initialiser/mettre à jour la période courante
CREATE OR REPLACE FUNCTION public.refresh_current_podium_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_period jsonb;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_existing_period_id uuid;
BEGIN
  -- Calculer la période actuelle
  v_current_period := public.get_current_podium_period();
  v_period_start := (v_current_period->>'period_start')::timestamptz;
  v_period_end := (v_current_period->>'period_end')::timestamptz;

  -- Vérifier si cette période existe déjà
  SELECT id INTO v_existing_period_id
  FROM public.podium_periods
  WHERE period_start = v_period_start
    AND period_end = v_period_end
  LIMIT 1;

  IF v_existing_period_id IS NULL THEN
    -- Désactiver toutes les périodes courantes
    UPDATE public.podium_periods
    SET is_current = false
    WHERE is_current = true;

    -- Créer la nouvelle période
    INSERT INTO public.podium_periods (period_start, period_end, is_current)
    VALUES (v_period_start, v_period_end, true);

    RAISE NOTICE 'Nouvelle période de podium créée: % -> %', v_period_start, v_period_end;
  ELSE
    -- La période existe déjà, s'assurer qu'elle est marquée comme courante
    UPDATE public.podium_periods
    SET is_current = false
    WHERE is_current = true AND id != v_existing_period_id;

    UPDATE public.podium_periods
    SET is_current = true
    WHERE id = v_existing_period_id;
  END IF;
END;
$$;

-- Initialiser la période actuelle
SELECT public.refresh_current_podium_period();

-- Grant permissions
GRANT SELECT ON public.podium_periods TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_podium_period TO authenticated;

-- Pour permettre le rafraîchissement manuel par les admins si nécessaire
COMMENT ON FUNCTION public.refresh_current_podium_period IS 'Rafraîchit la période de podium actuelle (appelée automatiquement par cron)';

-- ========================================
-- Configuration pg_cron (à exécuter manuellement avec un utilisateur postgres)
-- ========================================

-- IMPORTANT: Cette partie doit être exécutée manuellement par un administrateur Supabase
-- car pg_cron nécessite des privilèges spéciaux

-- Pour activer pg_cron dans Supabase:
-- 1. Aller dans le Dashboard Supabase > Database > Extensions
-- 2. Activer l'extension "pg_cron"
-- 3. Exécuter la commande suivante dans le SQL Editor:

/*
SELECT cron.schedule(
  'refresh-podium-period',           -- nom du job
  '0 16 * * 5',                      -- tous les vendredis à 16h UTC
  $$SELECT public.refresh_current_podium_period()$$
);
*/

-- Pour vérifier les jobs cron (nécessite les privilèges postgres):
-- SELECT * FROM cron.job;

-- Pour supprimer un job si nécessaire:
-- SELECT cron.unschedule('refresh-podium-period');
