# Audit Qualité du Code & Logique Métier - GMBS CRM

**Date** : 10 février 2026
**Branche** : `design_ux_ui`
**Périmètre** : 525 fichiers TypeScript/TSX (~122K lignes) dans `src/` et `app/`

---

## Score Global de Qualité

| Module | Score | Problèmes Critiques | Problèmes Hauts | Problèmes Moyens |
|--------|-------|---------------------|------------------|-------------------|
| **API Layer** (`lib/api/v2/`) | 4/10 | 5 | 8 | 12 |
| **Hooks** (`hooks/`) | 5/10 | 3 | 6 | 8 |
| **Realtime** (`lib/realtime/`) | 3/10 | 4 | 5 | 6 |
| **Pages** (`app/`) | 4/10 | 4 | 7 | 10 |
| **Settings** (`features/settings/`) | 5/10 | 2 | 6 | 8 |
| **Documents** (`components/documents/`) | 6/10 | 1 | 3 | 5 |
| **UI Components** (`components/ui/`) | 7/10 | 0 | 2 | 4 |
| **Composants partagés** | 5/10 | 1 | 4 | 6 |
| **Score moyen** | **4.9/10** | **20** | **41** | **59** |

---

## A. TypeScript Strictness

### A.1 Configuration (tsconfig.json)

**Verdict : `strict: true` activé** - Bon

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

**Pas de `@ts-ignore` ni `@ts-expect-error`** dans tout le codebase - Excellent.

### A.2 Usages de `any` - CRITIQUE

**360+ occurrences de `any` dans 50+ fichiers.**

| Fichier | Occurrences | Sévérité |
|---------|-------------|----------|
| `src/lib/api/v2/interventionsApi.ts` | 67 | CRITIQUE |
| `src/lib/api/v2/artisansApi.ts` | 45 | CRITIQUE |
| `src/hooks/useInterventionContextMenu.ts` | 43 | CRITIQUE |
| `src/lib/api/v2/common/utils.ts` | 18 | HAUTE |
| `src/lib/api/v2/usersApi.ts` | 15 | HAUTE |
| `src/lib/realtime/cache-sync.ts` | 13 | HAUTE |
| `src/lib/api/v2/rolesApi.ts` | 12 | HAUTE |
| `src/lib/api/v2/enumsApi.ts` | 10 | HAUTE |
| `src/hooks/useAnalyticsData.ts` | 9 | MOYENNE |
| `src/hooks/useUniversalSearch.ts` | 9 | MOYENNE |
| `src/lib/supabase-api.ts` | 9 | MOYENNE |
| `src/lib/api/v2/documentsApi.ts` | 8 | MOYENNE |
| `src/lib/api/v2/search.ts` | 8 | MOYENNE |
| `src/mockAPI/interventions.ts` | 7 | BASSE |
| Autres (37 fichiers) | ~47 | VARIABLE |

#### Exemples critiques

**CRITIQUE** - `src/hooks/useInterventionContextMenu.ts:141-161`
```typescript
// 20+ find() calls avec cast `as any` dans le même bloc
coutIntervention: costs.find((c: any) => c.cost_type === "intervention")?.amount?.toString() || "",
coutSST: costs.find((c: any) => c.cost_type === "sst")?.amount?.toString() || "",
accompteSST: payments.find((p: any) => p.payment_type === "acompte_sst")?.amount?.toString() || "",
// ... 15 lignes similaires
```

**Correction suggérée :**
```typescript
interface InterventionCost {
  cost_type: 'intervention' | 'sst' | 'materiel';
  amount: number;
}
interface InterventionPayment {
  payment_type: 'acompte_sst' | 'acompte_client';
  amount: number;
  is_received: boolean;
  payment_date: string | null;
}
// Puis utiliser ces types au lieu de `any`
coutIntervention: costs.find((c: InterventionCost) => c.cost_type === "intervention")?.amount?.toString() || "",
```

**CRITIQUE** - `src/lib/api/v2/utilsApi.ts:181`
```typescript
mapInterventionRecord(item: any, refs: ReferenceCache): any {
```

**Correction suggérée :**
```typescript
mapInterventionRecord(item: RawInterventionRow, refs: ReferenceCache): InterventionEntity {
```

**HAUTE** - `src/hooks/useInterventionsMutations.ts:175-206`
```typescript
const updateLists = (oldData: any) => {
  const updatedData = oldData.data.map((intervention: any) => ...)
  const statusLabel = (data as any).status?.label || "modifiée"
```

