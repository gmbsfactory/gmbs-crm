# Audit UX/UI et Accessibilite - GMBS CRM

**Date :** 10 fevrier 2026
**Branche :** `design_ux_ui`
**Score global UX/UI :** 72/100
**Score WCAG 2.1 AA :** 68/100

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Design System](#2-design-system)
3. [Audit par page](#3-audit-par-page)
4. [Composants UI de base](#4-composants-ui-de-base)
5. [Composants metier](#5-composants-metier)
6. [Accessibilite WCAG 2.1](#6-accessibilite-wcag-21)
7. [Etats UI](#7-etats-ui)
8. [Recommandations priorisees](#8-recommandations-priorisees)
9. [Checklist WCAG 2.1](#9-checklist-wcag-21)

---

## 1. Resume executif

Le CRM GMBS dispose d'un design system "Liquid Glass" sophistique avec un glassmorphism coherent et visuellement attractif. Les composants Radix UI fournissent une base d'accessibilite solide. Cependant, plusieurs lacunes critiques existent en matiere d'accessibilite ARIA, de contrastes de couleurs et de support `prefers-reduced-motion`.

### Points forts
- Design system glassmorphism coherent light/dark
- Composants Radix UI avec accessibilite native
- Tokens CSS centralises (tokens.css + globals.css)
- Support dark mode exhaustif via `data-theme="dark"`
- Detection low-power mode (LowPowerModeDetector)
- Kanban DnD avec annonces screen reader (announcements)
- Calcul de contraste dynamique dans gestionnaire-badge et searchable-badge-select

### Faiblesses majeures
- Fichier globals.css monolithique (4738 lignes, 141KB)
- Manque massif d'aria-label sur les composants
- Aucun support `prefers-reduced-motion` dans les composants React
- Console.log de debug laisses dans multi-select.tsx
- Contrastes insuffisants pour certains elements (toast destructive, dropdown shortcuts)
- Truncated-cell accessible uniquement a la souris

---

## 2. Design System

### 2.1 Architecture CSS

| Fichier | Lignes | Role |
|---------|--------|------|
| `app/globals.css` | 4738 | Design system complet (trop gros) |
| `src/styles/tokens.css` | 52 | Tokens de statut uniquement |

**Probleme critique :** `globals.css` a 141KB et 4738 lignes. Ce fichier contient tout : variables, composants glass, tables, modaux, formulaires, responsive. Il devrait etre decoupe en modules.

### 2.2 Variables CSS - Inventaire

**Mode Light (:root)**
- Couleurs marque : `--gmbs-blue` (#3371B2), variantes
- Glass backgrounds : 5 niveaux (`subtle` a `solid`) avec opacites 0.45 -> 0.88
- Glass borders : 5 niveaux (`subtle` a `accent`) avec opacites 0.25 -> 0.80
- Ombres : 5 niveaux (xs -> xl)
- Blur : 4 niveaux (8px -> 32px)
- Radius : xs(4px), sm(6px), md(10px), lg(14px), xl(20px)
- Transitions : fast(150ms), base(250ms), slow(350ms)
- Modal : panel-bg, element-bg, header-bg, footer-bg, input-bg, divider

**Mode Dark (`:root[data-theme="dark"]`)**
- Glass backgrounds plus opaques (0.04 -> 0.16)
- Borders plus claires pour visibilite
- Ombres plus prononcees
- Blur legerement augmente
- Navigation tokens adaptes

**Shadcn mapping :** Correct avec `--background`, `--foreground`, `--card`, `--primary`, etc. mappes vers les tokens custom.

### 2.3 Status Tokens (tokens.css)

| Statut | BG HSL | FG HSL | Contraste estime |
|--------|--------|--------|-----------------|
| Demande | 210 40% 98% | 215 16% 35% | ~5.5:1 OK |
| Devis Envoye | 210 40% 96% | 221 39% 28% | ~6.8:1 OK |
| Accepte | 142 76% 97% | 142 50% 32% | ~5.2:1 OK |
| En cours | 48 96% 96% | 32 95% 44% | ~3.2:1 FAIBLE |
| Visite Technique | 199 89% 96% | 199 84% 35% | ~5.0:1 OK |
| Termine | 151 81% 95% | 160 84% 24% | ~7.0:1 OK |
| Annule | 0 93% 95% | 0 72% 45% | ~4.1:1 LIMITE |
| Refuse | 343 76% 96% | 343 72% 40% | ~4.8:1 OK |
| STAND BY | 28 100% 96% | 28 85% 45% | ~3.5:1 FAIBLE |
| SAV | 252 95% 96% | 252 83% 45% | ~4.0:1 LIMITE |

**Problemes :** "En cours" et "STAND BY" n'atteignent pas le ratio WCAG AA (4.5:1) pour le texte.

### 2.4 Coherence Dark Mode

- Variables light/dark bien dupliquees
- `color-scheme: light/dark` correctement defini
- Body : gradient bleu en light, fond solide en dark
- Transition globale sur tous elements (`*`) : `background-color, border-color, color, box-shadow` (ligne 959-964) - cela peut causer des problemes de performance
- Classes glass adaptees pour chaque mode

**Probleme (globals.css:959-964) :** La transition globale `*, *::before, *::after` avec 4 proprietes appliquee a TOUS les elements est couteuse en performance. Devrait etre limitee aux elements interactifs.

---

## 3. Audit par page

### 3.1 Dashboard (app/dashboard/page.tsx) - Score: 7/10

**Structure :** Page client-side avec widgets (KPI, podium, cartes marge).

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 8/10 | Grid responsive avec gap-4/gap-6 |
| Responsivite | 7/10 | Classes Tailwind md:/lg: presentes |
| Accessibilite | 5/10 | Pas de landmarks, pas de headings hierarchiques |
| Loading state | 8/10 | Skeletons et loading indicators |
| Error state | 6/10 | Error handling present mais generique |
| Empty state | 5/10 | Pas de message si aucune donnee |
| Dark mode | 8/10 | Via design system glass |

**Problemes :**
- Pas de `<main>` ou `role="main"` (structure semantique)
- Pas d'aria-label sur les sections de widgets
- Podium cards pas accessibles au clavier

### 3.2 Admin Dashboard (app/admin/dashboard/page.tsx) - Score: 6/10

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 7/10 | Tabs + tableaux |
| Accessibilite | 5/10 | Manque aria-labels sur onglets |
| Loading state | 7/10 | Loader present |
| Error state | 5/10 | Basique |
| Responsivite | 6/10 | Tables debordent sur mobile |

**Problemes :**
- Tables admin sans `aria-label` ni `aria-describedby`
- Pas de responsive horizontal scroll pour les tableaux
- Filtres sans labels accessibles

### 3.3 Artisans (app/artisans/page.tsx) - Score: 7/10

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 8/10 | Liste avec recherche et pagination |
| Accessibilite | 6/10 | SearchModal a role="combobox" |
| Loading state | 8/10 | Skeleton loading |
| Pagination | 7/10 | Fonctionnelle mais aria-label manquant |
| Responsive | 7/10 | Adapte mais table deborde |

**Problemes :**
- ArtisanSearchModal (src/components/artisans/ArtisanSearchModal.tsx) : pas d'aria-label sur le champ de recherche
- Badges de statut artisan avec couleurs hardcodees (pas de dark mode via tokens)
- Pagination sans `aria-current="page"` sur la page active

### 3.4 Interventions (app/interventions/page.tsx) - Score: 8/10

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 9/10 | Multi-vues (table, gallery, kanban) |
| Accessibilite | 6/10 | Kanban avec DnD announcements |
| Loading state | 9/10 | Complet avec GenieEffect |
| Filtres | 8/10 | SearchableBadgeSelect accessible |
| Responsive | 7/10 | Vues adaptees mais kanban deborde |
| Animations | 9/10 | AnimatedCard, GenieEffect |

**Points forts :**
- Kanban avec announcements screen reader (kanban.tsx:283-301)
- Animations fluides (GenieEffect, AnimatedCard)
- Multi-modes d'affichage (halfpage, centerpage, fullpage)

**Problemes :**
- GenieEffect (src/components/ui/genie-effect/GenieEffect.tsx) : `innerHTML` (ligne 105) - risque XSS et pas de `prefers-reduced-motion`
- AnimatedCard sans `prefers-reduced-motion`
- ViewTabs pas d'aria-label pour le contexte

### 3.5 Settings - Toutes pages - Score: 6/10

**Structure :** 6 sous-pages (profile, team, targets, enums, interface, workflow)

| Page | Score | Detail |
|------|-------|--------|
| Profile (ProfileSettings.tsx) | 7/10 | Formulaire avec labels, avatar upload |
| Team (TeamSettings.tsx) | 6/10 | Liste users, modales permissions |
| Targets (TargetsSettings.tsx) | 6/10 | Formulaire numerique |
| Enums (EnumManager.tsx) | 6/10 | CRUD avec dialog |
| Interface | 7/10 | Bons controles |
| Workflow | 6/10 | Complexe |

**Problemes communs :**
- EnumEditDialog (src/features/settings/components/EnumEditDialog.tsx:91-95) : utilise `alert()` natif au lieu de toast - UX mediocre
- UserPermissionsDialog : animations `whileHover={{ scale: 1.01 }}` sans `prefers-reduced-motion`
- Labels pas toujours relies aux inputs via `htmlFor`
- ColorSelector (UserPermissionsDialog.tsx:185-195) : boutons couleur sans aria-label

### 3.6 Comptabilite (app/comptabilite/page.tsx) - Score: 7/10

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 8/10 | Table avec filtres et pagination |
| Accessibilite | 7/10 | Checkboxes avec aria-label |
| Loading state | 8/10 | Loading spinner + empty state |
| Error state | 7/10 | Message d'erreur style |
| Responsive | 6/10 | Table fixe, pas de scroll horizontal |

**Points forts :**
- Checkbox avec `aria-label="Selectionner toutes les lignes"` (ligne 699)
- Loading + empty states bien geres
- Feedback copie visuel

**Problemes :**
- Table avec `tableLayout: "fixed"` et beaucoup de colonnes - deborde sur mobile
- `TruncatedCell` accessible uniquement a la souris (pas de clavier)

### 3.7 Login ((auth)/login/page.tsx) - Score: 7/10

| Critere | Score | Detail |
|---------|-------|--------|
| Layout | 8/10 | Centre, formulaire simple |
| Accessibilite | 6/10 | Labels presents mais generiques |
| Error feedback | 7/10 | Messages d'erreur |
| Responsive | 8/10 | Bonne adaptation |

---

## 4. Composants UI de base

### 4.1 Modaux et overlays

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **Dialog** (dialog.tsx) | 7/10 | Close button a sr-only. Pas d'aria-label sur DialogContent. Backdrop `bg-black/5` contraste faible |
| **Sheet** (sheet.tsx) | 7/10 | Animations slide fluides. Pas d'aria-label sur trigger. `bg-black/5` overlay trop leger |
| **AlertDialog** (alert-dialog.tsx) | 7/10 | Meilleur overlay (`bg-black/20`). Z-index fragile (70/80) |
| **GenericModal** (modal/GenericModal.tsx) | 7/10 | Support multi-modes (half/center/full). Focus trap via Radix |

### 4.2 Formulaires

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **Input** (input.tsx) | 7/10 | Focus ring visible. Variant glass. Pas d'aria-label natif |
| **Textarea** (textarea.tsx) | 7/10 | Focus ring. Min-height lisible |
| **Select** (select.tsx) | 7/10 | Radix native. Chevron `opacity-50` contraste marginal |
| **Checkbox** (checkbox.tsx) | 8/10 | Radix native. Check icon. Space toggle |
| **Switch** (switch.tsx) | 8/10 | Radix native. Thumb animation smooth |
| **Label** (label.tsx) | 8/10 | Radix native. Peer disabled state |
| **MultiSelect** (multi-select.tsx) | 6/10 | `console.log` debug laisses (lignes 59,74,77,162,164). `role="option"` correct |
| **SearchableBadgeSelect** (searchable-badge-select.tsx) | 8/10 | Bon calcul contraste. `role="combobox"`, `aria-expanded`, `aria-controls`. `role="listbox"` sur options |

### 4.3 Navigation et layout

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **Tabs** (tabs.tsx) | 8/10 | Radix native. Arrow keys. Focus ring |
| **DropdownMenu** (dropdown-menu.tsx) | 7/10 | Radix native. Shortcut `opacity-60` contraste 3:1 insuffisant |
| **Sidebar** (sidebar.tsx) | 6/10 | Minimal (context seulement). Pas de `nav` role |
| **ModeSelector** (mode-selector/ModeSelector.tsx) | 7/10 | Dropdown avec descriptions. Pas d'aria-label |
| **PageSearchBar** (page-search-bar.tsx) | 9/10 | Excellent : Cmd/Ctrl+F, Escape, `aria-label` sur boutons. Input manque aria-label |

### 4.4 Affichage de donnees

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **Table** (table.tsx) | 6/10 | HTML semantique correct. Pas d'aria-label, pas d'aria-sort |
| **Card** (card.tsx) | 7/10 | h3 semantique pour titre. Variants glass |
| **Badge** (badge.tsx) | 6/10 | `<span>` pas de role="button" si cliquable |
| **Skeleton** (skeleton.tsx) | 4/10 | Manque `aria-busy="true"`, `role="status"`, `aria-label` |
| **TruncatedCell** (truncated-cell.tsx) | 5/10 | Tooltip souris uniquement. ResizeObserver sans fallback |
| **Tooltip** (tooltip.tsx) | 7/10 | Radix native. Z-index `[10000]` conflictuel |

### 4.5 Badges metier

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **GestionnaireBadge** (gestionnaire-badge.tsx) | 8/10 | Excellent calcul contraste. `title` tooltip. Manque aria-label |
| **ArtisanStatusBadge** (ArtisanStatusBadge.tsx) | 7/10 | Couleurs hardcodees (pas de dark mode tokens). Badge accessible |
| **ArtisanDossierStatusIcon** (ArtisanDossierStatusIcon.tsx) | 7/10 | `title` tooltip. Dot indicator visuel |
| **StatusBadge/MetierBadge/AgenceBadge** (BadgeComponents.tsx) | 7/10 | Tone system coherent. `title` hint |
| **ManagerBadge** (ManagerBadge.tsx) | 8/10 | Tooltip Radix. GestionnaireBadge delegue |
| **StyledSwitch** (styled-switch.tsx) | 6/10 | Animation 3D sans `prefers-reduced-motion`. `Math.random()` pour ID regenere chaque render |

### 4.6 Loader et animations

| Composant | Score A11y | Problemes |
|-----------|-----------|-----------|
| **Loader** (Loader.tsx) | 4/10 | Pas de `role="status"`, pas de `aria-label`. Utilise styled-components (inconsistant avec Tailwind) |
| **GenieEffect** (genie-effect/GenieEffect.tsx) | 5/10 | `innerHTML` (XSS risk). Pas de `prefers-reduced-motion`. Aucun role ARIA |
| **AvatarGroup** (avatar-group.tsx) | 7/10 | Tooltips Radix. Variants motion/css/stack. data-slot coherent |

---

## 5. Composants metier

### 5.1 Modale Intervention (InterventionModalContent.tsx)

**Score : 7/10**

Points forts :
- Structure en sections (header, body, footer) avec glass-modal
- Support multi-modes (halfpage, centerpage, fullpage)
- Tabs de navigation interne
- Feedback visuel pour actions (save, delete)

Problemes :
- `src/components/ui/intervention-modal/InterventionModalContent.tsx` : pas d'aria-describedby reliant titre et contenu
- Pas d'aria-label sur les sections internes
- Focus pas restore au retour du formulaire d'edition

### 5.2 Formulaire Intervention (InterventionEditForm.tsx)

**Score : 6/10**

Points forts :
- Labels presents sur la plupart des champs
- Validation cote client
- Structure responsive via `.legacy-form-main-grid`

Problemes :
- `src/components/interventions/InterventionEditForm.tsx` : Labels pas toujours relies via htmlFor
- Messages d'erreur pas lies via `aria-describedby`
- Pas d'indication `aria-required` sur les champs obligatoires

### 5.3 Section Commentaires (CommentSection.tsx)

**Score : 6/10**

Points forts :
- Zone de saisie avec submit
- Horodatage des commentaires

Problemes :
- `src/components/shared/CommentSection.tsx` : pas de `role="log"` sur la liste de commentaires
- Pas de live region pour nouveaux commentaires (`aria-live="polite"`)
- Bouton submit sans aria-label contextuel

### 5.4 Cartes Intervention (InterventionCard.tsx, AnimatedCard.tsx)

**Score : 7/10**

Points forts :
- InterventionCard avec informations structurees
- AnimatedCard avec framer-motion fluide
- Etats visuels pour statuts

Problemes :
- `src/features/interventions/components/AnimatedCard.tsx` : pas de `prefers-reduced-motion`
- `src/features/interventions/components/InterventionCard.tsx` : pas de role="article" ou semantic
- Click handlers sans indication keyboard (pas de onKeyDown)

### 5.5 Podium/Leaderboard

**Score : 6/10**

Points forts :
- `src/components/dashboard/leaderboard/PodiumCard.tsx` : Visuellement attractif
- Tokens gold/silver/bronze en light et dark
- Animations d'entree

Problemes :
- `src/components/dashboard/gestionnaire-ranking-podium.tsx` : pas de `role="list"` sur le podium
- Pas d'aria-label pour le rang
- Cards du podium pas accessibles au clavier
- `src/components/dashboard/margin-stats-card.tsx` : valeurs numeriques sans aria-label contextuel

### 5.6 Documents

**Score : 6/10**

Points forts :
- `src/components/documents/DocumentPreview.tsx` : Preview avec alt text
- Deux variants (gmbs, legacy) pour flexibilite
- Upload/download fonctionnels

Problemes :
- `src/components/documents/variants/docs_gmbs/DocumentManagerGmbs.tsx` : beaucoup d'aria-labels mais certains generiques
- `src/components/documents/variants/legacy/DocumentManagerLegacy.tsx` : drag-and-drop sans announcements
- Pas de feedback vocal pour upload en cours

### 5.7 Settings Features

**Score : 6/10**

| Feature | Score | Problemes cles |
|---------|-------|----------------|
| **EnumManager** | 6/10 | Dialog CRUD fonctionnel. `alert()` natif pour erreurs |
| **ProfileSettings** | 7/10 | Avatar upload. Labels corrects |
| **TargetsSettings** | 6/10 | Inputs numeriques. Pas d'aria-valuemin/max |
| **TeamSettings** | 6/10 | Liste users. Modales imbriquees |
| **UserPermissionsDialog** | 7/10 | Design riche. Animations sans reduced-motion |
| **EnumEditDialog** | 7/10 | Labels + required. `alert()` pour erreurs (ligne 91-95) |

---

## 6. Accessibilite WCAG 2.1

### 6.1 Statistiques globales

| Metrique | Valeur | Evaluation |
|----------|--------|------------|
| Attributs ARIA (aria-label, aria-describedby, role) | 90 occurrences dans 33 fichiers | Insuffisant pour ~65 composants |
| Attributs alt sur images | 19 occurrences dans 12 fichiers | Correct (peu d'images) |
| Balises `<img>` / `<Image>` | 5 occurrences dans 4 fichiers | Bon (principalement templates email) |
| `focus-visible` / `focus:ring` dans globals.css | 0 occurrence | Critique - pas de styles focus globaux custom |
| `prefers-reduced-motion` files | 12 fichiers mais 0 dans composants React | Critique |

### 6.2 Scoring WCAG par critere

| Critere WCAG | Score | Composants affectes |
|---|---|---|
| **1.1.1 Contenu non textuel** | 80% | Alt text present sur images. Icons decoratives OK |
| **1.3.1 Information et relations** | 60% | Headings pas hierarchiques. Landmarks manquants |
| **1.4.1 Utilisation de la couleur** | 65% | Statuts relies uniquement sur couleur (dot + texte aide) |
| **1.4.3 Contraste (AA 4.5:1)** | 60% | Toast destructive, dropdown shortcut, status "En cours"/"STAND BY" |
| **1.4.11 Contraste non-texte (3:1)** | 70% | Icons opacity-50, borders subtiles |
| **2.1.1 Clavier** | 80% | TruncatedCell manque, cards non focusables |
| **2.1.2 Pas de piege clavier** | 90% | Radix gere correctement |
| **2.3.1 Trois flashs ou seuil** | 95% | Pas de flash problematique |
| **2.4.1 Contourner blocs** | 50% | Pas de skip links |
| **2.4.3 Ordre du focus** | 75% | Logique mais pas d'aria-label contextuel |
| **2.4.7 Focus visible** | 85% | Focus rings Radix + Tailwind |
| **2.5.3 Etiquette dans le nom** | 60% | Beaucoup d'inputs sans label lie |
| **3.2.1 Au focus** | 90% | Pas de changement inattendu |
| **3.3.1 Identification erreurs** | 65% | `alert()` natif, pas d'aria-invalid |
| **3.3.2 Etiquettes/instructions** | 60% | Placeholders utilises comme labels |
| **4.1.2 Nom, role, valeur** | 55% | Manque massif d'aria-label |
| **4.1.3 Messages de statut** | 45% | Pas d'aria-live pour loading/errors/toasts |

### 6.3 Problemes critiques d'accessibilite

#### P1 - BLOQUANTS

1. **Toast destructive illisible** - `toast.tsx` variante destructive utilise des couleurs rouge sur rouge avec contraste ~2:1
   - Fichier: `src/components/ui/toast.tsx`
   - Fix: Utiliser contraste >= 4.5:1 pour text/bg

2. **Skeleton sans indication de chargement** - Aucun `aria-busy`, `role="status"`, ni `aria-label`
   - Fichier: `src/components/ui/skeleton.tsx:9`
   - Fix: Ajouter `aria-busy="true"` et `role="status"`

3. **Pas de skip links** - Aucun mecanisme pour contourner la navigation
   - Fichier: `app/layout.tsx`
   - Fix: Ajouter `<a href="#main-content" class="sr-only focus:not-sr-only">Aller au contenu</a>`

4. **TruncatedCell inaccessible au clavier** - Tooltip uniquement sur hover souris
   - Fichier: `src/components/ui/truncated-cell.tsx`
   - Fix: Ajouter `tabIndex={0}` et gestion onFocus/onBlur

#### P2 - IMPORTANTS

5. **Manque d'aria-label** sur ~80% des composants interactifs
   - Fichiers: Dialog, Sheet, Select triggers, Button (icon-only), Table, Dropdown triggers
   - Fix: Audit systematique et ajout d'aria-label

6. **Dropdown shortcut contraste 3:1** - `opacity-60` insuffisant WCAG AA
   - Fichier: `src/components/ui/dropdown-menu.tsx:177`
   - Fix: Augmenter a `opacity-80`

7. **Console.log de debug** dans multi-select.tsx
   - Fichier: `src/components/ui/multi-select.tsx:59,74,77,162,164`
   - Fix: Supprimer tous les console.log

8. **Status tokens contraste faible** pour "En cours" (3.2:1) et "STAND BY" (3.5:1)
   - Fichier: `src/styles/tokens.css:10-11,20-21`
   - Fix: Assombrir les couleurs foreground

9. **GenieEffect innerHTML** - Risque XSS et pas de reduced-motion
   - Fichier: `src/components/ui/genie-effect/GenieEffect.tsx:105`
   - Fix: Utiliser cloneNode au lieu d'innerHTML

#### P3 - A AMELIORER

10. **prefers-reduced-motion** non supporte dans les composants React (AnimatedCard, StyledSwitch, UserPermissionsDialog, GenieEffect)
11. **alert() natif** dans EnumEditDialog au lieu de toast
12. **Math.random() pour ID** dans StyledSwitch (regenere chaque render)
13. **Z-index fragiles** : Tooltip/Popover/Dropdown tous a 10000
14. **Transition globale** sur `*` couteuse en performance
15. **Loader.tsx** utilise styled-components (inconsistant avec Tailwind)

---

## 7. Etats UI

### 7.1 Loading States

| Page/Composant | Skeleton | Spinner | Empty msg | Score |
|----------------|----------|---------|-----------|-------|
| Dashboard | Oui | Oui | Non | 7/10 |
| Interventions | Oui | Oui | Oui | 9/10 |
| Artisans | Oui | Oui | Partiel | 7/10 |
| Comptabilite | Non | Oui | Oui | 7/10 |
| Settings | Partiel | Oui | Non | 5/10 |
| Admin | Oui | Oui | Partiel | 6/10 |

**Probleme global :** Skeleton component (skeleton.tsx) n'a pas de semantique accessible. Ajouter `aria-busy="true"` et `role="status"`.

### 7.2 Error States

| Page/Composant | Error display | Retry | A11y | Score |
|----------------|--------------|-------|------|-------|
| Dashboard | Generique | Non | Pas d'aria-live | 5/10 |
| Interventions | Toast | Non | Partiel | 6/10 |
| Comptabilite | Banner styled | Non | Pas d'aria-live | 6/10 |
| Settings | alert() natif | Non | Mauvais | 3/10 |

**Probleme global :** Pas de pattern error boundary global. Les erreurs ne sont pas annoncees via `aria-live="assertive"`.

### 7.3 Empty States

| Page | Empty state present | Message | Illustration | Score |
|------|-------------------|---------|-------------|-------|
| Interventions | Oui | "Aucune intervention" | Non | 7/10 |
| Artisans | Partiel | Generique | Non | 5/10 |
| Comptabilite | Oui | "Aucune intervention terminee..." | Non | 7/10 |
| Dashboard | Non | - | - | 3/10 |
| Settings | Non | - | - | 3/10 |

### 7.4 Responsive Design

| Breakpoint | Support | Problemes |
|------------|---------|-----------|
| Mobile (<640px) | Partiel | Tables debordent, Kanban inutilisable |
| Tablet (640-1024px) | Bon | La plupart des pages s'adaptent |
| Desktop (>1024px) | Excellent | Design optimise |
| Large (>1440px) | Bon | Bonne utilisation de l'espace |

**Problemes responsive principaux :**
- Tables comptabilite/admin : pas de scroll horizontal sur mobile
- Kanban : grille auto-cols-fr deborde sur petit ecran
- Modaux halfpage : trop etroit sur tablette portrait
- Filtres interventions : wrap maladroit sur mobile

---

## 8. Recommandations priorisees

### Phase 1 - Critiques (avant mise en production)

| # | Action | Fichier(s) | Effort |
|---|--------|-----------|--------|
| 1 | Fixer contrastes Toast destructive | toast.tsx | Faible |
| 2 | Ajouter skip links | app/layout.tsx | Faible |
| 3 | Ajouter aria-busy/role sur Skeleton | skeleton.tsx | Faible |
| 4 | Fixer TruncatedCell clavier | truncated-cell.tsx | Moyen |
| 5 | Supprimer console.log de debug | multi-select.tsx | Faible |
| 6 | Fixer contrastes status "En cours"/"STAND BY" | tokens.css | Faible |
| 7 | Remplacer innerHTML par cloneNode dans GenieEffect | GenieEffect.tsx | Moyen |
| 8 | Augmenter contraste shortcut dropdown | dropdown-menu.tsx | Faible |

### Phase 2 - Importants (sprint suivant)

| # | Action | Fichier(s) | Effort |
|---|--------|-----------|--------|
| 9 | Audit systematique aria-label | ~33 fichiers | Eleve |
| 10 | Ajouter prefers-reduced-motion global | globals.css + composants | Moyen |
| 11 | Remplacer alert() par toast dans Settings | EnumEditDialog.tsx | Faible |
| 12 | Ajouter aria-live pour loading/errors | Layout + composants | Moyen |
| 13 | Fixer StyledSwitch Math.random() ID | styled-switch.tsx | Faible |
| 14 | Decoupe globals.css en modules | globals.css -> 5+ fichiers | Eleve |
| 15 | Ajouter landmarks semantiques | Toutes les pages | Moyen |

### Phase 3 - Ameliorations (long terme)

| # | Action | Fichier(s) | Effort |
|---|--------|-----------|--------|
| 16 | Tests axe-core automatises | tests/accessibility/ | Eleve |
| 17 | Standardiser z-index layer system | globals.css, composants | Moyen |
| 18 | Responsive tables (scroll horizontal) | Comptabilite, Admin | Moyen |
| 19 | Screen reader testing (NVDA/JAWS) | - | Eleve |
| 20 | Remplacer Loader styled-components par Tailwind | Loader.tsx | Faible |
| 21 | Documenter le design system glass | Documentation | Moyen |
| 22 | Limiter transition globale sur * | globals.css:959 | Faible |

---

## 9. Checklist WCAG 2.1 AA

### Perception

- [ ] 1.1.1 Contenu non textuel : Alt text sur toutes les images
- [x] 1.2.1 Audio/video : N/A (pas de media)
- [ ] 1.3.1 Info et relations : Landmarks manquants, headings non hierarchiques
- [x] 1.3.2 Ordre significatif : DOM order logique
- [x] 1.3.3 Caracteristiques sensorielles : Instructions pas basees uniquement sur forme/couleur
- [ ] 1.4.1 Utilisation couleur : Statuts partiellement relies sur couleur seule
- [ ] 1.4.3 Contraste minimum (4.5:1) : Toast destructive, status "En cours"/"STAND BY", dropdown shortcuts
- [ ] 1.4.4 Redimensionnement texte : Non teste
- [x] 1.4.5 Images de texte : Pas d'images de texte
- [ ] 1.4.10 Reflow : Tables debordent sur mobile
- [ ] 1.4.11 Contraste non-texte (3:1) : Icons opacity-50
- [ ] 1.4.12 Espacement texte : Non teste
- [ ] 1.4.13 Contenu au survol/focus : TruncatedCell tooltip uniquement hover

### Utilisation

- [x] 2.1.1 Clavier : Majoritairement accessible (Radix)
- [x] 2.1.2 Pas de piege clavier : Radix gere correctement
- [ ] 2.1.4 Raccourcis caractere unique : PageSearchBar OK, reste non teste
- [ ] 2.2.1 Delai ajustable : N/A
- [x] 2.3.1 Trois flashs : Pas de flash
- [ ] 2.4.1 Contourner blocs : Pas de skip links
- [x] 2.4.2 Titre page : Titres presents
- [ ] 2.4.3 Parcours focus : Logique mais sans aria-label contextuel
- [ ] 2.4.5 Acceder au contenu : Pas de landmarks complets
- [ ] 2.4.6 En-tetes et etiquettes : Labels insuffisants
- [x] 2.4.7 Focus visible : Focus rings corrects (Radix + Tailwind)
- [ ] 2.5.3 Etiquette dans le nom : Inputs sans label lie

### Comprehension

- [x] 3.1.1 Langue page : `lang` present
- [ ] 3.2.1 Au focus : OK
- [x] 3.2.3 Navigation coherente : Sidebar coherente
- [ ] 3.3.1 Identification erreurs : alert() natif, pas d'aria-invalid
- [ ] 3.3.2 Etiquettes/instructions : Placeholders comme labels
- [ ] 3.3.3 Suggestion erreur : Generique

### Robustesse

- [x] 4.1.1 Analyse syntaxique : HTML valide (React)
- [ ] 4.1.2 Nom, role, valeur : Manque massif d'aria-label
- [ ] 4.1.3 Messages statut : Pas d'aria-live pour loading/errors

---

## Annexe A - Fichiers audites

### Pages (12)
- `app/dashboard/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/artisans/page.tsx`
- `app/interventions/page.tsx`
- `app/comptabilite/page.tsx`
- `app/settings/page.tsx`
- `app/settings/profile/page.tsx`
- `app/settings/team/page.tsx`
- `app/settings/targets/page.tsx`
- `app/settings/enums/page.tsx`
- `app/settings/interface/page.tsx`
- `app/(auth)/login/page.tsx`

### Composants UI de base (23)
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/styled-switch.tsx`
- `src/components/ui/gestionnaire-badge.tsx`
- `src/components/ui/truncated-cell.tsx`
- `src/components/ui/page-search-bar.tsx`

### Composants metier (23)
- `src/components/ui/intervention-modal/InterventionModalContent.tsx`
- `src/components/ui/intervention-modal/InterventionModal.tsx`
- `src/components/ui/intervention-modal/NewInterventionModalContent.tsx`
- `src/components/interventions/InterventionEditForm.tsx`
- `src/components/shared/CommentSection.tsx`
- `src/features/interventions/components/AnimatedCard.tsx`
- `src/features/interventions/components/InterventionCard.tsx`
- `src/components/dashboard/gestionnaire-ranking-podium.tsx`
- `src/components/dashboard/leaderboard/PodiumCard.tsx`
- `src/components/dashboard/margin-stats-card.tsx`
- `src/components/dashboard/margin-total-card.tsx`
- `src/components/documents/DocumentPreview.tsx`
- `src/components/documents/variants/docs_gmbs/DocumentManagerGmbs.tsx`
- `src/components/documents/variants/legacy/DocumentManagerLegacy.tsx`
- `src/components/artisans/ArtisanSearchModal.tsx`
- `src/components/ui/artisan-modal/ArtisanModal.tsx`
- `src/components/ui/artisan-modal/ArtisanModalContent.tsx`
- `src/features/settings/EnumManager.tsx`
- `src/features/settings/ProfileSettings.tsx`
- `src/features/settings/TargetsSettings.tsx`
- `src/features/settings/TeamSettings.tsx`
- `src/features/settings/UserPermissionsDialog.tsx`
- `src/features/settings/components/EnumEditDialog.tsx`

### Autres composants analyses (10)
- `src/components/ui/kanban.tsx`
- `src/components/ui/DealCard.tsx`
- `src/components/ui/SectionLock.tsx`
- `src/components/ui/multi-select.tsx`
- `src/components/ui/searchable-badge-select.tsx`
- `src/components/ui/genie-effect/GenieEffect.tsx`
- `src/components/ui/Loader.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/avatar-group.tsx`
- `src/components/ui/BadgeComponents.tsx`
- `src/components/ui/ArtisanStatusBadge.tsx`
- `src/components/ui/ArtisanDossierStatusIcon.tsx`
- `src/components/ui/mode-selector/ModeSelector.tsx`
- `src/components/documents/ManagerBadge.tsx`
- `src/components/layout/LowPowerModeDetector.tsx`

### Design System
- `app/globals.css` (4738 lignes, 141KB)
- `src/styles/tokens.css` (52 lignes)
