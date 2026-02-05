# GMBS CRM - Design System

> Version 1.0 | Stack: Next.js 15 + Tailwind CSS + shadcn/ui

---

## 1. Fondations

### Style Principal: **Professional Trust**

| Attribut | Valeur |
|----------|--------|
| Personnalité | Professionnel, fiable, efficace |
| Audience | Gestionnaires d'interventions, artisans |
| Densité | Haute (font-size: 12px base) |
| Mode | Light par défaut, Dark supporté |

### Anti-patterns

- Emojis comme icônes (utiliser Lucide React)
- Gradients flashy (rester sobre)
- Animations excessives (respecter `prefers-reduced-motion`)
- Surcharge visuelle (le CRM doit être scannable)

---

## 2. Couleurs

### Palette Principale

```css
/* Accent (violet professionnel) */
--accent-hsl: 270 75% 36%;        /* Light mode */
--accent-hsl: 270 58% 68%;        /* Dark mode */
```

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg-background` | `hsl(210 6% 96%)` | `hsl(220 12% 16%)` | Fond principal |
| `bg-card` | `hsl(210 10% 99%)` | `hsl(220 10% 24%)` | Cards, panels |
| `bg-muted` | `hsl(210 6% 92%)` | `hsl(220 14% 8%)` | Zones secondaires |
| `text-foreground` | `hsl(220 15% 14%)` | `hsl(0 0% 96%)` | Texte principal |
| `text-muted-foreground` | `hsl(220 10% 40%)` | `hsl(220 12% 66%)` | Texte secondaire |
| `border` | `hsl(210 10% 96%)` | `hsl(220 12% 30%)` | Bordures |
| `bg-primary` | `hsl(270 75% 36%)` | `hsl(270 58% 68%)` | Actions principales |
| `bg-destructive` | `hsl(12 88% 54%)` | `hsl(8 78% 64%)` | Erreurs, suppressions |

### Couleurs Sémantiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `--success` | `oklch(0.68 0.18 130)` | Validation, terminé |
| `--error` | `oklch(0.55 0.23 20)` | Erreurs |
| `--warning` | `oklch(0.72 0.20 85)` | Alertes |
| `--info` | `oklch(0.60 0.19 240)` | Information |

### Couleurs de Statut (Interventions)

| Statut | Background | Foreground | Classe |
|--------|------------|------------|--------|
| Demandé | `210 40% 98%` | `215 16% 35%` | `status-Demandé` |
| Devis Envoyé | `210 40% 96%` | `221 39% 28%` | `status-Devis_Envoyé` |
| Accepté | `142 76% 97%` | `142 50% 32%` | `status-Accepté` |
| En cours | `48 96% 96%` | `32 95% 44%` | `status-En_cours` |
| Visite Technique | `199 89% 96%` | `199 84% 35%` | `status-Visite_Technique` |
| Terminé | `151 81% 95%` | `160 84% 24%` | `status-Terminé` |
| Annulé | `0 93% 95%` | `0 72% 45%` | `status-Annulé` |
| Refusé | `343 76% 96%` | `343 72% 40%` | `status-Refusé` |
| Stand By | `28 100% 96%` | `28 85% 45%` | `status-STAND_BY` |
| SAV | `252 95% 96%` | `252 83% 45%` | `status-SAV` |

### Couleurs de Classement (Artisans)

| Rang | Couleur | Glow |
|------|---------|------|
| Gold | `45 100% 51%` | `45 100% 65%` |
| Silver | `0 0% 75%` | `0 0% 85%` |
| Bronze | `25 75% 47%` | `25 75% 60%` |
| Cold | `200 70% 50%` | `200 70% 65%` |

### Charts

```css
--chart-1: 300 65% 52%;  /* Violet */
--chart-2: 130 60% 48%;  /* Vert */
--chart-3: 20 78% 54%;   /* Orange */
--chart-4: 210 60% 46%;  /* Bleu */
--chart-5: 48 92% 60%;   /* Jaune */
```

---

## 3. Typographie

### Police Système

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Échelle

| Niveau | Taille | Line-height | Usage |
|--------|--------|-------------|-------|
| `text-xs` | 10px | 1.5 | Labels secondaires, badges |
| `text-sm` | 11px | 1.5 | Texte secondaire, méta |
| `text-base` | 12px | 1.5 | Texte principal (body) |
| `text-lg` | 14px | 1.5 | Sous-titres |
| `text-xl` | 16px | 1.4 | Titres de section |
| `text-2xl` | 20px | 1.3 | Titres de page |
| `text-3xl` | 24px | 1.2 | Hero titles |

### Poids

| Poids | Usage |
|-------|-------|
| `font-normal` (400) | Body text |
| `font-medium` (500) | Labels, boutons |
| `font-semibold` (600) | Titres de cartes |
| `font-bold` (700) | Titres principaux |

---

## 4. Espacements

### Échelle de spacing

| Token | Valeur | Usage |
|-------|--------|-------|
| `gap-1` | 4px | Espacement minimal (icons + text) |
| `gap-2` | 8px | Espacement interne cards |
| `gap-3` | 12px | Entre éléments de form |
| `gap-4` | 16px | Entre sections |
| `gap-6` | 24px | Entre cards |
| `gap-8` | 32px | Entre sections majeures |

### Padding des conteneurs

| Élément | Padding |
|---------|---------|
| Card | `p-4` (16px) |
| Modal | `p-6` (24px) |
| Sidebar | `p-4` |
| Page content | `p-6` |

---

## 5. Rayons de bordure

```css
--radius-sm: 6px;   /* Inputs, badges */
--radius-md: 10px;  /* Cards, boutons */
--radius-lg: 14px;  /* Modals, panels */
--radius-xl: 20px;  /* Large containers */
```

| Composant | Rayon |
|-----------|-------|
| Button | `rounded-md` |
| Input | `rounded-md` |
| Card | `rounded-lg` |
| Badge/Chip | `rounded-full` |
| Modal | `rounded-lg` |

---

## 6. Ombres

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.10);
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.10), 0 6px 12px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.12), 0 12px 20px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 12px rgba(0, 0, 0, 0.14), 0 24px 32px rgba(0, 0, 0, 0.10);
--shadow-xl: 0 12px 16px rgba(0, 0, 0, 0.16), 0 32px 48px rgba(0, 0, 0, 0.12);
```

