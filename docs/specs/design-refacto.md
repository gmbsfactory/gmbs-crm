# Spec: Refactoring Design GMBS-CRM

> **Statut** : Draft
> **Date** : 2026-04-10
> **Branche** : `fix/delivery_fixes`

---

## 1. Probleme

Un audit complet du codebase a identifie **58 problemes de design** repartis sur 5 couches :

| Couche | Critique | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| Hooks | 2 | 4 | 6 | 2 | 14 |
| API Layer | 3 | 5 | 7 | 3 | 18 |
| Components | 3 | 4 | 0 | 0 | 7 |
| Stores/Contexts | 2 | 3 | 4 | 0 | 9 |
| Types/Config | 0 | 3 | 7 | 0 | 10 |
| **Total** | **9** | **16** | **19** | **5** | **58** |

### Impacts constates

- **Bugs silencieux en production** : double cache de reference (invalider l'un ne flush pas l'autre), `invalidateStats` qui n'invalide rien, cache user ID sans expiry qui casse le sign-out
- **Fragilite** : 12 modules API importent le mauvais client Supabase (casse en SSR), validations dependantes de labels francais hardcodes
- **Dette technique exponentielle** : 4 formulaires intervention qui ne partagent aucun code, god hook de 888 lignes avec 65 valeurs retournees, RemindersContext de 515 lignes qui reimplemente TanStack Query

---

## 2. Solution : refactoring en 7 phases incrementales

Chaque phase est un PR (ou groupe de PRs) independant, mergeable sans attendre les suivantes.

```
Phase 1 (quick wins)         ████░░░░░░░░░░░░  — zero risque, valeur immediate
Phase 2 (cache/client)       ░░░░████░░░░░░░░  — elimine les bugs silencieux
Phase 3 (god hook)           ░░░░░░░░████░░░░  — le plus gros ROI refacto
Phase 4 (contexts)           ░░░░░░░░░░████░░  — simplifie le state management
Phase 5 (components)         ░░░░░░░░░░░░████  — le plus long, split en PRs
Phase 6 (types/config)       ░░░░░░░░░░░░████  — parallelisable avec Phase 5
Phase 7 (API cleanup)        ░░░░░░░░░░░░░░██  — polish final
```

---

## 3. Phase 1 — Quick wins & bugs silencieux

**Effort** : 1-2 jours | **Risque** : Nul | **PRs** : 1

Corrections rapides a fort impact, zero refacto structurelle.

### 3.1 Fix `invalidateStats` no-op

**Probleme** : `dashboardKeys.invalidateStats()` retourne `["dashboard", "stats", "margin", "period"]` — un flat key qui ne matche aucune query existante. Le dashboard ne s'invalide jamais correctement.

**Fichier** : `src/lib/react-query/queryKeys.ts:439`

**Avant** :
```typescript
invalidateStats: () => [...dashboardKeys.all, "stats", "margin", "period"],
```

**Apres** :
```typescript
invalidateStats: (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "stats"] })
  queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "margin"] })
  queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "period"] })
},
```

### 3.2 Fix `undefined` dans les query keys

**Probleme** : `interventionKeys.detail(id)` produit `["interventions", "detail", id, undefined]` quand `include` n'est pas passe — cause des cache miss.

**Fichier** : `src/lib/react-query/queryKeys.ts:103,264`

**Avant** :
```typescript
detail: (id: string, include?: string[]) => [...interventionKeys.details(), id, include] as const,
```

**Apres** :
```typescript
detail: (id: string, include?: string[]) =>
  [...interventionKeys.details(), id, ...(include ? [include] : [])] as const,
```

Idem pour `artisanKeys.detail` ligne 264.

### 3.3 Supprimer les 8 `console.log` de production

**Fichier** : `src/lib/api/v2/interventions/interventions-crud.ts:701-744`

8 appels `console.log` avec emojis dans le hot path de `update()`. Supprimer.

