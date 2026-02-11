# Prompt : Animation de transition login → dashboard avec effet de cercle révélateur

## Vue d'ensemble

Implémentation d'une animation de transition fluide entre la page de connexion et le dashboard utilisant un effet de cercle révélateur. **Navigation immédiate vers `/dashboard`** après authentification réussie, avec animation de révélation du dashboard depuis le bouton "Se connecter". La page login reste visible à l'extérieur du cercle via une iframe qui disparaît progressivement.

## Architecture technique

### Structure des couches (z-index)

L'animation utilise un système de couches empilées avec des z-index spécifiques :

1. **Iframe login (z-index: 90)** : Iframe contenant la page login, visible à l'extérieur du cercle avec un mask inversé, disparaît progressivement
2. **Dashboard contenu (z-index: 10)** : Page dashboard principale, révélée progressivement à l'intérieur du cercle avec `clipPath`

### Principe de fonctionnement

**Logique inversée par rapport à l'approche précédente** :
- ✅ **Navigation immédiate** : `router.replace('/dashboard')` dès l'authentification réussie
- ✅ **URL correcte** : L'URL change immédiatement vers `/dashboard` (pas de problème de reload/reconnexion)
- ✅ **Dashboard = page principale** : Le dashboard est la vraie page Next.js, pas une iframe
- ✅ **Login = iframe** : La page login est chargée dans une iframe pour l'animation
- ✅ **SessionStorage** : Position du bouton stockée dans `sessionStorage` pour passer de login à dashboard

### Composants impliqués

#### 1. Hook personnalisé : `useRevealTransition`

**Fichier** : `src/hooks/useRevealTransition.ts`

**Responsabilités** :
- Gérer l'état de l'animation (`isAnimating`)
- Calculer la taille maximale du cercle : `Math.sqrt(window.innerWidth² + window.innerHeight²)`
- Animer la taille du cercle avec Framer Motion (`useMotionValue` + `animate`)
- Courbe d'animation : `easeOutCubic` ([0.33, 1, 0.68, 1])
- Durée : 3 secondes (3000ms)
- Exposer la taille actuelle du cercle (`circleSize`) pour le mask de l'iframe

**API retournée** :
```typescript
{
  isAnimating: boolean
  circleSizeMotion: MotionValue<number>
  buttonPosition: { x: number, y: number } | null
  startAnimation: (buttonRef: RefObject<HTMLButtonElement>) => void
  startAnimationFromPosition: (position: ButtonPosition) => void
  maxCircleSize: number
  circleSize: number
}
```

#### 2. Page login modifiée

**Fichier** : `app/(auth)/login/page.tsx`

**Modifications principales** :
- **Suppression de l'iframe dashboard** : Plus besoin d'afficher le dashboard dans une iframe
- **Suppression des états d'animation** : Plus de `isAuthenticated`, `shouldPreloadDashboard`, etc.
- **Préchargement de l'iframe login** : Iframe cachée qui précharge `/login` pour être utilisée sur le dashboard
- **Stockage de la position** : Calcul et stockage de la position du bouton dans `sessionStorage` avant navigation
- **Navigation immédiate** : `router.replace('/dashboard')` dès l'authentification réussie

**Code clé** :
```typescript
// Calculer la position du bouton AVANT navigation
if (buttonRef.current) {
  const rect = buttonRef.current.getBoundingClientRect()
  const buttonPosition = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
  
  // Stocker dans sessionStorage
  sessionStorage.setItem('revealTransition', JSON.stringify({
    from: 'login',
    buttonPosition,
    timestamp: Date.now()
  }))
}

// Naviguer immédiatement
router.replace('/dashboard')
```

#### 3. Page dashboard modifiée

**Fichier** : `app/dashboard/page.tsx`

**Modifications principales** :
- **Détection de transition** : Vérifie `sessionStorage` pour détecter si on vient de login
- **Iframe login** : Affiche une iframe contenant `/login` avec mask inversé
- **Animation clipPath** : Applique un `clipPath` au contenu dashboard pour révélation progressive
- **Gestion de la fin** : Retire le clipPath et masque l'iframe après 3 secondes

