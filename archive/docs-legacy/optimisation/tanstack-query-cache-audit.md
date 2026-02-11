# TanStack Query Cache – État Des Lieux GMBS CRM

## 1. Vue d’ensemble
Ce document synthétise l’architecture actuelle de TanStack Query dans le projet `gmbs-crm`, les points forts déjà en place et les fragilités à corriger pour fiabiliser la migration (interventions, artisans, dashboard, auth et données de référence).  
Toutes les références de code sont indiquées pour faciliter la revue.

---

## 2. Query Client & Enveloppe

| Élément | Détails | Référence |
| --- | --- | --- |
| Provider global | `ReactQueryProvider` fixe `staleTime=30s`, `gcTime=5min`, désactive `refetchOnWindowFocus`, et conserve le résultat précédent via `placeholderData`. React Query DevTools sont chargés en dev. | `src/components/providers/ReactQueryProvider.tsx` |
| Auth listener | `AuthStateListenerProvider` écoute les événements Supabase, invalide `["currentUser"]`, déclenche `preloadCriticalDataAsync` après `SIGNED_IN`. | `src/providers/AuthStateListenerProvider.tsx` |
| Préchargement post-login | `preloadCriticalData` récupère l’utilisateur, prépare les mappers filtres, précharge listes/vues interventions (light), vues artisans, et stats dashboard pour le mois/semaine courants. | `src/lib/preload-critical-data.ts` |
| Hook client-side | `usePreloadDefaultViews` rejoue la logique pour les 6 vues par défaut (hors calendrier) avec décalage progressif. | `src/hooks/usePreloadDefaultViews.ts` |

**Forces**
- Configuration cohérente et centralisée.
- Préchargement multi-domaines dès l’authentification.

**Faiblesses**
- Sur `SIGNED_OUT`, seul `["currentUser"]` est vidé : toutes les autres queries restent chaudes → risque de fuite de données lors d’un changement d’utilisateur sur la même machine.
- `preloadCriticalData` n’`await` pas `prefetchQuery` (erreurs silencieuses et absence de suivi).
- Les clés utilisées dans le préchargement ne correspondent pas toujours aux clés réellement enregistrées (cf. §3).

---

## 3. Cartographie des clés TanStack Query

### 3.1 Interventions (`src/lib/react-query/queryKeys.ts`)

| Clé | Usage prévu | Observations |
| --- | --- | --- |
| `interventionKeys.list(params)` | Listes complètes (filtres, pagination) | Correctement utilisée par `useInterventionsQuery` (`src/hooks/useInterventionsQuery.ts`). |
| `interventionKeys.lightList(params)` | Endpoints light (préchargement/warm-up) | Utilisée dans `usePreload*` et `preloadCriticalData`. |
| `interventionKeys.detail(id, include?)` | Détails intervention | **Peu consommée** : nombreuses vues utilisent encore `["intervention", id]` (cf. §4). |
| `interventionKeys.summary(params)` | Compteurs/agrégats | Jamais utilisée côté requêtes. |
| `invalidateLists()` | Retourne `["interventions","list","light"]` | **Bug critique** : aucune query ne possède cette clé exacte, donc toutes les invalidations et `setQueriesData` ciblant `invalidateLists()` ne touchent rien. |
| `invalidateView(params)` | Tableau de trois clés (list/light/summary) | Non utilisé dans le code actuel. |

### 3.2 Artisans (`src/lib/react-query/queryKeys.ts`)

| Clé | Usage prévu | Observations |
| --- | --- | --- |
| `artisanKeys.list(params)` | `useArtisansQuery`, préchargement critiques | OK. |
| `artisanKeys.detail(id)` | Pour les fiches artisan | Non exploité : les composants utilisent `["artisan", id]`. |
| `invalidateLists()` | `["artisans","list"]` | Appelée par `useArtisansQuery` (optimistic update) mais pas par les mutations réelles (cf. §4). |

### 3.3 Dashboard (`src/lib/react-query/queryKeys.ts`)

| Clé | Usage prévu | Observations |
| --- | --- | --- |
| `dashboardKeys.statsByUser(params)` | `useDashboardStats` | OK. |
| `dashboardKeys.marginByUser(params)` | `useDashboardMargin` | OK. |
| `dashboardKeys.periodStatsByUser(params)` | `useDashboardPeriodStats` | OK. |
| `invalidateStats()` | Doit invalider stats/marge/périodes | Jamais appelé, ni depuis mutations ni depuis widgets. |

### 3.4 Autres clés