| Composant | Ombre |
|-----------|-------|
| Card (repos) | `shadow-sm` |
| Card (hover) | `shadow-md` |
| Dropdown | `shadow-lg` |
| Modal | `shadow-xl` |

---

## 7. Animations & Transitions

### Durées

```css
--transition-fast: 150ms;   /* Hover states */
--transition-base: 250ms;   /* Micro-interactions */
--transition-slow: 350ms;   /* Page transitions */
```

### Easing

```css
--transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
```

### Classes utilitaires

```css
transition-colors duration-200    /* Changements de couleur */
transition-shadow duration-200    /* Hover cards */
transition-transform duration-200 /* Scales, translations */
```

### Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .animated-gradient, [data-animated-bg="true"] {
    animation: none !important;
  }
}
```

---

## 8. Composants Standards

### Boutons

| Variant | Classes |
|---------|---------|
| Primary | `bg-primary text-primary-foreground hover:bg-primary/90` |
| Secondary | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| Destructive | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| Outline | `border border-input bg-background hover:bg-accent` |
| Ghost | `hover:bg-accent hover:text-accent-foreground` |

### Cards

```tsx
<Card className="bg-card shadow-sm hover:shadow-md transition-shadow">
  <CardHeader className="pb-2">
    <CardTitle className="text-lg font-semibold">Titre</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Contenu */}
  </CardContent>
</Card>
```

### Status Chips

```tsx
<span className="status-chip status-En_cours">
  En cours
</span>
```

### Glass Panels (Dark theme)

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px) saturate(1.08);
}
```

---

## 9. Layout Patterns

### Dashboard Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

### Table Responsive

```tsx
<div className="overflow-x-auto">
  <Table>
    {/* ... */}
  </Table>
</div>
```

Variable CSS pour la hauteur de table:
```css
--table-view-offset: 200px;
```