**Correction suggérée :**
```typescript
const updateLists = (oldData: PaginatedResponse<InterventionEntity>) => {
  const updatedData = oldData.data.map((intervention: InterventionEntity) => ...)
```

### A.3 Assertions de type dangereuses

| Fichier | Ligne | Pattern | Sévérité |
|---------|-------|---------|----------|
| `src/lib/supabase-client.ts` | 78,86 | `(instance as any)[prop]` | HAUTE |
| `src/hooks/useInterventionsRealtime.ts` | 177,190 | `channel.on('error' as any, ...)` | HAUTE |
| `src/hooks/useInterventionForm.ts` | 153-154 | `match.agences as any` | MOYENNE |
| `src/hooks/useInterventionsMutations.ts` | 206,226 | `(data as any).status` | MOYENNE |

### A.4 Suppressions ESLint

**12 `eslint-disable` pour `react-hooks/exhaustive-deps`** :

| Fichier | Lignes | Justifié ? |
|---------|--------|------------|
| `src/components/maps/MapLibreMapImpl.tsx` | 137-189 | Partiellement (6 suppressions, devrait utiliser useCallback) |
| `src/components/interventions/NewInterventionForm.tsx` | 304 | Non (dépendance manquante) |
| `src/hooks/useInfiniteScroll.ts` | 107 | Partiellement |
| `src/contexts/RemindersContext.tsx` | 479 | Partiellement |
| `src/components/ui/artisan-modal/ArtisanModalContent.tsx` | 648 | Non (deps manquantes) |
| `src/components/admin-dashboard/FilterBar.tsx` | 256 | Non |

---

## B. Patterns React

### B.1 Error Boundaries - CRITIQUE

**1 seul ErrorBoundary existe dans tout le projet et il est ORPHELIN (0 imports).**

```
src/components/FeatureBoundary.tsx - JAMAIS UTILISÉ (0 imports)
```

**Impact** : Aucune page n'a de protection contre les erreurs de rendu. Une erreur dans un composant enfant fait crasher toute l'application.

**Correction suggérée :** Wrapper les pages principales avec ErrorBoundary :
```typescript
// app/layout.tsx ou chaque page
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary fallback={<ErrorFallback />}>
  <DashboardPage />
</ErrorBoundary>
```

### B.2 Fichiers monolithiques (God Components) - CRITIQUE

| Fichier | Lignes | State vars | useEffect | Recommandation |
|---------|--------|------------|-----------|----------------|
| `src/lib/api/v2/interventionsApi.ts` | 4351 | N/A | N/A | Découper en modules |
| `src/components/interventions/InterventionEditForm.tsx` | 3472 | 20+ | 10+ | Extraire sous-composants |
| `src/components/ui/artisan-modal/NewArtisanModalContent.tsx` | 2613 | 15+ | 8+ | Découper formulaire |
| `src/lib/api/v2/artisansApi.ts` | 2443 | N/A | N/A | Découper en modules |
| `src/components/interventions/views/TableView.tsx` | 2193 | 10+ | 5+ | Extraire renderers |
| `src/components/ui/artisan-modal/ArtisanModalContent.tsx` | 2128 | 15+ | 6+ | Découper |
| `app/interventions/page.tsx` | 1831 | 20+ | 12+ | Extraire hooks/context |
| `app/artisans/page.tsx` | 1435 | 25+ | 8+ | Splitter table/filters |
| `src/features/settings/UserPermissionsDialog.tsx` | 1325 | 20+ | 5+ | Réduire complexité |
| `src/hooks/useInterventionViews.ts` | 1158 | N/A | 7 | Séparer logique |
| `src/features/settings/TeamSettings.tsx` | 1071 | 15+ | 5+ | Extraire modaux |
| `src/components/documents/useDocumentManager.ts` | 945 | 27 | 8+ | Décomposer hook |
| `app/admin/dashboard/page.tsx` | 925 | 13 | 5+ | Extraire modaux |
| `src/features/interventions/components/InterventionCard.tsx` | 882 | 8+ | 3+ | Simplifier |
| `src/features/settings/ProfileSettings.tsx` | 869 | 14 | 5+ | Découper sections |
| `src/components/shared/CommentSection.tsx` | 825 | 15+ | 4+ | Extraire sous-composants |
| `app/dashboard/page.tsx` | 812 | 15+ | 10+ | Découper en 5 composants |

