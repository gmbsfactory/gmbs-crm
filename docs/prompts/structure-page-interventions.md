# Structure de la page Interventions - Pastilles et Filtres Table View

## Vue d'ensemble

La page interventions (`app/interventions/page.tsx`) est une interface complexe qui permet de visualiser et filtrer les interventions selon différentes vues (tableau, cartes, calendrier). Elle utilise un système de vues personnalisables avec des pastilles (badges) affichant le nombre d'interventions et des filtres intégrés dans les en-têtes de colonnes de la table.

## Architecture principale

### 1. Composant Page (`app/interventions/page.tsx`)

Le composant principal `PageContent` orchestre :

- La gestion des vues via `useInterventionViews()`
- Le chargement des données via `useInterventionsQuery()`
- Les compteurs de vues via `useInterventionViewCounts()`
- La conversion des filtres de vue en paramètres API

### 2. Système de Vues avec Pastilles

#### Composant ViewTabs (`src/components/interventions/views/ViewTabs.tsx`)

**Structure des pastilles :**

- Chaque vue peut afficher une pastille (badge) avec le nombre d'interventions
- La pastille est contrôlée par la propriété `showBadge` de chaque vue
- Le comptage provient de `interventionCounts` (calculé via `useInterventionViewCounts`)

**Styles des pastilles :**

- **Vue active avec couleur de statut** : Style pastel avec fond blanc, bordure et texte dans la couleur du statut
- **Vue inactive avec couleur de statut** : Style plein avec fond coloré, texte blanc
- **Vue active sans couleur de statut** : Style pastel avec couleur primaire (primary)
- **Vue inactive sans couleur de statut** : Style plein avec couleur primaire

**Positionnement :**

- Position absolue : `-top-2.5 -right-2.5`
- Taille minimale : `h-5 min-w-[20px]`
- Texte : `text-[10px] font-bold`
- Bordure : `border-2`

**Couleurs dynamiques :**