### 3.4 Dead code cleanup

| Fichier | Ligne | Quoi |
|---------|-------|------|
| `interventions-crud.ts` | 302 | Empty `else {}` block + `interventionId` variable morte |
| `useInterventionsQuery.ts` | 196-205 | `firstId`, `lastId` calcules mais jamais utilises |
| `useInterventionsQuery.ts` | 200 | Block `if (process.env.NODE_ENV !== 'production') {}` vide |
| `useInterventionsQuery.ts` | 219-231 | `goToPage`, `nextPage`, `previousPage` — callbacks no-op |

### 3.5 Fix `REFERENCE_CACHE_DURATION` triplee

**Probleme** : 3 definitions independantes de la meme constante.

| Fichier | Statut |
|---------|--------|
| `src/lib/api/v2/common/constants.ts:131` | Source de verite (conserver) |
| `src/lib/api/v2/common/cache.ts:22` | Supprimer, importer depuis `constants.ts` |
| `src/lib/api/v2/utilsApi.ts:19` | Supprimer, importer depuis `constants.ts` |

### 3.6 Fix `CommentStats` dupliquee

**Fichier** : `src/lib/api/v2/common/types.ts:533,710`

Interface declaree deux fois. Supprimer la seconde declaration.

### 3.7 Fix `createdAt: new Date()` dans config

**Fichier** : `src/config/interventions.ts:206-207`

**Avant** :
```typescript
createdAt: new Date().toISOString(),
updatedAt: new Date().toISOString(),
```

**Apres** :
```typescript
createdAt: "2024-01-01T00:00:00.000Z",
updatedAt: "2024-01-01T00:00:00.000Z",
```

### 3.8 Supprimer `SimpleOptimizedContext` & `UltraOptimizedContext`

**Fichiers** :
- `src/contexts/SimpleOptimizedContext.tsx`
- `src/contexts/UltraOptimizedContext.tsx`

**Pre-requis** : verifier qu'aucun import n'existe dans le codebase. Si confirme dead code, supprimer les 2 fichiers.

**Raison** : ces contexts reimplementent TanStack Query (LRU, TTL, pagination) avec du state type `any[]`. Probablement des experiences abandonnees.

---

## 4. Phase 2 — Unifier les caches et le client Supabase

**Effort** : 2-3 jours | **Risque** : Moyen (RLS) | **PRs** : 2-3

### 4.1 Unifier le cache de reference

**Probleme** : deux caches independants coexistent. Invalider l'un ne flush pas l'autre.

```
src/lib/api/v2/common/cache.ts     → ReferenceCacheManager (canonical)
src/lib/api/v2/utilsApi.ts:8-51    → referenceCache / referenceCachePromise (independant)
```

**Action** :
1. Supprimer le cache local dans `utilsApi.ts:8-51`
2. Faire pointer `utilsApi.getReferenceCache()` vers `common/cache.ts`
3. Nettoyer la chaine de re-exports a 5 niveaux (`cache.ts` → `utils.ts` → `interventions-crud.ts` → `index.ts` → `interventionsApi.ts`)
4. Un seul point d'export : `common/cache.ts`

### 4.2 Unifier l'import Supabase client

**Probleme** : 12 modules API importent `supabase` depuis `@/lib/supabase-client` au lieu du `supabaseClient` de `common/client.ts`. En SSR, ces modules utilisent le client browser (anon key) au lieu du service-role client.

**Modules a migrer** :

| Module | Import actuel |
|--------|---------------|
| `agenciesApi.ts` | `import { supabase } from "@/lib/supabase-client"` |
| `artisanStatusesApi.ts` | idem |
| `interventionStatusesApi.ts` | idem |
| `metiersApi.ts` | idem |
| `ownersApi.ts` | idem |
| `reminders.ts` | idem |
| `rolesApi.ts` | idem |
| `search.ts` | idem |
| `tenantsApi.ts` | idem |
| `updatesApi.ts` | idem |
| `usersApi.ts` | idem |
| `utilsApi.ts` | idem |
| `common/utils.ts` | idem |