### Sidebar + Main Content

```tsx
<div className="flex h-screen">
  <aside className="w-64 border-r bg-sidebar">
    {/* Navigation */}
  </aside>
  <main className="flex-1 overflow-auto p-6">
    {/* Content */}
  </main>
</div>
```

---

## 10. Icônes

### Bibliothèque: Lucide React

```tsx
import { Plus, Edit, Trash2, ChevronDown } from 'lucide-react'
```

### Tailles standards

| Context | Classe |
|---------|--------|
| Dans bouton | `w-4 h-4` |
| Standalone | `w-5 h-5` |
| Navigation | `w-5 h-5` |
| Hero/Feature | `w-8 h-8` |

### Couleurs

```tsx
<Icon className="text-muted-foreground" />     // Icône secondaire
<Icon className="text-foreground" />           // Icône principale
<Icon className="text-primary" />              // Icône accent
<Icon className="text-destructive" />          // Icône danger
```

---

## 11. Formulaires

### Labels

```tsx
<Label htmlFor="email" className="text-sm font-medium">
  Email <span className="text-destructive">*</span>
</Label>
```

### Inputs

```tsx
<Input
  type="email"
  id="email"
  className="border-input focus:ring-2 focus:ring-ring"
  autoComplete="email"
/>
```

### Validation

- Valider `onBlur` pour la plupart des champs
- Messages d'erreur sous le champ en `text-destructive text-sm`
- Indicateur `*` pour les champs requis

### États de soumission

```tsx
<Button disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      Envoi...
    </>
  ) : (
    'Envoyer'
  )}
</Button>
```

---

## 12. Accessibilité

### Contraste minimum

- Texte normal: 4.5:1
- Texte large: 3:1
- Éléments UI: 3:1

### Focus

```css
focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
```

### Attributs requis

| Élément | Attribut |
|---------|----------|
| Bouton icon-only | `aria-label` |
| Image informative | `alt` |
| Input | `<label>` avec `htmlFor` |
| Dialog | `aria-modal`, `aria-labelledby` |

### Navigation clavier

- Tab order logique (gauche → droite, haut → bas)
- Escape pour fermer modals/dropdowns
- Enter/Space pour activer boutons

---

## 13. Charts & Data Viz

### Bibliothèque recommandée

- Recharts (intégré shadcn/ui)
- ApexCharts (alternatives)

### Types de graphiques par usage

| Donnée | Chart recommandé |
|--------|------------------|
| Évolution temps | Line Chart, Area Chart |
| Comparaison | Bar Chart |
| Distribution | Pie/Donut (max 5 segments) |
| Hiérarchie | Treemap |
| Flow | Sankey Diagram |

### Couleurs charts

Utiliser les tokens `--chart-1` à `--chart-5` pour garantir la cohérence.

---

## 14. Checklist Pré-livraison

### Visuel

- [ ] Pas d'emojis comme icônes
- [ ] Icônes cohérentes (Lucide)
- [ ] Hover states avec `cursor-pointer`
- [ ] Transitions smooth (150-300ms)

### Accessibilité

- [ ] Contraste texte 4.5:1 minimum
- [ ] Focus visible sur tous les interactifs
- [ ] Labels sur tous les inputs
- [ ] Alt text sur les images

### Responsive

- [ ] Test à 375px (mobile)
- [ ] Test à 768px (tablet)
- [ ] Test à 1024px (laptop)
- [ ] Test à 1440px (desktop)
- [ ] Pas de scroll horizontal

### Dark Mode

- [ ] Toutes les couleurs utilisent des tokens
- [ ] Glass/transparent visible en light mode
- [ ] Bordures visibles dans les deux modes

---

## 15. Fichiers de référence

| Fichier | Contenu |
|---------|---------|
| `app/globals.css` | Variables CSS, classes utilitaires |
| `src/styles/tokens.css` | Tokens de statuts |
| `tailwind.config.ts` | Configuration Tailwind étendue |
| `components/ui/*` | Composants shadcn/ui |

---

*Dernière mise à jour: Février 2025*
