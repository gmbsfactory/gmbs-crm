# AI Contextual Assistant (Option C)

> Guide d'implementation de l'assistant IA contextuel via raccourcis clavier.

---

## Vue d'ensemble

L'assistant IA contextuel permet aux gestionnaires d'acceder a des actions IA rapides via des raccourcis clavier. Les actions sont adaptees au contexte de la page courante (intervention, artisan, dashboard).

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
Raccourci clavier
    |
    v
AIShortcutsProvider (src/components/ai/AIShortcutsProvider.tsx)
    |
    v
useContextualAIAction (src/hooks/useContextualAIAction.ts)
    |
    ├── detectContext() → identifie page + entite
    ├── anonymizeIntervention/Artisan() → RGPD
    ├── getHeaders() → auth token
    |
    v
Edge Function ai-contextual-action (supabase/functions/ai-contextual-action/)
    |
    ├── Check cache (intervention_ai_cache)
    ├── Build prompt
    ├── Call Claude API
    ├── Parse response
    ├── Cache result (5 min TTL)
    |
    v
AIAssistantDialog (src/components/ai/AIAssistantDialog.tsx)
```

---

## Fichiers

### Couche IA (`src/lib/ai/`)

| Fichier | Role |
|---------|------|
| `types.ts` | Types TypeScript pour toute la couche IA |
| `context-detector.ts` | Detecte page/entite/actions disponibles |
| `anonymize.ts` | Pipeline d'anonymisation RGPD |
| `prompts.ts` | Templates de prompts par action |
| `index.ts` | Facade (re-exports) |

### Composants (`src/components/ai/`)

| Fichier | Role |
|---------|------|
| `AIShortcutsProvider.tsx` | Provider global, raccourcis clavier, rendu des dialogs |
| `AIAssistantDialog.tsx` | Dialog affichant le resultat IA (markdown) |
| `AIActionsPanel.tsx` | Menu de selection des actions disponibles |

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
| Liste interventions | suggestions, stats_insights |
| Detail artisan | summary, suggestions |
| Liste artisans | suggestions, stats_insights |
| Dashboard | stats_insights, suggestions |
| Comptabilite | stats_insights |
| Settings | _(aucune)_ |

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

3 fichiers de tests :
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
6. Ajouter un raccourci clavier dans `AIShortcutsProvider.tsx` si necessaire
7. Ecrire les tests
