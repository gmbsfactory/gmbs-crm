-- ============================================================================
-- 99056 - Restaure les policies RLS manquantes sur les tables enfants artisan
-- ============================================================================
--
-- CONTEXTE / BUG
-- --------------
-- RLS etait ACTIVEE sur artisan_attachments, artisan_zones et artisan_absences
-- mais AUCUNE policy n'existait dessus. Sous PostgreSQL, "RLS activee + 0 policy"
-- = deny-all : le role `authenticated` (le client de l'app) ne peut RIEN lire.
--
-- Symptome principal : l'avatar (photo de profil) de l'artisan ne s'affichait
-- plus. La photo est lue cote client via l'embed PostgREST
-- `artisans -> artisan_attachments` (artisansApi.getById). RLS renvoyait un
-- tableau vide => photoProfilMetadata = null => initiales. Le gestionnaire de
-- documents continuait de voir les fichiers car il passe par l'Edge Function
-- `documents` (service_role, qui ignore RLS).
--
-- Symptomes secondaires : les zones et absences de l'artisan, egalement lues par
-- embed cote client, revenaient vides (et l'ajout d'absence cote client cassait).
--
-- CORRECTIF
-- ---------
-- On recree le meme jeu de policies que la table soeur public.intervention_attachments
-- (acces complet pour le role authenticated, USING true) : ce CRM est interne et
-- son modele de securite considere tout utilisateur authentifie comme de confiance,
-- exactement comme intervention_attachments / artisans le font deja.
--
-- Idempotent : DROP POLICY IF EXISTS avant chaque CREATE.
-- ============================================================================

-- S'assure que RLS reste activee (no-op si deja le cas).
ALTER TABLE public.artisan_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_zones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_absences     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- artisan_attachments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access for authenticated users"   ON public.artisan_attachments;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.artisan_attachments;
DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.artisan_attachments;
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.artisan_attachments;

CREATE POLICY "Allow read access for authenticated users"
  ON public.artisan_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access for authenticated users"
  ON public.artisan_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access for authenticated users"
  ON public.artisan_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access for authenticated users"
  ON public.artisan_attachments FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- artisan_zones
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access for authenticated users"   ON public.artisan_zones;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.artisan_zones;
DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.artisan_zones;
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.artisan_zones;

CREATE POLICY "Allow read access for authenticated users"
  ON public.artisan_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access for authenticated users"
  ON public.artisan_zones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access for authenticated users"
  ON public.artisan_zones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access for authenticated users"
  ON public.artisan_zones FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- artisan_absences
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access for authenticated users"   ON public.artisan_absences;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.artisan_absences;
DROP POLICY IF EXISTS "Allow update access for authenticated users" ON public.artisan_absences;
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON public.artisan_absences;

CREATE POLICY "Allow read access for authenticated users"
  ON public.artisan_absences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access for authenticated users"
  ON public.artisan_absences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access for authenticated users"
  ON public.artisan_absences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access for authenticated users"
  ON public.artisan_absences FOR DELETE TO authenticated USING (true);
