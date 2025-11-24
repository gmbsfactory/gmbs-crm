# Tasks: Mise à jour en temps réel de la table vue des interventions

**Feature Branch**: `002-real-time-updates`  
**Created**: 2025-01-27  
**Status**: Ready for Implementation  
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Vue d'Ensemble

Ce document liste toutes les tâches d'implémentation pour la fonctionnalité de mise à jour en temps réel des interventions via Supabase Realtime. Les tâches sont organisées par phase et user story pour permettre une implémentation indépendante et testable.

**Total des tâches**: 98  
**Tâches complétées**: 81 (83%)  
**Tâches restantes**: 17 (17%)  
**User Stories P1**: 6 (US1, US2, US4, US5, US6, US7)  
**User Stories P2**: 6 (US3, US8, US9, US10, US11, US12)  
**Opportunités de parallélisation**: 45 tâches

## Stratégie d'Implémentation

### MVP Scope (Phase 3-8)
L'implémentation MVP couvre les user stories P1 :
- US1: Mise à jour immédiate après assignation "Je gère"
- US2: Mise à jour immédiate après changement de statut
- US4-6: Transitions de statut spécifiques (DEVIS_ENVOYE → ACCEPTE → EN_COURS → TERMINE)
- US7: Voir les modifications des autres utilisateurs en temps réel

### Livraison Incrémentale
1. **Phase 1-2**: Infrastructure de base (Setup + Foundational)
2. **Phase 3-8**: MVP avec user stories P1
3. **Phase 9-12**: Fonctionnalités avancées (P2)
4. **Phase finale**: Polish et optimisations

### Critères de Test Indépendants par User Story

- **US1**: Test manuel avec deux navigateurs - assignation "Je gère" dans Market, vérification disparition/apparition immédiate
- **US2**: Test manuel - changement de statut, vérification mise à jour immédiate des vues
- **US3**: Test automatique - vérification mise à jour compteurs via API après modification
- **US4-6**: Test manuel - transitions de statut spécifiques, vérification mise à jour immédiate
- **US7**: Test avec deux utilisateurs - modification dans navigateur 1, vérification apparition < 2s dans navigateur 2
- **US8**: Test avec deux utilisateurs - modification simultanée, vérification stratégie "dernier écrit gagne"
- **US9**: Test de charge - 10 utilisateurs simultanés, mesure temps de synchronisation
- **US10**: Test avec deux utilisateurs - création intervention, vérification apparition immédiate
- **US11**: Test manuel - modification autres champs, vérification synchronisation
- **US12**: Test manuel - changement artisan assigné, vérification mise à jour vues

---

## Phase 1: Setup

**Objectif**: Configuration initiale du projet et structure de base pour Realtime.

### T001-T005: Structure de base

- [X] T001 Créer le répertoire `src/lib/realtime/` pour les modules Realtime
- [X] T002 Créer le répertoire `src/components/interventions/` pour les composants Realtime
- [X] T003 Vérifier que `@supabase/supabase-js` ^2.58.0 est installé dans `package.json`
- [X] T004 Vérifier que `@tanstack/react-query` ^5.90.2 est installé dans `package.json`
- [X] T005 Vérifier que Realtime est activé dans `supabase/config.toml` (realtime.enabled = true)

---

## Phase 2: Foundational

**Objectif**: Implémenter les prérequis bloquants nécessaires pour toutes les user stories. Ces tâches doivent être complétées avant de commencer les user stories.

### T006-T015: Client Realtime et Configuration

- [X] T006 [P] Créer `src/lib/realtime/realtime-client.ts` avec fonction `createInterventionsChannel()` configurant le channel Supabase Realtime pour la table `interventions`
- [X] T007 [P] Implémenter la gestion des événements `error` et `disconnect` dans `src/lib/realtime/realtime-client.ts` pour basculement vers polling
- [X] T008 [P] Créer `src/lib/realtime/filter-utils.ts` avec fonction `matchesFilters(intervention, filters)` pour vérifier si une intervention correspond aux filtres d'une vue
- [X] T009 [P] Implémenter `extractFiltersFromQueryKey(queryKey)` dans `src/lib/realtime/filter-utils.ts` pour extraire les paramètres de filtrage depuis une query key TanStack Query
- [X] T010 [P] Créer `src/lib/realtime/cache-sync.ts` avec fonction `syncCacheWithRealtimeEvent(queryClient, payload)` pour synchroniser le cache TanStack Query avec les événements Realtime
- [X] T011 [P] Implémenter la détection des soft deletes (`isSoftDelete`) dans `src/lib/realtime/cache-sync.ts` pour gérer les UPDATE où `is_active` passe à `false`
- [X] T012 [P] Implémenter la mise à jour optimiste du cache via `setQueryData` dans `src/lib/realtime/cache-sync.ts` pour INSERT/UPDATE/DELETE
- [X] T013 [P] Implémenter l'invalidation silencieuse après 100ms dans `src/lib/realtime/cache-sync.ts` pour garantir la cohérence avec le serveur
- [X] T014 [P] Créer `src/lib/realtime/broadcast-sync.ts` avec fonction `createBroadcastSync(queryClient)` pour synchroniser le cache entre onglets via BroadcastChannel API
- [X] T015 [P] Implémenter `initializeCacheSync(queryClient)` dans `src/lib/realtime/cache-sync.ts` pour initialiser la synchronisation BroadcastChannel

