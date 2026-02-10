# AUDIT UX/UI COMPLET - GMBS CRM

**Date :** 2026-02-10
**Branche :** design_ux_ui
**Auditeur :** Chef UX/UI Agent

---

## 1. Résumé Exécutif

Le CRM GMBS utilise un "Liquid Glass Design System" défini dans `app/globals.css` (4887 lignes) et `src/styles/tokens.css` (56 lignes). L'analyse exhaustive révèle des **problèmes structurels majeurs** :

| Métrique | Valeur | Sévérité |
|----------|--------|----------|
| `!important` dans globals.css | **117 occurrences** | CRITIQUE |
| `backdrop-filter` declarations | **88 occurrences** | HAUTE (perf) |
| `@keyframes` dupliqués | **5 animations x2** | HAUTE |
| Classes CSS redéfinies | **3 classes majeures** | HAUTE |
| Valeurs `border-radius` incohérentes | **15+ formats** | HAUTE |
| Valeurs `blur()` hardcodées (hors variables) | **10 valeurs** | MOYENNE |
| Systèmes de thème conflictuels | **5 méthodes** | CRITIQUE |
| Taille du fichier CSS | **~55K tokens** | HAUTE (maintenabilité) |

**Verdict :** Le CSS actuel souffre d'une accumulation organique de styles avec des couches de spécificité qui se superposent. La section "Liquid Glass" finale (L4645-4888) utilise massivement `!important` pour écraser les styles définis dans `@layer components`, créant une guerre de spécificité impossible à maintenir.

---

## 2. Incohérences Identifiées

### 2.1 Border-Radius — 15+ formats différents

| Valeur | Fichier | Lignes | Catégorie |
|--------|---------|--------|-----------|
| `var(--radius-sm)` (6px) | globals.css | 3038, 4126, 4266, 4282 | Variable ✅ |
| `var(--radius-md)` (10px) | globals.css | 381, 995, 1031, 3027, 3087, 3125, 3324 | Variable ✅ |
| `var(--radius-lg)` (14px) | globals.css | 206, 414, 482, 968, 1069, 3115, 3760, 3984 | Variable ✅ |
| `var(--radius-xl)` (20px) | globals.css | 280, 298, 1578, 1813, 2579, 4027 | Variable ✅ |
| `0.75rem` (12px) | globals.css | 1730, 2514 | Hardcodé ❌ |
| `0.7rem` | globals.css | 1915, 1958 | Hardcodé ❌ |
| `0.6rem` | globals.css | 1752 | Hardcodé ❌ |
| `0.5rem` | globals.css | 1975 | Hardcodé ❌ |
| `12px !important` | globals.css | 4835 | Hardcodé + !important ❌❌ |
| `3px` | globals.css | 640 | Hardcodé (scrollbar) |
| `1.5px` | globals.css | 664 | Hardcodé (scrollbar) |
| `5px` | globals.css | 1519 | Hardcodé (scrollbar) |
| `999px` | globals.css | 1861, 1867 | Pill shape |
| `50%` | globals.css | 3312, 3996, 4460 | Cercle |
| `calc(var(--radius-xl) - 6px)` | globals.css | 1872, 2030, 2775, 2791 | Computed ⚠️ |
| `calc(var(--radius-xl) - 7px)` | globals.css | 2048 | Computed ⚠️ |
| `calc(var(--radius-md) - 4px)` | globals.css | 1934, 2630, 2656, 2683, 2700 | Computed ⚠️ |
| `calc(var(--radius-md) - 5px)` | globals.css | 2013 | Computed ⚠️ |
| `calc(var(--radius-md) - 2px)` | globals.css | 2103, 3940, 4379 | Computed ⚠️ |
| `calc(var(--radius-lg) + 2px)` | globals.css | 1056 | Computed ⚠️ |

**Composants TSX :** Les composants utilisent les classes Tailwind `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` de manière relativement cohérente, mais certains (UserPermissionsDialog) mélangent au moins 6 tailles différentes dans un seul composant.

### 2.2 Backdrop-Filter / Blur — Valeurs hardcodées vs variables

