# AI Contextual Assistant

> Guide d'implementation de l'assistant IA contextuel pour GMBS-CRM.

---

## Vue d'ensemble

L'assistant IA contextuel permet aux gestionnaires d'acceder a des actions IA rapides via des raccourcis clavier ou une bulle flottante. Les actions sont adaptees au contexte de la page courante (intervention, artisan, dashboard), a la **vue active** (pastille/tab selectionnee) et aux **filtres appliques**.

### Points d'entree

| Methode | Description |
|---------|-------------|
| Raccourci clavier | `Cmd/Ctrl + Shift + A` ouvre le menu, autres raccourcis pour actions directes |
| Bulle flottante | FAB draggable en bas a droite, visible sur les pages avec actions IA |

### Raccourcis disponibles

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `Cmd/Ctrl + Shift + A` | Menu IA | Ouvre le panneau de selection des actions IA |
| `Cmd/Ctrl + Shift + R` | Resume | Resume contextuel de l'entite courante |
| `Cmd/Ctrl + Shift + S` | Suggestions | Actions recommandees dans le contexte |
| `Cmd/Ctrl + Shift + F` | Trouver artisan | Profil artisan ideal (page detail intervention) |

---

## Architecture

```
Raccourci clavier / Bulle flottante
    |
    v
AIShortcutsProvider (src/components/ai/AIShortcutsProvider.tsx)
    |
    v
useContextualAIAction (src/hooks/useContextualAIAction.ts)
    |
    ├── detectContext() → identifie page + entite
    ├── enrichContextWithView() → ajoute vue active + filtres (depuis Zustand store)
    ├── getEntityData() → lit data-ai-entity + data-ai-history du DOM
    ├── anonymizeIntervention/Artisan() → RGPD
    ├── getHeaders() → auth token
    |
    v
Edge Function ai-contextual-action (supabase/functions/ai-contextual-action/)
    |
    ├── Check cache (intervention_ai_cache)
    ├── Build prompt (avec vue active, filtres, historique si dispo)
    ├── Call Claude API
    ├── Parse response
    ├── Cache result (5 min TTL, sauf data_summary)
    |
    v
AIAssistantDialog (src/components/ai/AIAssistantDialog.tsx)
```

### Flux de donnees detaille

```
Page (interventions/artisans)
  → useInterventionPageState / useArtisanPageState
    → useEffect publie dans ai-context-store (Zustand)
      → { activeViewId, activeViewTitle, activeViewLayout, appliedFilters }

Modal intervention ouvert
  → InterventionModalContent
    → data-ai-entity = JSON(intervention)
    → data-ai-history = JSON(buildHistoryContext(audit_log))

Utilisateur declenche action IA
  → AIShortcutsProvider
    → getEntityData() lit data-ai-entity + data-ai-history
    → useContextualAIAction.executeAction(action, entity, history, summaryData?)
      → detectContext(pathname) + enrichContextWithView(context, store)
      → POST Edge Function avec context enrichi + entity + history
        → Claude genere reponse contextualisee
      → Affichage dans AIAssistantDialog
```

---

## Fichiers

### Couche IA (`src/lib/ai/`)

| Fichier | Role |
|---------|------|
| `types.ts` | Types TypeScript (AIActionType, AIPageContext, AIDataSummary, etc.) |
| `context-detector.ts` | Detecte page/entite/actions + enrichissement vue active |
| `anonymize.ts` | Pipeline d'anonymisation RGPD |
| `prompts.ts` | Templates de prompts par action (avec vue, filtres, historique) |
| `history-context-builder.ts` | Parse l'audit log et construit metriques + alertes |
| `index.ts` | Facade (re-exports) |

### Composants (`src/components/ai/`)

| Fichier | Role |
|---------|------|
| `AIShortcutsProvider.tsx` | Provider global, raccourcis clavier, orchestration des dialogs |
| `AIAssistantDialog.tsx` | Dialog affichant le resultat IA (markdown) |
| `AIActionsPanel.tsx` | Menu de selection des actions avec selecteur de periode |
| `AIFloatingBubble.tsx` | Bulle flottante draggable (FAB) |

