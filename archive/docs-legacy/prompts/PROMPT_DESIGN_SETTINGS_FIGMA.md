# Brief Design - Page Settings / Paramètres

## Contexte
Page de paramètres du CRM avec navigation par onglets (Profile, Interface, Team, Security). La page doit respecter des contraintes strictes de scroll et de hauteur pour une expérience utilisateur optimale.

## Structure générale

### Hiérarchie des éléments (de haut en bas)

1. **Topbar (fixe, en dehors de la page settings)**
   - Hauteur : 64px (4rem)
   - Position : `fixed top-0`
   - Couvre toute la largeur de l'écran
   - Contient le logo, la recherche, et les actions principales

2. **Barre de navigation SettingsNav (sticky)**
   - Position : `sticky top-0` (reste fixe sous la topbar lors du scroll)
   - Hauteur : ~56px (incluant padding vertical)
   - Largeur : même largeur que le contenu de la page (voir contraintes ci-dessous)
   - Style : fond blanc/background, bordure inférieure, ombre légère
   - Contenu : 4 onglets (Profile, Interface, Team, Security) en grille responsive
   - Z-index : 40 (pour rester au-dessus du contenu)

3. **Zone de contenu scrollable**
   - Position : sous la barre de navigation
   - Comportement : scroll vertical uniquement
   - Hauteur : prend tout l'espace restant (100vh - topbar - SettingsNav)
   - Pas de scroll de la page entière, uniquement cette zone

## Contraintes de largeur et espacement

### Largeur maximale du contenu
- **Largeur max** : `max-w-5xl` (1024px)
- **Centrage** : `mx-auto` (centré horizontalement)
- **Padding horizontal** : `px-4` (16px de chaque côté)
- La barre de navigation SettingsNav doit avoir **exactement la même largeur** que le contenu de la page

### Structure de la barre de navigation
```
┌─────────────────────────────────────────────────────────┐
│  [Container sticky - fond + bordure]                    │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [Container max-w-5xl mx-auto px-4]                │ │
│  │  ┌─────────────────────────────────────────────┐  │ │
│  │  │ [Tabs - Profile | Interface | Team | Security] │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Structure du contenu
```
┌─────────────────────────────────────────────────────────┐
│  [Container scrollable - flex-1 overflow-auto]         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [Container px-4]                                   │ │
│  │  ┌─────────────────────────────────────────────┐  │ │
│  │  │ [Section max-w-5xl mx-auto py-6]            │  │ │
│  │  │  [Contenu de la page]                        │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Comportements et interactions

### Scroll
- **Pas de scroll de la page entière** : la page doit faire exactement 100vh max
- **Scroll uniquement dans la zone de contenu** : seule la zone sous SettingsNav doit scroller
- La barre SettingsNav reste **toujours visible** en haut lors du scroll

### Responsive
- Sur mobile : les onglets passent en grille 2 colonnes (`grid-cols-2`)
- Sur desktop : les onglets sont en grille 4 colonnes (`sm:grid-cols-4`)
- La largeur max (`max-w-5xl`) s'adapte automatiquement

## Spécifications techniques

### Hauteurs
- Topbar : 64px (4rem) - fixe
- SettingsNav : ~56px (incluant padding py-3 = 12px top + 12px bottom + hauteur TabsList ~32px)
- Zone de contenu : `calc(100vh - 64px - 56px)` = espace restant

### Espacements
- Padding horizontal global : 16px (`px-4`)
- Padding vertical du contenu : 24px (`py-6`)
- Espacement entre sections : 24px (`space-y-6`)

### Couleurs et styles
- Fond SettingsNav : `bg-background` (blanc/background selon thème)
- Bordure : `border-b` (bordure inférieure)
- Ombre : `shadow-sm` (ombre légère)
- Z-index SettingsNav : 40

## Exigences critiques

1. ✅ **La barre SettingsNav doit être sticky** : elle reste fixe sous la topbar lors du scroll
2. ✅ **Même largeur** : SettingsNav et contenu doivent avoir exactement la même largeur max (`max-w-5xl`)
3. ✅ **Pas de scroll de page** : la page entière ne doit jamais scroller, uniquement la zone de contenu
4. ✅ **Hauteur 100%** : la page doit utiliser 100vh max, pas plus
5. ✅ **Alignement parfait** : le contenu et la barre doivent être parfaitement alignés horizontalement

## Sections de contenu (exemple pour Interface)

1. **Theme Configuration** (Card)
   - Mode d'affichage (Clair/Sombre/Système) avec prévisualisations visuelles
   - Couleur d'accent avec présélections et option personnalisée

2. **Sidebar Configuration** (Card)
   - Toggle sidebar active/inactive
   - 3 modes visuels avec animations (Collapsed/Hybrid/Expanded)

3. **Préférences d'affichage des Modals** (Card)
   - 3 modes avec animations visuelles (Aperçu latéral/Centré/Pleine page)

4. **Réinitialiser les vues des interventions** (Card)
   - En bas de page

## Notes pour le designer

- Utiliser des composants de design system cohérents (Cards, Tabs, Buttons)
- Les animations visuelles dans les Cards doivent être subtiles mais claires
- Respecter les espacements et les alignements pour une cohérence visuelle
- Tester le comportement sticky sur différentes hauteurs de contenu
- Vérifier l'alignement horizontal entre SettingsNav et contenu sur différentes largeurs d'écran