Le design system définit 4 niveaux de blur via variables CSS :
- `--glass-blur-sm: 8px` (10px dark)
- `--glass-blur-md: 12px` (16px dark)
- `--glass-blur-lg: 20px` (24px dark)
- `--glass-blur-xl: 32px` (40px dark)

**Mais** de nombreuses déclarations utilisent des valeurs hardcodées :

| Valeur hardcodée | Fichier | Lignes | Contexte |
|------------------|---------|--------|----------|
| `blur(6px)` | globals.css | 1589 | `.modal-surface` dans @layer components |
| `blur(8px)` | globals.css | 1637 | `.shadcn-sheet-content` dans @layer components |
| `blur(12px)` | globals.css | 306, 345, 4686, 4720 | modal-header, modal-footer, topbar, sidebar |
| `blur(16px) saturate(1.4)` | globals.css | 4793, 4806, 4819, 4874 | Section "Liquid Glass" prioritaire (avec !important) |
| `blur(20px) saturate(1.5)` | globals.css | 295 | `.glass-modal-premium` (avec !important) |
| `blur(32px) saturate(1.4)` | globals.css | 1387 | `thead::before` (gloss effect) |
| `blur(40px) saturate(1.6)` | globals.css | 1403 | `thead::before` dark mode |
| `blur(16px) saturate(1.4)` | InterventionModalContent.tsx | inline | Style inline dans composant |
| `blur(16px) saturate(1.4)` | UserPermissionsDialog.tsx | inline | Style inline dans composant |

### 2.3 @keyframes Dupliqués

| Animation | Première définition | Seconde définition | Issue |
|-----------|--------------------|--------------------|-------|
| `gradient` | L690 (hors layer) | L3396 (hors layer) | Exactement identique |
| `expand-contract` | L3402 (hors layer) | L3570 (dans @layer utilities) | Identique |
| `shimmer` | L3407 (hors layer) | L3580 (dans @layer utilities) | Identique |
| `breathing` | L3418 (hors layer) | L3592 (dans @layer utilities) | Identique |
| `glass-float` | L3423 (hors layer) | L3604 (dans @layer utilities) | Identique |

### 2.4 Classes CSS Redéfinies (conflits)

| Classe | Définition 1 | Définition 2 | Définition 3 | Issue |
|--------|-------------|-------------|-------------|-------|
| `.glass-card` | L199 (hors layer) | L961 (@layer components) | L3556 (@layer utilities) | 3 définitions conflictuelles ! La version utilities utilise `@apply bg-white/5 backdrop-blur-md` qui est complètement différente |
| `.glass-sidebar` | L468 (hors layer) | L3565 (@layer utilities) | — | 2 définitions : la seconde utilise `@apply bg-black/20 backdrop-blur-xl` |
| `.animate-glass-float` | L3242 (@layer utilities) | L3613 (@layer utilities) | — | Défini 2x dans la même layer |
| `.card` | L961 (@layer components) | L4745 (hors layer, !important) | — | Le style hors layer écrase tout avec !important |
| `.modal-surface` | L1567 (@layer components) | L4789 (hors layer, !important) | — | Écrasé par la section "Liquid Glass" |
| `.shadcn-sheet-content` | L1633 (@layer components) | L4802 (hors layer, !important) | — | Idem |

### 2.5 Systèmes de Thème Conflictuels

Le fichier utilise **5 méthodes différentes** pour cibler les modes clair/sombre :

1. `:root[data-theme="dark"]` — Méthode principale (L112, L835, etc.)
2. `.dark` — Classe CSS alternative (L3500, L3530)
3. `html:not([data-theme="dark"])` — Hack de spécificité pour mode clair (L4745, L4789, etc.)
4. `:root:not([data-theme="dark"])` — Doublon du hack (L4746, L4790, etc.)
5. `.theme-color`, `.theme-glass`, `.theme-formal` — Variantes de thème (L3473, L3514, L3549)

**Problème :** Les sélecteurs `html:not([data-theme="dark"])` et `:root:not([data-theme="dark"])` à la fin du fichier ont une spécificité plus élevée que les styles dans `@layer`, ce qui nécessite `!important` partout.

