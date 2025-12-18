# 🎯 PROMPT COMPLET - AUDIT DE PERFORMANCE CPU
## Objectif : Réduire la charge CPU pour éviter la surchauffe et améliorer l'accessibilité sur PC peu puissants

---

## 📋 CONTEXTE DU PROJET

Tu vas analyser une application **Next.js 15** avec **React 18** qui est un CRM (Gestion de Relations Clients) pour la gestion d'interventions. L'application utilise :

- **Framework** : Next.js 15.5.7 avec App Router
- **State Management** : Zustand, React Context API, TanStack Query
- **Animations** : Framer Motion
- **UI** : Radix UI, Tailwind CSS, Styled Components
- **Données** : Supabase (PostgreSQL)
- **Visualisation** : Recharts, Nivo, ReactFlow, MapLibre GL
- **Autres** : @tanstack/react-virtual, react-resizable-panels

**Problème identifié** : L'application consomme trop de CPU, provoquant surchauffe et rendant l'utilisation difficile sur PC peu puissants.

---

## 🎯 OBJECTIF DE L'AUDIT

Effectuer un **audit complet et exhaustif** de toutes les sources potentielles de consommation CPU excessive, puis proposer des **solutions concrètes et prioritaires** pour optimiser les performances.

---

## 📊 DOMAINES D'ANALYSE À COUVRIR

### 1. 🔄 RENDU ET RE-RENDU REACT

#### Points à vérifier :
- [ ] **Re-renders inutiles** : Identifier les composants qui se re-rendent sans raison
- [ ] **Props drilling** : Détecter les props qui changent à chaque render
- [ ] **useMemo/useCallback manquants** : Repérer les calculs coûteux non mémorisés
- [ ] **Dépendances useEffect** : Vérifier les dépendances manquantes ou incorrectes
- [ ] **Context overuse** : Analyser si les Contexts provoquent des re-renders en cascade
- [ ] **Composants non mémorisés** : Identifier les composants enfants qui devraient être `React.memo`
- [ ] **Hooks personnalisés** : Vérifier les hooks qui recalculent à chaque appel
- [ ] **State updates fréquents** : Détecter les mises à jour d'état trop fréquentes

#### Fichiers à analyser en priorité :
- `app/layout.tsx` (nombreux providers imbriqués)
- `src/contexts/*` (tous les contextes)
- `src/hooks/*` (tous les hooks personnalisés)
- `src/components/**/*.tsx` (composants réutilisables)
- `app/**/page.tsx` (pages principales)

#### Métriques à identifier :
- Nombre de re-renders par action utilisateur
- Profondeur de l'arbre de composants
- Taille des props objets passés
- Fréquence des mises à jour de state

---

### 2. 🎨 ANIMATIONS ET TRANSITIONS

#### Points à vérifier :
- [ ] **Animations Framer Motion** : Identifier les animations complexes ou trop nombreuses
- [ ] **Animations CSS** : Détecter les transitions CSS coûteuses (box-shadow, blur, etc.)
- [ ] **Will-change** : Vérifier l'utilisation appropriée de `will-change`
- [ ] **GPU acceleration** : S'assurer que les animations utilisent transform/opacity
- [ ] **Animations simultanées** : Compter le nombre d'animations en parallèle
- [ ] **Animations sur scroll** : Analyser les animations déclenchées au scroll
- [ ] **Redraws** : Détecter les animations qui forcent des repaints complets

#### Fichiers à analyser :
- Composants utilisant `framer-motion`
- `app/globals.css` (animations CSS)
- Composants avec transitions/animations

#### Métriques à identifier :
- Nombre d'animations actives simultanément
- FPS moyen pendant les animations
- Utilisation GPU vs CPU pour les animations

---

### 3. 📦 GESTION D'ÉTAT (STATE MANAGEMENT)

#### Points à vérifier :
- [ ] **Zustand stores** : Analyser la taille et la fréquence des updates
- [ ] **Selectors** : Vérifier si les selectors sont optimisés (shallow comparison)
- [ ] **Context providers** : Identifier les providers qui se re-rendent trop souvent
- [ ] **TanStack Query** : Vérifier la configuration du cache et les refetches
- [ ] **State normalization** : Analyser si les données sont normalisées
- [ ] **State updates batch** : Vérifier si les updates sont batchés correctement
- [ ] **Subscriptions** : Compter les listeners/subscriptions actifs

