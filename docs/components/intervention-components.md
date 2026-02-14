# Composants Intervention

> Composants dédiés a la gestion des interventions dans GMBS-CRM.

---

## Organisation des fichiers

Les composants d'intervention sont répartis entre deux emplacements suivant le pattern de co-location Next.js App Router :

```
src/components/interventions/           # Composants réutilisables
  ColorPicker.tsx
  ConnectionStatusIndicator.tsx
  DateRangePicker.tsx
  DuplicateInterventionDialog.tsx
  EmailEditModal.tsx
  FiltersBar.tsx
  InterventionCard.tsx
  InterventionContextMenu.tsx
  InterventionEditForm.tsx
  InterventionForm.tsx
  InterventionNotifications.tsx
  InterventionRealtimeProvider.tsx
  Interventions.tsx
  InterventionsKanban.tsx
  NewInterventionForm.tsx
  ReminderMentionInput.tsx
  RemoteEditBadge.tsx
  ResizableTableHeader.tsx
  ScrollableTableCard.tsx
  StatusNode.tsx
  StatusSelector.tsx
  TransitionArrow.tsx
  UnsavedChangesDialog.tsx
  WorkflowAdminModal.tsx
  WorkflowVisualizer.tsx
  filters/                              # Filtres de colonnes
  views/                                # Vues (table, kanban, etc.)
  history/                              # Historique intervention
  legacy/                               # Composants legacy

app/interventions/_components/          # Composants co-localisés (page-specific)
  InterventionsPlusMenu.tsx
  InterventionsStatusFilter.tsx
  InterventionsViewRenderer.tsx
  types.ts
```

---

## Composants principaux

### Interventions.tsx

Composant racine de la page interventions. Orchestre :
- Le chargement des données via `useInterventionsQuery`
- Le système de vues via `useInterventionViews`
- Le rendu conditionnel selon le layout sélectionné
- La barre de filtres et la recherche

### InterventionCard.tsx

Carte d'intervention utilisée dans les vues cards, gallery et kanban.

Affiche : statut (couleur), adresse, artisan assigné, date, gestionnaire, métier.

### InterventionForm.tsx / NewInterventionForm.tsx

Formulaires de création et d'édition d'intervention utilisant React Hook Form + Zod pour la validation.

Fonctionnalités :
- Détection automatique de doublons (adresse + agence)
- Auto-complétion des champs adresse
- Sélecteurs de statut, métier, agence, gestionnaire
- Validation cumulative selon le workflow

### InterventionEditForm.tsx

Formulaire d'edition inline, utilise dans la modal d'intervention pour modifier les champs directement.

**Pattern de sauvegarde (fire-and-forget avec toast) :**

1. Le modal ferme **immediatement** apres la soumission (`onSuccess?.(null)`)
2. Un toast loading "Enregistrement en cours..." s'affiche
3. La mutation principale (`updateMutation.mutateAsync`) sauvegarde statut, owner, tenant, date prevue, adresse, etc.
4. En cas de succes, toast success avec bouton "Voir"
5. Les taches secondaires (couts, paiements, artisans) s'executent en arriere-plan via `runPostMutationTasks()`
6. Apres completion des taches, le cache intervention detail est invalide → l'UI se met a jour automatiquement

**Gestion des erreurs :**
- En cas d'echec de la mutation : toast error avec bouton "Reessayer"
- Le modal est deja ferme → l'utilisateur est informe uniquement via le toast
- Les erreurs des taches secondaires sont isolees (chaque tache catch ses propres erreurs)

---

## Système de vues (views/)

Le projet supporte **6 layouts** différents pour afficher les interventions :

| Vue | Fichier | Description |
|-----|---------|-------------|
| Table | `views/TableView.tsx` | Vue tabulaire avec colonnes redimensionnables et tri |
| Kanban | `views/KanbanView.tsx` | Vue en colonnes par statut avec drag & drop |
| Gallery | `views/GalleryView.tsx` | Vue en cartes grille |
| Calendar | `views/CalendarView.tsx` | Vue calendrier par date |
| Timeline | `views/TimelineView.tsx` | Vue chronologique |
| Tabs | `views/ViewTabs.tsx` | Onglets de navigation entre vues |

```
src/components/interventions/views/
  TableView.tsx
  KanbanView.tsx
  GalleryView.tsx
  CalendarView.tsx
  TimelineView.tsx
  ViewTabs.tsx
  ColumnConfiguration.tsx
  ColumnConfigurationModal.tsx
  column-alignment-options.ts
```

### ViewTabs