### 2.6 !important Abusifs

**117 occurrences** de `!important` dans globals.css, concentrées dans :

| Section | Lignes | Nombre | Justification |
|---------|--------|--------|---------------|
| `.glass-modal-premium` et enfants | 292-456 | ~25 | Écraser les styles shadcn |
| Disabled/is-disabled | 3232-3240 | 4 | Reset forcé |
| Date range picker (rdp) | 3260-3313 | ~16 | Écraser react-day-picker |
| reduced-motion | 3429-3449 | ~6 | Accessibilité |
| performance-mode | 3452-3470 | ~5 | Optimisation |
| Section "Liquid Glass" finale | 4645-4888 | ~50 | Écraser tout le @layer components |

La section finale (L4645-4888) est le plus gros problème : elle **ré-écrit entièrement** les styles de modals, cards et sections avec `!important`, rendant les styles du `@layer components` inutiles.

### 2.7 Bloat CSS — Sections surdimensionnées

| Section | Lignes | Taille | Problème |
|---------|--------|--------|----------|
| modal-config-columns-* | 1682-2337 | ~655 lignes | Composant unique, devrait être CSS Module |
| intervention-form-* | 2462-3015 | ~553 lignes | Composant unique, devrait être CSS Module |
| history-panel-* | 3696-4531 | ~835 lignes | Composant unique, devrait être CSS Module |
| Table (data-table + shadcn-table) | 1054-1498 | ~444 lignes | Très spécifique, devrait être co-localisé |
| Section "Liquid Glass" prioritaire | 4645-4888 | ~243 lignes | Duplique/écrase les styles existants |

### 2.8 Couleurs Hardcodées dans les Composants TSX