#### Fichiers à analyser :
- `src/stores/*.ts`
- `src/contexts/*.tsx`
- `src/components/providers/ReactQueryProvider.tsx`
- Hooks utilisant Zustand ou Context

#### Métriques à identifier :
- Taille des stores Zustand
- Fréquence des updates de state
- Nombre de composants abonnés à chaque store
- Taille du cache TanStack Query

---

### 4. 🔍 TRAITEMENT DE DONNÉES ET CALCULS

#### Points à vérifier :
- [ ] **Calculs synchrones lourds** : Identifier les opérations bloquantes
- [ ] **Boucles non optimisées** : Détecter les O(n²) ou pire
- [ ] **Parsing de données** : Analyser les opérations de parsing JSON/CSV
- [ ] **Filtrage/transformation** : Vérifier les opérations sur grands datasets
- [ ] **Regex complexes** : Identifier les expressions régulières coûteuses
- [ ] **Traitement d'images** : Analyser les opérations sur images (resize, crop, etc.)
- [ ] **Worker threads** : Vérifier si les calculs lourds pourraient être déportés

#### Fichiers à analyser :
- `src/lib/supabase-api-v2.ts` (mapping de données)
- `scripts/data-processing/*.js` (traitement de données)
- Fonctions de transformation/filtrage
- Composants avec logique métier complexe

#### Métriques à identifier :
- Temps d'exécution des calculs synchrones
- Taille des datasets traités
- Complexité algorithmique (Big O)
- Utilisation CPU pendant les calculs

---

### 5. 🌐 REQUÊTES ET DONNÉES RÉSEAU

#### Points à vérifier :
- [ ] **Requêtes multiples** : Identifier les N+1 queries ou requêtes redondantes
- [ ] **Polling excessif** : Détecter les refetches trop fréquents
- [ ] **Données surchargées** : Analyser si trop de données sont récupérées
- [ ] **Cache inefficace** : Vérifier la stratégie de cache
- [ ] **Requêtes séquentielles** : Identifier les requêtes qui pourraient être parallèles
- [ ] **Real-time subscriptions** : Analyser l'impact des subscriptions Supabase
- [ ] **Debouncing/throttling** : Vérifier l'utilisation pour les recherches/filtres

#### Fichiers à analyser :
- `app/api/**/*.ts` (routes API)
- `src/lib/supabase-api-v2.ts`
- Hooks utilisant TanStack Query
- Composants avec subscriptions real-time

#### Métriques à identifier :
- Nombre de requêtes par action
- Taille des payloads
- Fréquence des refetches
- Nombre de subscriptions actives

---

### 6. 🖼️ RENDU VISUEL ET DOM

#### Points à vérifier :
- [ ] **Virtualisation** : Vérifier l'utilisation de `@tanstack/react-virtual` pour les grandes listes
- [ ] **Lazy loading** : Analyser le chargement différé des composants/images
- [ ] **Code splitting** : Vérifier le découpage du bundle
- [ ] **Images non optimisées** : Détecter les images lourdes non optimisées
- [ ] **DOM profond** : Analyser la profondeur de l'arbre DOM
- [ ] **CSS coûteux** : Identifier les sélecteurs CSS complexes
- [ ] **Repaints/Reflows** : Détecter les opérations qui forcent des reflows

#### Fichiers à analyser :
- Composants de listes/tables
- Composants avec images
- `next.config.mjs` (configuration Next.js)
- `app/globals.css`

#### Métriques à identifier :
- Nombre d'éléments DOM rendus
- Taille des bundles JavaScript
- Nombre d'images chargées simultanément
- Profondeur moyenne du DOM

---

### 7. 🗺️ VISUALISATIONS ET GRAPHIQUES

#### Points à vérifier :
- [ ] **Recharts** : Analyser le nombre de graphiques et leur complexité
- [ ] **Nivo** : Vérifier les visualisations complexes (Sankey, etc.)
- [ ] **ReactFlow** : Analyser les graphes de workflow
- [ ] **MapLibre GL** : Vérifier la configuration de la carte (tiles, layers)
- [ ] **Re-renders de graphiques** : Détecter les recalculs inutiles
- [ ] **Animations de graphiques** : Analyser l'impact des animations

#### Fichiers à analyser :
- Composants utilisant Recharts/Nivo
- Composants avec cartes (MapLibre)
- Composants ReactFlow