**Code clé** :
```typescript
// Détecter la transition depuis login
useEffect(() => {
  const transitionData = sessionStorage.getItem('revealTransition')
  if (transitionData) {
    const data = JSON.parse(transitionData)
    if (data.from === 'login' && Date.now() - data.timestamp < 5000) {
      setButtonPosition(data.buttonPosition)
      setShowTransition(true)
      sessionStorage.removeItem('revealTransition')
      setTimeout(() => {
        startAnimationFromPosition(data.buttonPosition)
      }, 100)
    }
  }
}, [startAnimationFromPosition])
```

## Flux d'exécution détaillé

### Phase 1 : Initialisation sur la page login

1. **Au chargement de la page login** :
   - Iframe cachée précharge `/login` pour être utilisée sur le dashboard
   - Le hook `useRevealTransition` n'est pas utilisé sur la page login (seulement sur dashboard)

### Phase 2 : Authentification réussie

2. **Après soumission du formulaire et authentification réussie** :
   ```typescript
   // Calculer la position du bouton
   const rect = buttonRef.current.getBoundingClientRect()
   const buttonPosition = {
     x: rect.left + rect.width / 2,
     y: rect.top + rect.height / 2
   }
   
   // Stocker dans sessionStorage
   sessionStorage.setItem('revealTransition', JSON.stringify({
     from: 'login',
     buttonPosition,
     timestamp: Date.now()
   }))
   
   // Naviguer immédiatement vers dashboard
   router.replace('/dashboard')
   ```

3. **Navigation immédiate** :
   - L'URL change vers `/dashboard` immédiatement
   - Next.js commence à charger la page dashboard
   - La page login reste visible pendant le chargement (pas de flash blanc)

### Phase 3 : Détection et démarrage de l'animation sur dashboard

4. **Au chargement de la page dashboard** :
   - Vérification de `sessionStorage.getItem('revealTransition')`
   - Si les données sont présentes et récentes (< 5 secondes), démarrage de l'animation
   - Nettoyage immédiat de `sessionStorage`

5. **Démarrage de l'animation** :
   ```typescript
   setButtonPosition(data.buttonPosition)
   setShowTransition(true)
   setTimeout(() => {
     startAnimationFromPosition(data.buttonPosition)
   }, 100) // Délai pour laisser le DOM se charger
   ```

### Phase 4 : Animation du cercle (0-3000ms)

