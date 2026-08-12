-- Migration : recherche d'artisans a proximite entierement cote base
--
-- Bug corrige (signale sur l'intervention 22706, LA BOISSELLE 91180) :
-- l'artisan SEVENO CEDRIC, plombier situe a 6,04 km du logement et donc le
-- PLUS PROCHE des 562 plombiers geolocalises, n'etait jamais propose.
--
-- Cause : le hook useNearbyArtisans chargeait les artisans du metier par lots
-- puis s'arretait a un plafond arbitraire (sampleSize = 400) AVANT de calculer
-- la moindre distance. Le metier plomberie compte 572 artisans ; Seveno etait
-- le 521e dans l'ordre de restitution de Postgres, donc jamais charge, donc
-- jamais evalue. Le filtre geographique s'appliquait apres la troncature.
--
-- Aggravant : cet ordre de restitution n'est pas trie, il depend de la
-- disposition physique des lignes. Le bug etait donc non deterministe --
-- l'artisan perdu changeait au gre des UPDATE, d'ou le « ca marche parfois ».
--
-- Fix : pousser le filtrage ET le tri geographique en base. La fonction
-- renvoie directement les N artisans les plus proches, sans plafond
-- intermediaire. Le resultat est exhaustif et deterministe.
--
-- Choix technique : pas de dependance a PostGIS (non installee sur ce projet).
-- On utilise un pre-filtre par bounding box -- sargable, donc capable
-- d'exploiter un index btree -- puis un calcul haversine exact sur le petit
-- ensemble restant. Precision identique a l'implementation TypeScript
-- remplacee (meme formule, meme rayon terrestre de 6371 km).
--
-- SECURITY INVOKER : la fonction lit `artisans` et `artisan_attachments` avec
-- les droits de l'appelant, donc les politiques RLS existantes continuent de
-- s'appliquer exactement comme lorsque le client interrogeait ces tables
-- directement. Ne PAS passer en SECURITY DEFINER : cela contournerait le
-- cloisonnement par tenant.

-- Index de support du pre-filtre bounding box. Partiel : les artisans sans
-- coordonnees ne sont jamais candidats, inutile de les indexer.
CREATE INDEX IF NOT EXISTS idx_artisans_intervention_coords
  ON public.artisans (intervention_latitude, intervention_longitude)
  WHERE intervention_latitude IS NOT NULL
    AND intervention_longitude IS NOT NULL;

-- Support de la contrainte metier (EXISTS sur artisan_metiers).
CREATE INDEX IF NOT EXISTS idx_artisan_metiers_metier_artisan
  ON public.artisan_metiers (metier_id, artisan_id);

DROP FUNCTION IF EXISTS public.find_nearby_artisans(double precision, double precision, double precision, uuid, integer);

CREATE FUNCTION public.find_nearby_artisans(
  p_latitude   double precision,
  p_longitude  double precision,
  p_radius_km  double precision,
  p_metier_id  uuid,
  p_limit      integer DEFAULT 100
)
RETURNS TABLE (
  id                        uuid,
  prenom                    text,
  nom                       text,
  raison_sociale            text,
  telephone                 text,
  telephone2                text,
  email                     text,
  adresse_intervention      text,
  code_postal_intervention  text,
  ville_intervention        text,
  intervention_latitude     double precision,
  intervention_longitude    double precision,
  statut_id                 uuid,
  distance_km               double precision,
  photo_url                 text,
  photo_content_hash        text,
  photo_derived_sizes       jsonb,
  photo_mime_preferred      text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      -- 1 degre de latitude ~ 111,045 km, partout sur le globe.
      p_radius_km / 111.045                                          AS lat_delta,
      -- 1 degre de longitude retrecit avec la latitude. Au-dela de 89 degres
      -- cos() tend vers 0 et la division exploserait : on ouvre alors la boite
      -- sur toute la plage de longitudes (le haversine tranchera).
      CASE
        WHEN abs(p_latitude) >= 89 THEN 180.0
        ELSE p_radius_km / (111.045 * cos(radians(p_latitude)))
      END                                                            AS lng_delta
  ),
  candidates AS (
    SELECT
      a.id,
      a.prenom,
      a.nom,
      a.raison_sociale,
      a.telephone,
      a.telephone2,
      a.email,
      a.adresse_intervention,
      a.code_postal_intervention,
      a.ville_intervention,
      a.intervention_latitude::double precision  AS intervention_latitude,
      a.intervention_longitude::double precision AS intervention_longitude,
      a.statut_id,
      -- Haversine, rayon terrestre 6371 km.
      (6371 * 2 * asin(sqrt(
        power(sin(radians(a.intervention_latitude::double precision - p_latitude) / 2), 2)
        + cos(radians(p_latitude))
        * cos(radians(a.intervention_latitude::double precision))
        * power(sin(radians(a.intervention_longitude::double precision - p_longitude) / 2), 2)
      )))::double precision AS distance_km
    FROM public.artisans a
    CROSS JOIN bounds b
    WHERE a.intervention_latitude IS NOT NULL
      AND a.intervention_longitude IS NOT NULL
      -- Pre-filtre bounding box : sargable, exploite l'index ci-dessus.
      AND a.intervention_latitude  BETWEEN (p_latitude  - b.lat_delta)::numeric AND (p_latitude  + b.lat_delta)::numeric
      AND a.intervention_longitude BETWEEN (p_longitude - b.lng_delta)::numeric AND (p_longitude + b.lng_delta)::numeric
      -- Metier obligatoire : aucune proposition d'artisan sans metier choisi.
      -- EXISTS plutot qu'un JOIN : pas de duplication de ligne possible.
      AND EXISTS (
        SELECT 1 FROM public.artisan_metiers am
        WHERE am.artisan_id = a.id
          AND am.metier_id = p_metier_id
      )
      -- Les artisans archives ne sont jamais proposes.
      AND NOT EXISTS (
        SELECT 1 FROM public.artisan_statuses s
        WHERE s.id = a.statut_id
          AND s.code = 'ARCHIVE'
      )
  )
  SELECT
    c.id,
    c.prenom,
    c.nom,
    c.raison_sociale,
    c.telephone,
    c.telephone2,
    c.email,
    c.adresse_intervention,
    c.code_postal_intervention,
    c.ville_intervention,
    c.intervention_latitude,
    c.intervention_longitude,
    c.statut_id,
    c.distance_km,
    photo.url,
    photo.content_hash,
    photo.derived_sizes,
    coalesce(photo.mime_preferred, photo.mime_type)
  FROM candidates c
  LEFT JOIN LATERAL (
    SELECT att.url, att.content_hash, att.derived_sizes, att.mime_preferred, att.mime_type
    FROM public.artisan_attachments att
    WHERE att.artisan_id = c.id
      AND att.kind = 'photo_profil'
      AND att.url IS NOT NULL
      AND btrim(att.url) <> ''
    ORDER BY att.created_at DESC
    LIMIT 1
  ) photo ON TRUE
  -- La bounding box est un carre circonscrit : on reverifie le rayon exact.
  WHERE c.distance_km <= p_radius_km
  -- Tri par id en second critere : ordre total, donc resultat reproductible
  -- meme lorsque deux artisans sont a distance strictement egale.
  ORDER BY c.distance_km ASC, c.id ASC
  LIMIT greatest(p_limit, 0);
$$;

COMMENT ON FUNCTION public.find_nearby_artisans IS
  'Artisans d''un metier donne dans un rayon (km) autour d''un point, tries du plus proche au plus lointain. Exhaustif : aucun plafond d''echantillonnage. Exclut les artisans archives et ceux sans coordonnees d''intervention.';

GRANT EXECUTE ON FUNCTION public.find_nearby_artisans(double precision, double precision, double precision, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_artisans(double precision, double precision, double precision, uuid, integer) TO service_role;