#### Métriques à identifier :
- Nombre de graphiques rendus simultanément
- Nombre de points de données par graphique
- FPS pendant les interactions avec graphiques

---

### 8. 🔧 CONFIGURATION ET BUILD

#### Points à vérifier :
- [ ] **Bundle size** : Analyser la taille des bundles avec `@next/bundle-analyzer`
- [ ] **Tree shaking** : Vérifier si le code mort est éliminé
- [ ] **Source maps** : Vérifier si les source maps sont désactivées en prod
- [ ] **Minification** : S'assurer que le code est minifié
- [ ] **Compression** : Vérifier la compression gzip/brotli
- [ ] **Dependencies** : Analyser les dépendances lourdes inutiles
- [ ] **Polyfills** : Vérifier si des polyfills inutiles sont inclus

#### Fichiers à analyser :
- `package.json` (dépendances)
- `next.config.mjs`
- `tsconfig.json`
- Build output

#### Métriques à identifier :
- Taille totale des bundles
- Nombre de chunks
- Taille des dépendances principales

---

### 9. 🎯 INTERACTIONS UTILISATEUR

#### Points à vérifier :
- [ ] **Event handlers** : Vérifier le debouncing/throttling des handlers
- [ ] **Drag & Drop** : Analyser l'impact de @dnd-kit ou @hello-pangea/dnd
- [ ] **Formulaires** : Vérifier la validation et les re-renders
- [ ] **Recherche/Filtres** : Analyser le traitement des inputs
- [ ] **Scroll** : Détecter les handlers de scroll coûteux
- [ ] **Resize** : Vérifier les listeners de resize window

#### Fichiers à analyser :
- Composants avec formulaires
- Composants avec drag & drop
- Composants avec recherche/filtres
- Event handlers globaux

#### Métriques à identifier :
- Fréquence des événements déclenchés
- Temps de réponse aux interactions
- CPU pendant les interactions

---

### 10. 🔄 REAL-TIME ET SUBSCRIPTIONS

#### Points à vérifier :
- [ ] **Supabase subscriptions** : Analyser le nombre et la fréquence
- [ ] **Broadcast channels** : Vérifier l'utilisation des BroadcastChannel
- [ ] **Event listeners** : Compter les listeners actifs
- [ ] **WebSocket connections** : Analyser les connexions WebSocket
- [ ] **Polling** : Détecter les mécanismes de polling

#### Fichiers à analyser :
- Composants avec subscriptions Supabase
- Hooks utilisant real-time
- Providers avec event listeners

#### Métriques à identifier :
- Nombre de subscriptions actives
- Fréquence des updates real-time
- Bande passante utilisée

---

## 📈 MÉTHODOLOGIE D'ANALYSE

### Phase 1 : Exploration et Identification
1. **Parcourir la structure du projet** pour comprendre l'architecture
2. **Identifier les fichiers critiques** dans chaque domaine
3. **Lire le code** pour comprendre les patterns utilisés
4. **Repérer les anti-patterns** de performance

### Phase 2 : Analyse Détaillée
1. **Analyser chaque fichier** selon les critères ci-dessus
2. **Identifier les problèmes** avec des exemples de code concrets
3. **Mesurer l'impact** (estimé) de chaque problème
4. **Prioriser** les problèmes (Critique, Élevé, Moyen, Faible)

### Phase 3 : Solutions et Recommandations
1. **Proposer des solutions concrètes** pour chaque problème
2. **Fournir des exemples de code** pour les corrections
3. **Estimer l'effort** de mise en œuvre
4. **Estimer le gain** de performance attendu

---

## 📝 FORMAT DE SORTIE ATTENDU

### Structure du Rapport