### T016-T020: Hook Realtime de Base

- [X] T016 [P] Créer `src/hooks/useInterventionsRealtime.ts` avec hook React utilisant `createInterventionsChannel()` et `syncCacheWithRealtimeEvent()`
- [X] T017 [P] Implémenter la gestion du cycle de vie du channel (subscribe/unsubscribe) dans `src/hooks/useInterventionsRealtime.ts`
- [X] T018 [P] Intégrer l'initialisation de `initializeCacheSync` dans `src/hooks/useInterventionsRealtime.ts`
- [X] T019 [P] Créer `src/components/interventions/InterventionRealtimeProvider.tsx` comme provider React encapsulant `useInterventionsRealtime()`
- [X] T020 Intégrer `InterventionRealtimeProvider` dans `app/interventions/page.tsx` pour activer Realtime sur la page interventions

### T021-T025: Gestion des Erreurs et File d'Attente

- [X] T021 [P] Créer `src/lib/realtime/sync-queue.ts` avec classe `SyncQueue` pour gérer la file d'attente FIFO limitée à 50 modifications
- [X] T022 [P] Implémenter la sauvegarde/restauration localStorage dans `src/lib/realtime/sync-queue.ts` pour persistance entre sessions
- [X] T023 [P] Implémenter le traitement par batch (10 modifications toutes les 5 secondes) dans `src/lib/realtime/sync-queue.ts`
- [X] T024 [P] Créer fonction utilitaire `isNetworkError(error)` dans `src/lib/realtime/realtime-client.ts` pour détecter les erreurs réseau
- [X] T025 [P] Intégrer `syncQueue.enqueue()` dans `src/hooks/useInterventionsMutations.ts` pour mettre en file d'attente les modifications en cas d'erreur réseau

### T026-T030: Debounce et Compteurs

- [X] T026 [P] Créer ou vérifier l'existence de `src/utils/debounce.ts` avec fonction `debounce(fn, delay)` pour debounce des appels API
- [X] T027 [P] Implémenter la fonction `debouncedRefreshCounts` dans `src/lib/realtime/cache-sync.ts` avec debounce de 500ms pour invalider les résumés (compteurs)
- [X] T028 [P] Intégrer `debouncedRefreshCounts` dans `syncCacheWithRealtimeEvent` pour déclencher la mise à jour des compteurs après chaque événement Realtime
- [X] T029 [P] Vérifier que `getInterventionTotalCount()` et `getInterventionCounts()` existent dans `src/lib/supabase-api-v2.ts` pour les appels API de comptage
- [X] T030 [P] Créer fonction helper `shouldRefreshCounts(eventType, oldRecord, newRecord)` dans `src/lib/realtime/cache-sync.ts` pour déterminer si les compteurs doivent être mis à jour

---

## Phase 3: User Story 1 - Mise à jour immédiate après assignation "Je gère" (P1)

**Objectif**: Lorsqu'un utilisateur clique sur "Je gère" dans la vue Market, l'intervention disparaît immédiatement de Market et apparaît dans "Mes demandes" avec mise à jour des compteurs.

**Critère de test indépendant**: Ouvrir deux navigateurs avec le même utilisateur. Dans navigateur 1, cliquer sur "Je gère" pour une intervention dans Market. Vérifier que l'intervention disparaît immédiatement de Market dans navigateur 2 et que les compteurs se mettent à jour sans refresh.

### T031-T035: Gestion de l'assignation utilisateur

- [X] T031 [US1] Modifier `syncCacheWithRealtimeEvent` dans `src/lib/realtime/cache-sync.ts` pour détecter les changements de `assigned_user_id` (passage de `null` à `user_id`)
  - ✅ Implémenté via la logique générique dans `handleUpdate()` qui utilise `matchesFilters()` pour déterminer si l'intervention correspond aux filtres
- [X] T032 [US1] Implémenter la logique de retrait de l'intervention de la vue Market (filtre `assigned_user_id === null`) dans `syncCacheWithRealtimeEvent` lors d'un UPDATE avec changement d'assignation
  - ✅ Implémenté via `handleUpdate()` : si `matchesNow === false` et `wasInList === true`, l'intervention est retirée