- Les couleurs proviennent de `viewStatusColors` qui mappe les IDs de vues vers les codes de statuts
- Pour les vues liées à un statut spécifique (ex: "mes-demandes" → "DEMANDE"), la couleur est récupérée depuis la base de données via `useInterventionStatuses()`
- Pour les vues sans statut (ex: "market"), une couleur fixe est utilisée (#EF4444 pour Market)

**Exemple de code :**

```tsx
{view.showBadge && interventionCount > 0 && (
  <span 
    className={cn(
      "absolute -top-2.5 -right-2.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-md border-2",
      isActive && !hasStatusColor && "border-primary/60 bg-background text-primary",
      !isActive && !hasStatusColor && "bg-primary text-primary-foreground border-primary"
    )}
    style={hasStatusColor && statusColor ? (
      isActive 
        ? {
            borderColor: statusColor,
            backgroundColor: "hsl(var(--background))",
            color: statusColor,
          }
        : {
            backgroundColor: statusColor,
            color: "#FFFFFF",
            borderColor: statusColor,
          }
    ) : undefined}
  >
    {interventionCount}
  </span>
)}
```

### 3. Filtres sur la Table View

#### Composant TableView (`src/components/interventions/views/TableView.tsx`)

**Structure des filtres :**

- Chaque colonne peut avoir un filtre via le composant `ColumnFilter`
- Les filtres sont conditionnels selon `schema?.filterable`
- Les filtres actifs sont stockés dans `view.filters` (propriété de chaque vue)

**Types de filtres par colonne :**

1. **Filtres texte** (`ColumnFilter` avec `schema.type === "text"`)
   - Champ de recherche avec autocomplétion
   - Utilise `loadDistinctValues` pour charger les valeurs distinctes depuis l'API

2. **Filtres date** (`DateColumnFilter`)
   - Date picker avec sélection de plage
   - Opérateurs : `between`, `gte`, `lte`

3. **Filtres select** (`SelectColumnFilter`)
   - Dropdown avec multi-sélection
   - Options chargées depuis `schema.options` ou via `loadDistinctValues`

4. **Filtres statut** (filtre spécial dans la barre de filtres)
   - Affiché conditionnellement si `showStatusFilter` est activé dans `TableLayoutOptions`
   - Multi-sélection avec chips colorés
   - Inclut un filtre spécial "CHECK" pour les interventions avec date d'échéance dépassée

**Intégration dans les en-têtes :**

```tsx
<th>
  <div className="relative flex items-center justify-center gap-2">
    {schema?.filterable && onPropertyFilterChange ? (
      <ColumnFilter
        property={property}
        schema={schema}
        activeFilter={activeFilter}
        interventions={allInterventions ?? interventions}
        loadDistinctValues={loadDistinctValues}
        onFilterChange={onPropertyFilterChange}
        baseFilters={baseFilters}
      />
    ) : (
      <span>{getPropertyLabel(property)}</span>
    )}
  </div>
</th>
```

**Gestion des filtres :**

- Les filtres sont convertis en paramètres API via `convertViewFiltersToServerFilters()`
- Les filtres serveur sont appliqués lors du chargement des données
- Les filtres client (ex: `isCheck`) sont appliqués côté client après le chargement

**Filtre de statut conditionnel :**

- Affiché uniquement si `showStatusFilter` est activé dans les options de layout de la vue table
- Positionné dans une barre séparée au-dessus de la table (lignes 1690-1774 de `page.tsx`)
- Permet la multi-sélection de statuts avec compteurs
- Inclut un bouton "CHECK" pour filtrer les interventions en retard

### 4. Flux de données

**Chargement des interventions :**

1. `useInterventionsQuery()` charge les interventions avec les filtres serveur
2. Les filtres sont convertis depuis `view.filters` via `convertViewFiltersToServerFilters()`
3. Les données sont normalisées et enrichies (statuts, couleurs, etc.)
4. Les filtres client sont appliqués si nécessaire

**Comptage des vues :**

1. `useInterventionViewCounts()` calcule le nombre d'interventions pour chaque vue
2. Utilise les mêmes filtres que la vue mais sans pagination
3. Les compteurs sont mis à jour automatiquement via TanStack Query
4. Les compteurs sont passés à `ViewTabs` via `interventionCounts`

**Synchronisation des filtres :**

- Les filtres de la vue active sont synchronisés avec l'état local (ex: `selectedStatuses`, `dateRange`)
- Les changements de filtres mettent à jour la vue via `updateFilters()`
- La page est réinitialisée à 1 lors d'un changement de filtre

### 5. Personnalisation des colonnes

**Configuration des colonnes :**

- Modal `ColumnConfigurationModal` pour choisir les colonnes visibles
- Chaque colonne peut avoir un style personnalisé (`columnStyles`)
- Options de style : taille de texte, gras, italique, couleur, alignement, apparence (none/badge/solid)

**Options de layout de la table :**

- `rowDensity` : default, dense, ultra-dense
- `showStatusBorder` : bordure colorée à gauche basée sur le statut
- `coloredShadow` : ombrage coloré basé sur le statut
- `rowDisplayMode` : stripes (alternées) ou gradient (dégradé par colonne)
- `useAccentColor` : utiliser la couleur d'accentuation pour les stripes

### 6. Points d'attention

**Performance :**

- Utilisation de virtualisation (`@tanstack/react-virtual`) pour les grandes listes
- Pagination côté serveur (100 interventions par page)
- Compteurs calculés séparément pour éviter de charger toutes les données

**État et synchronisation :**

- Les vues sont persistées (probablement dans localStorage ou une base de données)
- Les filtres sont stockés dans chaque vue
- La synchronisation entre l'état local et les vues se fait via des `useEffect` avec des garde-fous pour éviter les boucles

**Accessibilité :**

- Navigation au clavier entre les vues (Tab/Shift+Tab)
- Support des raccourcis clavier (Cmd+F pour la recherche)
- Labels ARIA appropriés

## Résumé

La page interventions combine :

- **Système de vues** avec pastilles dynamiques affichant le nombre d'interventions
- **Filtres intégrés** dans les en-têtes de colonnes de la table
- **Filtre de statut conditionnel** affiché au-dessus de la table
- **Personnalisation complète** des colonnes et du style de la table
- **Performance optimisée** avec virtualisation et pagination

Les pastilles s'adaptent automatiquement à la couleur du statut associé à la vue, et les filtres permettent une recherche granulaire directement depuis les en-têtes de colonnes.



