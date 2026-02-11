# UI Cleanup 2025

## Contexte
- Objectif : alléger l'interface CRM en retirant les modules expérimentaux Chat, Tâches et IA.
- Motivation : ces fonctionnalités n'étaient plus maintenues, généraient des appels réseaux et des raccourcis cassés, et alourdissaient le layout principal.

## Changements clés
- Suppression des routes Next.js `app/chat`, `app/chat-4`, `app/chat-5`, `app/tasks`, `app/ia` et des APIs associées (`app/api/chat*`, `app/api/views*`).
- Retrait complet des features front `src/features/ai/` et `src/features/chat/`, ainsi que des hooks/contexts reliés.
- Nettoyage des layouts (`app/layout.tsx`, `app/layout-complex.tsx`) pour retirer `AIProvider`, `AIQuickModal` et les raccourcis clavier IA.
- Simplification de la topbar et de la sidebar : plus de bouton "Demander à l'IA", navigation réduite aux entrées actives (Dashboard, Interventions, Artisans, Paramètres).
- Débranchement des appels `/tasks` hérités : les composants n'exposent plus d'actions "Créer tâche" ni de redirection vers un module inexistant.
- Mise à jour des endpoints de checkout pour rediriger vers `/dashboard` au lieu de `/chat`.

## Impact produit
- L'interface est recentrée sur les parcours actifs ; aucune dépendance résiduelle vers les modules supprimés.
- Les utilisateurs n'ont plus de raccourcis ou CTA pointant vers des écrans absents, réduisant le risque d'erreur 404.
- Le code base est allégé : moins de providers, moins de tests ciblant l'ancienne IA, build plus rapide.

## Points d'attention
- Les tables Supabase `ai_views` peuvent être conservées pour archivage, mais ne sont plus consommées côté app.
- Les scripts ou docs historiques (ex. `README_IA.md`) sont conservés à titre de référence technique ; prévoir un archivage ultérieur si nécessaire.

## Prochaines étapes
1. Surveiller les analytics pour confirmer l'absence de trafic vers les anciennes routes.
2. Envisager la suppression des dépendances backend inutilisées (tables IA, endpoints éventuels) une fois la stabilisation confirmée.
3. Mettre à jour la documentation produit pour refléter la navigation réduite.