- [X] T033 [US1] Implémenter la logique d'ajout de l'intervention dans la vue "Mes demandes" (filtre `assigned_user_id === current_user_id`) dans `syncCacheWithRealtimeEvent` lors d'un UPDATE avec changement d'assignation
  - ✅ Implémenté via `handleUpdate()` : si `matchesNow === true` et `wasInList === false`, l'intervention est ajoutée
- [X] T034 [US1] Vérifier que `matchesFilters` dans `src/lib/realtime/filter-utils.ts` gère correctement le filtre `user === null` (Market) et `user === user_id` (Mes demandes)
  - ✅ Vérifié : `matchesFilters()` gère correctement `filters.user === null` (Market) et `filters.user === user_id` (Mes demandes) - lignes 37-51
- [ ] T035 [US1] Tester manuellement l'assignation "Je gère" avec deux navigateurs pour vérifier la synchronisation immédiate
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 4: User Story 2 - Mise à jour immédiate après changement de statut (P1)

**Objectif**: Lorsqu'un utilisateur modifie le statut d'une intervention, l'intervention disparaît immédiatement des vues avec l'ancien statut et apparaît dans les vues avec le nouveau statut.

**Critère de test indépendant**: Modifier le statut d'une intervention de "Demandé" à "Devis envoyé" et vérifier que l'intervention disparaît immédiatement de la vue "Mes demandes" et que les compteurs se mettent à jour sans refresh.

### T036-T040: Gestion des changements de statut

- [X] T036 [US2] Modifier `syncCacheWithRealtimeEvent` dans `src/lib/realtime/cache-sync.ts` pour détecter les changements de `statut_id`
  - ✅ Implémenté via la logique générique dans `handleUpdate()` qui utilise `matchesFilters()` pour déterminer si l'intervention correspond aux filtres
- [X] T037 [US2] Implémenter la logique de retrait de l'intervention des vues avec ancien statut dans `syncCacheWithRealtimeEvent` lors d'un UPDATE avec changement de statut
  - ✅ Implémenté via `handleUpdate()` : si `matchesNow === false` et `wasInList === true`, l'intervention est retirée
- [X] T038 [US2] Implémenter la logique d'ajout de l'intervention dans les vues avec nouveau statut dans `syncCacheWithRealtimeEvent` lors d'un UPDATE avec changement de statut
  - ✅ Implémenté via `handleUpdate()` : si `matchesNow === true` et `wasInList === false`, l'intervention est ajoutée
- [X] T039 [US2] Vérifier que `matchesFilters` dans `src/lib/realtime/filter-utils.ts` gère correctement le filtre `statut` pour toutes les vues
  - ✅ Vérifié : `matchesFilters()` gère correctement le filtre `statut` (simple ou array) - lignes 25-34
- [ ] T040 [US2] Tester manuellement le changement de statut avec plusieurs vues ouvertes pour vérifier la synchronisation immédiate
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 5: User Story 3 - Mise à jour automatique des compteurs (P2)

**Objectif**: Tous les compteurs (pastilles) des vues concernées se mettent à jour automatiquement via les appels API de comptage existants après chaque modification.

**Critère de test indépendant**: Effectuer une modification d'intervention et vérifier que les compteurs de toutes les vues concernées se mettent à jour via les appels API (pas de calcul mathématique local) avec debounce de 500ms.

### T041-T045: Mise à jour des compteurs

- [X] T041 [US3] Vérifier que `debouncedRefreshCounts` est appelée après chaque événement Realtime qui affecte les filtres dans `src/lib/realtime/cache-sync.ts`
  - ✅ Vérifié : `debouncedRefreshCounts` est appelée ligne 270 après vérification via `shouldRefreshCounts()`
- [X] T042 [US3] Implémenter l'invalidation des query keys `interventionKeys.summaries()` dans `debouncedRefreshCounts` avec `refetchType: 'active'` pour forcer le recalcul via API
  - ✅ Implémenté : `debouncedRefreshCounts` invalide `interventionKeys.summaries()` avec `refetchType: 'active'` (lignes 155-162)
- [X] T043 [US3] Vérifier que les appels API `getInterventionTotalCount()` et `getInterventionCounts()` sont utilisés pour recalculer les compteurs (pas de calcul local)
  - ✅ Vérifié : L'invalidation avec `refetchType: 'active'` force le refetch via les queries qui utilisent `getInterventionTotalCount()` et `getInterventionCounts()`