### B.3 useEffect problématiques

**79+ useEffect à travers 30+ hooks** - beaucoup sont complexes avec des dépendances mal gérées.

**CRITIQUE** - `app/dashboard/page.tsx` :
- 10+ useEffect dans un seul composant
- Animation clipPath + requestAnimationFrame + Framer Motion combinés
- Synchronisation localStorage avec risque d'hydratation

**HAUTE** - `app/interventions/page.tsx:294-334` :
```typescript
// Mapper readiness - machine d'état complexe sans gestion claire
const mappersReady = { /* recalculé chaque render */ }
```

**HAUTE** - `src/components/maps/MapLibreMapImpl.tsx` :
- 6 eslint-disable pour hooks/exhaustive-deps dans un seul fichier
- Dépendances intentionnellement omises - fragile

### B.4 State Management excessif

| Composant | useState count | Recommandation |
|-----------|---------------|----------------|
| `app/artisans/page.tsx` | 25+ | useReducer ou Zustand store |
| `useDocumentManager.ts` | 27 | Décomposer en sous-hooks |
| `app/interventions/page.tsx` | 20+ | Context + useReducer |
| `UserPermissionsDialog.tsx` | 20+ | State machine (XState ou useReducer) |
| `app/dashboard/page.tsx` | 15+ | Extraire hooks custom |
| `TeamSettings.tsx` | 15+ | useReducer pour modaux |
| `app/admin/dashboard/page.tsx` | 13 (5 modaux séparés) | Modal manager context |

**Exemple** - `app/admin/dashboard/page.tsx:96-100` :
```typescript
// PROBLÈME: 5 états de modal séparés
const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false)
const [isInterventionsModalOpen, setIsInterventionsModalOpen] = useState(false)
const [isTransformationModalOpen, setIsTransformationModalOpen] = useState(false)
// ... etc.
```

**Correction suggérée :**
```typescript
type ModalType = 'revenue' | 'interventions' | 'transformation' | null;
const [activeModal, setActiveModal] = useState<ModalType>(null);
```

### B.5 Memory Leaks potentiels

| Fichier | Ligne | Problème | Sévérité |
|---------|-------|----------|----------|
| `useDocumentManager.ts` | 232 | `URL.revokeObjectURL` pas appelé dans tous les chemins | HAUTE |
| `MapLibreMapImpl.tsx` | 137-189 | Event listeners avec deps manquantes | HAUTE |
| `useInterventionsRealtime.ts` | 177 | Channel subscription sans cleanup conditionnel | MOYENNE |
| `broadcast-sync.ts` | 36-72 | `recentTimestamps` Set grandit sans limite | MOYENNE |

---

## C. Gestion d'erreurs

### C.1 Error Boundary absent - CRITIQUE

Comme mentionné en B.1 : **FeatureBoundary.tsx existe mais n'est jamais importé**. Aucune page n'est protégée.

### C.2 Blocs catch vides - HAUTE

**32 blocs catch vides** détectés dans le codebase :

| Fichier | Occurrences | Sévérité |
|---------|-------------|----------|
| `src/components/layout/settings-provider.tsx` | 4 | HAUTE |
| `src/components/documents/useDocumentManager.ts` | 2 | HAUTE |
| `src/components/layout/LowPowerModeDetector.tsx` | 2 | MOYENNE |
| `src/stores/settings.ts` | 2 | MOYENNE |
| `src/components/interventions/filters/filter-utils.ts` | 2 | MOYENNE |
| `src/features/settings/UserPermissionsDialog.tsx` | 1 | HAUTE |
| `src/lib/api/permissions.ts` | 1 | HAUTE |
| `src/lib/geocode/geocode-service.ts` | 1 | MOYENNE |
| `src/hooks/usePreloadInterventions.ts` | 1 | BASSE |
| Autres (15 fichiers) | 16 | VARIABLE |

**Exemple critique** - `src/stores/settings.ts:38` :
```typescript
try {
  // ... parse localStorage
} catch {}  // Erreur complètement ignorée
```

**Correction suggérée :**
```typescript
try {
  // ...
} catch (error) {
  console.warn('[Settings] Failed to parse stored settings:', error);
  // Fallback to defaults
}
```

