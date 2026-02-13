# Composants UI (shadcn/ui)

> Catalogue des composants UI du projet GMBS-CRM, basé sur shadcn/ui et Radix UI.

---

## Vue d'ensemble

Le projet utilise **shadcn/ui** comme base de composants UI, construits sur les primitives **Radix UI** et stylés avec **Tailwind CSS**. Les composants se trouvent dans `src/components/ui/`.

Chaque composant est un fichier autonome avec les variantes gérées via **class-variance-authority** (CVA) et la fusion de classes via **tailwind-merge** + **clsx**.

---

## Composants de base

### Boutons et actions

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Button` | `button.tsx` | Bouton principal avec variantes (default, destructive, outline, secondary, ghost, link) |
| `Badge` | `badge.tsx` | Badge de statut avec couleurs sémantiques |
| `BadgeComponents` | `BadgeComponents.tsx` | Composants badge métier (statut intervention, artisan) |

```tsx
import { Button } from "@/components/ui/button"

<Button variant="default">Confirmer</Button>
<Button variant="destructive">Supprimer</Button>
<Button variant="outline">Annuler</Button>
<Button variant="ghost">Fermer</Button>
```

### Formulaires

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Input` | `input.tsx` | Champ de saisie texte standard |
| `Textarea` | `textarea.tsx` | Zone de texte multi-lignes |
| `Label` | `label.tsx` | Label accessible pour formulaires |
| `Select` | `select.tsx` | Sélecteur natif Radix UI |
| `MultiSelect` | `multi-select.tsx` | Sélection multiple avec tags |
| `Checkbox` | `checkbox.tsx` | Case a cocher Radix |
| `Switch` | `switch.tsx` | Interrupteur bascule |
| `StyledSwitch` | `styled-switch.tsx` | Switch avec styles personnalisés |
| `RadioGroup` | `radio-group.tsx` | Groupe de boutons radio |
| `Calendar` | `calendar.tsx` | Calendrier pour sélection de date (react-day-picker) |
| `DatePicker` | `date-picker.tsx` | Sélecteur de date combinant Popover + Calendar |
| `InputOTP` | `input-otp.tsx` | Saisie de code OTP |
| `SearchableBadgeSelect` | `searchable-badge-select.tsx` | Sélecteur avec recherche et badges |

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="nom@exemple.fr" />
```

### Affichage de données

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Card` | `card.tsx` | Conteneur avec header, content, footer |
| `Table` | `table.tsx` | Tableau HTML accessible avec header, body, row, cell |
| `Avatar` | `avatar.tsx` | Avatar utilisateur avec initiales ou image |
| `AvatarGroup` | `avatar-group.tsx` | Groupe d'avatars empilés |
| `ExpandableAvatarGroup` | `expandable-avatar-group.tsx` | Groupe d'avatars avec expansion au survol |
| `Skeleton` | `skeleton.tsx` | Placeholder de chargement animé |
| `Separator` | `separator.tsx` | Séparateur horizontal ou vertical |
| `Chart` | `chart.tsx` | Wrapper pour Recharts avec thème intégré |
| `Pagination` | `pagination.tsx` | Navigation paginée |
| `TruncatedCell` | `truncated-cell.tsx` | Cellule avec troncature et tooltip au survol |

### Navigation et structure

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Tabs` | `tabs.tsx` | Onglets de navigation Radix |
| `Accordion` | `accordion.tsx` | Panneaux dépliables |
| `Collapsible` | `collapsible.tsx` | Section repliable |
| `ScrollArea` | `scroll-area.tsx` | Zone de défilement personnalisée |
| `Resizable` | `resizable.tsx` | Panneaux redimensionnables (react-resizable-panels) |
| `Sidebar` | `sidebar.tsx` | Sidebar de navigation avec modes collapsed/icons/hybrid/expanded |
| `Command` | `command.tsx` | Palette de commandes (cmdk) |

### Overlays et dialogues

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Dialog` | `dialog.tsx` | Dialogue modal Radix |
| `AlertDialog` | `alert-dialog.tsx` | Dialogue de confirmation |
| `Sheet` | `sheet.tsx` | Panneau latéral glissant |
| `Popover` | `popover.tsx` | Popover positionnée |
| `Tooltip` | `tooltip.tsx` | Info-bulle au survol |
| `HoverCard` | `hover-card.tsx` | Carte d'aperçu au survol |
| `DropdownMenu` | `dropdown-menu.tsx` | Menu déroulant Radix |
| `ContextMenu` | `context-menu.tsx` | Menu contextuel (clic droit) |