- [ ] T044 [US3] Tester que le debounce de 500ms fonctionne correctement lors de modifications multiples rapides
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`
- [ ] T045 [US3] Vérifier que les compteurs se mettent à jour dans tous les onglets ouverts simultanément via BroadcastChannel
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 6: User Story 4 - Transition DEVIS_ENVOYE → ACCEPTE (P1)

**Objectif**: Lorsqu'un utilisateur modifie le statut d'une intervention de "Devis envoyé" à "Accepté", l'intervention disparaît immédiatement des vues "Devis envoyé" et apparaît dans les vues "Accepté".

**Critère de test indépendant**: Modifier le statut d'une intervention de "Devis envoyé" à "Accepté" et vérifier que l'intervention disparaît immédiatement de la vue "Devis envoyé" et apparaît dans la vue "Accepté" avec compteurs mis à jour.

### T046-T048: Transition spécifique DEVIS_ENVOYE → ACCEPTE

- [X] T046 [US4] Vérifier que la logique générique de changement de statut (Phase 4) gère correctement la transition DEVIS_ENVOYE → ACCEPTE
  - ✅ Vérifié : La logique générique dans `handleUpdate()` gère toutes les transitions de statut via `matchesFilters()`
- [ ] T047 [US4] Tester manuellement la transition DEVIS_ENVOYE → ACCEPTE avec vérification de la mise à jour immédiate des vues
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`
- [X] T048 [US4] Vérifier que les compteurs des vues "Devis envoyé" et "Accepté" se mettent à jour correctement après la transition
  - ✅ Vérifié : `shouldRefreshCounts()` détecte les changements de `statut_id` et déclenche `debouncedRefreshCounts()`

---

## Phase 7: User Story 5 - Transition ACCEPTE → EN_COURS (P1)

**Objectif**: Lorsqu'un utilisateur modifie le statut d'une intervention de "Accepté" à "En cours", l'intervention disparaît immédiatement des vues "Accepté" et apparaît dans les vues "En cours".

**Critère de test indépendant**: Modifier le statut d'une intervention de "Accepté" à "En cours" et vérifier que l'intervention disparaît immédiatement de la vue "Accepté" et apparaît dans la vue "En cours" avec compteurs mis à jour.

### T049-T051: Transition spécifique ACCEPTE → EN_COURS

- [X] T049 [US5] Vérifier que la logique générique de changement de statut (Phase 4) gère correctement la transition ACCEPTE → EN_COURS
  - ✅ Vérifié : La logique générique dans `handleUpdate()` gère toutes les transitions de statut via `matchesFilters()`
- [ ] T050 [US5] Tester manuellement la transition ACCEPTE → EN_COURS avec vérification de la mise à jour immédiate des vues
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`
- [X] T051 [US5] Vérifier que les compteurs des vues "Accepté" et "En cours" se mettent à jour correctement après la transition
  - ✅ Vérifié : `shouldRefreshCounts()` détecte les changements de `statut_id` et déclenche `debouncedRefreshCounts()`

---

## Phase 8: User Story 6 - Transition EN_COURS → TERMINE (P1)

**Objectif**: Lorsqu'un utilisateur modifie le statut d'une intervention de "En cours" à "Terminé", l'intervention disparaît immédiatement des vues "En cours" et apparaît dans les vues "Terminé".

**Critère de test indépendant**: Modifier le statut d'une intervention de "En cours" à "Terminé" et vérifier que l'intervention disparaît immédiatement de la vue "En cours" et apparaît dans la vue "Terminé" avec compteurs mis à jour.

### T052-T054: Transition spécifique EN_COURS → TERMINE

- [X] T052 [US6] Vérifier que la logique générique de changement de statut (Phase 4) gère correctement la transition EN_COURS → TERMINE
  - ✅ Vérifié : La logique générique dans `handleUpdate()` gère toutes les transitions de statut via `matchesFilters()`
- [ ] T053 [US6] Tester manuellement la transition EN_COURS → TERMINE avec vérification de la mise à jour immédiate des vues
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`
- [X] T054 [US6] Vérifier que les compteurs des vues "En cours" et "Terminé" se mettent à jour correctement après la transition
  - ✅ Vérifié : `shouldRefreshCounts()` détecte les changements de `statut_id` et déclenche `debouncedRefreshCounts()`

---

## Phase 9: User Story 7 - Voir les modifications des autres utilisateurs en temps réel (P1)

**Objectif**: Lorsqu'un utilisateur A modifie une intervention, tous les autres utilisateurs visualisant cette intervention voient la modification apparaître automatiquement en temps réel (< 2 secondes).

**Critère de test indépendant**: Ouvrir deux navigateurs avec deux utilisateurs différents. Modifier une intervention dans navigateur 1. Vérifier que la modification apparaît automatiquement dans navigateur 2 en moins de 2 secondes avec badge overlay codé par couleur utilisateur.

### T055-T062: Synchronisation multi-utilisateurs

- [X] T055 [US7] Vérifier que les événements Realtime sont automatiquement filtrés par RLS selon les permissions utilisateur (pas de configuration supplémentaire nécessaire)
  - ✅ Vérifié : Les événements Realtime sont automatiquement filtrés par RLS (voir `contracts/realtime-events.md`)