**Action** : remplacer par `import { supabaseClient } from "./common/client"` (ou chemin relatif adapte).

**Cas speciaux** :
- `interventions-crud.ts:914` (`getByArtisan`) : utilise `supabaseClient` puis `supabase` dans la meme fonction → unifier sur `supabaseClient`
- `interventions-crud.ts:461,617,834` : `supabase.auth.getUser()` sur le client browser → utiliser `supabaseClient.auth.getUser()`

### 4.3 Fix cache user ID dans reminders

**Fichier** : `src/lib/api/v2/reminders.ts:13-29`

**Probleme** : `_cachedPublicUserId` est un module-level variable sans expiry. Si l'utilisateur se deconnecte et un autre se connecte, l'ancien ID est utilise.

**Action** : ajouter un TTL (5 min comme le cache de reference) + un `resetPublicUserIdCache()` appele sur auth state change. Ou mieux : lire directement depuis `supabaseClient.auth.getUser()` a chaque appel (le SDK Supabase cache deja la session).

---

## 5. Phase 3 — Refacto du god hook `useInterventionFormState`

**Effort** : 3-5 jours | **Risque** : Eleve (hook central) | **PRs** : 5-6 (un par extraction)

**Etat actuel** : 888 lignes, 65 valeurs retournees, 6 responsabilites melangees.

### 5.1 Extraire `useInterventionValidation`

**Source** : lignes 282-398 (12 memos `requiresX`)

**Interface** :
```typescript
function useInterventionValidation(selectedStatus: InterventionStatus | null): {
  requiresDefinitiveId: boolean
  requiresDatePrevue: boolean
  requiresArtisan: boolean
  requiresFacture: boolean
  requiresNomFacturation: boolean
  requiresAssignedUser: boolean
  requiresCouts: boolean
  requiresConsigneArtisan: boolean
  requiresClientInfo: boolean
  requiresAgence: boolean
  requiresMetier: boolean
  requiresDevis: boolean
}
```

**Changement cle** : supprimer les fallbacks sur les labels francais (`"inter en cours"`, `"termine"`...). Seul `selectedStatus.code` est authoritative. Les Sets dans `form-constants.ts` sont la source de verite.

**Fichier cible** : `src/hooks/useInterventionValidation.ts`

### 5.2 Extraire `useLocationSearch`

**Source** : lignes 129-141, 643-703

**Interface** :
```typescript
function useLocationSearch(): {
  locationQuery: string
  setLocationQuery: (q: string) => void
  geocodeQuery: string
  setGeocodeQuery: (q: string) => void
  suggestions: Suggestion[]
  clearSuggestions: () => void
  handleGeocodeAddress: () => void
  handleSuggestionSelect: (suggestion: Suggestion) => void
}
```

**Fichier cible** : `src/hooks/useLocationSearch.ts`

### 5.3 Extraire `useArtisanSelection`

**Source** : lignes 179-208, 564-641

Regroupe la logique de selection artisan primaire + secondaire, nearby artisans, search artisan.

**Fichier cible** : `src/hooks/useArtisanSelection.ts`

### 5.4 Extraire `useInterventionDraft`

**Source** : lignes 439-470

Persistence localStorage du brouillon d'intervention.

**Fichier cible** : `src/hooks/useInterventionDraft.ts`

### 5.5 Deplacer les absences dans un hook dedie

**Source** : lignes 472-516

**Probleme** : appels Supabase directs dans un hook de form state.

**Action** : creer `useArtisanAbsences(artisanId)` avec React Query au lieu de `useEffect` + `useState`.

**Fichier cible** : `src/hooks/useArtisanAbsences.ts`

### 5.6 Supprimer les 3 useEffect de callback remontee

**Source** : lignes 528-547