### Feedback

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Toast` | `toast.tsx` | Notification temporaire |
| `Toaster` | `toaster.tsx` | Conteneur de toasts |
| `Loader` | `Loader.tsx` | Spinner de chargement |

---

## Composants métier dans ui/

Au-delà des composants shadcn/ui de base, le dossier `ui/` contient également des composants métier spécifiques.

### Badges métier

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `GestionnaireBadge` | `gestionnaire-badge.tsx` | Badge gestionnaire avec couleur et initiales |
| `ArtisanStatusBadge` | `ArtisanStatusBadge.tsx` | Badge statut artisan avec couleur sémantique |
| `ArtisanDossierStatusIcon` | `ArtisanDossierStatusIcon.tsx` | Icone statut dossier artisan (complet/incomplet) |

### Composants spécialisés

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `DealCard` | `DealCard.tsx` | Carte Kanban pour une intervention |
| `Kanban` | `kanban.tsx` | Infrastructure Kanban (colonnes, drag & drop) |
| `PageSearchBar` | `page-search-bar.tsx` | Barre de recherche globale dans le topbar |
| `SectionLock` | `SectionLock.tsx` | Verrouillage de section (permissions) |
| `ModeSelector` | `mode-selector/` | Sélecteur de mode d'affichage modal |

---

## Système Modal (ui/modal/)

Le système modal est construit sur une architecture en couches.

### GenericModal

```
src/components/ui/modal/
  GenericModal.tsx          # Base : animation Framer Motion, FocusTrap, détection changements non sauvegardés
  GenericModalContent.tsx   # Contenu wrapper avec scroll et layout
  index.ts                 # Re-exports
```

GenericModal gère :
- 3 modes d'affichage : `halfpage` (50% droite), `centerpage` (centré), `fullpage` (plein écran)
- Animations d'entrée/sortie via Framer Motion
- Piège de focus (focus-trap-react)
- Dialogue de confirmation si changements non sauvegardés

### InterventionModal (ui/intervention-modal/)

```
src/components/ui/intervention-modal/
  InterventionModal.tsx              # Orchestrateur : routing mode view/edit/create
  InterventionModalContent.tsx       # Vue détail intervention
  NewInterventionModalContent.tsx    # Formulaire création intervention
  index.ts
```

### ArtisanModal (ui/artisan-modal/)

```
src/components/ui/artisan-modal/
  ArtisanModal.tsx                   # Orchestrateur artisan
  ArtisanModalContent.tsx            # Vue détail artisan
  NewArtisanModalContent.tsx         # Formulaire création artisan
  ArtisanFinancesSection.tsx         # Section finances (coûts, marges)
  ArtisanInterventionsTable.tsx      # Tableau interventions liées
  index.ts
```

### Hiérarchie de composition

```
GenericModal (base)
  InterventionModal (orchestrateur)
    InterventionModalContent (vue détail)
    NewInterventionModalContent (création)
  ArtisanModal (orchestrateur)
    ArtisanModalContent (vue détail)
    NewArtisanModalContent (création)
```

---

## Conventions d'import

Tous les composants shadcn/ui s'importent depuis `@/components/ui/` :

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
```

Les composants modaux s'importent depuis leur sous-dossier :

```tsx
import { InterventionModal } from "@/components/ui/intervention-modal"
import { ArtisanModal } from "@/components/ui/artisan-modal"
import { GenericModal } from "@/components/ui/modal"
```

---

## Dépendances

| Package | Usage |
|---------|-------|
| `@radix-ui/*` (20+ packages) | Primitives accessibles (Dialog, Popover, Select, etc.) |
| `class-variance-authority` | Variantes de composants |
| `clsx` + `tailwind-merge` | Fusion de classes CSS |
| `cmdk` | Palette de commandes |
| `react-day-picker` | Composant Calendar |
| `react-resizable-panels` | Panneaux redimensionnables |
| `framer-motion` | Animations modal |
| `focus-trap-react` | Piège de focus pour modals |
| `lucide-react` | Icones |