- [X] T056 [US7] Créer `src/lib/realtime/remote-edit-indicator.ts` avec interface `RemoteEditIndicator` et logique de gestion des badges overlay
  - ✅ Créé : `RemoteEditIndicatorManager` avec gestion des indicateurs et tracking des modifications locales
- [X] T057 [US7] Implémenter l'affichage d'un badge overlay codé par couleur utilisateur dans `src/lib/realtime/remote-edit-indicator.ts` lorsqu'un autre utilisateur modifie une intervention
  - ✅ Implémenté : `getUserColor()` génère une couleur cohérente basée sur l'ID utilisateur
- [X] T058 [US7] Intégrer l'affichage du badge overlay dans `syncCacheWithRealtimeEvent` pour les modifications distantes (vérifier que `event.userId !== currentUserId`)
  - ✅ Implémenté : Détection des modifications distantes via `isLocalModification()` et création d'indicateurs dans `cache-sync.ts`
- [X] T059 [US7] Implémenter la persistance du badge jusqu'à synchronisation complète de la modification dans `src/lib/realtime/remote-edit-indicator.ts`
  - ✅ Implémenté : Badges persistent 10 secondes puis sont nettoyés automatiquement
- [X] T060 [US7] Créer composant `RemoteEditBadge` dans `src/components/interventions/RemoteEditBadge.tsx` pour afficher le badge overlay avec couleur utilisateur
  - ✅ Créé : Composant `RemoteEditBadge` avec animation et couleur utilisateur
- [X] T061 [US7] Intégrer `RemoteEditBadge` dans les composants d'affichage des interventions pour afficher les modifications distantes
  - ✅ Intégré : `RemoteEditBadge` ajouté dans `InterventionCard.tsx`
- [ ] T062 [US7] Tester avec deux utilisateurs différents pour vérifier que les modifications apparaissent en < 2 secondes avec badge overlay
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 10: User Story 8 - Gérer les conflits de modification simultanée (P2)

**Objectif**: Lorsque deux utilisateurs modifient simultanément la même intervention, le système applique la stratégie "dernier écrit gagne" et notifie les utilisateurs concernés.

**Critère de test indépendant**: Ouvrir deux navigateurs avec deux utilisateurs différents. Modifier simultanément la même intervention dans les deux navigateurs. Vérifier que le système applique "dernier écrit gagne" et affiche une toast notification à l'utilisateur dont la modification a été écrasée.

### T063-T068: Gestion des conflits

- [X] T063 [US8] Implémenter la détection de conflit via comparaison des timestamps `updated_at` dans `src/lib/realtime/cache-sync.ts`
  - ✅ Implémenté : Fonction `detectConflict()` qui compare les timestamps locaux et distants
- [X] T064 [US8] Implémenter la stratégie "dernier écrit gagne" dans `syncCacheWithRealtimeEvent` en restaurant la valeur distante si `localUpdate.updated_at < remoteUpdate.updated_at`
  - ✅ Implémenté : La stratégie est appliquée automatiquement via l'utilisation de `enrichedNewRecord` qui a le `updated_at` le plus récent
- [X] T065 [US8] Créer fonction `showConflictNotification(remoteUser, field, oldValue, newValue)` dans `src/lib/realtime/cache-sync.ts` pour afficher la toast notification de conflit
  - ✅ Implémenté : Fonction `showConflictNotification()` utilisant Sonner pour afficher les notifications
- [X] T066 [US8] Intégrer `showConflictNotification` dans la logique de résolution de conflit pour notifier l'utilisateur dont la modification a été écrasée
  - ✅ Implémenté : Intégré dans `syncCacheWithRealtimeEvent` lors de la détection de conflit
- [X] T067 [US8] Vérifier que le système utilise le système de toast existant (shadcn/ui) pour afficher les notifications de conflit
  - ✅ Vérifié : Utilise `toast` de `sonner` qui est déjà intégré dans l'application
- [ ] T068 [US8] Tester avec deux utilisateurs modifiant simultanément la même intervention pour vérifier la gestion des conflits

---

## Phase 11: User Story 9 - Performance avec 10 utilisateurs simultanés (P2)

**Objectif**: Le système maintient des performances acceptables (mise à jour en moins de 2 secondes) même lorsque 10 utilisateurs modifient simultanément différentes interventions.

**Critère de test indépendant**: Simuler 10 utilisateurs simultanés effectuant des modifications et mesurer le temps de synchronisation pour chaque utilisateur. Vérifier que toutes les mises à jour apparaissent en moins de 2 secondes.

### T069-T071: Optimisations de performance

- [ ] T069 [US9] Vérifier que le debounce de 500ms pour les compteurs fonctionne correctement sous charge pour éviter la surcharge serveur
- [ ] T070 [US9] Vérifier que la mise à jour optimiste du cache via `setQueryData` permet une réactivité immédiate (< 500ms) même sous charge
- [ ] T071 [US9] Effectuer un test de charge avec 10 utilisateurs simultanés pour vérifier que les performances restent acceptables (< 2 secondes)

