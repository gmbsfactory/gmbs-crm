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
  GestionnaireField.tsx                 # Sélecteur de gestionnaire (factorisé)
  GestionnaireSelector.tsx
  InterventionCard.tsx
  InterventionContextMenu.tsx
  InterventionEditForm.tsx              # Formulaire d'édition (composé de form-sections/)
  InterventionNotifications.tsx
  InterventionRealtimeProvider.tsx
  Interventions.tsx
  InterventionsKanban.tsx
  NewInterventionForm.tsx               # Formulaire de création (composé de form-sections/)
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
  filters/                              # Filtres de colonnes (+ SortControls)
  form-sections/                        # Sections de formulaire factorisées
  views/                                # Vues (table, kanban, etc.) + cells/
  history/                              # Historique intervention
  legacy/                               # Composants legacy

app/interventions/_components/          # Composants co-localisés (page-specific)
  InterventionsPlusMenu.tsx
  InterventionsStatusFilter.tsx
  InterventionsViewRenderer.tsx
  types.ts
```

> **Note refacto (avril 2026)** : `InterventionForm.tsx` (monolithique) a été supprimé. `NewInterventionForm` et `InterventionEditForm` partagent désormais l'état via le hook `useInterventionFormState` et composent des sections issues de `form-sections/`.

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

### NewInterventionForm.tsx

Formulaire de **création** d'intervention. C'est un composant fin qui :

1. Initialise l'état partagé via `useInterventionFormState({ mode: "create" })`
2. Compose les sections de `form-sections/` (header, client, owner, détails, artisan, paiement…)
3. Délègue la persistance au hook `useInterventionSubmit`

Fonctionnalités :
- Détection automatique de doublons (adresse + agence)
- Auto-complétion des champs adresse via `useGeocodeSearch`
- Sélecteurs de statut, métier, agence, gestionnaire (factorisés en sous-composants)
- Validation cumulative pilotée par `useInterventionValidation`
- Brouillon persisté dans le store Zustand `interventionDraft`

### InterventionEditForm.tsx

Formulaire d'edition inline, utilise dans la modal d'intervention pour modifier les champs directement. Integre le tracking de presence au niveau des champs via `FieldPresenceContext` et `useFieldPresenceDelegation` — les autres utilisateurs voient en temps reel quel champ est en cours d'edition.

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

## Sections de formulaire (form-sections/)

Depuis le refacto d'avril 2026, la logique des formulaires d'intervention est éclatée en sections autonomes, exportées depuis `form-sections/index.ts` :

| Section | Fichier | Rôle |
|---------|---------|------|
| `InterventionHeaderFields` | `InterventionHeaderFields.tsx` | Référence, statut, dates principales |
| `InterventionClientSection` | `InterventionClientSection.tsx` | Informations locataire (tenant) |
| `InterventionOwnerSection` | `InterventionOwnerSection.tsx` | Informations propriétaire / facturation |
| `InterventionDetailsSection` | `InterventionDetailsSection.tsx` | Métier, description, consigne |
| `ArtisanPanel` | `ArtisanPanel.tsx` | Sélection de l'artisan principal + carte |
| `SecondArtisanSection` | `SecondArtisanSection.tsx` | Artisan secondaire (optionnel) |
| `PaymentSection` | `PaymentSection.tsx` | Coûts, paiements, acomptes |

#### Invariant acomptes : "Reçu/Envoyé" implique une date

Cocher la case "Reçu" (acompte client) ou "Envoyé" (acompte SST) auto-remplit la date de paiement avec **la date du jour (heure locale)** si elle est vide. Décocher vide la date. La date reste éditable dans tous les cas.

- Logique métier centralisée dans `applyRecuToggle()` (`src/lib/interventions/deposit-helpers.ts`).
- Édition : appliquée par `useInterventionAccomptes` avant la transition de statut et l'upsert paiement, garantissant que `is_received === true ⟺ payment_date !== null`.
- Création : appliquée par les shims locaux de `NewInterventionForm.tsx`, qui consomment le même helper.
- Côté statut (édition uniquement) : cocher l'acompte client → `ACCEPTE` ; décocher en `ACCEPTE` → `ATT_ACOMPTE`. L'acompte SST n'impacte pas le statut.
| `DocumentSection` | `DocumentSection.tsx` | Documents liés (devis, facture…) |
| `CustomStatusSection` | `CustomStatusSection.tsx` | Sous-statuts personnalisés |

Chaque section reçoit l'état du formulaire en props depuis `useInterventionFormState` et reste découplée de la mécanique de submit.

### GestionnaireField

`GestionnaireField.tsx` est un composant factorisé partagé entre `NewInterventionForm`, `InterventionEditForm` et la modal artisan. Il encapsule la sélection (avec recherche) du gestionnaire assigné et a remplacé plusieurs implémentations dupliquées.

---

## Hooks de formulaire

Le formulaire d'intervention est désormais piloté par trois hooks complémentaires :

| Hook | Rôle |
|------|------|
| `useInterventionFormState` | État partagé : valeurs des champs, dirty tracking, sélection artisan, géocodage, brouillon Zustand. Mode `create` ou `edit`. |
| `useInterventionSubmit` | Pipeline de soumission : mutation principale, owner/tenant find-or-create, post-mutation tasks, gestion d'erreur avec rollback toast. |
| `useInterventionValidation` | Calcule dynamiquement quels champs sont requis en fonction du statut sélectionné (depuis `form-constants.ts`). |

> Le hook historique `useInterventionForm` n'existe plus. Toute nouvelle section de formulaire doit consommer `useInterventionFormState` et déléguer la persistance via `useInterventionSubmit`.

### Logique métier extraite

Les règles de dérivation (artisans avec email, calculs intermédiaires, etc.) ont été extraites de `InterventionEditForm` vers `src/lib/interventions/derivations.ts` — fonctions pures testables en isolation. Suivre ce pattern pour toute nouvelle règle métier : extraire avant d'inclure dans un `useMemo`.

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
  ExpandedRowContent.tsx              # Détail dépliable d'une ligne table
  column-alignment-options.ts
  cells/                              # Cellules réutilisables (refacto avril 2026)
    ArtisanCell.tsx
    AssigneeCell.tsx
    ColorBadgeCell.tsx
    StatusCell.tsx
    types.ts
    index.ts
```