6. **Rendu des conteneurs** :
   - **Iframe login** (z-index: 90) : Affiche `/login` avec mask inversé (visible à l'extérieur du cercle)
   - **Dashboard contenu** (z-index: 10) : Contenu principal avec `clipPath` (visible à l'intérieur du cercle)

7. **Animation du clipPath pour le dashboard** :
   ```typescript
   circleSizeMotion.on('change', (size) => {
     const clipPath = `circle(${size}px at ${buttonPosition.x}px ${buttonPosition.y}px)`
     dashboardContentRef.current.style.clipPath = clipPath
     dashboardContentRef.current.style.webkitClipPath = clipPath
   })
   ```

8. **Animation du mask inversé pour l'iframe login** :
   ```typescript
   circleSizeMotion.on('change', (size) => {
     const mask = size === 0 
       ? 'black' // Tout visible au début
       : `radial-gradient(circle ${size}px at ${buttonPosition.x}px ${buttonPosition.y}px, transparent ${size}px, black ${size + 0.1}px)`
     loginIframeRef.current.style.mask = mask
     loginIframeRef.current.style.webkitMask = webkitMask
   })
   ```

9. **Effet visuel** :
   - Le cercle s'agrandit depuis le centre du bouton "Se connecter"
   - **À l'intérieur du cercle** : Le dashboard apparaît progressivement (clipPath)
   - **À l'extérieur du cercle** : La page login reste visible (mask inversé sur iframe)
   - Courbe d'animation `easeOutCubic` pour un effet naturel

### Phase 5 : Fin de l'animation (après 3000ms)

10. **Transition finale** :
    ```typescript
    setTimeout(() => {
      // Retirer le clipPath du dashboard
      dashboardContentRef.current.style.clipPath = 'none'
      dashboardContentRef.current.style.webkitClipPath = 'none'
      
      // Masquer l'iframe login avec transition d'opacité
      loginIframeRef.current.style.opacity = '0'
      loginIframeRef.current.style.pointerEvents = 'none'
      
      // Masquer complètement après transition
      setTimeout(() => {
        setShowTransition(false)
      }, 300)
    }, 3000)
    ```

11. **Résultat** :
    - Le dashboard prend le contrôle complet de l'écran
    - L'iframe login disparaît avec une transition d'opacité
    - Les interactions sont normales (pas d'iframe, vraie navigation Next.js)
    - **URL correcte** : `/dashboard` (pas de problème de reload/reconnexion)

## Détails techniques critiques

### ClipPath pour le dashboard

**ClipPath pour révéler le dashboard** :
```css
clipPath: circle(size px at x px y px)
-webkitClipPath: circle(size px at x px y px) /* Safari */
```

- Le dashboard est visible **à l'intérieur** du cercle
- Le cercle grandit depuis la position du bouton
- À la fin, le clipPath est retiré (`'none'`)

### Mask inversé pour l'iframe login

**Mask pour masquer progressivement l'iframe login** :
```css
/* Au début (size = 0) */
mask: black; /* Tout visible */

/* Pendant l'animation */
mask: radial-gradient(
  circle size px at x px y px,
  transparent size px,  /* Intérieur transparent (masqué) */
  black size+0.1 px      /* Extérieur visible */
);
```

- L'iframe login est visible **à l'extérieur** du cercle
- L'intérieur devient transparent progressivement
- À la fin, l'iframe disparaît complètement avec `opacity: 0`

### Gestion de l'iframe login

**Pourquoi une iframe pour la page login ?**
- Permet de garder la page login visible pendant l'animation
- La page login disparaît progressivement à l'intérieur du cercle
- L'iframe est préchargée sur la page login elle-même pour être prête

**Optimisations** :
- **Préchargement** : Iframe cachée sur `/login` qui précharge `/login` pour être utilisée sur dashboard
- `loading="eager"` pour charger l'iframe rapidement
- `pointerEvents: 'none'` pendant l'animation pour éviter les interactions accidentelles
- Transition d'opacité à la fin pour une disparition fluide

### Stockage de la position dans sessionStorage

**Format des données** :
```typescript
{
  from: 'login',
  buttonPosition: { x: number, y: number },
  timestamp: number
}
```

**Pourquoi sessionStorage ?**
- Persiste pendant la navigation mais se vide à la fermeture de l'onglet
- Accessible immédiatement après navigation
- Pas de problème de sécurité (données temporaires)
- Nettoyage automatique après utilisation

**Vérification de validité** :
- Vérifie que `from === 'login'`
- Vérifie que `Date.now() - timestamp < 5000` (moins de 5 secondes)
- Nettoie automatiquement après lecture

### Calcul de la taille maximale du cercle

```typescript
const maxCircleSize = Math.sqrt(
  window.innerWidth * window.innerWidth + 
  window.innerHeight * window.innerHeight
)
```

**Pourquoi cette formule ?**
- Garantit que le cercle couvre tout l'écran quelle que soit la taille
- Utilise la diagonale de l'écran comme rayon maximum
- Recalculée au resize pour le responsive

### Position du bouton

```typescript
const rect = buttonRef.current.getBoundingClientRect()
const x = rect.left + rect.width / 2  // Centre horizontal
const y = rect.top + rect.height / 2 // Centre vertical
```

**Pourquoi `getBoundingClientRect()` ?**
- Calcul dynamique de la position réelle du bouton dans le viewport
- Fonctionne même si le bouton change de position (responsive, scroll, etc.)
- Calculé **avant** la navigation pour garantir la précision

## Solutions aux problèmes rencontrés

### Problème 1 : URL reste sur `/login` après connexion

**Cause** : L'ancienne approche utilisait une iframe pour le dashboard, donc l'URL ne changeait pas.

**Solution** : Navigation immédiate avec `router.replace('/dashboard')` dès l'authentification réussie.

### Problème 2 : Rechargement = reconnexion

**Cause** : L'URL restait sur `/login`, donc un reload ramenait sur la page login.

**Solution** : L'URL change immédiatement vers `/dashboard`, donc un reload garde l'utilisateur sur `/dashboard`.

### Problème 3 : Navigation interne limitée

**Cause** : Les liens dans l'iframe naviguaient dans l'iframe, pas dans la page principale.

**Solution** : Plus d'iframe pour le dashboard, navigation normale Next.js.

### Problème 4 : Page login disparaît immédiatement

**Cause** : Quand on navigue vers `/dashboard`, la page login disparaît immédiatement.

**Solution** : Iframe contenant `/login` affichée sur le dashboard avec mask inversé pour rester visible à l'extérieur du cercle.

### Problème 5 : Compatibilité Safari

**Cause** : Safari nécessite le préfixe `-webkit-` pour clipPath et mask.

**Solution** : Application des deux propriétés :
```typescript
element.style.clipPath = clipPath
element.style.webkitClipPath = clipPath
element.style.mask = mask
element.style.webkitMask = webkitMask
```

## Optimisations de performance

1. **Préchargement de l'iframe login** : Iframe cachée sur `/login` qui précharge `/login` pour être utilisée sur dashboard
2. **Délai avant animation** : 100ms pour laisser le DOM du dashboard se charger
3. **Motion values** : Utilisation de Framer Motion pour des animations performantes avec `requestAnimationFrame`
4. **Cleanup** : Nettoyage des event listeners et timers dans les `useEffect`
5. **SessionStorage** : Nettoyage automatique après utilisation

## Accessibilité

- `aria-hidden="true"` sur l'iframe login
- `pointerEvents: 'none'` pendant l'animation pour éviter les interactions accidentelles
- Titre descriptif sur l'iframe : `title="Login"`

## Responsive

- Calcul dynamique de la taille max du cercle au resize
- Position du bouton calculée dynamiquement (fonctionne sur mobile et desktop)
- Le cercle couvre toujours tout l'écran quelle que soit la taille

## Courbe d'animation

**EaseOutCubic** : `[0.33, 1, 0.68, 1]`
- Démarrage rapide
- Ralentissement progressif vers la fin
- Effet naturel et fluide

## Durée

**3 secondes (3000ms)**
- Assez long pour être visible et appréciable
- Assez court pour ne pas être frustrant
- Permet au dashboard de charger pendant l'animation

## Avantages de cette solution

1. ✅ **URL correcte** : `/dashboard` immédiatement après connexion
2. ✅ **Pas de reconnexion** : Reload garde l'utilisateur sur `/dashboard`
3. ✅ **Navigation normale** : Les liens fonctionnent normalement (pas d'iframe)
4. ✅ **Animation fluide** : Transition visuelle préservée avec effet de révélation circulaire
5. ✅ **Code propre** : Pas d'iframe pour le dashboard, navigation standard Next.js
6. ✅ **Page login visible** : Reste visible à l'extérieur du cercle pendant l'animation

## Résultat final

Une transition fluide et moderne où :
1. ✅ L'utilisateur clique sur "Se connecter"
2. ✅ Navigation immédiate vers `/dashboard` (URL change)
3. ✅ Le cercle part du bouton "Se connecter"
4. ✅ Le dashboard apparaît progressivement à l'intérieur du cercle
5. ✅ La page login reste visible à l'extérieur du cercle (via iframe)
6. ✅ À la fin, l'iframe login disparaît et seul le dashboard reste
7. ✅ Navigation normale Next.js, pas de problème de reload/reconnexion