---

## Phase 12: User Story 10 - Création d'intervention en temps réel (P2)

**Objectif**: Lorsqu'un utilisateur crée une nouvelle intervention, tous les autres utilisateurs visualisant des vues où cette intervention devrait apparaître voient la nouvelle intervention apparaître automatiquement en temps réel.

**Critère de test indépendant**: Ouvrir deux navigateurs avec deux utilisateurs différents. Créer une intervention dans navigateur 1. Vérifier que la nouvelle intervention apparaît automatiquement dans les vues appropriées du navigateur 2 en moins de 2 secondes.

### T072-T075: Création en temps réel

- [X] T072 [US10] Vérifier que la logique INSERT dans `syncCacheWithRealtimeEvent` ajoute correctement les nouvelles interventions aux vues correspondant aux filtres
  - ✅ Vérifié : `handleInsert()` utilise `matchesFilters()` pour déterminer si l'intervention doit être ajoutée à chaque vue
- [X] T073 [US10] Vérifier que `matchesFilters` dans `src/lib/realtime/filter-utils.ts` gère correctement les nouvelles interventions pour toutes les vues (Market, Mes demandes, etc.)
  - ✅ Vérifié : `matchesFilters()` gère tous les filtres (user, statut, artisan, agence, métier, date, search)
- [X] T074 [US10] Vérifier que les compteurs se mettent à jour automatiquement après création d'intervention via `debouncedRefreshCounts`
  - ✅ Vérifié : `shouldRefreshCounts()` retourne `true` pour INSERT et déclenche `debouncedRefreshCounts()`
- [ ] T075 [US10] Tester avec deux utilisateurs pour vérifier que les nouvelles interventions apparaissent automatiquement dans les vues appropriées
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 13: User Story 11 - Modification de champs autres que statut/assignation (P2)

**Objectif**: Lorsqu'un utilisateur modifie un champ d'intervention autre que le statut ou l'assignation (adresse, date, métier, agence), tous les utilisateurs visualisant cette intervention voient la modification apparaître automatiquement en temps réel.

**Critère de test indépendant**: Modifier différents champs d'une intervention (adresse, date, métier, agence) et vérifier que les modifications apparaissent automatiquement pour tous les utilisateurs concernés et que l'intervention apparaît/disparaît des vues selon les nouveaux filtres.

### T076-T078: Modification d'autres champs

- [X] T076 [US11] Vérifier que `syncCacheWithRealtimeEvent` met à jour correctement le cache pour toutes les modifications de champs (pas seulement statut/assignation)
  - ✅ Vérifié : `handleUpdate()` met à jour toutes les interventions dans le cache, quel que soit le champ modifié
- [X] T077 [US11] Vérifier que `matchesFilters` dans `src/lib/realtime/filter-utils.ts` gère correctement les filtres par agence, métier, date pour déterminer si une intervention doit apparaître/disparaître d'une vue
  - ✅ Vérifié : `matchesFilters()` gère les filtres agence (lignes 64-73), métier (lignes 75-84), date (lignes 86-94)
- [ ] T078 [US11] Tester la modification de différents champs (adresse, date, métier, agence) pour vérifier que les modifications apparaissent automatiquement et que les vues se mettent à jour selon les filtres
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 14: User Story 12 - Changement d'artisan assigné (P2)

**Objectif**: Lorsqu'un utilisateur assigne ou modifie l'artisan assigné à une intervention, tous les utilisateurs visualisant cette intervention ou des vues filtrées par artisan voient la modification apparaître automatiquement en temps réel.

**Critère de test indépendant**: Modifier l'artisan assigné à une intervention et vérifier que la modification apparaît automatiquement pour tous les utilisateurs concernés et que l'intervention apparaît/disparaît des vues filtrées par artisan avec compteurs mis à jour.

### T079-T081: Modification d'artisan assigné

- [X] T079 [US12] Modifier `syncCacheWithRealtimeEvent` dans `src/lib/realtime/cache-sync.ts` pour détecter les changements de `artisan_id`
  - ✅ Implémenté via la logique générique dans `handleUpdate()` qui utilise `matchesFilters()` pour déterminer si l'intervention correspond aux filtres
- [X] T080 [US12] Vérifier que `matchesFilters` dans `src/lib/realtime/filter-utils.ts` gère correctement le filtre `artisan` pour les vues filtrées par artisan
  - ✅ Vérifié : `matchesFilters()` gère le filtre `artisan` (simple ou array) - lignes 54-62
- [ ] T081 [US12] Tester la modification d'artisan assigné pour vérifier que les modifications apparaissent automatiquement et que les vues filtrées par artisan se mettent à jour
  - ⚠️ Test manuel requis - voir `docs/VERIFICATION_REALTIME.md`