### Stores

| Fichier | Role |
|---------|------|
| `src/stores/ai-context-store.ts` | Store Zustand : pont entre pages et couche IA (vue active, filtres) |

### Hooks

| Fichier | Role |
|---------|------|
| `src/hooks/useContextualAIAction.ts` | Hook central : detection contexte, appel Edge Function, cache |
| `src/hooks/useAIDataSummary.ts` | Collecte les vraies stats pour le resume data-driven |

### Backend

| Fichier | Role |
|---------|------|
| `supabase/functions/ai-contextual-action/index.ts` | Edge Function unique pour toutes les actions |
| `supabase/migrations/00083_ai_infrastructure.sql` | Tables IA + pgvector |

### Query Keys

`src/lib/react-query/queryKeys.ts` : Ajout de `aiKeys` pour le cache des resultats IA.

---

## Actions par page

| Page | Actions disponibles |
|------|---------------------|
| Detail intervention | summary, next_steps, email_artisan, email_client, find_artisan, suggestions |
| Liste interventions | suggestions, stats_insights, **data_summary** |
| Detail artisan | summary, suggestions |
| Liste artisans | suggestions, stats_insights |
| Dashboard | stats_insights, suggestions, **data_summary** |
| Admin Dashboard | stats_insights, suggestions, **data_summary** |
| Comptabilite | stats_insights |
| Settings | _(aucune — bulle masquee)_ |

---

## Conscience de vue active

L'IA connait la vue/pastille/tab active de l'utilisateur et les filtres appliques.

### Mecanisme

1. Les hooks de page (`useInterventionPageState`, `useArtisanPageState`) publient la vue active dans le store Zustand `ai-context-store`
2. `useContextualAIAction` lit le store et enrichit le contexte via `enrichContextWithView()`
3. Les prompts incluent la vue active et un resume des filtres

### Donnees transmises

| Champ | Exemple |
|-------|---------|
| `activeViewId` | `"ma-liste-en-cours"` |
| `activeViewTitle` | `"Ma liste en cours"` |
| `activeViewLayout` | `"table"` |
| `appliedFilters` | `[{ property: "statusValue", operator: "in", value: ["EN_COURS"] }]` |
| `filterSummary` | `"statusValue in EN_COURS \| attribueA eq user-123"` |

### Vues interventions predefinies

- `liste-generale` — Toutes les interventions
- `mes-demandes` — Interventions en statut "DEMANDE"
- `ma-liste-en-cours` — Interventions en cours
- `mes-visites-technique` — Visites techniques
- `ma-liste-accepte` — Interventions acceptees
- `ma-liste-att-acompte` — Attente acompte
- `mes-interventions-a-check` — A checker

---

## Historique contextuel (modal intervention)

Quand un modal intervention est ouvert, l'IA recoit l'historique reel de l'intervention via `intervention_audit_log`.

### Donnees disponibles

Le module `history-context-builder.ts` extrait depuis l'audit log :

| Categorie | Contenu |
|-----------|---------|
| **Status changes** | Ancien/nouveau statut, acteur, date |
| **Artisan changes** | Assignation/retrait, acteur, date |
| **Cost changes** | Ajout/modif/suppression, montant avant/apres |
| **Comments** | Contenu (tronque 200 chars), acteur, date |
| **Metriques** | Jours dans statut actuel, jours depuis creation, depuis derniere action, nb changements statut/couts |

### Alertes automatiques

Le builder detecte et remonte des alertes :

| Alerte | Condition |
|--------|-----------|
| Inactivite | Aucune action depuis > 7 jours |
| Marge negative | `marge < 0` |
| Marge tres basse | `marge < 5%` |
| Pas d'artisan | Aucun artisan assigne |
| Ping-pong statuts | > 4 changements de statut (instabilite) |

### Integration DOM

```html
<div data-ai-entity="{...intervention JSON...}" data-ai-history="{...history context JSON...}">
```

Lu par `AIShortcutsProvider.getEntityData()` et transmis a l'Edge Function.

---

## Resume data-driven (action `data_summary`)