| Composant | Couleur | Contexte |
|-----------|---------|----------|
| InterventionCard.tsx | `#EF4444` | Status CHECK color (hardcodé en inline style) |
| InterventionModalContent.tsx | `#25D366` | WhatsApp green (bg-[#25D366]) |
| InterventionModalContent.tsx | `rgba(255, 255, 255, 0.25)` | Glass background (inline style) |
| UserPermissionsDialog.tsx | `#6366f1` | Indigo default (inline backgroundColor) |
| artisans/page.tsx | `#f1f5f9`, `#0f172a`, `#e2e8f0` | Slate colors (inline style) |
| dashboard/page.tsx | `rgb(34, 197, 94)`, `rgb(239, 68, 68)` | Green/Red indicators |
| comptabilite/page.tsx | `compta-checked` + `#bbf7d0`, `#166534` | Green checked rows (globals.css L1542-1550) |

### 2.9 Format de Couleurs Incohérent

Le projet utilise **6 formats de couleurs différents** :

1. **oklch** : `oklch(0.55 0.21 300)` — Variables de base (--accent-color, --bg, etc.)
2. **HSL sans fonction** : `270 75% 36%` — Tokens shadcn (--primary, --accent, etc.)
3. **Hex** : `#3371B2` — GMBS blue, quelques composants
4. **rgba** : `rgba(87, 100, 151, 0.25)` — Glass backgrounds
5. **color-mix(in oklab)** : Couleurs computées dans le CSS
6. **Tailwind opacity** : `bg-primary/10` — Classes utilitaires

---

## 3. Template de Style de Base Uniforme

### 3.1 Variables CSS de Référence (à utiliser PARTOUT)

```css
/* ============================================================
   DESIGN TOKENS UNIFIÉS
   ============================================================ */

:root {
  /* Radius Scale - 4 niveaux uniquement */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Blur Scale - 4 niveaux */
  --blur-sm: 8px;
  --blur-md: 12px;
  --blur-lg: 20px;
  --blur-xl: 32px;

  /* Saturate */
  --saturate-normal: 1.15;
  --saturate-strong: 1.25;

  /* Shadow Scale */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.10), 0 8px 16px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.12), 0 16px 32px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.14), 0 24px 48px rgba(0, 0, 0, 0.10);

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Transitions */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-base: 250ms;
}
```

### 3.2 Cards / Panels

```css
/* Card standard - PAS de glass effect */
.card-standard {
  background: var(--bg-light);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}

/* Card avec glass subtil (MODÉRÉ - utiliser avec parcimonie) */
.card-glass {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-md)) saturate(var(--saturate-normal));
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(var(--saturate-normal));
  box-shadow: var(--shadow-sm);
}
```

### 3.3 Modals / Dialogs / Sheets

```css
/* Style de référence pour TOUS les modals */
/* GLASS MODÉRÉ : background: rgba(75, 92, 181, 0.14); backdrop-filter: blur(50px) saturate(3); */
/* Version recommandée plus subtile : */

.modal-base {
  background: rgba(87, 100, 151, 0.20);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--saturate-strong));
  -webkit-backdrop-filter: blur(var(--blur-lg)) saturate(var(--saturate-strong));
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

/* Éléments qui ressortent du modal */
.modal-section {
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* Header/Footer du modal */
.modal-header-base {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.modal-footer-base {
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
```

### 3.4 Tables

```css
/* Table wrapper */
.table-base {
  background: var(--bg-light);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* Table header */
.table-header-base {
  background: hsl(var(--muted));
  border-bottom: 1px solid hsl(var(--border));
  font-weight: 600;
  font-size: 0.875rem;
  padding: var(--space-3) var(--space-4);
}

/* Table row */
.table-row-base {
  border-bottom: 1px solid hsl(var(--border));
  padding: var(--space-3) var(--space-4);
  transition: background-color var(--duration-fast) var(--ease);
}

.table-row-base:hover {
  background-color: hsl(var(--muted) / 0.3);
}
```

### 3.5 Forms / Inputs

```css
.input-base {
  background: var(--bg-light);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: 0.875rem;
  transition: border-color var(--duration-fast) var(--ease),
              box-shadow var(--duration-fast) var(--ease);
}

.input-base:focus {
  outline: none;
  border-color: hsl(var(--accent));
  box-shadow: 0 0 0 2px hsl(var(--accent) / 0.2);
}

/* Input dans un modal glass */
.input-modal {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(51, 113, 178, 0.12);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
```

### 3.6 Typography Scale

```
- Titre page : 1.5rem / 700 / var(--text)
- Titre section : 1.125rem / 600 / var(--text)
- Titre card : 0.95rem / 600 / var(--text)
- Body : 0.875rem / 400 / var(--text)
- Caption/Label : 0.8rem / 500 / var(--text-muted)
- Small/Meta : 0.75rem / 400 / var(--text-muted)
- Tiny : 0.6875rem / 500 / var(--text-muted)
```

### 3.7 Style Glass de Référence

```css
/* LE style glass de référence — à utiliser AVEC MODÉRATION */
/* Uniquement pour : modals, overlays, sidebars, topbar */
/* PAS pour : cards normales, tables, forms, badges */

.glass-reference {
  background: rgba(75, 92, 181, 0.14);
  backdrop-filter: blur(50px) saturate(3);
  -webkit-backdrop-filter: blur(50px) saturate(3);
}

/* Version MODÉRÉE (recommandée pour la plupart des cas) */
.glass-moderate {
  background: rgba(87, 100, 151, 0.20);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--saturate-strong));
  -webkit-backdrop-filter: blur(var(--blur-lg)) saturate(var(--saturate-strong));
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

---

## 4. Plan de Missions

### Mission 1 : globals.css Cleanup et Standardisation Variables
**Priorité : CRITIQUE**

**Fichiers concernés :**
- `app/globals.css` (4887 lignes → objectif ~2000 lignes)
- `src/styles/tokens.css`

**Problèmes à corriger :**
1. Supprimer les 5 @keyframes dupliqués (L3570-3611 dans @layer utilities)
2. Supprimer les classes dupliquées `.glass-card` (L3556), `.glass-sidebar` (L3565), `.animate-glass-float` (L3613) dans @layer utilities
3. Résoudre le conflit `.glass-card` : la définition L199 (hors layer) et L961 (@layer components) se superposent — garder UNE seule définition
4. Supprimer la section "Liquid Glass prioritaires" (L4645-4888) et intégrer ses styles proprement dans @layer components SANS !important
5. Unifier le sélecteur dark mode : utiliser UNIQUEMENT `:root[data-theme="dark"]`, supprimer les sélecteurs `.dark`, `html:not(...)`, `:root:not(...)`
6. Remplacer TOUTES les valeurs de border-radius hardcodées (0.75rem, 0.6rem, 0.7rem, 12px) par des variables CSS
7. Remplacer TOUTES les valeurs de blur() hardcodées par les variables --glass-blur-*
8. Extraire les sections composant-spécifiques (modal-config-*, intervention-form-*, history-panel-*) vers des CSS modules ou fichiers dédiés
9. Réduire les !important de 117 à < 10 (seuls cas acceptables : overrides de librairies tierces)
10. Ajouter `--radius-xs: 4px` pour les cas actuellement à 3px ou 5px
11. Supprimer la variable `--card-radius` dans tokens.css (doublon de `--radius-lg`)
12. Nettoyer les commentaires obsolètes ("Design v1.5", "Sajid principle", etc.)

---

### Mission 2 : Modals / Dialogs / Sheets Unification
**Priorité : CRITIQUE**

**Fichiers concernés :**
- `src/components/ui/modal/GenericModal.tsx`
- `src/components/ui/modal/GenericModalContent.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/features/settings/UserPermissionsDialog.tsx`
- `app/globals.css` — sections modal-surface, shadcn-sheet, shadcn-dialog, glass-modal-premium

**Problèmes spécifiques :**
1. `.modal-surface` défini 2x (L1567 @layer + L4789 hors layer avec !important) → fusionner
2. `.shadcn-sheet-content` défini 2x (L1633 @layer + L4802 hors layer) → fusionner
3. `.glass-modal-premium` défini 2x (L292 hors layer + L4870 hors layer) → fusionner
4. Les composants TSX (InterventionModalContent, UserPermissionsDialog) utilisent des **inline styles** pour backdrop-filter au lieu des classes CSS → migrer vers les classes
5. Le `.modal-overlay` est rendu transparent en mode clair (L4774-4778 avec !important) mais garde `rgba(0,0,0,0.40)` dans @layer components → choisir UN comportement
6. Unifier tous les modals sur le même template (modal-base du template section 3.3)
7. Les blur values des modals sont incohérentes : 6px (modal-surface), 8px (sheet), 16px (liquid glass), 20px (premium) → standardiser sur blur(var(--blur-lg))

---

### Mission 3 : Page Interventions (Liste)
**Priorité : HAUTE**

**Fichiers concernés :**
- `app/interventions/page.tsx`
- `src/components/interventions/InterventionCard.tsx`
- `src/components/interventions/ScrollableTableCard.tsx`
- `app/globals.css` — sections data-table, shadcn-table, table-scroll-wrapper

**Problèmes spécifiques :**
1. Couleur CHECK status hardcodée `#EF4444` en inline style → utiliser la variable --status-cancelled-fg ou une variable dédiée
2. Inline styles pour les status badges (`backgroundColor: \`${finalColor}15\``) → utiliser des classes CSS avec variables
3. Le système de stripes table (L1240-1350) est surdimensionné avec fallbacks nth-child + data-row-index → simplifier
4. Les table headers utilisent un `::before` pseudo-element avec gloss effect (L1373-1405) incluant des blur hardcodés (32px, 40px) → standardiser
5. La section table-scroll-wrapper (L1499-1537) définit ses propres scrollbar styles → centraliser dans un utilitaire
6. Les ombres colorées par ligne (L1415-1443) utilisent `color-mix` complexe → simplifier

---

### Mission 4 : Page Intervention Detail (Editor)
**Priorité : HAUTE**

**Fichiers concernés :**
- `app/interventions/[id]/InterventionEditor.tsx` (wrapper)
- `src/components/ui/intervention-modal/InterventionModalContent.tsx`
- `app/globals.css` — sections intervention-form-*

**Problèmes spécifiques :**
1. La section `intervention-form-*` (L2462-3015, ~553 lignes) dans globals.css est ENTIÈREMENT dédiée à ce composant → extraire vers un CSS module
2. Le composant utilise des inline styles `style={{}}` pour backdrop-filter (L828-831) au lieu des classes CSS
3. Les sections `.intervention-form-section` sont overridées à L4828-4837 avec !important → fusionner
4. Couleur WhatsApp hardcodée `#25D366` dans le composant → variable CSS ou constante
5. Chaque variante de modal (halfpage, centerpage, fullpage) a ses propres overrides de taille → utiliser un système de slots ou CSS container queries

---

### Mission 5 : Section Commentaires
**Priorité : MOYENNE**

**Fichiers concernés :**
- Rechercher : composants de commentaires dans `src/components/` ou `src/features/`
- Inline dans InterventionDetailCard.tsx (L62 : `className="rounded bg-muted/30"`)

**Problèmes spécifiques :**
1. Les commentaires utilisent `bg-muted/30` sans style défini → créer une classe `.comment-bubble`
2. L'InterventionDetailCard contient un texte artefact `zferdezdsf` (L56) → supprimer
3. Pas de styles dédiés pour la section commentaires dans globals.css → en ajouter si nécessaire
4. Les commentaires dans les modaux et la page détail doivent avoir le même style visuel

---

### Mission 6 : Section Documents
**Priorité : MOYENNE**

**Fichiers concernés :**
- `src/components/documents/DocumentPreview.tsx`
- `src/components/documents/variants/docs_gmbs/DocumentManagerGmbs.tsx`
- `src/components/documents/variants/legacy/DocumentManagerLegacy.tsx`

**Problèmes spécifiques :**
1. Les deux variants (gmbs et legacy) ont des styles très similaires mais non partagés → extraire les styles communs
2. Les états de drag-over utilisent `bg-primary/10`, `bg-primary/5` de manière ad-hoc → unifier
3. Le DocumentPreview utilise `bg-muted/60` pour l'indicateur de type → standardiser
4. Pas d'utilisation du glass design system → cohérence à vérifier avec le reste de l'app
5. Les border-radius mélangent `rounded`, `rounded-md`, `rounded-l`, `rounded-tl`, `rounded-full` dans un même composant

---

### Mission 7 : Page Artisans
**Priorité : HAUTE**

**Fichiers concernés :**
- `app/artisans/page.tsx`

**Problèmes spécifiques :**
1. Couleurs hardcodées en inline style : `#f1f5f9`, `#0f172a`, `#e2e8f0` → remplacer par variables Tailwind/CSS
2. Utilise `hexToRgba()` pour les ombres dynamiques → standardiser
3. Pas d'utilisation du glass design system → cohérence visuelle à assurer
4. Les lignes alternées utilisent `bg-white` / `dark:bg-background` au lieu du système de stripes → unifier

---

### Mission 8 : Page Dashboard
**Priorité : MOYENNE**

**Fichiers concernés :**
- `app/dashboard/page.tsx`

**Problèmes spécifiques :**
1. Couleurs RGB hardcodées pour les indicateurs de retard : `rgb(34, 197, 94)`, `rgb(239, 68, 68)` → utiliser les variables --success, --error
2. Interpolation RGB manuelle pour gradients de couleurs → utiliser `color-mix()` ou variables CSS
3. Le dashboard utilise `bg-muted/30` pour les filtres, cohérent avec le reste
4. Shadow `shadow-sm` utilisé de manière cohérente

---

### Mission 9 : Page Admin Dashboard / Analytics
**Priorité : MOYENNE**

**Fichiers concernés :**
- `app/admin/dashboard/page.tsx`

**Problèmes spécifiques :**
1. Box-shadow hardcodé : `0 25px 50px -12px rgba(0, 0, 0, 0.1)` → utiliser --shadow-xl
2. Skeleton cards utilisent `rounded-xl` tandis que les cards normales utilisent `rounded-lg` → unifier
3. Les accordions utilisent `bg-card shadow-sm` → cohérent
4. Les charts utilisent des couleurs spécifiques (Orange/Amber, Purple, Green) → vérifier avec le design system

---

### Mission 10 : Pages Settings
**Priorité : BASSE**

**Fichiers concernés :**
- `app/settings/page.tsx` (redirect seulement)
- `app/settings/layout.tsx`
- `src/features/settings/UserPermissionsDialog.tsx`

**Problèmes spécifiques :**
1. Le UserPermissionsDialog est le composant le PLUS stylé du projet avec des inline styles massifs
2. Mélange `glass-modal-premium` (CSS class) avec inline `backdrop-filter` → choisir un
3. Couleurs hardcodées : `#6366f1` (indigo default) → variable
4. 6 tailles de border-radius différentes dans un seul composant → standardiser
5. Dark mode géré par mélange de `dark:` prefix et CSS variables → unifier

---

### Mission 11 : Sidebar / Navigation
**Priorité : HAUTE**

**Fichiers concernés :**
- `src/components/ui/sidebar.tsx`
- `app/globals.css` — classes `.glass-sidebar`, `.liquid-glass-sidebar`, `.glass-navbar`, `.liquid-glass-topbar-blue`

**Problèmes spécifiques :**
1. `.glass-sidebar` défini 2x (L468 et L3565) avec des implémentations complètement différentes
2. `.liquid-glass-sidebar` (L4713) utilise des gradients hardcodés et des blur hardcodés (12px) → standardiser
3. `.liquid-glass-topbar-blue` (L4679) utilise aussi des valeurs hardcodées
4. Les couleurs de la sidebar (`hsl(210 50% 87%)`, `rgba(51, 113, 178, 0.15)`) sont hardcodées → variables
5. Dark mode de la sidebar utilise `.dark .liquid-glass-sidebar` (sélecteur .dark) au lieu de `:root[data-theme="dark"]`

---

### Mission 12 : Composants UI de Base
**Priorité : HAUTE**

**Fichiers concernés :**
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/accordion.tsx`
- `src/components/ui/card.tsx`
- `app/globals.css` — sections correspondantes

**Problèmes spécifiques :**
1. **Table** : Le composant shadcn `table.tsx` utilise des classes `shadcn-table` mappées dans globals.css avec des styles très complexes (stripes, gradients, status borders) → simplifier
2. **Accordion** : Styles définis dans globals.css (L3085-3111) en @layer components → vérifier cohérence avec le composant
3. **Card** : Le composant shadcn utilise `data-slot="card"` qui est ciblé par la section "Liquid Glass" (L4747) avec !important → nettoyer
4. **Tabs** : Vérifier que les tab triggers utilisent le même style que le reste

---

### Mission 13 : Optimisations Performance
**Priorité : MOYENNE**

**Fichiers concernés :**
- `app/globals.css` — toutes les sections avec backdrop-filter

**Problèmes spécifiques :**
1. **88 backdrop-filter** dans le CSS global, c'est BEAUCOUP pour les machines modestes
2. Le mode `performance-mode` (L3452-3470) et `low-power-mode` existent mais ne couvrent pas tous les blur
3. `prefers-reduced-motion` (L3429-3449) désactive les blur mais de manière trop agressive
4. Le `font-size: 12px` sur `html` (L704) réduit la taille de base de 16px à 12px, ce qui affecte TOUT le site → vérifier si c'est voulu
5. La transition globale sur `*, *::before, *::after` (L932-937) force une transition sur TOUS les éléments → impact performance

---

## 5. Classes CSS à Supprimer / Fusionner

### À SUPPRIMER (duplicats ou inutilisés)

| Classe/Bloc | Lignes | Raison |
|-------------|--------|--------|
| `.glass-card` (utilities) | L3556-3559 | Doublon conflictuel de L199 |
| `.glass-nav` (utilities) | L3561-3563 | Non référencé dans les composants |
| `.glass-sidebar` (utilities) | L3565-3567 | Doublon conflictuel de L468 |
| `.animate-glass-float` (2ème) | L3613-3615 | Doublon exact de L3242 |
| `@keyframes expand-contract` (2ème) | L3570-3578 | Doublon exact de L3402 |
| `@keyframes shimmer` (2ème) | L3580-3590 | Doublon exact de L3407 |
| `@keyframes breathing` (2ème) | L3592-3602 | Doublon exact de L3418 |
| `@keyframes glass-float` (2ème) | L3604-3611 | Doublon exact de L3423 |
| `@keyframes gradient` (2ème) | L3396-3400 | Doublon exact de L690 |
| `.no-scrollbar` vs `.scrollbar-hide` | L604-620 | Identiques — garder un seul nom |
| Section Liquid Glass prioritaires | L4645-4888 | Intégrer dans les styles normaux |

### À FUSIONNER

| Classes | Action |
|---------|--------|
| `.modal-surface` (L1567) + override (L4789) | Fusionner en une seule définition sans !important |
| `.shadcn-sheet-content` (L1633) + override (L4802) | Fusionner en une seule définition |
| `.modal-surface-full` (L1642) + override (L4815) | Fusionner |
| `.card` (L961) + override (L4745) | Fusionner, supprimer !important |
| `.glass-modal-premium` (L292) + override (L4870) | Fusionner |
| `.modal-overlay` (L1557) + override (L4774) | Fusionner — décider si transparent ou pas |

---

## 6. Variables CSS à Normaliser

### À AJOUTER

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--radius-xs` | `4px` | Scrollbar thumbs, petits éléments |
| `--blur-reference` | `50px` | Le blur de référence glass |
| `--saturate-reference` | `3` | Le saturate de référence glass |
| `--glass-modal-bg` | `rgba(87, 100, 151, 0.20)` | Background unifié des modals glass |
| `--glass-modal-border` | `rgba(255, 255, 255, 0.3)` | Bordure unifiée des modals glass |
| `--glass-section-bg` | `rgba(255, 255, 255, 0.97)` | Background des sections dans les modals |

### À MODIFIER

| Variable | Avant | Après | Raison |
|----------|-------|-------|--------|
| `--radius-xl` | `20px` (tokens.css: `1rem`) | `20px` uniquement | Conflit tokens.css vs globals.css |
| `--card-radius` (tokens.css) | `0.75rem` | SUPPRIMER | Doublon de --radius-lg |
| `--card-shadow` (tokens.css) | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | SUPPRIMER | Doublon de --shadow-xs |

### À SUPPRIMER

| Variable | Raison |
|----------|--------|
| `--card-radius` (tokens.css L38) | Doublon de --radius-lg |
| `--card-shadow` (tokens.css L39) | Doublon de --shadow-xs |
| `--glass-bg-*` (5 niveaux) | Remplacer par des opacités Tailwind si non utilisées dans globals.css |
| `--glass-border-dark`, `--glass-border-dark-medium` | Redondants avec --glass-border-* |

### Variables tokens.css à GARDER (bien définis)

Toutes les variables `--status-*` sont bien organisées et cohérentes. Les classes `.status-*` sont propres.

---

## 7. Résumé Prioritaire des Actions

| # | Mission | Priorité | Effort estimé | Impact |
|---|---------|----------|---------------|--------|
| 1 | globals.css cleanup | CRITIQUE | Grand | Fondation de tout le reste |
| 2 | Modals unification | CRITIQUE | Moyen | Cohérence UX majeure |
| 11 | Sidebar/Navigation | HAUTE | Petit | Visible sur toutes les pages |
| 12 | Composants UI base | HAUTE | Moyen | Fondation composants |
| 3 | Page Interventions | HAUTE | Moyen | Page la plus utilisée |
| 7 | Page Artisans | HAUTE | Petit | Couleurs hardcodées |
| 4 | Intervention Detail | HAUTE | Moyen | Formulaire complexe |
| 13 | Performance | MOYENNE | Moyen | UX machines modestes |
| 8 | Dashboard | MOYENNE | Petit | Couleurs hardcodées |
| 9 | Admin Dashboard | MOYENNE | Petit | Consistance |
| 5 | Commentaires | MOYENNE | Petit | Accessibilité |
| 6 | Documents | MOYENNE | Petit | Accessibilité |
| 10 | Settings | BASSE | Moyen | Composant complexe |

---

*Fin de l'audit UX/UI — Ce rapport est actionnable et prêt à être utilisé par les agents spécialisés.*