---

## Phase 15: Polish & Cross-Cutting Concerns

**Objectif**: Finaliser l'implémentation avec les optimisations, gestion d'erreurs avancée, et améliorations UX.

### T082-T090: Gestion d'erreurs avancée et résilience

- [X] T082 Implémenter le basculement automatique vers polling (5s) dans `src/lib/realtime/realtime-client.ts` lorsque Realtime est indisponible
  - ✅ Implémenté : Basculement automatique vers polling dans `useInterventionsRealtime` avec intervalle de 5s
- [X] T083 Implémenter la tentative de reconnexion automatique à Realtime toutes les 30s dans `src/lib/realtime/realtime-client.ts`
  - ✅ Implémenté : Tentative de reconnexion automatique toutes les 30s dans `useInterventionsRealtime`
- [X] T084 Ajouter un indicateur de statut de connexion (Realtime vs Polling) dans l'interface utilisateur pour informer l'utilisateur du mode de synchronisation
  - ✅ Implémenté : Composant `ConnectionStatusIndicator` et contexte `RealtimeContext` pour exposer le statut
- [X] T085 Implémenter la gestion gracieuse des erreurs localStorage (plein, inaccessible, mode privé) dans `src/lib/realtime/sync-queue.ts` avec notification d'avertissement
  - ✅ Implémenté : Gestion des erreurs QUOTA_EXCEEDED_ERR et SECURITY_ERR avec nettoyage automatique de la file
- [X] T086 Implémenter la restauration automatique des modifications en file d'attente depuis localStorage à la reconnexion dans `src/lib/realtime/sync-queue.ts`
  - ✅ Implémenté : Méthode `restoreOnReconnect()` qui recharge depuis localStorage et redémarre le traitement
- [X] T087 Implémenter la gestion des soft deletes avec notification toast "Intervention supprimée" et annulation des modifications en cours dans `src/lib/realtime/cache-sync.ts`
  - ✅ Implémenté : Notification toast dans `handleSoftDelete()` et nettoyage des indicateurs
- [X] T088 Implémenter la gestion de la perte d'accès (changement RLS) avec notification toast "Accès retiré" et annulation des modifications en cours dans `src/lib/realtime/cache-sync.ts`
  - ✅ Implémenté : Détection des événements UPDATE sans payload `new`, suppression de l'intervention, nettoyage SyncQueue + badges et toast "Accès retiré"
- [X] T089 Ajouter la gestion des retry avec backoff exponentiel (3 tentatives: 1s, 2s, 4s) dans `src/lib/realtime/sync-queue.ts` avant mise en file d'attente
  - ✅ Implémenté : Méthode `syncModificationWithRetry()` avec backoff exponentiel (1s, 2s, 4s)
- [X] T090 Vérifier que toutes les erreurs réseau sont correctement gérées avec retry et file d'attente
  - ✅ Vérifié : Les erreurs réseau sont détectées via `isNetworkError()` et mises en file d'attente avec retry

### T091-T095: Optimisations et tests

- [X] T091 Vérifier que la synchronisation BroadcastChannel évite les boucles infinies via vérification du timestamp dans `src/lib/realtime/broadcast-sync.ts`
  - ✅ Implémenté : Utilisation d'un Set de timestamps récents avec TTL de 5 secondes pour éviter les boucles
- [X] T092 Optimiser les performances de `matchesFilters` pour les grandes listes d'interventions (considérer l'utilisation de Map pour les filtres fréquents)
  - ✅ Optimisé : Vérifications court-circuit pour exclure rapidement les interventions inactives
- [X] T093 Ajouter des logs de debug pour le développement (à désactiver en production) dans `src/lib/realtime/cache-sync.ts`
  - ✅ Implémenté : Logs de debug conditionnels basés sur `NODE_ENV === 'development'` dans `filter-utils.ts`
- [X] T094 Créer des tests unitaires pour `matchesFilters` dans `tests/unit/realtime/filter-utils.test.ts`
  - ✅ Couverture des cas clés : statut, utilisateurs (single/array), artisan/agence/métier, dates et recherche textuelle
- [X] T095 Créer des tests d'intégration pour la synchronisation Realtime dans `tests/integration/realtime-sync.test.ts`
  - ✅ Tests Vitest validant INSERT/UPDATE/Perte d'accès sur `syncCacheWithRealtimeEvent` avec `QueryClient`

### T096-T098: Documentation et finalisation

- [ ] T096 Documenter l'utilisation de `useInterventionsRealtime` et `InterventionRealtimeProvider` dans les composants
- [ ] T097 Vérifier que tous les edge cases documentés dans `spec.md` sont gérés correctement
- [ ] T098 Effectuer une revue complète du code pour vérifier la conformité avec la constitution du projet (architecture modulaire, TypeScript strict, etc.)