Action speciale qui collecte les **vraies donnees** sur une periode avant d'appeler l'IA.

### Flux

1. L'utilisateur choisit "Resume donnees" dans le panel IA
2. Un selecteur de periode apparait : **Semaine** / **Mois** / **Trimestre**
3. Le hook `useAIDataSummary` appelle les APIs stats existantes :
   - `interventionsApi.getStatsByUser(userId, startDate, endDate)`
   - `interventionsApi.getMarginStatsByUser(userId, startDate, endDate)`
4. Les donnees reelles sont structurees en `AIDataSummary` et envoyees a l'Edge Function
5. Claude genere un rapport analytique base sur les vrais chiffres

### Structure AIDataSummary

```typescript
{
  period: { label, startDate, endDate },
  interventions: { total, byStatus, created, completed },
  financial: { totalRevenue, totalCosts, totalMargin, averageMarginPercent },
  alerts: string[]  // "Marge moyenne basse (< 15%)", etc.
}
```

### Cache

Les resultats `data_summary` ne sont **PAS caches** (les donnees changent constamment).

---

## Bulle flottante IA (FAB)

### Comportement

- **Position** : fixe en bas a droite (`bottom-6 right-6`), z-index 85
- **Visibilite** : apparait uniquement sur les pages ayant des actions IA (masquee sur settings, login)
- **Draggable** : via framer-motion, position persistee dans localStorage (`crm:ai:bubble-position`)
- **Badge** : affiche le nombre d'actions disponibles si > 1
- **Click** : ouvre le `AIActionsPanel` (meme effet que `Cmd+Shift+A`)
- **Drag vs Click** : un flag `isDragging` empeche le click apres un drag

### Hierarchie z-index

| Element | Z-index |
|---------|---------|
| Sticky headers | 55-60 |
| Modal backdrop | 60 |
| Modal container | 70 |
| **Bulle flottante** | **85** |
| AI dialogs | 100 |
| AI overlay | 99 |
| Toasters | 100 |

---

## Pipeline RGPD

Avant tout envoi a l'API Claude, les donnees sont **anonymisees** :

- **Conserve** : contexte, consigne, statut, metier, zone (CP + ville), dates, montants
- **Pseudonymise** : artisan_id → `ARTISAN_XY1234`, user_id → `USER_AB5678`
- **Supprime** : noms, emails, telephones, adresses completes, IBAN

Voir `src/lib/ai/anonymize.ts`.

---

## Cache

Les resultats IA (summary, next_steps) sont caches a 2 niveaux :

1. **TanStack Query** (client) : `aiKeys.action(action, entityId)` — staleTime implicite
2. **PostgreSQL** (serveur) : `intervention_ai_cache` — TTL 5 min

Le cache serveur est consulte en priorite par l'Edge Function avant d'appeler Claude.

**Exception** : l'action `data_summary` n'est pas cachee.

---

## Configuration requise

### Secrets Supabase

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Migration SQL

```bash
supabase db push  # Applique 00083_ai_infrastructure.sql
```

---

## Tests

```bash
npm run test -- tests/unit/lib/ai/
```

3 fichiers de tests (37 tests) :
- `context-detector.test.ts` : Detection de page/entite/actions
- `anonymize.test.ts` : Pipeline RGPD (PII non transmises)
- `prompts.test.ts` : Construction des prompts

---

## Ajouter une nouvelle action IA

1. Ajouter le type dans `src/lib/ai/types.ts` (union `AIActionType`)
2. Ajouter les actions par page dans `src/lib/ai/context-detector.ts` (`ACTIONS_BY_PAGE`)
3. Ajouter le prompt dans `src/lib/ai/prompts.ts`
4. Ajouter label + description dans `prompts.ts` (`ACTION_LABELS`, `ACTION_DESCRIPTIONS`)
5. Ajouter le case dans l'Edge Function `buildUserPrompt()`
6. Si l'action necessite des donnees prealables (comme `data_summary`), creer un hook dedie
7. Ajouter un raccourci clavier dans `AIShortcutsProvider.tsx` si necessaire
8. Ecrire les tests