### C.3 Console.log en production - HAUTE

**136+ console.log/warn/error** dans 30+ fichiers de production.

Fichiers les plus pollués :
| Fichier | Occurrences |
|---------|-------------|
| `src/providers/AuthStateListenerProvider.tsx` | 35 |
| `src/lib/api/v2/artisansApi.ts` | 17 |
| `src/lib/geocode/geocode-service.ts` | 12 |
| `src/hooks/useAnalyticsData.ts` | 9 |
| `src/lib/api/v2/interventionsApi.ts` | 8+ |

**Recommandation** : Implémenter un logger centralisé avec niveaux (debug/info/warn/error) et désactiver en production.

### C.4 Promesses non gérées

| Fichier | Ligne | Problème | Sévérité |
|---------|-------|----------|----------|
| `sync-queue.ts` | 260-262 | `syncModification()` est **vide** - la queue offline ne synchronise rien | CRITIQUE |
| `cache-sync.ts` | 372-374 | Failures silencieuses lors de la résolution de conflits | HAUTE |
| `artisans/page.tsx` | 459-504 | Promise.all sans gestion d'erreurs individuelles | HAUTE |
| `dashboard/page.tsx` | 177-199 | Appel API lateness sans catch | MOYENNE |

### C.5 Gestion des états d'erreur UI

| Page/Composant | Loading state | Error state | Empty state | Retry |
|----------------|--------------|-------------|-------------|-------|
| `dashboard/page.tsx` | Partiel | Absent | Absent | Non |
| `admin/dashboard/page.tsx` | Skeleton | Partiel | Absent | Non |
| `artisans/page.tsx` | Oui | Générique | Oui | Non |
| `interventions/page.tsx` | Oui | Toast only | Partiel | Non |
| `MarginStatsCard` | Oui | Absent (fallback silencieux) | N/A | Non |
| `CommentSection` | Oui | Générique | Oui | Non |
| `UserPermissionsDialog` | Partiel | Générique | N/A | Non |

---

## D. Performance

### D.1 Fichiers massifs impactant le bundle

Les 5 plus gros fichiers de logique applicative :

| Fichier | Lignes | Impact bundle | Lazy loadable ? |
|---------|--------|---------------|-----------------|
| `interventionsApi.ts` | 4351 | ~100KB | Oui (route-level) |
| `InterventionEditForm.tsx` | 3472 | ~85KB | Oui (modal) |
| `NewArtisanModalContent.tsx` | 2613 | ~65KB | Oui (modal) |
| `artisansApi.ts` | 2443 | ~60KB | Oui (route-level) |
| `TableView.tsx` | 2193 | ~55KB | Oui (view switch) |

### D.2 Calculs non mémoïsés

**HAUTE** - `app/dashboard/page.tsx` :
```typescript
// periodOptions recalcule 36 mois/semaines à chaque render
const periodOptions = useMemo(() => { /* 40 lignes */ }, [periodType])
// Mais les dépendances ne sont pas optimales
```

**HAUTE** - `app/interventions/page.tsx:313-390` :
```typescript
// 75 lignes de conversion de filtres SANS useMemo
// Exécuté à chaque render, crée de nouveaux objets chaque fois
```

**MOYENNE** - `app/artisans/page.tsx` :
```typescript
// getDisplayName() appelé inline sans cache
// hexToRgba(), computeBadgeStyle() recalculés pour chaque cellule du tableau
```

### D.3 CSS-in-JS dangereux

**HAUTE** - `app/admin/dashboard/page.tsx:27-85,487` :
```typescript
const accordionStyles = `...`  // 60 lignes de CSS
<style dangerouslySetInnerHTML={{ __html: accordionStyles }} />
```
- Injecte du CSS brut dans le DOM à chaque render
- Pas de scoping (affecte toute la page)
- Devrait utiliser des CSS modules ou des classes Tailwind

### D.4 Tables sans virtualisation

| Composant | Items rendus | Virtualisation | Recommandation |
|-----------|-------------|----------------|----------------|
| `TableView.tsx` | Jusqu'à 100 | Non | Utiliser `@tanstack/react-virtual` |
| `artisans/page.tsx` | Jusqu'à 100 | Non | Virtualiser les lignes |
| `admin-dashboard tables` | Variable | Non | Paginer côté serveur |

> Note : Le projet possède un dossier `src/components/virtual-components/` avec VirtualList, VirtualGrid, VirtualTable mais ils ne semblent pas utilisés partout.

