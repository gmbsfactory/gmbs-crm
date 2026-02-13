# Composants partagés et patterns

> Composants réutilisables cross-feature et patterns architecturaux des composants GMBS-CRM.

---

## Composants partagés (src/components/shared/)

### CommentSection

**Fichier :** `src/components/shared/CommentSection.tsx` (29 KB)

Composant de commentaires unifié, utilisé a la fois dans les modals intervention et artisan.

**Props :**

```typescript
interface CommentSectionProps {
  entityType: "artisan" | "intervention"
  entityId: string
  currentUserId?: string | null
  limit?: number
  scrollFadeColor?: string | null
  scrollFadeInsetLeft?: number
  scrollFadeInsetRight?: number
  disableScrollFades?: boolean
  searchQuery?: string
}
```

**Fonctionnalités :**
- Création, édition et suppression de commentaires via TanStack Query
- Avatars colorés avec initiales du gestionnaire (`GestionnaireBadge`)
- Menu contextuel (clic droit) pour modifier ou supprimer ses propres commentaires
- Raccourci clavier Ctrl/Cmd+Enter pour soumettre
- Scroll fades dynamiques (gradient en haut/bas quand le contenu dépasse)
- Surlignage des termes de recherche via `getHighlightSegments`
- Différents types de commentaires : `internal`, `external`, `system`
- Affichage du type de motif (`archive`, `done`) pour les commentaires système

```tsx
import { CommentSection } from "@/components/shared/CommentSection"

<CommentSection
  entityType="intervention"
  entityId={intervention.id}
  currentUserId={user.id}
  searchQuery={searchTerm}
/>
```

### StatusReasonModal

**Fichier :** `src/components/shared/StatusReasonModal.tsx`

Modal demandant un motif obligatoire lors de certains changements de statut.

**Props :**

```typescript
interface StatusReasonModalProps {
  open: boolean
  type: StatusReasonType   // "archive" | "done"
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSubmitting?: boolean
}
```

**Usage :** Déclenchée automatiquement lors du passage au statut INTER_TERMINEE (done) ou lors de l'archivage d'un artisan (archive). Le commentaire est enregistré avec le `reason_type` correspondant pour traçabilité.

---

## Composants de layout (src/components/layout/)

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `AppSidebar` | `app-sidebar.tsx` | Sidebar de navigation principale avec 4 modes (collapsed, icons, hybrid, expanded) |
| `Topbar` | `topbar.tsx` | Barre de navigation supérieure avec recherche, notifications, profil |
| `GlobalModalHost` | `GlobalModalHost.tsx` | Portal unique pour le rendu de toutes les modals (z-index garanti) |
| `AuthGuard` | `auth-guard.tsx` | Wrapper de permission qui masque le contenu si l'utilisateur n'a pas les droits |
| `DataTable` | `data-table.tsx` | Table générique basée sur @tanstack/react-table |
| `SidebarGate` | `sidebar-gate.tsx` | Affichage conditionnel de la sidebar selon la route |
| `TopbarGate` | `topbar-gate.tsx` | Affichage conditionnel du topbar selon la route |
| `ThemeWrapper` | `theme-wrapper.tsx` | Wrapper de thème (light/dark/system) via next-themes |
| `SettingsProvider` | `settings-provider.tsx` | Provider des paramètres utilisateur (Zustand store) |
| `AvatarStatus` | `avatar-status.tsx` | Avatar avec indicateur de statut (online, busy, dnd, offline) |
| `GlobalShortcuts` | `global-shortcuts.tsx` | Gestionnaire de raccourcis clavier globaux |
| `LowPowerModeDetector` | `LowPowerModeDetector.tsx` | Détection du mode économie d'énergie pour réduire les animations |
| `ConditionalPadding` | `conditional-padding.tsx` | Padding dynamique selon le mode sidebar |
| `Overview` | `overview.tsx` | Vue d'ensemble pour le dashboard |

---

## Composants virtualisés (src/components/virtual-components/)

Composants utilisant `@tanstack/react-virtual` pour le rendu performant de grandes listes :

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `VirtualTable` | `VirtualTable.tsx` | Tableau virtualisé (rendu uniquement des lignes visibles) |
| `VirtualList` | `VirtualList.tsx` | Liste virtualisée pour scroll infini |
| `VirtualGrid` | `VirtualGrid.tsx` | Grille virtualisée pour les vues gallery |