### Cellules de table (views/cells/)

Les cellules complexes de la vue Table ont été extraites en composants dédiés et typés :

| Cellule | Description |
|---------|-------------|
| `ArtisanCell` | Affichage de l'artisan assigné avec avatar et fallback |
| `AssigneeCell` | Gestionnaire assigné (réutilise `GestionnaireField` en édition inline) |
| `ColorBadgeCell` | Badge coloré générique (statut, métier, agence…) |
| `StatusCell` | Cellule de statut avec sélecteur inline |

Le fichier `cells/types.ts` définit les props partagées (`CellContext<Intervention>`).

### ExpandedRowContent

Contenu affiché lorsqu'une ligne de la `TableView` est dépliée. Présente un résumé enrichi de l'intervention sans ouvrir la modal complète.

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

## Presence en temps reel (modal)

Composants d'indicateurs de presence collaborative, affichant qui consulte ou edite la meme intervention.

### PresenceAvatars.tsx

> Source: `src/components/ui/intervention-modal/PresenceAvatars.tsx`

Affiche les avatars des utilisateurs qui consultent actuellement la meme intervention dans le header du modal. Utilise le hook `useInterventionPresence` pour s'abonner au canal Supabase Presence `presence:intervention-{id}`.

### PresenceFieldIndicator.tsx

> Source: `src/components/ui/intervention-modal/PresenceFieldIndicator.tsx`

Indicateur visuel au niveau d'un champ de formulaire, montrant qu'un autre utilisateur est en train d'editer ce champ specifique. Utilise le `FieldPresenceContext` et le hook `useFieldPresenceDelegation`.

### Hooks de Presence

| Hook | Fichier | Role |
|------|---------|------|
| `useInterventionPresence` | `src/hooks/useInterventionPresence.ts` | Gestion canal Presence (subscribe/track/untrack), deduplication multi-onglets |
| `useFieldPresenceDelegation` | `src/hooks/useFieldPresenceDelegation.ts` | Tracking de focus sur les champs du formulaire, whitelist de champs (`TRACKED_FIELD_IDS`) |

### Context

Le `FieldPresenceContext` (`src/contexts/FieldPresenceContext.tsx`) fournit les informations de presence au niveau des champs aux composants enfants du modal.

---

## Composants co-localisés (app/)

### InterventionsViewRenderer.tsx

Composant de rendu qui sélectionne et affiche la vue appropriée (table, kanban, gallery, etc.) selon la configuration active.

### InterventionsStatusFilter.tsx

Barre de filtrage rapide par statut, affichée au-dessus de la liste. Chaque statut affiche un compteur.

### InterventionsPlusMenu.tsx

Menu "+" pour les actions de création rapide : nouvelle intervention, import, etc.

---

## Page Comptabilite

La page comptabilite (`app/comptabilite/page.tsx`) affiche les interventions terminees avec leurs couts, paiements et informations client/facturation.

### Architecture

```
app/comptabilite/
  page.tsx                          # Page principale avec filtres de periode
  _components/
    ComptabiliteTableRow.tsx        # Ligne de tableau memorisee (memo)
src/hooks/useComptabiliteQuery.ts   # Hook TanStack Query dedie
src/lib/comptabilite/formatters.ts  # Formatters (nom client, couts, paiements)
```

### Donnees affichees

La colonne **Client** affiche les informations de facturation (owner/proprietaire) et non le locataire (tenant). L'ordre de priorite est :

1. `nomPrenomFacturation` (champ `plain_nom_facturation` de la table `owners`)
2. `prenomProprietaire` + `nomProprietaire` (champs `owner_firstname`/`owner_lastname`)
3. Fallback : `prenomClient` + `nomClient` (tenant)

Pour que ces donnees soient disponibles, `useComptabiliteQuery` passe `include: ["artisans", "costs", "payments", "owner"]` a l'API, ce qui force l'Edge Function a joindre la table `owners`.

### Style des lignes cochees

Les lignes marquees comme gerees (via "Copier + Check") s'affichent avec un fond vert defini dans `app/styles/tables.css` via la classe CSS `.compta-checked`.

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
