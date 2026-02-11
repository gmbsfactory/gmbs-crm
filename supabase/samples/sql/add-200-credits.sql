-- Script pour ajouter 200 crédits IA dans la table billing_state
-- Date: 2025-10-16
-- ATTENTION: Ce script ajoute les crédits, il ne reset PAS la base de données

-- Option 1: Ajouter 200 crédits via usage_events (recommandé - utilise le trigger automatique)
-- Le trigger apply_usage_delta() mettra automatiquement à jour billing_state

-- Pour l'utilisateur global pool (user_id NULL)
INSERT INTO public.usage_events (user_id, delta, reason, created_at)
VALUES (NULL, 200, 'Ajout manuel de 200 crédits IA', NOW());

-- Option 2: Si vous voulez ajouter 200 crédits à un utilisateur spécifique
-- Décommentez et remplacez 'USERNAME_ICI' par le nom d'utilisateur réel
-- INSERT INTO public.usage_events (user_id, delta, reason, created_at)
-- SELECT u.id, 200, 'Ajout manuel de 200 crédits IA', NOW()
-- FROM public.users u
-- WHERE u.username = 'USERNAME_ICI';

-- Option 3: Mise à jour directe (si le pool global existe déjà)
-- UPDATE public.billing_state
-- SET requests_remaining = requests_remaining + 200,
--     updated_at = NOW()
-- WHERE user_id IS NULL;

-- Vérifier le résultat
SELECT 
  id,
  user_id,
  requests_remaining,
  current_plan_id,
  status,
  updated_at
FROM public.billing_state
ORDER BY updated_at DESC;