Barre d'onglets permettant de basculer entre les vues. Chaque onglet est persisté dans `localStorage` via le hook `useInterventionViews`.

### ColumnConfiguration

Modal de configuration des colonnes visibles dans la vue Table. Permet de réordonner, masquer et dimensionner les colonnes.

---

## Filtres (filters/)

Composants de filtrage des colonnes dans la vue Table :

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `ColumnFilter` | `ColumnFilter.tsx` | Dispatcher qui rend le filtre approprié selon le type |
| `TextColumnFilter` | `TextColumnFilter.tsx` | Filtre texte avec recherche |
| `SelectColumnFilter` | `SelectColumnFilter.tsx` | Filtre par sélection (statut, agence, etc.) |
| `CheckboxColumnFilter` | `CheckboxColumnFilter.tsx` | Filtre par cases a cocher multiples |
| `DateColumnFilter` | `DateColumnFilter.tsx` | Filtre par plage de dates |
| `NumberColumnFilter` | `NumberColumnFilter.tsx` | Filtre par plage numérique |
| `UserColumnFilter` | `UserColumnFilter.tsx` | Filtre par utilisateur (gestionnaire) |

```tsx
// Exemple d'utilisation interne dans TableView
<ColumnFilter
  column={column}
  filterType={column.filterType}
  onFilterChange={handleFilterChange}
/>
```

Le fichier `filter-utils.ts` contient les utilitaires de matching et de conversion de filtres, et `types.ts` les types partagés.

---

## Composants de workflow

### WorkflowVisualizer.tsx

Visualisation graphique des transitions de statuts d'intervention utilisant **ReactFlow**. Affiche les noeuds (statuts) et les arêtes (transitions autorisées) avec les couleurs de chaque statut.

### WorkflowAdminModal.tsx

Modal d'administration du workflow permettant de configurer les transitions autorisées, les exigences par statut et les conditions.

### StatusSelector.tsx

Sélecteur de statut avec indicateur visuel de couleur. Affiche uniquement les transitions autorisées depuis le statut courant.

### StatusNode.tsx / TransitionArrow.tsx

Composants ReactFlow pour le rendu des noeuds de statut et des flèches de transition dans le visualiseur.

---

## Composants de communication

### InterventionNotifications.tsx

Gestion des notifications liées aux interventions (rappels, mentions, changements de statut).

### ReminderMentionInput.tsx

Champ de saisie avec support des @mentions pour les rappels d'intervention. Utilise une regex `/@([\p{L}\p{N}_.-]+)/gu` pour détecter les mentions.

### EmailEditModal.tsx

Modal d'édition et d'envoi d'email lié a une intervention (devis, convocation visite technique).

---

## Composants d'état

### ConnectionStatusIndicator.tsx

Indicateur de statut de connexion temps réel (Supabase Realtime). Affiche un point coloré : vert (connecté), orange (reconnexion), rouge (déconnecté).

### RemoteEditBadge.tsx

Badge affiché quand un autre utilisateur est en train de modifier la même intervention. Auto-cleanup après 20 secondes.

### DuplicateInterventionDialog.tsx

Dialogue d'alerte affiché lors de la détection d'un doublon (même adresse + même agence).

### UnsavedChangesDialog.tsx

Dialogue de confirmation affiché quand l'utilisateur tente de quitter un formulaire avec des modifications non sauvegardées.

---

## Composants co-localisés (app/)

### InterventionsViewRenderer.tsx

Composant de rendu qui sélectionne et affiche la vue appropriée (table, kanban, gallery, etc.) selon la configuration active.

### InterventionsStatusFilter.tsx

Barre de filtrage rapide par statut, affichée au-dessus de la liste. Chaque statut affiche un compteur.

### InterventionsPlusMenu.tsx

Menu "+" pour les actions de création rapide : nouvelle intervention, import, etc.

---

## Composants utilitaires

| Composant | Description |
|-----------|-------------|
| `FiltersBar.tsx` | Barre de filtres active avec pills supprimables |
| `ColorPicker.tsx` | Sélecteur de couleur pour sous-statuts personnalisés |
| `DateRangePicker.tsx` | Sélecteur de plage de dates |
| `ResizableTableHeader.tsx` | En-tête de tableau avec colonnes redimensionnables par drag |
| `ScrollableTableCard.tsx` | Conteneur de tableau avec scroll horizontal |
| `InterventionRealtimeProvider.tsx` | Provider qui initialise le channel Supabase Realtime pour les interventions |
| `InterventionsKanban.tsx` | Vue Kanban avec drag & drop via @hello-pangea/dnd |