- Auth : `["currentUser"]` (partagé entre `useCurrentUser`, `AuthGuard`, `AvatarStatus`).
- Gestionnaires : `["gestionnaires"]`.
- Commentaires : `["comments", entityType, entityId, limit]`.
- Données de référence : **pas de React Query**, mais un cache module-level (`useReferenceData`, `useInterventionStatusMap`, `useUserMap`, `useInterventionStatuses`).

---

## 4. Hooks / Mutations / Préchargements

### 4.1 Interventions

| Hook | Clé | Paramètres encodés | Notes |
| --- | --- | --- | --- |
| `useInterventionsQuery` | `interventionKeys.list/light` + `viewId` | `limit`, `offset`, filtres normalisés, `fields`, `viewId` (en suffixe). | Mise à jour optimiste via `setQueriesData({ queryKey: interventionKeys.invalidateLists() })` → **ne fonctionne pas** (clé inexistante). |
| `useInterventionsMutations` | invalidations multiples | Invalide `invalidateLists()`, `summaries()`, `detail(id)` selon mutation. | Même problème d’invalidation que ci-dessus. |
| `usePreloadView(s)` / `preloadCriticalData` | `interventionKeys.lightList(params)` (+viewId) | Utilise `prefetchQuery`, `useLight=true`. | Préchargements faits en `fire-and-forget`. |

### 4.2 Artisans

| Hook | Clé | Paramètres | Notes |
| --- | --- | --- | --- |
| `useArtisansQuery` | `artisanKeys.list(params)` (+ `viewId`) | `limit`, `offset`, `gestionnaire`, `statut`. | Optimistic update `setQueriesData({ queryKey: artisanKeys.invalidateLists() })` ; idem bug que interventions pour les composants ne consommant pas ces clés. |
| Mutations (création/édition) | pas de hook dédié | `ArtisanModalContent` et `NewArtisanModalContent` appellent directement les APIs, puis émettent `window.dispatchEvent("artisan-updated")`. | React Query n’est pas utilisé pour invalider/mettre à jour les caches. |

### 4.3 Dashboard

- `useDashboardStats`, `useDashboardMargin`, `useDashboardPeriodStats` utilisent `dashboardKeys` correctement.
- Les composants graphiques (`intervention-stats-barchart.tsx`, `intervention-stats-piechart.tsx`) refetchent directement via `interventionsApi` et maintiennent leur propre cache `Map` basé sur `setInterval`. Ces appels ignorent totalement le cache React Query et ne peuvent être invalidés par les mutations.

### 4.4 Auth & Références

- `useCurrentUser` (React Query) ; `AvatarStatus` et `AuthGuard` refont le fetch manuellement, provoquant des doublons.
- `useReferenceData`, `useInterventionStatusMap`, `useUserMap`, `useInterventionStatuses` gèrent chacune un cache global (variable module) + `useEffect`. Pas d’invalidation (ex. import massifs, refresh manuel impossible).

---

## 5. Utilisation effective dans les composants

| Domaine | Adhérence TanStack Query | Zones legacy |
| --- | --- | --- |
| Interventions (pages, modales, tables) | `app/interventions/page.tsx` s’appuie sur `useInterventionsQuery` pour la data principale. `InterventionModalContent` utilise `useQuery(['intervention', id])`. | 1) Clé `['intervention', id]` n’est pas alignée sur `interventionKeys.detail`. 2) `NewInterventionModalContent` invalide `invalidateLists()` (inefficace). 3) `InterventionEditForm` invalide `["comments", ...]` mais pas la liste/détail via `interventionKeys`. |
| Artisans | `app/artisans/page.tsx` branche `useArtisansQuery`. | `ArtisanModalContent` / `NewArtisanModalContent` utilisent `useQuery(["artisan", id])` et un bus `window.dispatchEvent("artisan-updated")`. Aucune invalidation TanStack Query après création/mise à jour. |
| Dashboard | Pages & cards consomment les hooks `useDashboardStats*`. | Les charts et sections “recent interventions” contournent TanStack Query. Aucun lien entre mutations et dashboard. |
| Auth/UI | `useCurrentUser`, `useGestionnaires` via React Query. | `AvatarStatus` et `AuthGuard` refont le fetch sans tirer parti du cache (risque d’incohérence, double requête). |
| Comments | `CommentSection` est full TanStack Query (list + mutations + invalidations claires). | — |

---

## 6. Synthèse forces / faiblesses

### Points forts
1. **Base QueryClient solide** : options homogènes + DevTools prêts à l’emploi.
2. **Hooks domaines structurés** : `useInterventionsQuery` et `useArtisansQuery` encodent proprement pagination/filtres dans la clé.
3. **Préchargement agressif** : `preloadCriticalData` et `usePreloadDefaultViews` apportent une UX réactive post-login.
4. **Mutations interventions centralisées** : un seul hook couvre création/mise à jour/suppression/assignation/costs/paiements.

