-- Mettre une intervention existante à INTER_TERMINEE et lier l'artisan
UPDATE public.interventions
SET 
  statut_id = (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1),
  date_termine = CURRENT_DATE,
  updated_at = now()
WHERE id = 'VOTRE_INTERVENTION_ID'::uuid  -- ⚠️ REMPLACEZ par l'ID de l'intervention
RETURNING id;

-- Puis lier l'artisan (si pas déjà lié)
INSERT INTO public.intervention_artisans (
  intervention_id,
  artisan_id,
  role,
  is_primary,
  assigned_at,
  created_at
)
VALUES (
  'VOTRE_INTERVENTION_ID'::uuid,  -- ⚠️ REMPLACEZ par l'ID de l'intervention
  'VOTRE_ARTISAN_ID'::uuid,       -- ⚠️ REMPLACEZ par l'ID de l'artisan
  'primary',
  true,
  now(),
  now()
)
ON CONFLICT (intervention_id, artisan_id) DO UPDATE
SET is_primary = true;