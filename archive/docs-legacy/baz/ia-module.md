# Module IA CRM GMBS

## Vue d'ensemble
- **State global** : `AIProvider` (`src/features/ai/context/AIContext.tsx`) expose les réponses stockées, l'exécution d'outils et le mini-modal.
- **Hooks** : `useAI` (client) donne accès aux réponses, à `executeAction`, aux helpers (`buildFullPageUrl`, `openQuickModal`).
- **Rendu unifié** : `AIResponseRenderer` supporte tableaux, cartes, cartes extensibles, markdown, CSV et diagrammes Mermaid, avec un switcher intégré (table/cartes/CSV) par dataset.
- **Surfaces UI** :
  - Chat (`ChatMessageList`) affiche automatiquement les réponses IA et propose l'ouverture plein écran (`/ia/resultats/[id]`).
  - Mini-modal Cmd+/ (`AIQuickModal`) pour une requête contextuelle (interventions, artisans, tâches, global) avec focus et blocage des raccourcis de page.
  - Boutons "Demander à l'IA" ajoutés dans les vues Interventions, Artisans et Tâches (contexte passé à `openQuickModal`).
  - Sélecteur "Vues IA enregistrées" sur `/interventions` qui charge les vues persistées.

## API & endpoints
- `POST /api/chat`
  - Génère la réponse IA, enregistre la structure (`AIResponse`) dans `messages.payload`.
  - Supporte le rendu structuré via `buildAiResponseFromTools` (dataset multi-vues + résumé).
  - Déclare les outils `change_intervention_status` et `create_dynamic_view` (confirmation côté UI).
  - Journalise la consommation dans `usage_events`.
- `GET /api/chat/history`
  - Retourne les messages + `aiResponses` récupérées depuis `payload`.
- `GET /api/chat/responses/:id`
  - Récupère une réponse IA stockée pour affichage plein écran.
- `POST /api/chat/actions`
  - `tool = change_intervention_status`
    - Vérifie la transition (`AUTHORIZED_TRANSITIONS`), impose artisan si nécessaire, quotas (25/24h).
    - Met à jour Supabase (table `interventions`), log `usage_events` + `audit_actions` (catch si table absente).
  - `tool = create_dynamic_view`
    - Persiste la vue dans `ai_views`, renvoie `viewId`, lien d'ouverture et supprime l'action une fois confirmée.
- `GET /api/views?context=interventions`
  - Liste les vues IA persistées (table `ai_views`).
- `GET /api/views/:id`
  - Récupère une vue IA unique (utilisée pour `/interventions?aiView=...`).
- `POST /api/views`
  - Crée une vue (utilisé par le tool IA). Déduplication via `signature`.
- `DELETE /api/views/:id`
  - Supprime une vue IA.

## Quotas & sécurité
- Quotas journaliers via `usage_events` (`ai_tool_change_status`, `ai_tool_create_view`).
- Confirmation en UI (actions marquées `requiresConfirmation` côté client).
- `buildStatusUpdatePayload` garantit le mapping statuts ⇄ DB.
- Audit : tentative d'insertion dans `audit_actions` (sous `try/catch` si table manquante).

## Création & persistance des vues dynamiques
- Table `ai_views` (migration `20241010121000_create_ai_views.sql`) : colonnes `context`, `layout`, `filters`, `sorts`, `visible_properties`, `layout_options`, `metadata`, `signature`.
- Signature stable via `computeViewSignature` (hash SHA-256) pour éviter les doublons.
- Action "Sauvegarder cette vue" :
  - Générée côté serveur (`buildAiResponseFromTools`).
  - Confirmation UI → POST `/api/chat/actions` (`tool=create_dynamic_view`).
  - Une fois créée, l'action est retirée de la réponse et un lien `/interventions?aiView=<id>` est fourni.
- Côté client :
  - Événement `ai:view-created` dispatché pour rafraîchir la liste (`refreshAiViews`).
  - `/interventions` expose un menu "Vues IA enregistrées" et applique la vue via `registerExternalView` (`useInterventionViews`).
  - Support du paramètre `?aiView=<id>` pour ouvrir une vue directement depuis un lien chat.

## Actions IA (chat)
- **Changement de statut** :
  - Le modèle déclenche l'outil `change_intervention_status` → un bouton de confirmation apparaît dans le chat.
  - Confirmation côté client (`window.confirm`) puis POST `/api/chat/actions` → mise à jour Supabase, quota décrémenté, audit log.
- **Création de vue** :
  - L'IA suggère l'enregistrement d'une vue ; le bouton ouvre un prompt pour le titre, crée la ligne dans `ai_views`, rafraîchit la liste UI et ajoute un résumé dans la conversation.
- Les actions restent historisées via `/chat` ; les pages full-screen ne créent pas de nouveau flux.

## Tests
- `tests/ai-response-builder.test.ts` (Vitest) couvre :
  - Génération de tableau depuis `query_interventions`.
  - Description des filtres (`describeFilters`).
- Exécution : `npx vitest run tests/ai-response-builder.test.ts`
- `tests/view-signature.test.ts` sécurise la stabilité des signatures de vues IA.

## Flux Cmd+/ mini-modal
- `AIQuickModal` met le focus sur l'input et bloque les interactions clavier globales (space, etc.).
- Les requêtes déclenchent `/api/chat` avec contexte (`interventions`/`artisans`/`tasks`/`general`) pour des réponses ciblées.

## Prochaines étapes suggérées
- Étendre les actions IA (mapping multi-lignes, confirmation UI dédiée).
- Ajout de tests e2e (chat complet, exécution outil, mini-modal).
- Documenter l'implantation dans `docs/baz/prompt-ajout-interactions-ui.md` si d'autres interactions IA sont ajoutées.
- Propager la mise à jour `AIResponse` aux historiques existants via migration si nécessaire.
