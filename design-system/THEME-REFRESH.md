# GMBS CRM - Theme Refresh Guide

> De "Boring Gray" à "Professional Blue-Green Glass"

---

## Objectif

Transformer le thème Light Mode pour:
- **Fond**: Bleu clair subtil (inspiré du logo GMBS)
- **Cards/Tables**: Blanc pur ou Glass pour contraste
- **Accent/CTA**: Vert émeraude professionnel
- **Conserver**: Toutes les couleurs métier (statuts, agences, métiers, users)

---

## Palette Proposée

### Fond d'application (Background)

| Token | Avant (Gray) | Après (Blue) | HSL |
|-------|--------------|--------------|-----|
| `--bg-dark` | `#E8EAED` | `#E3EDF7` | `210 45% 93%` |
| `--bg` | `#F4F5F7` | `#EDF4FA` | `210 50% 96%` |
| `--bg-light` | `#FAFBFC` | `#F5F9FD` | `210 60% 98%` |

### Surfaces (Cards, Tables, Panels)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--card` | `0 0% 100%` | Cards blanches pures |
| `--card-glass` | `rgba(255,255,255,0.85)` | Glass effect subtil |
| `--table-bg` | `0 0% 100%` | Fond des tableaux |

### Accent Principal (Vert Émeraude)

| Token | Valeur | HSL |
|-------|--------|-----|
| `--accent-primary` | `#10B981` | `160 84% 39%` |
| `--accent-hover` | `#059669` | `161 94% 30%` |
| `--accent-light` | `#D1FAE5` | `152 76% 90%` |

### Bleu Marque (pour éléments secondaires)

| Token | Valeur | HSL |
|-------|--------|-----|
| `--brand-blue` | `#2563EB` | `220 91% 54%` |
| `--brand-blue-light` | `#DBEAFE` | `214 95% 93%` |

---

## Variables CSS à modifier

### Dans `app/globals.css` - Section `:root`

```css
:root {
  /* === NOUVEAU FOND BLEU SUBTIL === */
  --bg-dark-hsl: 210 45% 93%;      /* Était: 210 6% 92% */
  --bg-hsl: 210 50% 96%;           /* Était: 210 6% 96% */
  --bg-light-hsl: 210 60% 98%;     /* Était: 210 10% 99% */

  /* OKLCH versions */
  --bg-dark: oklch(0.93 0.02 230);
  --bg: oklch(0.96 0.02 230);
  --bg-light: oklch(0.98 0.01 230);

  /* === NOUVEAU ACCENT VERT === */
  --accent-hsl: 160 84% 39%;       /* Était: 270 75% 36% (violet) */
  --accent-color: oklch(0.70 0.17 165);
  --accent-color-light: oklch(0.90 0.08 165);

  /* === CARDS BLANCHES POUR CONTRASTE === */
  --card: 0 0% 100%;               /* Blanc pur */
  --card-foreground: var(--text-hsl);

  /* === PRIMARY = VERT (CTA) === */
  --primary: 160 84% 39%;
  --primary-foreground: 0 0% 100%;

  /* === SECONDARY = BLEU MARQUE === */
  --secondary: 220 91% 54%;
  --secondary-foreground: 0 0% 100%;

  /* === RING/FOCUS = VERT === */
  --ring: 160 84% 39%;

  /* === SIDEBAR BLEU PLUS MARQUÉ === */
  --sidebar-background: 210 50% 94%;
  --sidebar-border: 210 30% 88%;

  /* Charts mis à jour */
  --chart-1: 160 84% 39%;  /* Vert (principal) */
  --chart-2: 220 91% 54%;  /* Bleu marque */
  --chart-3: 32 95% 44%;   /* Orange (inchangé) */
  --chart-4: 270 58% 55%;  /* Violet */
  --chart-5: 45 93% 47%;   /* Jaune */
}
```

---

## Glass Effect pour Cards

### Ajouter dans `globals.css`

```css
/* === GLASS CARDS (Light Mode) === */
.card-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    0 4px 6px rgba(37, 99, 235, 0.04),
    0 10px 20px rgba(37, 99, 235, 0.06);
}

.card-glass:hover {
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 6px 12px rgba(37, 99, 235, 0.06),
    0 16px 32px rgba(37, 99, 235, 0.08);
}

/* Table container glass */
.table-glass {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

/* Sidebar glass subtil */
.sidebar-glass {
  background: rgba(237, 244, 250, 0.8);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(37, 99, 235, 0.08);
}

/* Input fields sur fond bleu */
[data-theme="light"] .input-on-blue {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(37, 99, 235, 0.15);
}

[data-theme="light"] .input-on-blue:focus {
  background: white;
  border-color: hsl(160 84% 39%);
}
```

