# Guide Developpeur - Navigation Clavier

Reference technique des hooks de navigation clavier et guide d'integration pour les nouvelles pages.

---

## Table des matieres

- [Hooks disponibles](#hooks-disponibles)
  - [useTableKeyboardNavigation](#usetablekeyboardnavigation)
  - [useSimpleTableNavigation](#usesimpletablenavigation)
  - [usePageKeyboardShortcuts](#usepagekeyboardshortcuts)
  - [usePlatformKey](#useplatformkey)
- [Styles CSS](#styles-css)
- [Integrer la navigation a une nouvelle page](#integrer-la-navigation-a-une-nouvelle-page)

---

## Hooks disponibles

### useTableKeyboardNavigation

**Fichier :** `src/hooks/useTableKeyboardNavigation.ts`

Hook avance pour les tableaux utilisant TanStack Virtual (virtualizer). Gere le scroll automatique dans un viewport virtualise.

**Interface :**

```typescript
interface UseTableKeyboardNavigationOptions {
  dataset: { id: string }[]
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
  expandedRowId: string | null
  setExpandedRowId: (id: string | null) => void
  onInterventionClick?: (id: string, options?: {
    layoutId?: string
    orderedIds?: string[]
    index?: number
  }) => void
  orderedIds: string[]
  enabled?: boolean            // default: true
  onNextPage?: () => void
  onPreviousPage?: () => void
}

function useTableKeyboardNavigation(
  options: UseTableKeyboardNavigationOptions
): {
  highlightedIndex: number   // -1 si aucune ligne selectionnee
  isKeyboardMode: boolean
}
```

**Touches gerees :**

| Touche | Action |
|--------|--------|
| `ArrowDown` | Index +1, scroll via `rowVirtualizer.scrollToIndex(i, { align: 'auto' })` |
| `ArrowUp` | Index -1, scroll auto |
| `Space` | Toggle `expandedRowId` sur la ligne active, `preventDefault()` |
| `Enter` | Appelle `onInterventionClick(id, { layoutId, orderedIds, index })` |
| `Escape` | Si expandee → `setExpandedRowId(null)` ; sinon → reset index a -1 |
| `Shift+ArrowRight` | Appelle `onNextPage()` |
| `Shift+ArrowLeft` | Appelle `onPreviousPage()` |

**Comportement special :**
- Reset automatique de `highlightedIndex` quand le dataset change (signature : `length + firstId + lastId`)
- Sort du mode clavier au premier mouvement de souris
- Quand une ligne est expandee et qu'on navigue, l'expansion suit la ligne active

**Utilise par :** `src/components/interventions/views/TableView.tsx`

---

### useSimpleTableNavigation

**Fichier :** `src/hooks/useSimpleTableNavigation.ts`

Hook leger pour les tableaux standards (sans virtualizer). Utilise `scrollIntoView` natif.

**Interface :**

```typescript
interface UseSimpleTableNavigationOptions {
  rowCount: number
  onEnter?: (index: number) => void
  enabled?: boolean                    // default: true
  tableContainerSelector?: string      // pour futur usage
}

function useSimpleTableNavigation(
  options: UseSimpleTableNavigationOptions
): {
  highlightedIndex: number   // -1 si aucune ligne selectionnee
  isKeyboardMode: boolean
}
```

**Touches gerees :**

| Touche | Action |
|--------|--------|
| `ArrowDown` | Index +1, `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` |
| `ArrowUp` | Index -1, scroll smooth |
| `Enter` | Appelle `onEnter(index)` |
| `Escape` | Reset index a -1, sort du mode clavier |

**Pre-requis :** Chaque `<tr>` du tableau doit avoir l'attribut `data-kb-row="{index}"` pour que le scroll fonctionne.

**Comportement special :**
- Reset automatique quand `rowCount` change
- Sort du mode clavier au premier mouvement de souris

**Utilise par :** `app/artisans/page.tsx`, `app/comptabilite/page.tsx`

---

### usePageKeyboardShortcuts

**Fichier :** `src/hooks/usePageKeyboardShortcuts.ts`

Hook partage pour le changement de vue (pastilles) et la pagination via les fleches horizontales.

**Interface :**

```typescript
interface UsePageKeyboardShortcutsOptions {
  viewIds?: string[]
  activeViewId?: string | null
  onViewChange?: (id: string) => void
  onNextPage?: () => void
  onPreviousPage?: () => void
  enabled?: boolean            // default: true
}

function usePageKeyboardShortcuts(
  options: UsePageKeyboardShortcutsOptions
): void
```

**Touches gerees :**

| Touche | Action |
|--------|--------|
| `ArrowRight` | Vue suivante (cycle continu) |
| `ArrowLeft` | Vue precedente (cycle continu) |
| `Shift+ArrowRight` | Appelle `onNextPage()` |
| `Shift+ArrowLeft` | Appelle `onPreviousPage()` |

**Conditions pour le changement de vue :**
- `viewIds`, `activeViewId` et `onViewChange` doivent tous etre fournis
- `activeViewId` doit etre present dans `viewIds`
- Sans ces conditions, seule la pagination fonctionne

**Utilise par :** `app/interventions/page.tsx`, `app/artisans/page.tsx`, `app/comptabilite/page.tsx`

---

### usePlatformKey

**Fichier :** `src/hooks/usePlatformKey.ts`

Detection de la plateforme (Mac vs Windows/Linux) pour adapter les touches modificatrices.

**Interface :**

```typescript
function usePlatformKey(): {
  isMac: boolean
  modifierSymbol: "⌘" | "Ctrl"
  modifierLabel: "Command" | "Ctrl"
  isModifierPressed(event: KeyboardEvent): boolean
  formatShortcut(key: string): string
  formatAriaLabel(action: string, key: string): string
}
```

**Exemples d'utilisation :**

```typescript
const { isModifierPressed, formatShortcut } = usePlatformKey()

// Verifier si Cmd (Mac) ou Ctrl (Win) est enfonce
if (isModifierPressed(event)) { ... }

// Formater pour l'affichage : "⌘K" (Mac) ou "Ctrl+K" (Win)
const label = formatShortcut("K")
```

**Detection :** Verifie `navigator.platform` et `navigator.userAgent`. SSR-safe (defaut `false` cote serveur, corrige au mount cote client).

**Utilise par :** `src/components/layout/global-shortcuts.tsx`

---

## Styles CSS

Les styles de surlignage sont dans `app/styles/tables.css`, section "Keyboard Navigation Highlight".

### Selecteur principal

```css
/* Surlignage bleu sur toutes les cellules de la ligne active */
.data-table tbody tr[data-kb-highlighted] td,
.shadcn-table tbody tr[data-kb-highlighted] td {
  --cell-base-color: hsl(var(--primary) / 0.08) !important;
  background-color: hsl(var(--primary) / 0.08) !important;
}

/* Bordure gauche */
...tbody tr[data-kb-highlighted] td:first-child {
  box-shadow: inset 3px 0 0 0 hsl(var(--primary) / 0.6);
}

/* Bordure droite */
...tbody tr[data-kb-highlighted] td:last-child {
  box-shadow: inset -3px 0 0 0 hsl(var(--primary) / 0.6);
}

/* Outline sur la ligne */
...tbody tr[data-kb-highlighted] {
  outline: 2px solid hsl(var(--primary) / 0.4);
  outline-offset: -2px;
}
```

### Override pour comptabilite (lignes vertes)

Les lignes cochees en comptabilite ont un fond vert (`#bbf7d0`) avec `!important`. Le surlignage clavier doit prevaloir :

```css
/* Le surlignage bleu ecrase le vert quand la ligne est navigee */
.data-table tbody tr.compta-checked[data-kb-highlighted] td {
  background: hsl(var(--primary) / 0.12) !important;
}
```

La colonne sticky "Action" a sa propre classe `compta-highlighted-sticky` pour refleter le surlignage.

### Pourquoi `data-kb-highlighted` au lieu de classes Tailwind ?

Les `<td>` ont leur propre `background-color` via la variable CSS `--cell-base-color` (systeme de stripes pair/impair). Un `bg-*` sur le `<tr>` est invisible car couvert par les `<td>`. L'attribut `data-kb-highlighted` permet de cibler les `<td>` directement avec `!important` pour surmonter la specificite.

---

## Integrer la navigation a une nouvelle page

### Etape 1 : Choisir le bon hook de navigation tableau

| Situation | Hook |
|-----------|------|
| Tableau avec TanStack Virtual (virtualizer) | `useTableKeyboardNavigation` |
| Tableau HTML standard (pas de virtualizer) | `useSimpleTableNavigation` |

### Etape 2 : Ajouter les attributs HTML au tableau

Sur chaque `<tr>` du body :

```tsx
<tr
  data-kb-row={rowIndex}
  data-kb-highlighted={highlightedIndex === rowIndex ? "" : undefined}
  aria-selected={highlightedIndex === rowIndex}
>
```

### Etape 3 : Integrer le hook dans la page

**Exemple avec `useSimpleTableNavigation` :**

```tsx
import { useSimpleTableNavigation } from "@/hooks/useSimpleTableNavigation"

// Dans le composant page
const handleRowEnter = useCallback(
  (index: number) => {
    const item = data[index]
    if (item) openModal(item.id)
  },
  [data, openModal],
)

const { highlightedIndex } = useSimpleTableNavigation({
  rowCount: data.length,
  onEnter: handleRowEnter,
})
```

### Etape 4 : Ajouter les raccourcis de page (optionnel)

Si la page a des pastilles de vue et/ou de la pagination :

```tsx
import { usePageKeyboardShortcuts } from "@/hooks/usePageKeyboardShortcuts"

const visibleViewIds = useMemo(
  () => views.map((v) => v.id),
  [views],
)

usePageKeyboardShortcuts({
  viewIds: visibleViewIds,
  activeViewId,
  onViewChange: setActiveView,
  onNextPage: goToNextPage,
  onPreviousPage: goToPreviousPage,
})
```

### Etape 5 : Ajouter les styles CSS (si necessaire)

Si le tableau utilise la classe `.data-table` ou `.shadcn-table`, les styles de surlignage dans `tables.css` s'appliquent automatiquement via `data-kb-highlighted`.

Si le tableau a des styles de fond specifiques (comme le vert de comptabilite) qui utilisent `!important`, ajouter une regle CSS supplementaire :

```css
.data-table tbody tr.ma-classe-custom[data-kb-highlighted] td {
  background: hsl(var(--primary) / 0.12) !important;
}
```

### Etape 6 : Navigation sidebar (automatique)

La navigation globale `Cmd/Ctrl + ArrowUp/Down` est geree par `GlobalShortcuts` dans le layout. Pour qu'une nouvelle page soit incluse dans le cycle, ajouter sa route dans le tableau `ROUTE_CYCLE` de `src/components/layout/global-shortcuts.tsx` :

```typescript
const ROUTE_CYCLE = [
  "/dashboard",
  "/interventions",
  "/artisans",
  "/comptabilite",
  "/ma-nouvelle-page",  // ← ajouter ici
  "/settings",
] as const
```

> L'ordre dans `ROUTE_CYCLE` doit correspondre a l'ordre dans la sidebar (`src/config/navigation.ts`).

### Checklist d'integration

- [ ] Hook de navigation tableau importe et configure
- [ ] `data-kb-row` sur chaque `<tr>`
- [ ] `data-kb-highlighted` conditionnel sur chaque `<tr>`
- [ ] `aria-selected` pour l'accessibilite
- [ ] `usePageKeyboardShortcuts` si pastilles de vue / pagination
- [ ] Route ajoutee a `ROUTE_CYCLE` dans `global-shortcuts.tsx`
- [ ] Route ajoutee a `ROUTE_CONFIG` dans `src/config/navigation.ts`
- [ ] Styles CSS de surlignage fonctionnels (verifier visuellement)
- [ ] Guards verifies : aucun raccourci ne se declenche en saisie ou modal ouverte