### Faiblesses majeures
1. **Clé d’invalidation invalide** : `interventionKeys.invalidateLists()` ne correspond à aucune query → toutes les invalidations/optimistic updates sont inopérantes.
2. **Clés de détail divergentes** : l’écosystème utilise encore `["intervention", id]` et `["artisan", id]`, ignorant les factories `interventionKeys.detail` / `artisanKeys.detail`.
3. **Artisans pas réellement migrés** : absence de mutations React Query, recours à des événements globaux, pas d’invalidation des listes.
4. **Dashboard hors cache** : appels directs aux API + `Map` maison pour le survol, aucune stratégie d’invalidation (`dashboardKeys.invalidateStats()` jamais utilisé).
5. **Caches parallèles** : données de référence (statuts, users, workflows) ne passent pas par TanStack Query → impossible de beneficier du `prefetch` ni d’invalidation.
6. **Nettoyage session incomplet** : seul `["currentUser"]` est vidé au logout, laissant les données sensibles en mémoire.

---

## 7. Feuille de route recommandée

Priorité haute :
1. **Corriger `interventionKeys.invalidateLists()`**  
   - Remplacer par deux helpers (`invalidateListPrefix` / `invalidateLightPrefix`) ou faire retourner `["interventions","list"]` et `["interventions","light"]`.  
   - Mettre à jour tous les `invalidateQueries` / `setQueriesData` qui l’utilisent.
2. **Unifier les clés de détail**  
   - Remplacer partout `["intervention", id]` par `interventionKeys.detail(id)` et `["artisan", id]` par `artisanKeys.detail(id)`.  
   - Supprimer `src/lib/query-keys.ts` pour éviter les régressions.
3. **Migrer définitivement les mutations artisans**  
   - Créer `useArtisansMutations` sur le modèle interventions (create/update/delete + invalidations `artisanKeys.invalidateLists()` et `detail`).  
   - Supprimer `window.dispatchEvent("artisan-updated")` (côté modales et listeners).

Priorité moyenne :
4. **Brancher dashboard & compteurs sur TanStack Query**  
   - Créer des hooks pour les “recent interventions” et les compteurs de vues (`useInterventionViewCounts`, `useInterventionDistinctValues`).  
   - Utiliser `dashboardKeys.invalidateStats()` depuis `useInterventionsMutations`.
5. **Nettoyer le cache au logout**  
   - Dans `AuthStateListenerProvider`, remplacer `removeQueries({ queryKey: ["currentUser"] })` par `queryClient.clear()` (ou `removeQueries()` sans filtre).  
   - Après `SIGNED_IN`, relancer `preloadCriticalDataAsync` *et* `queryClient.resumePausedMutations()` si nécessaire.
6. **Intégrer les données de référence dans React Query**  
   - Encapsuler `referenceApi.getAll()`, `referenceApi.getInterventionStatuses()`, `referenceApi.getUsers()` dans des hooks `useQuery`.  
   - Ajouter une clé `["references","statuses"]`, `["references","users"]`, etc., afin d’invalider facilement après import.

Long terme :
7. **Persistance facultative**  
   - Réintroduire `@tanstack/react-query-persist-client` pour conserver la “liste générale” ou les refs lors d’un hard refresh.  
   - Clé de stockage suggérée : `gmbs:react-query`.
8. **Instrumentation & QA**  
   - Ajouter un test E2E (Playwright) qui crée/édite/supprime une intervention et vérifie que la liste se met à jour sans refresh manuel.  
   - Surveiller la taille du cache via React Query DevTools pour valider le nettoyage session.

---

## 8. Annexes rapides

| Sujet | Fichier |
| --- | --- |
| Factory clés TanStack Query | `src/lib/react-query/queryKeys.ts` |
| Hook interventions | `src/hooks/useInterventionsQuery.ts` |
| Mutations interventions | `src/hooks/useInterventionsMutations.ts` |
| Hook artisans | `src/hooks/useArtisansQuery.ts` |
| Provider React Query | `src/components/providers/ReactQueryProvider.tsx` |
| Préchargement critiques | `src/lib/preload-critical-data.ts` |
| Dashboard hooks | `src/hooks/useDashboardStats.ts` |
| Comment Section (exemple complet) | `src/components/shared/CommentSection.tsx` |

---

**Prochaine étape** : appliquer les correctifs haute priorité (clés d’invalidation + unification des détails + migration artisans) avant d’étendre la couverture Query aux dashboards et références. Une fois ces chantiers finalisés, la migration TanStack Query pourra être considérée comme aboutie et prête pour la persistance/offline si désiré.