```markdown
# AUDIT DE PERFORMANCE CPU - [NOM DU PROJET]

## 📊 RÉSUMÉ EXÉCUTIF
- Nombre total de problèmes identifiés : X
- Problèmes critiques : X
- Problèmes élevés : X
- Problèmes moyens : X
- Problèmes faibles : X

## 🎯 PRIORISATION GLOBALE
[Top 10 des optimisations les plus impactantes]

---

## 1. [DOMAINE] - [NOM DU PROBLÈME]

### 🔴 Niveau de Priorité : [Critique/Élevé/Moyen/Faible]

### 📍 Localisation
- Fichier(s) : `chemin/vers/fichier.tsx`
- Ligne(s) : X-Y
- Composant/Fonction : `NomDuComposant`

### 🐛 Description du Problème
[Description détaillée du problème]

### 💻 Code Problématique
```typescript
// Exemple de code problématique
```

### ⚡ Impact Estimé
- **CPU** : [Impact sur CPU - Ex: +30% utilisation]
- **Performance** : [Impact sur les performances - Ex: -200ms de latence]
- **Expérience utilisateur** : [Impact UX]

### ✅ Solution Proposée
[Description de la solution]

### 🔧 Code Corrigé
```typescript
// Exemple de code corrigé
```

### 📊 Gain Estimé
- **Réduction CPU** : [Ex: -25%]
- **Amélioration performance** : [Ex: +150ms]
- **Effort de mise en œuvre** : [Ex: 2h]

### 🔗 Références
- [Liens vers documentation si pertinent]

---

## [Répéter pour chaque problème identifié]

---

## 📈 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Quick Wins (Semaine 1)
1. [Optimisation 1] - Effort : Xh - Gain : Y%
2. [Optimisation 2] - Effort : Xh - Gain : Y%

### Phase 2 : Optimisations Majeures (Semaine 2-3)
1. [Optimisation 1] - Effort : Xh - Gain : Y%
2. [Optimisation 2] - Effort : Xh - Gain : Y%

### Phase 3 : Refactoring (Semaine 4+)
1. [Optimisation 1] - Effort : Xh - Gain : Y%
2. [Optimisation 2] - Effort : Xh - Gain : Y%

---

## 🛠️ OUTILS ET TECHNIQUES RECOMMANDÉS

### Pour Mesurer
- React DevTools Profiler
- Chrome DevTools Performance
- Web Vitals
- Lighthouse
- Bundle Analyzer

### Pour Optimiser
- React.memo, useMemo, useCallback
- Code splitting dynamique
- Virtualisation
- Debouncing/Throttling
- Web Workers
- Request deduplication

---

## 📚 RESSOURCES COMPLÉMENTAIRES
[Liens vers documentation, articles, etc.]
```

---

## 🎯 CRITÈRES DE PRIORISATION

### 🔴 Critique
- Bloque l'utilisation sur PC peu puissants
- Provoque des freezes > 500ms
- Consommation CPU > 50% en continu
- Impact visible immédiatement

### 🟠 Élevé
- Ralentit significativement l'application
- Consommation CPU 20-50%
- Freezes 200-500ms
- Impact visible après quelques minutes d'utilisation

### 🟡 Moyen
- Ralentissement modéré
- Consommation CPU 10-20%
- Freezes 50-200ms
- Impact visible sur PC peu puissants uniquement

### 🟢 Faible
- Optimisation mineure
- Consommation CPU < 10%
- Freezes < 50ms
- Impact marginal mais bon à faire

---

## 🔍 POINTS D'ATTENTION SPÉCIFIQUES

### Pour ce projet en particulier :
1. **Nombreux providers imbriqués** dans `app/layout.tsx` → Risque de re-renders en cascade
2. **Visualisations multiples** (Recharts, Nivo, ReactFlow) → Peuvent être très coûteuses
3. **Traitement de grandes quantités de données** (6000+ interventions) → Nécessite virtualisation
4. **Animations Framer Motion** → Peuvent consommer beaucoup de CPU
5. **Real-time subscriptions** → Peuvent provoquer des updates fréquents
6. **Drag & Drop** → Peut être coûteux avec beaucoup d'éléments

---

## ✅ CHECKLIST FINALE

Avant de finaliser le rapport, vérifier que :

- [ ] Tous les domaines ont été analysés
- [ ] Chaque problème identifié a une solution proposée
- [ ] Les priorités sont justifiées
- [ ] Les gains estimés sont réalistes
- [ ] Le code d'exemple est fonctionnel
- [ ] Les références sont pertinentes
- [ ] Le plan d'action est réalisable

---

## 🚀 COMMENCER L'AUDIT

**Instructions** : Commence par explorer la structure du projet, puis analyse méthodiquement chaque domaine en suivant cette checklist. Pour chaque problème identifié, documente-le selon le format ci-dessus. Sois exhaustif mais aussi pragmatique - concentre-toi sur les optimisations qui auront le plus d'impact.

**Objectif final** : Un rapport complet et actionnable qui permettra de réduire significativement la charge CPU de l'application.

---

**Bonne analyse ! 🎯**