```tsx
import { VirtualTable } from "@/components/virtual-components"

<VirtualTable
  data={interventions}
  columns={columns}
  rowHeight={48}
  overscan={5}
/>
```

---

## Composants de recherche (src/components/search/)

### UniversalSearchResults

Composant d'affichage des résultats de recherche globale. Regroupe les résultats par catégorie (interventions, artisans) avec surlignage des termes.

Utilise le hook `useUniversalSearch` avec debounce de 300ms.

---

## Composants de documents (src/components/documents/)

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `useDocumentManager` | `useDocumentManager.ts` | Hook de gestion des documents (upload, suppression, listing) |
| `DocumentManagerRegistry` | `DocumentManagerRegistry.tsx` | Registry des gestionnaires de documents par entité |
| `DocumentPreview` | `DocumentPreview.tsx` | Prévisualisation inline des documents (images, PDF) |
| `variants/` | Dossier | Variantes d'affichage (compact, full, grid) |

---

## Composants Admin Dashboard (src/components/admin-dashboard/)

| Composant | Description |
|-----------|-------------|
| `VirtualizedDataTable.tsx` | Tableau de données admin avec virtualisation |
| `KPICard.tsx` | Carte KPI avec valeur, tendance et sparkline |
| `GestionnairePerformanceTable.tsx` | Tableau de performance par gestionnaire |
| `ManagerPerformanceTable.tsx` | Tableau de performance par manager |
| `VerticalBarChart.tsx` | Graphique barres verticales (Recharts) |
| `HorizontalBarChart.tsx` | Graphique barres horizontales |
| `StackedBarChart.tsx` | Graphique barres empilées |
| `FunnelChart.tsx` | Graphique entonnoir |
| `Sparkline.tsx` | Mini-graphique inline |
| `MarginBar.tsx` | Barre de marge visuelle |
| `FilterBar.tsx` | Barre de filtres admin |
| `AdminGuard.tsx` | Guard d'accès admin |
| `*HistoryModal.tsx` | Modals d'historique (revenue, marge, cycle time, etc.) |

---

## Composants Auth (src/components/auth/)

### PermissionGate

Wrapper conditionnel basé sur les permissions de l'utilisateur :

```tsx
import { PermissionGate } from "@/components/auth/PermissionGate"

<PermissionGate permission="write_interventions">
  <Button>Modifier</Button>
</PermissionGate>

<PermissionGate permission="view_admin" fallback={<AccessDenied />}>
  <AdminPanel />
</PermissionGate>
```

---

## Patterns architecturaux

### Pattern de composition de page

Chaque page du CRM suit ce pattern :

```typescript
// 1. Permission check & loader (server component ou client guard)
// 2. Providers setup
<InterventionRealtimeProvider>
  <GenieEffectProvider>
    <FilterMappersProvider>
      // 3. Main PageContent component
      <PageContent />
    </FilterMappersProvider>
  </GenieEffectProvider>
</InterventionRealtimeProvider>

// 4. PageContent utilise un state hook
function PageContent() {
  const state = useInterventionPageState()
  return (
    <>
      {/* 5. Layout avec sub-components */}
      <ViewTabs />
      <FiltersBar />
      <ViewRenderer />
      {/* 6. Modals en bas */}
      <InterventionModal />
      <StatusReasonModal />
    </>
  )
}
```

### Pattern Provider/Consumer

Les données partagées entre composants d'une même page utilisent React Context :

```
Provider (dans layout ou page)
  Consumer A (composant enfant)
  Consumer B (composant enfant)
```

Exemples : `FilterMappersContext`, `GenieEffectContext`, `ModalDisplayContext`.

### Pattern Optimistic Update

Les mutations utilisent le pattern optimistic update de TanStack Query :

```
1. onMutate: sauvegarder l'état précédent, mettre a jour le cache
2. Appel API en arrière-plan
3. onError: rollback vers l'état précédent
4. onSuccess: invalider les queries pour re-fetch
```

### Pattern Portal

Les modals et tooltips sont rendus via un portal dans `GlobalModalHost` pour garantir le z-index correct :

```
DOM Tree:
  <body>
    <div id="app">...</div>
    <div id="modal-host">     <!-- GlobalModalHost -->
      <GenericModal>...</GenericModal>
    </div>
  </body>
```
