# GMBS-CRM Liquid Glass Design System

## Vue d'ensemble

Le système de design **Liquid Glass** apporte une esthétique moderne et fluide à l'interface GMBS-CRM, tout en préservant les couleurs métier existantes (statuts, accent violet, leaderboard, charts).

## Principes de design

### Glassmorphism
- Surfaces translucides avec effet de flou (backdrop-filter)
- Bordures lumineuses subtiles
- Reflets internes (highlights)
- Ombres douces et diffuses
- Transitions fluides

### Background bleu GMBS (Light Mode)
En mode clair, l'application utilise un dégradé bleu subtil basé sur les couleurs du logo GMBS (`#3371B2`) pour apporter du contraste :

```css
--app-bg-gradient: linear-gradient(
  135deg,
  hsl(210 50% 97%) 0%,
  hsl(210 45% 94%) 25%,
  hsl(215 40% 92%) 50%,
  hsl(220 35% 94%) 75%,
  hsl(210 50% 96%) 100%
);
```

Le dark mode conserve un background sombre classique sans gradient.

### Préservation des couleurs
Toutes les couleurs métier sont conservées :
- **Accent** : Violet `270 75% 36%` (light) / `270 58% 68%` (dark)
- **Logo GMBS** : Bleu `#3371B2` (210 52% 45%)
- **Statuts** : Demandé, Devis Envoyé, Accepté, En cours, etc.
- **Leaderboard** : Gold, Silver, Bronze, Cold
- **Charts** : 5 couleurs distinctes
- **Sémantique** : Success, Error, Warning, Info

---

## Variables CSS

### Backgrounds Glass

| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--glass-bg-subtle` | `rgba(255,255,255,0.45)` | `rgba(255,255,255,0.04)` | Backgrounds très légers |
| `--glass-bg-light` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.06)` | Panneaux légers |
| `--glass-bg-medium` | `rgba(255,255,255,0.65)` | `rgba(255,255,255,0.08)` | Cards standard |
| `--glass-bg-strong` | `rgba(255,255,255,0.75)` | `rgba(255,255,255,0.12)` | Surfaces hover |
| `--glass-bg-solid` | `rgba(255,255,255,0.88)` | `rgba(255,255,255,0.16)` | Modales, tooltips |

### Borders Glass

| Variable | Description |
|----------|-------------|
| `--glass-border-subtle` | Bordure à peine visible |
| `--glass-border-light` | Bordure légère standard |
| `--glass-border-medium` | Bordure visible |
| `--glass-border-strong` | Bordure prononcée |
| `--glass-border-accent` | Bordure très lumineuse |

### Shadows Glass

| Variable | Usage |
|----------|-------|
| `--glass-shadow-sm` | Petits éléments |
| `--glass-shadow-md` | Cards |
| `--glass-shadow-lg` | Dropdowns, popovers |
| `--glass-shadow-xl` | Modales |

### Glows

| Variable | Usage |
|----------|-------|
| `--glass-glow-accent` | Glow couleur accent |
| `--glass-glow-white` | Glow blanc subtil |
| `--glass-glow-hover` | Glow hover intensifié |

### Blur

| Variable | Valeur Light | Valeur Dark |
|----------|--------------|-------------|
| `--glass-blur-sm` | 8px | 10px |
| `--glass-blur-md` | 12px | 16px |
| `--glass-blur-lg` | 20px | 24px |
| `--glass-blur-xl` | 32px | 40px |

---

## Classes CSS

### Composants Glass prédéfinis

```css
.glass-panel       /* Surface légère */
.glass-strong      /* Surface opaque */
.glass-card        /* Card avec hover lift */
.glass-subtle      /* Background très léger */
.glass-solid       /* Surface quasi-opaque */
.glass-button      /* Bouton secondaire */
.glass-input       /* Champ de formulaire */
.glass-modal       /* Dialogue/modale */
.glass-navbar      /* Barre de navigation */
.glass-sidebar     /* Barre latérale */
.glass-dropdown    /* Menu déroulant */
.glass-badge       /* Badge/chip */
.glass-table-header /* En-tête de tableau */
.glass-accent      /* Avec couleur accent */
.glass-accent-button /* Bouton primary accent */
```

### Utilitaires

```css
/* Blur */
.glass-blur-none | .glass-blur-sm | .glass-blur-md | .glass-blur-lg | .glass-blur-xl

/* Backgrounds */
.glass-bg-subtle | .glass-bg-light | .glass-bg-medium | .glass-bg-strong | .glass-bg-solid

/* Borders */
.glass-border-subtle | .glass-border-light | .glass-border-medium | .glass-border-strong

/* Shadows */
.glass-shadow-sm | .glass-shadow-md | .glass-shadow-lg | .glass-shadow-xl

/* Glows */
.glass-glow | .glass-glow-accent | .glass-glow-hover

/* Highlights */
.glass-highlight | .glass-highlight-strong | .glass-highlight-subtle

/* Effets combinés */
.glass-effect        /* blur + saturate standard */
.glass-effect-strong /* blur + saturate prononcé */

/* Interactions */
.glass-hover-lift    /* lift au hover */
.glass-interactive   /* états hover/active */

/* Décoratifs */
.glass-divider       /* séparateur gradient */
.glass-shine         /* ligne brillante en haut */
.glass-frosted       /* effet givré */
```

### Modales Premium

Le système de modal premium offre un rendu haut de gamme avec header/footer opaques et corps translucide.