### D.5 Images non optimisées

Le projet utilise `next/image` dans certains endroits mais des balises `<img>` brutes existent encore, manquant les optimisations de Next.js (lazy loading, formats modernes, sizing).

---

## E. Code Mort et Duplication

### E.1 Modules API dupliqués - CRITIQUE

```
ANCIEN (deprecated) :
├── src/lib/supabase-api.ts        ← Contient usersApi, artisansApi, interventionsApi
│                                     INTERVENTION_STATUS, INTERVENTION_METIERS
├── src/lib/supabase-api-v2.ts     ← Re-exporte depuis v2/ avec alias

NOUVEAU (actuel) :
├── src/lib/api/v2/usersApi.ts
├── src/lib/api/v2/artisansApi.ts
├── src/lib/api/v2/interventionsApi.ts
└── src/lib/api/v2/index.ts        ← Re-exporte avec suffixe V2
```

**3 couches d'indirection pour les mêmes APIs** : legacy → v2 → alias.

### E.2 Fonction `getSupabaseClientForNode()` dupliquée 4 fois - CRITIQUE

| Fichier | Lignes | Identique ? |
|---------|--------|-------------|
| `src/lib/api/v2/artisansApi.ts` | ~28-50 | Oui |
| `src/lib/api/v2/interventionsApi.ts` | ~28-50 | Oui |
| `src/lib/api/v2/enumsApi.ts` | ~28-50 | Oui |
| `src/lib/api/v2/documentsApi.ts` | ~40-60 | Légèrement différent |

**Alternative centralisée existante mais non utilisée** : `src/lib/supabase-admin.ts:getSupabaseAdminClient()`

**Correction suggérée** : Extraire dans `src/lib/api/v2/common/client.ts`.

### E.3 Pattern de détection browser/server dupliqué

Même pattern copié-collé dans 3+ fichiers API :
```typescript
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();
```

### E.4 Composants orphelins (0 imports) - MOYENNE

**14 composants jamais importés** :

| Fichier | Taille | Recommandation |
|---------|--------|----------------|
| `src/components/FeatureBoundary.tsx` | ~25 lignes | UTILISER (ErrorBoundary) |
| `src/components/background/BubbleBackground.tsx` | ~50 lignes | Supprimer |
| `src/components/admin-analytics/ConversionSankey.tsx` | Variable | Supprimer ou planifier |
| `src/components/layout/date-range-picker.tsx` | Variable | Supprimer |
| `src/components/layout/recent-sales.tsx` | Variable | Supprimer |
| `src/components/admin-dashboard/StatusChart.tsx` | Variable | Supprimer |
| `src/components/admin-dashboard/GestionnairePerformanceTable.tsx` | Variable | Supprimer |
| `src/components/admin-dashboard/ManagerPerformanceTable.tsx` | Variable | Supprimer |
| `src/components/dashboard/intervention-stats-piechart.tsx` | Variable | Supprimer |
| `src/components/Skeletons.tsx` | Variable | Supprimer |
| `src/components/interventions/ResizableTableHeader.tsx` | Variable | Supprimer |
| `src/components/interventions/StatusSelector.tsx` | Variable | Supprimer |
| `src/components/interventions/ScrollableTableCard.tsx` | Variable | Supprimer |
| `src/components/interventions/InterventionNotifications.tsx` | Variable | Supprimer |

### E.5 Context orphelin

`src/contexts/NavigationContext.tsx` - **0 imports** - Dead code à supprimer.

### E.6 Constantes dupliquées - MOYENNE

| Constante | Localisation 1 | Localisation 2 |
|-----------|---------------|----------------|
| `INTERVENTION_STATUS` | `src/lib/supabase-api.ts:551` | `src/mockAPI/interventions.ts:294` |
| `INTERVENTION_METIERS` | `src/lib/supabase-api.ts:565` | `src/mockAPI/interventions.ts:317` |

Importées dans ~24 fichiers depuis des sources différentes.

### E.7 Pages de test/preview en production

| Fichier | Description | Recommandation |
|---------|-------------|----------------|
| `app/testmodalui/page.tsx` | Test UI modaux | Déplacer dans `_dev/` |
| `app/component/page.tsx` | Showcase composants | Déplacer dans `_dev/` |
| `app/previews/interventions-card/page.tsx` | Preview carte | Déplacer dans `_dev/` |
| `app/comptabilite/page.tsx` | Page comptabilité (incomplet) | À terminer ou supprimer |

