# Navigation Clavier - GMBS CRM

Le CRM dispose d'un systeme complet de raccourcis clavier permettant une navigation rapide sans souris. Ce systeme couvre trois niveaux : la navigation globale entre pages, la navigation au sein d'une page (pastilles de vues, pagination), et la navigation dans les tableaux (ligne par ligne).

---

## Table des matieres

- [Raccourcis globaux](#raccourcis-globaux)
- [Navigation dans les pages](#navigation-dans-les-pages)
- [Navigation dans les tableaux](#navigation-dans-les-tableaux)
- [Resume par page](#resume-par-page)
- [Regles de priorite](#regles-de-priorite)
- [Architecture technique](#architecture-technique)

---

## Raccourcis globaux

Ces raccourcis fonctionnent sur **toutes les pages** du CRM.

| Raccourci | Action |
|-----------|--------|
| `Cmd + ArrowDown` (Mac) / `Ctrl + ArrowDown` (Win) | Page suivante dans la sidebar |
| `Cmd + ArrowUp` (Mac) / `Ctrl + ArrowUp` (Win) | Page precedente dans la sidebar |

**Ordre de navigation :**

```
Dashboard → Interventions → Artisans → Comptabilite → Parametres
    ↑                                                      ↓
    └──────────────────────────────────────────────────────┘
                        (cycle continu)
```

**Fichier source :** `src/components/layout/global-shortcuts.tsx`

---

## Navigation dans les pages

### Changement de vue (pastilles)

Sur les pages disposant de plusieurs vues (pastilles/onglets), les fleches gauche/droite permettent de passer d'une vue a l'autre.

| Raccourci | Action |
|-----------|--------|
| `ArrowRight` | Vue suivante (cycle : derniere → premiere) |
| `ArrowLeft` | Vue precedente (cycle : premiere → derniere) |

**Pages concernees :**
- `/interventions` : Liste generale, Market, Devis envoye, etc.
- `/artisans` : Toutes les vues definies par l'utilisateur

> La page `/comptabilite` n'a pas de pastilles de vue, donc ces raccourcis ne s'appliquent pas.

### Pagination

| Raccourci | Action |
|-----------|--------|
| `Shift + ArrowRight` | Page suivante de la pagination |
| `Shift + ArrowLeft` | Page precedente de la pagination |

**Pages concernees :** Interventions, Artisans, Comptabilite

**Fichier source :** `src/hooks/usePageKeyboardShortcuts.ts`

---

## Navigation dans les tableaux

### Interventions (`/interventions`)

La TableView des interventions utilise un virtualizer (TanStack Virtual) pour gerer un grand volume de lignes. Le hook dedie gere le scroll automatique dans le viewport virtualise.

| Raccourci | Action |
|-----------|--------|
| `ArrowDown` | Surligner la ligne suivante (1er appui = 1ere ligne) |
| `ArrowUp` | Surligner la ligne precedente |
| `Space` | Deplier / replier la vue etendue de la ligne surlignee |
| `Enter` | Ouvrir le modal de detail de l'intervention |
| `Escape` | Si expandee → replier ; sinon → deselectionner |

**Fichier source :** `src/hooks/useTableKeyboardNavigation.ts`

### Artisans (`/artisans`)

| Raccourci | Action |
|-----------|--------|
| `ArrowDown` | Surligner la ligne suivante |
| `ArrowUp` | Surligner la ligne precedente |
| `Enter` | Ouvrir le detail de l'artisan |
| `Escape` | Deselectionner la ligne |

**Fichier source :** `src/hooks/useSimpleTableNavigation.ts`

### Comptabilite (`/comptabilite`)

| Raccourci | Action |
|-----------|--------|
| `ArrowDown` | Surligner la ligne suivante |
| `ArrowUp` | Surligner la ligne precedente |
| `Enter` | Ouvrir le modal de detail |
| `Escape` | Deselectionner la ligne |

**Fichier source :** `src/hooks/useSimpleTableNavigation.ts`

### Style de surlignage

La ligne active est mise en evidence par :
- Un fond bleu semi-transparent (`hsl(var(--primary) / 0.08)`)
- Un outline bleu (`2px solid hsl(var(--primary) / 0.4)`)
- Des bords lateraux colores (box-shadow inset gauche et droite)

Ces styles sont definis dans `app/styles/tables.css` via l'attribut `data-kb-highlighted` et prennent le dessus sur tous les autres styles de ligne, y compris le fond vert des lignes cochees en comptabilite.

---

## Resume par page

| Page | ArrowUp/Down | Space | Enter | Escape | ArrowLeft/Right | Shift+Arrow | Cmd/Ctrl+Arrow |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | — | — | — | — | — | — | Navigation sidebar |
| Interventions | Naviguer lignes | Expand/Collapse | Ouvrir modal | Replier/Deselectionner | Changer vue | Pagination | Navigation sidebar |
| Artisans | Naviguer lignes | — | Ouvrir detail | Deselectionner | Changer vue | Pagination | Navigation sidebar |
| Comptabilite | Naviguer lignes | — | Ouvrir modal | Deselectionner | — | Pagination | Navigation sidebar |
| Parametres | — | — | — | — | — | — | Navigation sidebar |

---

## Regles de priorite

Tous les raccourcis sont **desactives** dans les situations suivantes :

1. **Focus sur un champ de saisie** : `<input>`, `<textarea>`, `<select>`, ou element `contentEditable`
2. **Modal ouverte** : Detection via `[role="dialog"]` ou `[role="alertdialog"]`
3. **Menu contextuel ouvert** : Detection via `[data-radix-menu-content]`

**Priorite des touches modificatrices :**
- `Cmd/Ctrl` + fleche → navigation globale sidebar (priorite la plus haute)
- `Shift` + fleche gauche/droite → pagination
- Fleche seule → navigation tableau (haut/bas) ou changement de vue (gauche/droite)

**Sortie du mode clavier :**
Tout mouvement de souris desactive le mode clavier et restaure le curseur standard. Le surlignage de la ligne disparait.

---

## Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│  GlobalShortcuts (layout)                                   │
│  Cmd/Ctrl + ArrowUp/Down = Navigation entre pages           │
│  Utilise : usePlatformKey, useRouter, usePathname           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
  useTableKeyboardNavigation     useSimpleTableNavigation
  (Interventions - virtualise)   (Artisans, Comptabilite)
              │                               │
  - ArrowUp/Down (lignes)       - ArrowUp/Down (lignes)
  - Space (expand/collapse)     - Enter (callback)
  - Enter (modal + contexte)    - Escape (deselection)
  - Escape (replier/deselect)   - scrollIntoView smooth
  - Shift+Arrow (pagination)
  - scrollToIndex virtualizer
              │                               │
              └───────────┬───────────────────┘
                          │
              usePageKeyboardShortcuts
              (Partage entre les 3 pages)
                          │
              - ArrowLeft/Right (pastilles)
              - Shift+ArrowLeft/Right (pagination)
```

### Fichiers cles

| Fichier | Role |
|---------|------|
| `src/components/layout/global-shortcuts.tsx` | Raccourcis globaux Cmd/Ctrl+Arrow |
| `src/hooks/useTableKeyboardNavigation.ts` | Navigation tableau virtualise (interventions) |
| `src/hooks/useSimpleTableNavigation.ts` | Navigation tableau simple (artisans, comptabilite) |
| `src/hooks/usePageKeyboardShortcuts.ts` | Pastilles de vue + pagination |
| `src/hooks/usePlatformKey.ts` | Detection Mac vs Windows |
| `app/styles/tables.css` | Styles CSS du surlignage clavier |

### Attributs HTML

Les tableaux utilisent des attributs `data-*` pour la navigation et le style :

| Attribut | Porte par | Usage |
|----------|-----------|-------|
| `data-kb-row="{index}"` | `<tr>` | Identifie chaque ligne pour le scroll (`scrollIntoView`) |
| `data-kb-highlighted` | `<tr>` | Presente quand la ligne est surlignee — declenche les styles CSS |
| `aria-selected` | `<tr>` | Accessibilite — indique la ligne active |

Pour plus de details techniques sur les hooks et comment ajouter la navigation clavier a une nouvelle page, voir le [Guide developpeur](developer-guide.md).