```typescript
// SUPPRIMER — le parent lira directement formData
useEffect(() => { onClientNameChange?.(formData.nomPrenomClient) }, [...])
useEffect(() => { onClientPhoneChange?.(formData.telephoneClient) }, [...])
useEffect(() => { onAgencyNameChange?.(agency.label) }, [...])
```

Le parent derive ces valeurs depuis `formData` retourne par le hook.

### 5.7 Hook coordinateur

`useInterventionFormState` devient un thin wrapper :

```typescript
function useInterventionFormState(options: Options) {
  const validation = useInterventionValidation(selectedStatus)
  const location = useLocationSearch()
  const artisans = useArtisanSelection(options)
  const draft = useInterventionDraft(options)
  const absences = useArtisanAbsences(artisans.selectedArtisanId)
  const email = useEmailModal()

  return {
    // Form data (propre au coordinateur)
    formData, handleInputChange,
    // Sous-hooks (accessibles individuellement ou via le coordinateur)
    ...validation,
    ...location,
    ...artisans,
    ...draft,
    ...email,
    absences,
  }
}
```

Le return object passe de ~65 a ~25 valeurs.

---

## 6. Phase 4 — Nettoyer les contexts

**Effort** : 2-3 jours | **Risque** : Moyen | **PRs** : 3-4

### 6.1 Migrer `RemindersContext` vers React Query

**Fichier** : `src/contexts/RemindersContext.tsx` (515 lignes)

**Probleme** : reimplemente TanStack Query manuellement — fetch, cache, optimistic updates, realtime. 14 callbacks + 5 Maps/Sets. Chaque changement re-render tout l'arbre.

**Architecture cible** :

```
src/hooks/useReminders.ts          → useQuery pour le fetch initial
src/hooks/useReminderMutations.ts  → useMutation pour create/update/delete/dismiss
src/hooks/useRemindersRealtime.ts  → souscription Realtime → queryClient.invalidateQueries
```

Le `RemindersProvider` est supprime. Les composants appellent directement les hooks.

### 6.2 Fusionner `settings.ts` + `interface-context.tsx`

**Fichiers** :
- `src/stores/settings.ts`
- `src/contexts/interface-context.tsx`

**Probleme** : deux sources de verite pour le theme, synchronisees manuellement. Type `SidebarMode` divergent (3 vs 4 valeurs).

**Architecture cible** :

```typescript
// src/stores/settings.ts — seule source de verite
export type SidebarMode = "collapsed" | "icons" | "hybrid" | "expanded"

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sidebarMode: "expanded" as SidebarMode,
      theme: "system" as "light" | "dark" | "system",
      accent: "blue",
      // ...
    }),
    { name: "gmbs:settings" }
  )
)
```

`InterfaceContext` est supprime. Les composants importent `useSettings` directement.

### 6.3 Fix `NavigationContext`

**Fichier** : `src/contexts/NavigationContext.tsx`

**Probleme** : `Map` module-level jamais reset, passee par reference dans le context value — React ne detecte jamais les changements.

**Action** : evaluer si le cache de navigation est necessaire. Si oui, migrer vers un Zustand store. Si non (TanStack Query couvre deja le besoin), supprimer.

### 6.4 Fix `interventionDraft` getter side-effect

**Fichier** : `src/stores/interventionDraft.ts:44-56`

**Probleme** : `getDraft()` appelle `set()` pour purger les drafts expires — side-effect dans un getter.