---

## Dépendances entre User Stories

### Graphe de Dépendances

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational) - Bloque toutes les user stories
  ↓
Phase 3 (US1) - Assignation "Je gère"
  ↓
Phase 4 (US2) - Changement de statut générique
  ↓
Phase 6-8 (US4-6) - Transitions spécifiques (dépendent de US2)
  ↓
Phase 9 (US7) - Modifications autres utilisateurs (dépend de US1, US2)
  ↓
Phase 5 (US3) - Compteurs (dépend de US1, US2)
  ↓
Phase 10 (US8) - Conflits (dépend de US7)
  ↓
Phase 11 (US9) - Performance (dépend de toutes les US précédentes)
  ↓
Phase 12-14 (US10-12) - Fonctionnalités avancées (dépendent de US1, US2)
  ↓
Phase 15 (Polish) - Finalisation
```

### Ordre d'Implémentation Recommandé

1. **Phase 1-2**: Setup + Foundational (T001-T030) - **Blocant pour tout**
2. **Phase 3-4**: US1 + US2 (T031-T040) - **MVP Core**
3. **Phase 6-8**: US4-6 (T046-T054) - **Transitions spécifiques**
4. **Phase 9**: US7 (T055-T062) - **Synchronisation multi-utilisateurs**
5. **Phase 5**: US3 (T041-T045) - **Compteurs**
6. **Phase 10**: US8 (T063-T068) - **Conflits**
7. **Phase 11**: US9 (T069-T071) - **Performance**
8. **Phase 12-14**: US10-12 (T072-T081) - **Fonctionnalités avancées**
9. **Phase 15**: Polish (T082-T098) - **Finalisation**

## Exécution en Parallèle

### Tâches Parallélisables par Phase

**Phase 2 (Foundational)**:
- T006-T015 peuvent être développées en parallèle (fichiers différents)
- T016-T020 peuvent être développées en parallèle après T006-T015
- T021-T025 peuvent être développées en parallèle
- T026-T030 peuvent être développées en parallèle

**Phase 3-14 (User Stories)**:
- Chaque user story peut être développée indépendamment après Phase 2
- US1, US2, US4-6 peuvent être développées en parallèle après Phase 2
- US7 peut être développée en parallèle avec US1-US2
- US3, US8-12 peuvent être développées en parallèle après leurs dépendances

**Phase 15 (Polish)**:
- T082-T090 peuvent être développées en parallèle
- T091-T095 peuvent être développées en parallèle
- T096-T098 peuvent être développées en parallèle

### Exemple d'Exécution Parallèle

**Sprint 1** (Setup + Foundational):
- Développeur A: T006-T010 (Client Realtime + Cache Sync)
- Développeur B: T011-T015 (Broadcast Sync + Initialisation)
- Développeur C: T016-T020 (Hook Realtime + Provider)
- Développeur D: T021-T025 (File d'attente)

**Sprint 2** (MVP Core):
- Développeur A: T031-T035 (US1 - Assignation)
- Développeur B: T036-T040 (US2 - Changement statut)
- Développeur C: T046-T048 (US4 - Transition DEVIS_ENVOYE → ACCEPTE)
- Développeur D: T049-T051 (US5 - Transition ACCEPTE → EN_COURS)

**Sprint 3** (MVP Final):
- Développeur A: T052-T054 (US6 - Transition EN_COURS → TERMINE)
- Développeur B: T055-T062 (US7 - Modifications autres utilisateurs)
- Développeur C: T041-T045 (US3 - Compteurs)

## Résumé

- **Total des tâches**: 98
- **Tâches parallélisables**: 45
- **User Stories P1**: 6 (US1, US2, US4, US5, US6, US7)
- **User Stories P2**: 6 (US3, US8, US9, US10, US11, US12)
- **MVP Scope**: Phase 1-8 (T001-T054) - Setup + Foundational + US1, US2, US4-6, US7
- **Temps estimé MVP**: 2-3 sprints (selon équipe)
- **Temps estimé complet**: 4-5 sprints (selon équipe)

## Notes d'Implémentation

1. **Conformité Constitution**: Toutes les tâches respectent la constitution du projet (architecture modulaire, TypeScript strict, React Query, etc.)

2. **Réutilisation**: Les tâches réutilisent les APIs et hooks existants (`interventionsApiV2`, `useInterventionsQuery`, `useInterventionsMutations`, `interventionKeys`)

3. **Tests**: Les tests sont optionnels selon la spec, mais recommandés pour les fonctionnalités critiques (US7, US8)

4. **Performance**: Les optimisations (debounce, mise à jour optimiste, BroadcastChannel) sont intégrées dès la Phase 2

5. **Résilience**: La gestion d'erreurs et la file d'attente sont implémentées dès la Phase 2 pour garantir la robustesse du système
