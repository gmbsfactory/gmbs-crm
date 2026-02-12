# Panneau IA Interactif — Prochaines Etapes

## Vue d'ensemble

Le panneau IA interactif transforme l'action "Prochaines etapes" d'un simple affichage markdown en une interface actionnable avec des boutons qui executent de vraies actions CRM.

### Architecture

```
|------- Viewport (>= 1280px) -------|
| AISidePanel (38vw)  | InterventionModal (halfpage, 50%) |
| - Texte IA          | - Formulaire intervention          |
| - Boutons d'action  | - Tabs, artisans, couts            |
|_____________________|_____________________________________|
```

Sur ecrans < 1280px : le panneau IA devient un Sheet (drawer) depuis le bas.

## Composants

### `AISidePanel` (`src/components/ai/AISidePanel.tsx`)

Panneau lateral fixe a gauche du modal intervention :
- Position : `fixed top-0 left-0 z-[69]` (sous le modal z-[70])
- Largeur : `w-[38vw] max-w-[550px] min-w-[360px]`
- Animation : slide-in depuis la gauche (framer-motion)
- Responsive : Sheet en bas sur ecrans < 1280px

### `AIActionButton` (`src/components/ai/AIActionButton.tsx`)

Bouton individuel pour chaque action suggeree :
- `change_status` : badge colore avec couleur du statut cible
- `assign_artisan` : icone user-plus
- `navigate_section` : bouton link-style
- `send_email` : icone mail
- `add_comment` : icone message-square

Support des etats disabled avec tooltip explicatif.

### `AIMarkdownContent` (`src/components/ai/AIMarkdownContent.tsx`)

Composant partage de rendu markdown extrait depuis `AIAssistantDialog`. Utilise par les deux interfaces (dialog centre et panneau lateral).

## Store

### `useAIPanelStore` (`src/stores/ai-panel-store.ts`)

Store Zustand gerant l'etat du panneau IA :
- `isPanelOpen` : boolean
- `panelInterventionId` : string | null
- `openPanel(id)` / `closePanel()` : actions

Lu par `ModalDisplayContext` pour forcer le mode halfpage quand le panneau est ouvert.

## Types d'actions

### `AIActionButtonType`

```typescript
type AIActionButtonType =
  | 'change_status'    // Changer le statut de l'intervention
  | 'assign_artisan'   // Ouvrir la recherche d'artisan
  | 'navigate_section' // Naviguer vers une section du formulaire
  | 'send_email'       // Ouvrir le modal email (client/artisan)
  | 'add_comment'      // Ouvrir la section commentaires
```

### `AIActionPayload`

Union discriminee par `type` contenant les parametres specifiques a chaque action :
- `change_status` : code/label du statut cible, flag requires_comment
- `assign_artisan` : code metier et code postal optionnels
- `navigate_section` : nom de la section cible
- `send_email` : type d'email (client/artisan)
- `add_comment` : pas de parametres supplementaires

## Flux d'execution

```
1. Utilisateur clique "Prochaines etapes" (ou Cmd+Shift+P)
2. AIShortcutsProvider detecte modal ouvert + ecran large
3. openPanel(entityId) → store mis a jour
4. ModalDisplayContext force halfpage (via useAIPanelStore)
5. AISidePanel s'affiche avec le contenu IA + boutons d'action
6. Utilisateur clique un bouton
7. useAIActionExecutor dispatche un custom event DOM
8. InterventionEditForm/InterventionModalContent ecoute l'event
9. Action CRM executee (mutation, ouverture modal, scroll)
```

## Communication inter-composants

Le panneau IA est rendu dans un portal separe du modal intervention. La communication utilise des **custom events DOM** pour un decouplage maximal :

| Event | Source | Cible | Action |
|-------|--------|-------|--------|
| `ai:open-artisan-search` | AISidePanel | InterventionEditForm | Ouvre ArtisanSearchModal |
| `ai:navigate-section` | AISidePanel | InterventionEditForm | Ouvre et scroll vers la section |
| `ai:focus-comment` | AISidePanel | InterventionEditForm | Ouvre et focus les commentaires |
| `ai:open-email-modal` | AISidePanel | InterventionModalContent | Ouvre le modal email |
| `ai:change-status` | AISidePanel | InterventionModalContent | Ouvre StatusReasonModal ou mutation directe |

Chaque event inclut un `interventionId` dans le detail pour eviter les collisions quand plusieurs modals pourraient etre ouverts.

## Generation des actions (Edge Function)

La fonction `buildSuggestedActions()` dans `supabase/functions/ai-contextual-action/index.ts` est **deterministe** (pas d'appel IA) :

1. Lit le `statut_code` depuis `entity_data`
2. Genere les transitions de statut valides (max 3)
3. Ajoute "Assigner artisan" si aucun artisan et statut le requiert
4. Ajoute "Email client/artisan" si pertinent
5. Ajoute "Naviguer vers section" pour les donnees manquantes
6. Ajoute "Ajouter commentaire" (toujours disponible)
7. Retourne max 6 actions, triees par priorite

Les regles de transition sont une copie statique de `src/config/workflow-rules.ts`.

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Cmd+Shift+P` | Toggle panneau IA lateral |
| `Cmd+Shift+A` | Menu des actions IA |

## Tests

- `tests/unit/lib/ai/types.test.ts` — Validation types
- `tests/unit/hooks/useAIActionExecutor.test.ts` — Events et dispatch
- `tests/unit/components/ai/AIActionButton.test.tsx` — Rendu et interactions
- `tests/unit/components/ai/AISidePanel.test.tsx` — Rendu conditionnel et chargement