**Action** : separer en `getDraft()` (pur, retourne le draft ou null sans mutation) et `purgeExpiredDrafts()` (action explicite, appelee au mount de l'app ou avant save).

### 6.5 Fix `useModal` — state global + souscriptions

**Fichier** : `src/hooks/useModal.ts`

**Probleme 1** : `closingGuardId` et `pendingModalId` sont des variables module-level mutables partagees entre toutes les instances.

**Action** : deplacer dans le Zustand store `useModalState`.

**Probleme 2** : 16 souscriptions Zustand separees.

**Action** : utiliser `useShallow` pour un seul selector :

```typescript
const { isOpen, activeId, ... } = useModalState(
  useShallow(state => ({
    isOpen: state.isOpen,
    activeId: state.activeId,
    // ...
  }))
)
```

---

## 7. Phase 5 — Refacto composants

**Effort** : 5-7 jours | **Risque** : Eleve | **PRs** : 5-6

### 7.1 Unifier la logique submit des formulaires intervention

**Fichiers impactes** :
- `src/components/interventions/InterventionEditForm.tsx` (~250 lignes de submit)
- `src/components/interventions/NewInterventionForm.tsx` (~250 lignes de submit)

**Architecture cible** :

```typescript
// src/hooks/useInterventionSubmit.ts
function useInterventionSubmit(mode: "create" | "edit") {
  // Validation
  // findOrCreateOwner / findOrCreateTenant
  // Duplicate detection (create only)
  // Cost array construction
  // API call (interventionsApi.create or .update)
  // runPostMutationTasks
  // Comment posting
  return { executeSubmit, isSubmitting }
}
```

Les deux forms appellent `executeSubmit(formData)` au lieu de dupliquer la logique.

### 7.2 Extraire `useModalBlocker` context

**Probleme** : `InterventionEditForm` a 11 callback props pour remonter l'etat des modaux au parent.

**Architecture cible** :

```typescript
// src/hooks/useModalBlocker.ts
const ModalBlockerContext = createContext<{
  registerBlocker: (id: string) => void
  unregisterBlocker: (id: string) => void
  isBlocked: boolean
}>()

// Usage dans les sous-composants :
const { registerBlocker, unregisterBlocker } = useModalBlocker()
useEffect(() => {
  if (isOpen) registerBlocker("email-modal")
  else unregisterBlocker("email-modal")
}, [isOpen])

// Le parent lit simplement :
const { isBlocked } = useModalBlocker()
// isBlocked = true → empecher la fermeture du modal parent
```

Supprime les 11 callback props.

### 7.3 Decomposer `InterventionEditForm`

**Fichier** : `src/components/interventions/InterventionEditForm.tsx` (2738 lignes)

**Extractions** :

| Extraction | Source | Cible |
|------------|--------|-------|
| WhatsApp deep-links | lignes 633-698 | `src/components/interventions/_components/WhatsAppButton.tsx` |
| Column resize logic | lignes 718-748 | `src/hooks/useColumnResize.ts` |
| Document presence check | lignes 359-387 | `src/hooks/useDocumentPresence.ts` |
| Realtime form sync | lignes ~439 (large useEffect) | `src/hooks/useRealtimeFormSync.ts` |

### 7.4 Decomposer `TableView`

**Fichier** : `src/components/interventions/views/TableView.tsx` (2332 lignes)

**Extractions** :

| Extraction | Source | Cible |
|------------|--------|-------|
| `renderCell` (550 lignes) | lignes 219-580 | Registry de cell renderers dans `app/interventions/_components/cells/` |
| `GestionnaireSelector` | lignes 645-779 | `app/interventions/_components/GestionnaireSelector.tsx` + hook |
| Reminder dialog | ~100 lignes JSX + 8 states | `app/interventions/_components/ReminderDialog.tsx` |
| `getReadableTextColor` (3 copies) | 3 fichiers | `src/lib/color-utils.ts` (unique) |

### 7.5 Deplacer les API calls directs dans des hooks

| Composant | Appel direct | Hook cible |
|-----------|-------------|------------|
| `InterventionEditForm.tsx` | `documentsApi.getAll` (2x) | `useDocumentPresence(interventionId)` |
| `intervention-stats-piechart.tsx` | `interventionsApi.getStatsByUser` via useEffect | `useDashboardStats` (existant) |
| `EmailEditModal.tsx:419` | `fetch('/api/.../send-email')` | `src/lib/api/v2/emailApi.ts` + `useSendEmail` mutation |

---

## 8. Phase 6 — Types & Config

**Effort** : 2-3 jours | **Risque** : Faible | **PRs** : 2-3

### 8.1 Unifier `InterventionView`

**Fichiers** :
- `src/types/intervention-view.ts` (marque `@deprecated` mais plus complet, ~20 champs en plus)
- `src/types/intervention-generated.ts`

**Action** : fusionner les champs manquants dans `intervention-generated.ts`, supprimer `intervention-view.ts`. Mettre a jour tous les imports.

### 8.2 Single source of truth pour les couleurs de statut

**Probleme** : divergences entre `status-colors.ts` et `config/interventions.ts` :

| Statut | `status-colors.ts` | `config/interventions.ts` |
|--------|--------------------|-----------------------|
| VISITE_TECHNIQUE | `#06B6D4` (cyan) | `#14B8A6` (teal) |
| REFUSE | `#EF4444` (red) | `#EC4899` (pink) |
| DEVIS_ENVOYE | `#8B5CF6` (violet) | `#6366F1` (indigo) |

**Action** : la DB est la source de verite. Supprimer `status-colors.ts`. `config/interventions.ts` sert de fallback unique. Aligner les couleurs avec la DB.

### 8.3 Definir le chemin forward pour `POTENTIEL`

**Probleme** : `POTENTIEL` est `isInitial: true` dans `config/interventions.ts` mais absent de toutes les chaines de progression dans `intervention-status-chains.ts`. Aucune transition `from: "POTENTIEL"` definie.

**Action** : decider avec le metier si `POTENTIEL` doit avoir des transitions (→ les ajouter) ou s'il est un statut terminal/legacy (→ retirer `isInitial: true` et documenter).

### 8.4 Typer les mapping functions

**Fichier** : `src/lib/api/v2/common/utils.ts`

| Fonction | Actuel | Cible |
|----------|--------|-------|
| `mapInterventionRecord(item, refs)` | `any, any → any` | `RawInterventionRow, ReferenceCache → InterventionView` |
| `mapArtisanRecord(item, refs)` | `any, any → any` | `RawArtisanRow, ReferenceCache → ArtisanView` |
| `buildUserDisplay(user?)` | `any → ...` | `UserRecord \| undefined → UserDisplay` |

### 8.5 Cleanup divers

| Probleme | Fichier | Action |
|----------|---------|--------|
| 5 champs `pieceJointe*` types `any[]` | `intervention-view.ts:113-118` | → `InterventionAttachment[]` |
| Index signature `[key: string]: unknown` | `intervention-workflow.ts:87` | Supprimer |
| Fonctions runtime dans `types/` | `artisan-page.ts:83-178` | Deplacer dans `config/` ou `lib/` |
| `factureGmbsFile` absent du type | `workflow-rules.ts` | Ajouter au type `WorkflowRule.requirements` |
| `metier-colors.ts` double map | `config/metier-colors.ts` | Deriver `BY_LABEL` de `BY_CODE` automatiquement |

---

## 9. Phase 7 — API layer cleanup

**Effort** : 3-4 jours | **Risque** : Moyen | **PRs** : 3-4

### 9.1 Split `update()` god function

**Fichier** : `src/lib/api/v2/interventions/interventions-crud.ts:556-748`

**Etat actuel** : ~200 lignes qui font role check HTTP, status transition, DB write, artisan recalculation.

**Architecture cible** :

```typescript
async update(id, data) {
  const payload = await this.sanitizePayload(data)           // role check + strip
  const transition = await this.resolveTransition(id, payload) // fetch current + diff
  const result = await this.performUpdate(id, payload)        // DB write
  if (transition) await this.executeTransition(transition)     // log + side effects
  await this.recalculateArtisanStatuses(result)               // post-update
  return this.mapResult(result)
}
```

### 9.2 Extraire helpers partages

| Helper | Utilise dans | Fichier cible |
|--------|-------------|---------------|
| `buildFilterParams(params, refs)` | `getAll`, `getAllLight` | `interventions-filters.ts` |
| `resolveMetierToId(codeOrId, refs)` | 5 endroits dans 2 fichiers | `common/utils.ts` |

### 9.3 Guard `generateUniqueCodeGestionnaire`

**Fichier** : `src/lib/api/v2/common/utils.ts:183-211`

**Action** : ajouter `maxRetries = 100` :

```typescript
let attempts = 0
while (attempts++ < 100) {
  // ...
}
throw new Error("Impossible de generer un code gestionnaire unique apres 100 tentatives")
```

### 9.4 Batch `createBulk`

**Fichiers** :
- `interventions-crud.ts:859-874`
- `commentsApi.ts:217-241`
- `interventions-costs.ts:379-409`

**Probleme** : boucle sequentielle — N items = 3N+ round-trips DB.

**Action** : utiliser `Promise.all` avec concurrency limit (`p-limit`) ou un batch insert direct via Supabase `.insert([...items])`.

### 9.5 Factoriser les mutations dupliquees

**Fichier** : `src/hooks/useInterventionContextMenu.ts`

**Probleme** : les mutations "transition DEVIS_ENVOYE" et "transition ACCEPTE" sont structurellement identiques (copy-paste avec differents status codes).

**Action** :

```typescript
// Factory
function useStatusTransitionMutation(targetStatus: string, statusLabel: string) {
  return useMutation({
    mutationFn: (id: string) => interventionsApi.updateStatus(id, targetStatus),
    onMutate: (id) => applyOptimisticUpdate(queryClient, id, { status: targetStatus }),
    onError: (_, __, context) => rollbackOptimisticUpdate(queryClient, context),
  })
}

// Usage
const transitionToDevisEnvoye = useStatusTransitionMutation("DEVIS_ENVOYE", "Devis envoye")
const transitionToAccepte = useStatusTransitionMutation("ACCEPTE", "Accepte")
```

Extraire `applyOptimisticUpdate(queryClient, id, patch)` dans `src/lib/react-query/optimistic.ts` — reutilisable par `useInterventionsMutations.ts` aussi.

---

## 10. Verification

Apres chaque phase :

- [ ] `npm run typecheck` — zero erreur
- [ ] `npm run test` — zero regression
- [ ] `npm run build` — build production OK
- [ ] Test manuel : creer une intervention, editer, assigner 2 artisans, envoyer email devis + intervention
- [ ] Test manuel : dashboard stats se rafraichissent correctement (Phase 1)
- [ ] Test manuel : sign-out / sign-in — pas de donnees stale (Phase 2)
- [ ] Test manuel : reminders fonctionnent en temps reel (Phase 4)

---

## 11. Fichiers critiques impactes

| Phase | Fichiers principaux |
|-------|---------------------|
| 1 | `queryKeys.ts`, `interventions-crud.ts`, `useInterventionsQuery.ts`, `common/types.ts`, `config/interventions.ts` |
| 2 | `utilsApi.ts`, `common/cache.ts`, `common/client.ts`, 12 modules API, `reminders.ts` |
| 3 | `useInterventionFormState.ts` → split en 5 hooks + coordinateur |
| 4 | `RemindersContext.tsx`, `settings.ts`, `interface-context.tsx`, `NavigationContext.tsx`, `useModal.ts`, `interventionDraft.ts` |
| 5 | `InterventionEditForm.tsx`, `NewInterventionForm.tsx`, `TableView.tsx`, `EmailEditModal.tsx` |
| 6 | `intervention-view.ts`, `intervention-generated.ts`, `status-colors.ts`, `common/utils.ts`, `workflow-rules.ts` |
| 7 | `interventions-crud.ts`, `interventions-filters.ts`, `useInterventionContextMenu.ts`, `useInterventionsMutations.ts` |
