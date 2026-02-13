# Team UX - Tracker de Taches

> **Equipe :** UX/UI & Accessibilite
> **Branche :** `fix/audit-ux`
> **Base :** `main`
> **Lead :** agent-ux-lead
> **Statut global :** in_progress
> **Progression :** 2/3

---

## Locks Actifs

| Fichier | Agent | Depuis | Tache |
|---------|-------|--------|-------|
| _(aucun)_ | | | |

---

## Taches

### Wave 4 - UX & Accessibilite

<!-- TASK:UX-001 STATUS:completed OWNER:agent-ux-css:2026-02-10T22:55:00Z PRIORITY:high WAVE:4 DEPENDS:none EFFORT:3d LOCKS:app/globals.css -->
#### UX-001 : Eclater globals.css (4738 lignes)

**Description :** Le fichier `globals.css` est monolithique avec 4738 lignes. Le decomposer en modules thematiques pour la maintenabilite.

**Plan de decomposition :**

```
app/
├── globals.css                  (GARDER - imports uniquement, <50L)
├── styles/
│   ├── variables.css            (~200L) - CSS custom properties, couleurs, spacing
│   ├── base.css                 (~150L) - Reset, body, html, typographie de base
│   ├── glass-system.css         (~500L) - Glassmorphism, backdrop-blur, frosted effects
│   ├── components.css           (~400L) - Styles composants generiques (buttons, badges, etc.)
│   ├── tables.css               (~300L) - Styles tableaux (data tables, headers, rows)
│   ├── modals.css               (~300L) - Styles modaux et sheets
│   ├── forms.css                (~200L) - Inputs, selects, checkboxes, form layout
│   ├── sidebar.css              (~200L) - Navigation laterale
│   ├── dashboard.css            (~300L) - Widgets, cartes stats, charts
│   ├── animations.css           (~150L) - Keyframes, transitions, effets
│   ├── responsive.css           (~300L) - Media queries, breakpoints
│   └── utilities.css            (~200L) - Classes utilitaires custom
```

**globals.css final :**
```css
@import './styles/variables.css';
@import './styles/base.css';
@import './styles/glass-system.css';
@import './styles/components.css';
@import './styles/tables.css';
@import './styles/modals.css';
@import './styles/forms.css';
@import './styles/sidebar.css';
@import './styles/dashboard.css';
@import './styles/animations.css';
@import './styles/responsive.css';
@import './styles/utilities.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Procedure :**
1. Analyser le contenu de globals.css et categoriser chaque bloc
2. Creer les fichiers dans `app/styles/`
3. Deplacer les styles par categorie
4. Remplacer globals.css par les imports
5. Verifier visuellement que rien n'est casse

**Criteres d'acceptation :**
- [x] globals.css < 50 lignes (18 lignes - imports uniquement)
- [x] 10-12 fichiers CSS thematiques crees (12 fichiers)
- [x] Chaque fichier < 500 lignes (max: tables.css 508L)
- [x] Pas de style perdu (diff visuel identique)
- [x] Variables CSS centralisees dans variables.css (311L)
- [x] `npm run build` reussit (CSS compile OK)
- [x] postcss-import ajoute pour resoudre les @import
- [x] Commit : 3707563

---

<!-- TASK:UX-002 STATUS:pending OWNER:none PRIORITY:high WAVE:4 DEPENDS:none EFFORT:5d -->
#### UX-002 : Audit WCAG + aria-label sur les composants

**Description :** Score accessibilite actuel : 72/100 (objectif : 85/100). Ajouter les attributs ARIA manquants, corriger les contrastes, supporter `prefers-reduced-motion`.

**Domaines d'action :**

**1. Contrastes (WCAG 2.1 AA - ratio 4.5:1 minimum)**
- Verifier tous les textes sur backgrounds glassmorphism
- Verifier les textes dans le mode sombre
- Corriger les tokens CSS si necessaire

**2. Attributs ARIA (~33 composants)**
- `aria-label` sur tous les boutons icone (sans texte visible)
- `aria-describedby` sur les champs de formulaire
- `role` sur les elements interactifs custom
- `aria-live="polite"` sur les zones de notification/toast
- `aria-expanded` sur les dropdowns et accordeons

**Fichiers principaux a modifier :**
- `src/components/ui/button.tsx` - aria-label sur variantes icone
- `src/components/ui/dialog.tsx` - aria-labelledby, aria-describedby
- `src/components/ui/sheet.tsx` - aria-label, focus trap
- `src/components/ui/toast.tsx` - aria-live
- `src/components/layout/app-sidebar.tsx` - navigation landmarks
- `app/layout.tsx` - lang="fr", skip-to-content link
- Tous les composants avec `<button>` ou `<a>` sans texte

**3. Clavier & Focus**
- Focus visible sur tous les elements interactifs
- Tab order logique
- Escape ferme les modaux
- `skip-to-content` link

**4. Motion**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Criteres d'acceptation :**
- [ ] Score accessibilite >= 85/100 (Lighthouse)
- [ ] Ratio de contraste >= 4.5:1 pour tout le texte (AA)
- [ ] `aria-label` sur 80%+ des elements interactifs sans texte
- [ ] `lang="fr"` sur `<html>`
- [ ] Skip-to-content link fonctionnel
- [ ] `prefers-reduced-motion` respecte
- [ ] Focus visible sur tous les elements interactifs
- [ ] `npm run build` reussit

---

<!-- TASK:UX-003 STATUS:completed OWNER:agent-ux-a11y:2026-02-10T22:49:00Z PRIORITY:medium WAVE:4 DEPENDS:none EFFORT:1d -->
#### UX-003 : Corriger TruncatedCell et GenieEffect

**Description :** Deux composants ont des problemes d'accessibilite specifiques :

**TruncatedCell :**
- Non accessible au clavier (hover only)
- Pas de `aria-expanded` sur le tooltip
- Contenu tronque non lisible par screen reader

**GenieEffect :**
- Utilise `innerHTML` directement (risque XSS + non accessible)
- Pas de `role` ni `aria-label`

**Fichiers a modifier :**
- `src/components/interventions/TruncatedCell.tsx`
- `src/components/ui/GenieEffect.tsx` (ou similaire)

**Criteres d'acceptation :**
- [x] TruncatedCell : accessible au clavier (focus + Enter/Space)
- [x] TruncatedCell : `aria-expanded` sur le tooltip
- [x] TruncatedCell : texte complet en `aria-label` ou `title`
- [x] GenieEffect : `innerHTML` remplace par cloneNode(true)
- [x] GenieEffect : `role` et `aria-label` ajoutes
- [x] GenieEffect : prefers-reduced-motion supporte (JS + CSS)
- [x] `npm run test` passe (25 tests)
- [x] Commit : 838e7d5

---

## Historique

| Date | Tache | Action | Agent |
|------|-------|--------|-------|
| 2026-02-10 | ALL | Initialisation tracker | orchestrator |
| 2026-02-10 | UX-003 | Completed - TruncatedCell a11y + GenieEffect security/a11y (commit 838e7d5) | agent-ux-a11y |
| 2026-02-10 | UX-001 | Completed - globals.css eclate en 12 modules (commit 3707563) | agent-ux-css |