---

## Gradients Subtils (optionnel)

```css
/* Fond avec gradient subtil */
.bg-gradient-blue {
  background: linear-gradient(
    135deg,
    hsl(210 50% 96%) 0%,
    hsl(210 55% 94%) 50%,
    hsl(210 45% 97%) 100%
  );
}

/* Header avec touche de vert */
.header-gradient {
  background: linear-gradient(
    90deg,
    hsl(210 50% 96%) 0%,
    hsl(180 40% 96%) 100%
  );
}
```

---

## Bordures Colorées

```css
/* Bordures subtiles bleutées */
:root {
  --border-hsl: 210 30% 90%;       /* Était: 210 10% 96% */
  --border: oklch(0.92 0.02 230);
}

/* Bordure de card avec touche de couleur */
.card-accent-border {
  border-left: 3px solid hsl(160 84% 39%);
}

.card-blue-border {
  border-left: 3px solid hsl(220 91% 54%);
}
```

---

## Shadows Colorées

```css
:root {
  /* Ombres avec teinte bleue */
  --shadow-xs: 0 1px 2px rgba(37, 99, 235, 0.06);
  --shadow-sm: 0 2px 4px rgba(37, 99, 235, 0.06), 0 6px 12px rgba(37, 99, 235, 0.04);
  --shadow-md: 0 4px 6px rgba(37, 99, 235, 0.08), 0 12px 20px rgba(37, 99, 235, 0.06);
  --shadow-lg: 0 8px 12px rgba(37, 99, 235, 0.10), 0 24px 32px rgba(37, 99, 235, 0.08);

  /* Ombre verte pour éléments accent */
  --shadow-accent: 0 4px 14px rgba(16, 185, 129, 0.25);
}

/* Bouton CTA avec glow vert */
.btn-glow {
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
}

.btn-glow:hover {
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}
```

---

## Résumé des changements

### Ce qui CHANGE (Thème Global)

| Élément | Avant | Après |
|---------|-------|-------|
| Fond principal | Gris neutre `#F4F5F7` | Bleu clair `#EDF4FA` |
| Cards | Gris très clair | Blanc pur + glass |
| Accent/CTA | Violet `#7C3AED` | Vert `#10B981` |
| Bordures | Gris `#E5E7EB` | Bleu subtil `#D6E4F0` |
| Ombres | Noir/gris | Teintées bleu |
| Focus ring | Violet | Vert |

### Ce qui NE CHANGE PAS (Couleurs Métier)

- ✅ Couleurs de statuts (Demandé, En cours, Terminé, etc.)
- ✅ Couleurs d'agences
- ✅ Couleurs de métiers
- ✅ Couleurs de rôles/users
- ✅ Couleurs de classement (Gold, Silver, Bronze)
- ✅ Couleurs sémantiques (Success, Error, Warning, Info)

---

## Implémentation Étape par Étape

### 1. Backup

```bash
cp app/globals.css app/globals.css.backup
```

### 2. Modifier les variables de fond

Dans `:root` de `globals.css`, remplacer les `--bg-*` par les nouvelles valeurs bleues.

### 3. Modifier l'accent

Remplacer `--accent-hsl: 270 75% 36%` par `--accent-hsl: 160 84% 39%`.

### 4. Ajouter les classes glass

Ajouter les classes `.card-glass`, `.table-glass`, etc.

### 5. Tester

- Vérifier le contraste texte/fond (minimum 4.5:1)
- Vérifier que les couleurs métier ressortent toujours bien
- Tester en mode sombre (ne devrait pas être impacté)

---

## Preview Rapide

Pour tester rapidement dans le navigateur DevTools:

```javascript
// Coller dans la console pour preview
document.documentElement.style.setProperty('--bg-hsl', '210 50% 96%');
document.documentElement.style.setProperty('--bg-dark-hsl', '210 45% 93%');
document.documentElement.style.setProperty('--bg-light-hsl', '210 60% 98%');
document.documentElement.style.setProperty('--accent-hsl', '160 84% 39%');
document.documentElement.style.setProperty('--primary', '160 84% 39%');
document.documentElement.style.setProperty('--card', '0 0% 100%');
```

---

## Variantes Possibles

### Option A: Bleu Plus Intense
```css
--bg-hsl: 210 60% 95%;
```

### Option B: Vert-Bleu (Teal)
```css
--bg-hsl: 190 45% 96%;
--accent-hsl: 175 80% 35%;
```

### Option C: Bleu Très Subtil (Safe)
```css
--bg-hsl: 210 35% 97%;
```
