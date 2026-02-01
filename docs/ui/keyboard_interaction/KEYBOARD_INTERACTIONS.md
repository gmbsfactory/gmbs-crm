# Guide des Interactions Clavier - GMBS CRM

Ce document définit les standards d'accessibilité et les interactions clavier pour l'application GMBS CRM. Il est basé sur les recommandations WCAG 2.1 AA et les ARIA Design Patterns.

---

## Table des matières

1. [Principes généraux](#principes-généraux)
2. [Navigation globale](#navigation-globale)
3. [Modals et Dialogs](#modals-et-dialogs)
4. [Formulaires](#formulaires)
5. [Tableaux et listes](#tableaux-et-listes)
6. [Raccourcis clavier globaux](#raccourcis-clavier-globaux)
7. [Composants spécifiques](#composants-spécifiques)

---

## Principes généraux

### Focus Management (Gestion du focus)

1. **Visible Focus Indicator**
   - Tous les éléments interactifs doivent avoir un indicateur visuel de focus clair
   - Utiliser `focus-visible:ring-2` pour les indicateurs de focus
   - Ne jamais utiliser `outline: none` sans alternative visible

2. **Ordre de tabulation logique**
   - L'ordre de tabulation (`Tab`/`Shift+Tab`) doit suivre l'ordre visuel de lecture (gauche à droite, haut en bas)
   - Éviter les `tabIndex` positifs (>0) qui perturbent l'ordre naturel
   - Utiliser `tabIndex={-1}` uniquement pour les éléments qui doivent être focusables programmatiquement mais pas via Tab

3. **Focus piégé (Focus Trap)**
   - Les modals, dialogs et overlays doivent piéger le focus à l'intérieur
   - Le focus ne doit jamais "s'échapper" vers les éléments en arrière-plan

---

## Navigation globale

### Sidebar Navigation

**Touches supportées:**

| Touche | Action |
|--------|--------|
| `Tab` | Naviguer vers le lien suivant dans la sidebar |
| `Shift+Tab` | Naviguer vers le lien précédent |
| `Enter` ou `Space` | Activer le lien sélectionné |
| `Escape` | Fermer la sidebar (mode mobile) |

**Comportement:**
- Lorsqu'un lien est actif, il est indiqué visuellement (`bg-secondary`)
- Le focus doit être visible avec un anneau de focus (`focus-visible:ring-2`)
- En mode hybride/collapsed, le hover révèle les labels mais ne doit pas bloquer le focus après un clic

**Implémentation actuelle:**
- Fichier: [app-sidebar.tsx](../src/components/layout/app-sidebar.tsx)
- Les liens utilisent des composants `Link` de Next.js enveloppés dans des `Button`
- Focus trap: ✅ Non nécessaire (navigation permanente)

---

## Modals et Dialogs

### Standards ARIA pour les Modals

Tous les modals doivent respecter le [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

**Touches supportées:**

| Touche | Action |
|--------|--------|
| `Escape` | Fermer le modal |
| `Tab` | Naviguer vers l'élément focusable suivant **dans le modal** |
| `Shift+Tab` | Naviguer vers l'élément focusable précédent **dans le modal** |
| `Enter` | Soumettre le formulaire (si applicable) ou activer le bouton primaire |

**Comportement requis:**

1. **Ouverture du modal**
   - Le focus doit automatiquement aller sur le premier élément focusable du modal
   - Alternative: Focus sur le bouton de fermeture ou le titre si le modal n'a pas d'action claire
   - Les éléments en arrière-plan doivent être marqués comme `inert` (ou `aria-hidden="true"`)

2. **Navigation dans le modal**
   - `Tab` et `Shift+Tab` doivent cycler **uniquement** entre les éléments du modal
   - Le focus ne doit **jamais** s'échapper vers la sidebar ou d'autres éléments de la page
   - Implémentation: Utiliser `focus-trap-react` ou Radix UI (qui l'intègre nativement)

3. **Fermeture du modal**
   - `Escape` doit toujours fermer le modal
   - Click sur le backdrop (overlay) peut fermer le modal (selon le contexte)
   - Le focus doit retourner à l'élément qui a déclenché le modal

4. **Attributs ARIA requis**
   ```jsx
   <div
     role="dialog"
     aria-modal="true"
     aria-labelledby="modal-title"
     aria-describedby="modal-description"
   >
   ```

### Implémentation actuelle

#### GenericModal (Modals personnalisés)
- **Fichier**: [GenericModal.tsx](../src/components/ui/modal/GenericModal.tsx)
- **Focus trap**: ✅ Implémenté avec `focus-trap-react`
- **Escape pour fermer**: ✅ Configuré dans `focusTrapOptions.escapeDeactivates`
- **Return focus**: ✅ Configuré dans `focusTrapOptions.returnFocusOnDeactivate`

**Configuration du focus trap:**
```tsx
// Le focus trap est désactivé dynamiquement quand un portal Radix UI est ouvert
// (Select, Popover, AlertDialog, etc.) pour permettre la navigation correcte
const isPortalOpen = /* détection des portals Radix UI */

{isPortalOpen ? (
  <div>{modalContent}</div>
) : (
  <FocusTrap
    focusTrapOptions={{
      initialFocus: false,               // Permet au contenu de définir le focus initial
      escapeDeactivates: true,           // Escape ferme le modal
      clickOutsideDeactivates: false,    // Click outside ne désactive pas (géré par onClick)
      returnFocusOnDeactivate: true,     // Retour du focus à l'élément déclencheur
      allowOutsideClick: (e) => { /* Permet les clicks dans les portals */ },
    }}
  >
    <div>{modalContent}</div>
  </FocusTrap>
)}
```

**Gestion des portals imbriqués:**

Le GenericModal détecte automatiquement quand un composant Radix UI utilisant un portal est ouvert (comme un Select, Popover ou AlertDialog). Dans ce cas, le focus trap principal est temporairement désactivé pour permettre au focus trap natif de Radix UI de prendre le contrôle. Cela résout le problème où Tab depuis un Select ou Popover pouvait "s'échapper" vers la sidebar.

Composants détectés:
- `[data-radix-popper-content-wrapper]` - Popovers et Tooltips
- `[data-radix-select-content]` - Selects
- `[data-radix-popover-content]` - Popovers explicites
- `[role="alertdialog"]` - AlertDialogs imbriqués

#### Dialog (Radix UI)
- **Fichier**: [dialog.tsx](../src/components/ui/dialog.tsx)
- **Focus trap**: ✅ Intégré nativement par Radix UI
- **Escape pour fermer**: ✅ Natif
- **Return focus**: ✅ Natif

#### AlertDialog (Radix UI)
- **Fichier**: [alert-dialog.tsx](../src/components/ui/alert-dialog.tsx)
- **Focus trap**: ✅ Intégré nativement par Radix UI
- **Escape pour fermer**: ✅ Natif (peut être désactivé si nécessaire)
- **Return focus**: ✅ Natif

#### Sheet (Radix UI)
- **Fichier**: [sheet.tsx](../src/components/ui/sheet.tsx)
- **Focus trap**: ✅ Intégré nativement (basé sur Dialog)
- **Escape pour fermer**: ✅ Natif
- **Return focus**: ✅ Natif

### Exemple: Intervention Modal

Le modal d'intervention utilise `GenericModal` et doit respecter ces interactions:

```
Scénario: Ouvrir un modal d'intervention depuis le tableau
1. User clique sur une ligne → Modal s'ouvre
2. Focus va automatiquement sur le premier champ éditable
3. User appuie sur Tab → Focus va au champ suivant (RESTE dans le modal)
4. User appuie sur Escape → Modal se ferme, focus retourne à la ligne du tableau
```

**Problèmes résolus**:
1. Avant l'implémentation du focus trap, Tab depuis le modal pouvait naviguer vers la sidebar (page /artisans), ce qui est incorrect.
2. Le focus trap empêchait initialement la navigation dans les portals Radix UI (Select, Popover). Résolu en désactivant temporairement le focus trap quand un portal est détecté.

---

## Formulaires

### Standards d'interaction

**Touches supportées:**

| Touche | Action |
|--------|--------|
| `Tab` | Naviguer vers le champ suivant |
| `Shift+Tab` | Naviguer vers le champ précédent |
| `Enter` | Soumettre le formulaire (si focus sur submit button ou input text) |
| `Space` | Toggle checkbox/radio/switch |
| `Arrow Up/Down` | Naviguer dans les select, radio groups |
| `Escape` | Fermer les dropdowns/popovers ouverts |

### Focus Management dans les formulaires

1. **Premier champ invalide**
   - En cas d'erreur de validation, le focus doit aller sur le premier champ en erreur

2. **Labels et erreurs**
   - Tous les champs doivent avoir un `<label>` associé (via `htmlFor` ou wrapping)
   - Les erreurs doivent être annoncées via `aria-describedby` ou `aria-invalid`

3. **Champs requis**
   - Indiquer visuellement (`*`) ET avec `aria-required="true"`

**Exemple:**
```jsx
<div>
  <label htmlFor="intervention-title">
    Titre <span className="text-destructive">*</span>
  </label>
  <input
    id="intervention-title"
    name="title"
    aria-required="true"
    aria-invalid={errors.title ? "true" : "false"}
    aria-describedby={errors.title ? "title-error" : undefined}
  />
  {errors.title && (
    <span id="title-error" className="text-destructive text-sm">
      {errors.title.message}
    </span>
  )}
</div>
```

---

## Tableaux et listes

### Tableau d'interventions

**Touches supportées:**

| Touche | Action |
|--------|--------|
| `Tab` | Naviguer vers la ligne/cellule suivante |
| `Shift+Tab` | Naviguer vers la ligne/cellule précédente |
| `Enter` ou `Space` | Ouvrir le modal de détail de l'intervention |
| `Arrow Up/Down` | Naviguer entre les lignes (si implémenté) |
| `Escape` | Désélectionner / Annuler l'action |

**Recommandations:**
- Les lignes cliquables doivent être focusables (ajouter `tabIndex={0}`)
- Les lignes actives/sélectionnées doivent avoir un indicateur visuel clair
- Utiliser `role="row"` et `role="cell"` pour l'accessibilité

**Navigation optimale avec clavier:**
```jsx
// Exemple de ligne de tableau cliquable et accessible
<tr
  tabIndex={0}
  onClick={() => openModal(intervention.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openModal(intervention.id)
    }
  }}
  className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
>
  <td>{intervention.title}</td>
  <td>{intervention.status}</td>
</tr>
```

---

## Raccourcis clavier globaux

Les raccourcis clavier globaux améliorent la productivité. Voici les standards recommandés:

### Raccourcis recommandés

| Raccourci | Action |
|-----------|--------|
| `Ctrl/Cmd + K` | Ouvrir la recherche globale / Command palette |
| `Ctrl/Cmd + N` | Créer une nouvelle intervention |
| `Ctrl/Cmd + S` | Sauvegarder (dans un formulaire) |
| `Ctrl/Cmd + /` | Afficher les raccourcis clavier disponibles |
| `Escape` | Fermer modal/drawer/popover |
| `?` | Afficher l'aide contextuelle |

### Implémentation

Utiliser un hook global pour les raccourcis:

```tsx
// hooks/useGlobalShortcuts.ts
import { useEffect } from 'react'

export function useGlobalShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K ou Ctrl+K pour search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Ouvrir search modal
      }

      // Cmd+N pour nouvelle intervention
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        // Ouvrir modal de création
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

**Note**: Vérifier que vous êtes dans `GlobalShortcuts` ([global-shortcuts.tsx](../src/components/layout/global-shortcuts.tsx))

---

## Composants spécifiques

### Combobox / Select

**Touches supportées:**

| Touche | Action |
|--------|--------|
| `Enter` ou `Space` | Ouvrir/fermer le dropdown |
| `Arrow Up/Down` | Naviguer entre les options |
| `Home` | Aller à la première option |
| `End` | Aller à la dernière option |
| `Type to search` | Filtrer les options en tapant |
| `Escape` | Fermer le dropdown |

### Date Picker

| Touche | Action |
|--------|--------|
| `Enter` ou `Space` | Ouvrir le calendrier |
| `Arrow Up/Down/Left/Right` | Naviguer dans le calendrier |
| `Page Up/Down` | Mois précédent/suivant |
| `Home` | Aller au début du mois |
| `End` | Aller à la fin du mois |
| `Escape` | Fermer le calendrier |

### Dropdown Menu

| Touche | Action |
|--------|--------|
| `Enter` ou `Space` | Ouvrir le menu |
| `Arrow Up/Down` | Naviguer entre les items |
| `Escape` | Fermer le menu |
| `Enter` | Activer l'item sélectionné |

---

## Checklist d'implémentation

Utilisez cette checklist pour vérifier l'accessibilité clavier de vos composants:

### Pour chaque modal/dialog:
- [ ] Focus trap implémenté (pas d'échappement vers la page)
- [ ] Escape ferme le modal
- [ ] Focus retourne à l'élément déclencheur à la fermeture
- [ ] Backdrop click ferme le modal (si approprié)
- [ ] `role="dialog"` et `aria-modal="true"` présents
- [ ] `aria-labelledby` et `aria-describedby` définis

### Pour chaque formulaire:
- [ ] Tous les champs ont un label visible et associé
- [ ] Ordre de tabulation logique
- [ ] Erreurs visibles et annoncées (aria-invalid, aria-describedby)
- [ ] Champs requis indiqués visuellement et via aria-required
- [ ] Enter soumet le formulaire (ou action primaire)

### Pour chaque élément interactif:
- [ ] Focus visible (ring ou outline)
- [ ] Accessible au clavier (Tab, Enter, Space)
- [ ] Actions keyboard équivalentes aux actions mouse
- [ ] Pas de `tabIndex` > 0

### Pour la navigation globale:
- [ ] Skip link présent ("Aller au contenu")
- [ ] Ordre de focus logique dans toute l'application
- [ ] Pas de pièges à clavier (sauf modals)

---

## Ressources et références

- [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.1 - Keyboard Accessible](https://www.w3.org/WAI/WCAG21/quickref/?showtechniques=211#keyboard-accessible)
- [Radix UI - Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [focus-trap-react Documentation](https://github.com/focus-trap/focus-trap-react)

---

## Support et maintenance

Ce document doit être mis à jour lorsque:
- De nouveaux patterns d'interaction sont ajoutés
- Des composants modaux personnalisés sont créés
- Des raccourcis clavier globaux sont modifiés
- Des problèmes d'accessibilité sont découverts et résolus

**Dernière mise à jour**: 2025-12-20
**Version**: 1.0
**Auteur**: Claude (Assistant IA)
