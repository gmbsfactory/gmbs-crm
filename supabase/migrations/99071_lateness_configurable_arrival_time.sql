-- Migration: Heure d'arrivee configurable pour le suivi des retards
-- Description: L'heure limite d'arrivee etait codee en dur a 10h00 a deux endroits
--              (calcul du retard + libelle de l'email), ce qui garantissait une
--              derive entre les deux. On la stocke desormais dans la config unique
--              lateness_email_config, avec 10h00 par defaut (comportement inchange).
-- Date: 2026-08-02

ALTER TABLE public.lateness_email_config
  ADD COLUMN IF NOT EXISTS arrival_hour smallint NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS arrival_minute smallint NOT NULL DEFAULT 0;

-- L'heure est exprimee dans le fuseau metier (Europe/Paris), jamais en UTC.
COMMENT ON COLUMN public.lateness_email_config.arrival_hour IS
  'Heure limite d''arrivee (0-23), exprimee en Europe/Paris. Au-dela, la premiere activite du jour est comptee en retard.';
COMMENT ON COLUMN public.lateness_email_config.arrival_minute IS
  'Minutes de l''heure limite d''arrivee (0-59), exprimees en Europe/Paris.';

ALTER TABLE public.lateness_email_config
  DROP CONSTRAINT IF EXISTS lateness_email_config_arrival_hour_check;
ALTER TABLE public.lateness_email_config
  ADD CONSTRAINT lateness_email_config_arrival_hour_check
  CHECK (arrival_hour BETWEEN 0 AND 23);

ALTER TABLE public.lateness_email_config
  DROP CONSTRAINT IF EXISTS lateness_email_config_arrival_minute_check;
ALTER TABLE public.lateness_email_config
  ADD CONSTRAINT lateness_email_config_arrival_minute_check
  CHECK (arrival_minute BETWEEN 0 AND 59);

NOTIFY pgrst, 'reload schema';