### E.8 Données mock en production - HAUTE

`src/features/interventions/components/InterventionCard.tsx:76-81` :
```typescript
const USERS_MOCK = { /* ... hardcoded user data ... */ }
```

**Du code mock en production qui ne devrait pas être là.**

---

## F. Revue Page par Page

### F.1 Dashboard (`app/dashboard/page.tsx`) - Score 4/10

| Aspect | Évaluation |
|--------|------------|
| **Taille** | 812 lignes - TROP GROS |
| **State** | 15+ useState - Non structuré |
| **Effects** | 10+ useEffect - Complexes et imbriqués |
| **Erreurs** | Appel lateness sans catch, pas d'error boundary |
| **Accessibilité** | Pas d'aria-label sur avatars cliquables, pas de rôle region |
| **Hardcoded** | "Période :", pluralisation inline, "👑 Le boss..." |
| **Performance** | periodOptions recalcule 36 entrées chaque render |

**Recommandation** : Découper en 5 composants :
- `DashboardHeader` (période, utilisateur)
- `DashboardStats` (cartes de statistiques)
- `GestionnaireSelector` (sélecteur avec avatars)
- `RevealTransition` (animation d'entrée)
- `DashboardPage` (orchestration)

### F.2 Admin Dashboard (`app/admin/dashboard/page.tsx`) - Score 4/10

| Aspect | Évaluation |
|--------|------------|
| **Taille** | 925 lignes - TROP GROS |
| **State** | 13 useState dont 5 modaux séparés |
| **CSS** | `dangerouslySetInnerHTML` pour 60 lignes de CSS |
| **Erreurs** | Erreurs API avec fallback silencieux |
| **Duplication** | `agencyColumns`, `metierColumns`, `managerColumns` - même structure 3x |
| **Hardcoded** | Couleurs inline (#60a5fa, #10b981), textes FR |

### F.3 Artisans (`app/artisans/page.tsx`) - Score 3/10

| Aspect | Évaluation |
|--------|------------|
| **Taille** | 1435 lignes - CRITIQUE |
| **State** | 25+ useState - Ingérable |
| **Logique** | Filtres complexes mélangeant client/serveur |
| **Bug risk** | Race conditions entre changements de filtres |
| **Erreurs** | View count errors silencieuses (console.log seulement) |
| **Accessibilité** | Pas de rôles sémantiques dans le tableau, pas de keyboard nav |
| **Helpers** | `hexToRgba()`, `computeBadgeStyle()`, `getDisplayName()` inline |

### F.4 Interventions (`app/interventions/page.tsx`) - Score 3/10

| Aspect | Évaluation |
|--------|------------|
| **Taille** | 1831 lignes - LE PLUS GROS COMPOSANT |
| **State** | 20+ useState + 25 useCallback/useMemo |
| **Effects** | 12+ useEffect avec logique complexe |
| **Architecture** | Permission checks + view management + filter conversion + status mapping + data loading + modals dans UN composant |
| **Session Storage** | Communication cross-page fragile, données non validées |
| **Erreurs** | Pas de retry, toast seul sur erreur de statut |
| **Workflow** | `isSyncingFromViewRef` - pattern ref boolean confus |

### F.5 Settings - Score moyen 5/10

| Composant | Lignes | Score | Problème principal |
|-----------|--------|-------|--------------------|
| `EnumManager.tsx` | 738 | 5/10 | 14 useState, inline `any` x4, pas de validation couleur |
| `ProfileSettings.tsx` | 869 | 4/10 | Callback hell dans le changement de password, `(currentUser as any)` |
| `TargetsSettings.tsx` | 616 | 6/10 | Pas de validation min/max sur les objectifs de marge |
| `TeamSettings.tsx` | 1071 | 4/10 | 10+ boolean state, pas de state machine pour les modaux |
| `UserPermissionsDialog.tsx` | 1325 | 4/10 | 20+ state, `variant: 'destructive' as any`, avatar upload sans cleanup |

### F.6 Documents - Score 6/10

| Composant | Lignes | Score | Problème principal |
|-----------|--------|-------|--------------------|
| `DocumentPreview.tsx` | 106 | 7/10 | MIME type brittle, PDF height fixe |
| `useDocumentManager.ts` | 945 | 4/10 | 27 useState, refs à la place de state, localStorage sans validation |
| `DocumentManagerGmbs.tsx` | Variable | 6/10 | Complexe mais structuré |
| `DocumentManagerLegacy.tsx` | Variable | 6/10 | Correct |
| `DocumentManagerRegistry.tsx` | 71 | 8/10 | Bon pattern Factory |

---

## G. Logique Métier Critique

### G.1 Transition de statuts d'intervention - CRITIQUE

`src/lib/api/v2/interventionsApi.ts:604-667` :

**Problèmes** :
1. **Pas de transaction atomique** : Le statut actuel est lu séparément de la mise à jour → un autre utilisateur peut le modifier entre-temps
2. **Pas de validation de transition** : Ne vérifie pas si la transition est autorisée selon les règles workflow
3. **Logique dupliquée** : Si le service échoue, fallback RPC avec métadonnées dupliquées
4. **Pas d'audit trail** : Métadonnées de transition non enregistrées de manière cohérente

```typescript
// PROBLÈME: Race condition entre lecture et écriture
const oldStatus = await getOldStatus(interventionId); // <-- peut changer
await updateStatus(interventionId, newStatus);         // <-- basé sur oldStatus
```

**Correction suggérée** : Utiliser une transaction Postgres ou du verrouillage optimiste (version/timestamp).

### G.2 Gestion des artisans - CRITIQUE

`src/lib/api/v2/interventionsApi.ts:748-949` :

1. **Race condition** : Lecture du primary existant puis mise à jour - peut être modifié entre les deux queries
2. **Pas de vérification d'existence** : L'artisan assigné n'est pas vérifié avant le lien
3. **Perte de données potentielle** : Si la mise à jour échoue à mi-chemin, les rôles peuvent être incohérents
4. **Logique de démolition** : Si le rôle primary est déjà 'primary', demotion vers un état ambigu

### G.3 Queue de synchronisation offline - CRITIQUE

`src/lib/realtime/sync-queue.ts:260-262` :

```typescript
syncModification(modification: QueuedModification): Promise<void> {
  // TODO: Implement actual sync
}
```

**La méthode `syncModification()` est VIDE**. Toute la queue offline est non fonctionnelle. Les modifications hors-ligne sont perdues.

### G.4 Race conditions dans le cache-sync

`src/lib/realtime/cache-sync.ts` :

1. **Ligne 302-326** : `setTimeout(0)` pour l'invalidation peut s'exécuter dans le mauvais ordre avec `setQueryData`
2. **Ligne 365-374** : Fetch du cache de référence pendant la détection de conflits peut timeout
3. **Ligne 452-463** : Broadcast sync appelé après invalidation peut rater des mises à jour

### G.5 Broadcast sync - Memory leak

`src/lib/realtime/broadcast-sync.ts:56-64` :
```typescript
// Global hack non thread-safe
window.__lastBroadcastTimestamp = timestamp;
// recentTimestamps Set grandit sans limite
```

### G.6 Calculs de marge dupliqués

`src/components/dashboard/margin-stats-card.tsx` et `margin-total-card.tsx` partagent ~80% de code identique :
- `getPeriodTypeFromDates()`
- `previousPeriod` calculation
- `useDashboardMargin` call pattern
- Target loading via `usersApi`

**Recommandation** : Créer `useDashboardCardLogic.ts` hook partagé.

---

## H. Métriques de Complexité

### H.1 Complexité cyclomatique estimée (top 10)

| Fichier | Complexité | Risque |
|---------|-----------|--------|
| `interventionsApi.ts` | Très haute | Bugs, maintenabilité |
| `app/interventions/page.tsx` | Très haute | Régression |
| `InterventionEditForm.tsx` | Très haute | Difficile à tester |
| `app/artisans/page.tsx` | Haute | Bugs filtres |
| `cache-sync.ts` | Haute | Race conditions |
| `useInterventionContextMenu.ts` | Haute (43 `any`) | Type safety |
| `artisansApi.ts` | Haute | Maintenabilité |
| `UserPermissionsDialog.tsx` | Haute | State management |
| `useDocumentManager.ts` | Haute (27 state) | Memory leaks |
| `app/admin/dashboard/page.tsx` | Moyenne-Haute | CSS injection |

### H.2 Ratio de duplication

| Pattern dupliqué | Fichiers affectés | Lignes dupliquées |
|-----------------|-------------------|-------------------|
| `getSupabaseClientForNode()` | 4 | ~100 |
| API modules (legacy + v2) | 5 | ~500+ |
| `INTERVENTION_STATUS/METIERS` | 2+ (24 importeurs) | ~30 |
| Period type conversion | 3+ | ~60 |
| Color utilities (hexToRgba, etc.) | 5+ | ~100 |
| Status display logic | 4+ | ~150 |
| Supabase client detection | 3+ | ~15 |

**Estimation totale** : ~1000+ lignes de code dupliqué.

---

## Résumé des Recommandations par Priorité

### CRITIQUE (Sprint actuel)

| # | Action | Fichiers concernés | Impact |
|---|--------|-------------------|--------|
| 1 | Implémenter `syncModification()` ou supprimer la queue | `sync-queue.ts` | Sync offline non fonctionnelle |
| 2 | Ajouter des transactions pour les transitions de statut | `interventionsApi.ts` | Intégrité des données |
| 3 | Ajouter des transactions pour la gestion des artisans | `interventionsApi.ts` | Corruption de données possible |
| 4 | Activer FeatureBoundary (ErrorBoundary) sur toutes les pages | `app/*/page.tsx` | Crash complet en production |
| 5 | Consolider `getSupabaseClientForNode()` en un seul endroit | 4 fichiers API | Duplication critique |

### HAUTE (Prochain sprint)

| # | Action | Impact |
|---|--------|--------|
| 6 | Éliminer les `any` les plus critiques (interventionsApi: 67, artisansApi: 45, contextMenu: 43) | Type safety |
| 7 | Découper les composants > 1000 lignes | Maintenabilité |
| 8 | Remplacer les 32 catch vides par une gestion d'erreur | Debugging |
| 9 | Supprimer les 136+ console.log ou implémenter un logger | Production readiness |
| 10 | Corriger les race conditions dans cache-sync | Cohérence données |
| 11 | Consolider les constantes dupliquées (statuts, métiers) | Source unique de vérité |

### MOYENNE (Mois suivant)

| # | Action | Impact |
|---|--------|--------|
| 12 | Supprimer les 14 composants orphelins + NavigationContext | Code mort |
| 13 | Remplacer `dangerouslySetInnerHTML` CSS par Tailwind/CSS modules | Sécurité + perf |
| 14 | Ajouter virtualisation aux tables > 50 items | Performance |
| 15 | Déplacer les pages test/preview dans `_dev/` | Propreté |
| 16 | Ajouter états d'erreur + retry dans les composants | UX |
| 17 | Extraire les hooks custom depuis les God components | Testabilité |
| 18 | Supprimer USERS_MOCK de InterventionCard | Production readiness |
| 19 | Supprimer les modules API legacy (supabase-api.ts, supabase-api-v2.ts) | Simplification |

### BASSE (Backlog)

| # | Action | Impact |
|---|--------|--------|
| 20 | Préparer l'i18n (extraire les 100+ strings hardcodées) | Internationalisation |
| 21 | Ajouter des tests unitaires pour la logique métier | Confiance |
| 22 | Documenter les CSS variables requises par les composants UI | DX |
| 23 | Consolider les hook aliases (useInterventionModalState → useModalState) | Clarté |
| 24 | Centraliser les utilitaires couleur (hexToRgba, getReadableTextColor, etc.) | DRY |

---

## Annexe : Fichiers à risque maximal

Ces fichiers concentrent le plus de dette technique et devraient être prioritaires pour le refactoring :

1. **`src/lib/api/v2/interventionsApi.ts`** (4351 lignes, 67 `any`, race conditions)
2. **`app/interventions/page.tsx`** (1831 lignes, 20+ state, 12+ effects)
3. **`src/lib/realtime/cache-sync.ts`** (980 lignes, 13 `any`, race conditions)
4. **`src/lib/realtime/sync-queue.ts`** (méthode sync vide, queue non fonctionnelle)
5. **`src/hooks/useInterventionContextMenu.ts`** (43 `any`, aucun typage)
6. **`app/artisans/page.tsx`** (1435 lignes, 25+ state)
7. **`src/components/interventions/InterventionEditForm.tsx`** (3472 lignes)
8. **`src/components/documents/useDocumentManager.ts`** (945 lignes, 27 state)