```css
/* Container principal */
.glass-modal-premium    /* Modal avec structure header/body/footer */

/* Sections */
.glass-modal-header     /* Header opaque avec ligne de séparation */
.glass-modal-body       /* Corps translucide */
.glass-modal-body--translucent  /* Corps encore plus translucide */
.glass-modal-footer     /* Footer opaque avec ligne de séparation */

/* Inputs premium */
.glass-modal-input      /* Input bien visible dans le modal */

/* Utilitaires */
.glass-modal-divider    /* Séparateur gradient */
```

**Variables spécifiques aux modales :**

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--modal-header-bg` | `rgba(255,255,255,0.92)` | `rgba(30,35,45,0.95)` |
| `--modal-footer-bg` | `rgba(255,255,255,0.92)` | `rgba(30,35,45,0.95)` |
| `--modal-body-bg` | `rgba(255,255,255,0.35)` | `rgba(20,25,35,0.75)` |
| `--modal-input-bg` | `rgba(255,255,255,0.85)` | `rgba(40,45,55,0.90)` |

---

## Composants React

### Card

```tsx
import { Card } from "@/components/ui/card"

// Variantes disponibles
<Card variant="glass">...</Card>        // Défaut - glass standard
<Card variant="default">...</Card>      // Style solide classique
<Card variant="glass-subtle">...</Card> // Glass très léger
<Card variant="glass-strong">...</Card> // Glass opaque
<Card variant="glass-solid">...</Card>  // Glass quasi-solide
<Card variant="glass-accent">...</Card> // Glass avec teinte accent
```

### Button

```tsx
import { Button } from "@/components/ui/button"

// Variantes glass
<Button variant="default">...</Button>      // Glass accent (primary)
<Button variant="outline">...</Button>      // Glass outline
<Button variant="secondary">...</Button>    // Glass secondary
<Button variant="ghost">...</Button>        // Glass ghost
<Button variant="glass">...</Button>        // Glass neutre
<Button variant="glass-accent">...</Button> // Glass accent explicite
<Button variant="glass-subtle">...</Button> // Glass très subtil
```

### Input

```tsx
import { Input } from "@/components/ui/input"

// Variantes
<Input variant="glass" />    // Défaut - glass input
<Input variant="default" />  // Style solide classique
```

### Badge

```tsx
import { Badge } from "@/components/ui/badge"

// Nouvelles variantes glass
<Badge variant="glass">...</Badge>       // Glass neutre
<Badge variant="glass-accent">...</Badge> // Glass teinté accent
```

### Dialog (Modal Premium)

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Modal standard (glass classique)
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titre</DialogTitle>
    </DialogHeader>
    <p>Contenu...</p>
    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Modal Premium (header/footer opaques, corps translucide)
<Dialog>
  <DialogContent variant="premium">
    <DialogHeader variant="premium">
      <DialogTitle>Titre Premium</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <DialogBody translucent>
      {/* Corps translucide - les inputs restent visibles */}
      <Input placeholder="Champ visible" />
    </DialogBody>
    <DialogFooter variant="premium">
      <Button variant="outline">Annuler</Button>
      <Button>Confirmer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Props disponibles :**

| Composant | Prop | Valeurs | Description |
|-----------|------|---------|-------------|
| `DialogContent` | `variant` | `"default"`, `"premium"` | Style du modal |
| `DialogContent` | `hideCloseButton` | `boolean` | Masquer le bouton X |
| `DialogHeader` | `variant` | `"default"`, `"premium"` | Header opaque ou non |
| `DialogBody` | `translucent` | `boolean` | Corps plus translucide |
| `DialogFooter` | `variant` | `"default"`, `"premium"` | Footer opaque ou non |

---

## Bonnes pratiques

### Performance

1. **Limiter les layers** : Ne pas empiler trop d'éléments avec `backdrop-filter`
2. **Fallback** : Les styles dégradés sont fournis pour les navigateurs sans support
3. **prefers-reduced-motion** : Les animations sont respectueuses du paramètre système

### Accessibilité

1. **Contraste** : Les textes gardent un ratio 4.5:1 minimum
2. **Focus visible** : Les états focus sont préservés
3. **Pas de dépendance à la transparence** : Le contenu reste lisible même sans blur

### Cohérence

1. **Utiliser les classes prédéfinies** quand possible
2. **Éviter les valeurs arbitraires** pour les opacités et blur
3. **Respecter la hiérarchie** : subtle < light < medium < strong < solid

---

## Exemples d'utilisation

### Card avec contenu

```tsx
<Card variant="glass" className="p-6">
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Contenu de la card
  </CardContent>
</Card>
```

### Bouton avec glow

```tsx
<Button variant="default" className="glass-glow-hover">
  Action principale
</Button>
```

### Input dans un formulaire glass

```tsx
<div className="glass-card p-6">
  <Label htmlFor="email">Email</Label>
  <Input variant="glass" id="email" placeholder="email@example.com" />
</div>
```

### Dropdown personnalisé

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* Le style glass-dropdown est appliqué automatiquement */}
    <DropdownMenuItem>Option 1</DropdownMenuItem>
    <DropdownMenuItem>Option 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Migration depuis l'ancien design

Les composants existants utilisent maintenant le style glass par défaut. Pour revenir à l'ancien style solide :

```tsx
// Ancien style
<Card variant="default">...</Card>
<Button variant="default">...</Button>
<Input variant="default" />
```

Les classes CSS `.card`, `.button-primary`, `.button-secondary` ont été mises à jour pour utiliser le système glass.

---

## Support navigateur

Le glassmorphism nécessite le support de `backdrop-filter`. Un fallback est fourni pour les navigateurs non supportés (IE, anciens navigateurs).

| Navigateur | Support |
|------------|---------|
| Chrome 76+ | Oui |
| Firefox 103+ | Oui |
| Safari 9+ | Oui (avec préfixe) |
| Edge 79+ | Oui |
| IE | Fallback solide |
