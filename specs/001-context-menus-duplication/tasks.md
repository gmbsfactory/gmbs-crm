# Tasks: Menus contextuels et duplication "Devis supp"

**Input**: Design documents from `/specs/001-context-menus-duplication/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 [P] Créer le fichier de types pour les menus contextuels dans `src/types/context-menu.ts`
- [ ] T002 [P] Vérifier que le composant ContextMenu existe dans `src/components/ui/context-menu.tsx` et qu'il est fonctionnel

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Modifier la fonction `duplicateIntervention` dans `src/lib/api/interventions.ts` pour ignorer la vérification de doublons (FR-006 : permettre plusieurs devis supplémentaires)
- [X] T004 Modifier l'endpoint API `/app/api/interventions/[id]/duplicate/route.ts` pour améliorer la gestion d'erreur avec message explicite "L'intervention originale n'existe plus" (User Story 5, scénario 5)
- [ ] T005 Créer l'endpoint API `/app/api/interventions/[id]/assign/route.ts` pour l'assignation "Je gère"
- [ ] T006 [P] Vérifier/créer l'endpoint API `/app/api/artisans/[id]/archive/route.ts` pour l'archivage d'artisan
- [X] T007 Vérifier que le hook `useInterventionContextMenu` dans `src/hooks/useInterventionContextMenu.ts` expose correctement les états `isLoading` pour chaque mutation (FR-014 : états disabled pendant mutations)
- [ ] T008 Créer le hook `useArtisanContextMenu` dans `src/hooks/useArtisanContextMenu.ts` avec gestion du StatusReasonModal

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Menus contextuels pour Artisans (Priority: P1) 🎯 MVP

**Goal**: Un gestionnaire peut accéder rapidement aux actions principales sur un artisan via un clic droit sur une ligne du tableau dans la page Artisans.

**Independent Test**: Ouvrir la page Artisans, cliquer droit sur une ligne, vérifier que le menu s'affiche avec les options : "Ouvrir fiche artisan", "Modifier fiche artisan", "Archiver". Tester chaque action séparément.

### Implementation for User Story 1

- [ ] T009 [US1] Intégrer le menu contextuel dans `src/components/artisans/ArtisanTable.tsx` en utilisant le hook `useArtisanContextMenu`
- [ ] T010 [US1] Ajouter le composant ContextMenu avec ContextMenuTrigger sur chaque TableRow dans ArtisanTable
- [ ] T011 [US1] Créer le composant InterventionContextMenuContent pour afficher les options : "Ouvrir fiche artisan", "Modifier fiche artisan", "Archiver"
- [ ] T012 [US1] Intégrer le StatusReasonModal dans le hook useArtisanContextMenu pour gérer l'archivage avec motif obligatoire
- [ ] T013 [US1] Ajouter la gestion d'erreurs et les toasts pour les actions du menu contextuel dans ArtisanTable
- [ ] T014 [US1] Tester que l'archivage crée bien un commentaire avec le motif dans la table comments

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Menus contextuels pour Interventions (Toutes les vues) (Priority: P1)

**Goal**: Un gestionnaire peut accéder aux actions de base sur une intervention via un clic droit depuis n'importe quelle vue (liste general, market, mes demandes etc.).

**Independent Test**: Tester sur chaque vue (liste, carte, market) en cliquant droit sur une intervention et vérifier la présence des options de base ("Ouvrir", "Ouvrir dans un nouvel onglet").

### Implementation for User Story 2

- [ ] T015 [US2] Intégrer le menu contextuel dans `src/components/interventions/InterventionTable.tsx` avec les options de base
- [ ] T016 [US2] Intégrer le menu contextuel dans `src/features/interventions/components/InterventionCard.tsx` avec les options de base
- [ ] T017 [US2] Intégrer le menu contextuel dans `src/components/interventions/views/TableView.tsx` avec les options de base
- [ ] T018 [US2] Intégrer le menu contextuel dans `src/components/interventions/views/MarketView.tsx` avec les options de base (préparer pour US6)
- [X] T019 [US2] Vérifier que le composant InterventionContextMenuContent dans `src/components/interventions/InterventionContextMenu.tsx` utilise les états `isLoading` du hook pour désactiver les options pendant les mutations (FR-014 : pas de spinner, juste disabled)
- [ ] T020 [US2] Ajouter la gestion de l'ouverture dans un nouvel onglet avec `window.open(/interventions/${id}, '_blank')`
- [ ] T021 [US2] Ajouter la gestion de l'ouverture de la modale de détail via le hook useInterventionModal existant

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Transition "Demandé → Devis envoyé" (Priority: P1)

**Goal**: Un gestionnaire peut passer rapidement une intervention de "Demandé" à "Devis envoyé" depuis le menu contextuel si l'ID devis est renseigné.

**Independent Test**: Vérifier que l'option n'apparaît que pour les interventions avec statut "Demandé" ET ID devis rempli. Tester la transition.

### Implementation for User Story 3

- [ ] T022 [US3] Ajouter la logique conditionnelle dans `useInterventionContextMenu` pour afficher "Passer à Devis envoyé" uniquement si `statut = "DEMANDE"` ET `id_inter` non null
- [ ] T023 [US3] Créer la mutation React Query `transitionToDevisEnvoye` dans `useInterventionContextMenu` qui appelle `transitionStatus`
- [ ] T024 [US3] Ajouter l'option "Passer à Devis envoyé" dans le composant InterventionContextMenuContent avec condition d'affichage
- [ ] T025 [US3] Ajouter l'invalidation des queries React Query après la transition pour rafraîchir la vue
- [ ] T026 [US3] Ajouter la gestion d'erreurs avec toast pour les échecs de transition
- [ ] T027 [US3] Tester que l'option n'apparaît pas si `id_inter` est null ou vide

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Transition "Devis envoyé → Accepté" (Priority: P1)

**Goal**: Un gestionnaire peut passer rapidement une intervention de "Devis envoyé" à "Accepté" depuis le menu contextuel.

**Independent Test**: Vérifier que l'option n'apparaît que pour les interventions avec statut "Devis envoyé". Tester la transition.

### Implementation for User Story 4

- [ ] T028 [US4] Ajouter la logique conditionnelle dans `useInterventionContextMenu` pour afficher "Passer à Accepté" uniquement si `statut = "DEVIS_ENVOYE"`
- [ ] T029 [US4] Créer la mutation React Query `transitionToAccepte` dans `useInterventionContextMenu` qui appelle `transitionStatus`
- [ ] T030 [US4] Ajouter l'option "Passer à Accepté" dans le composant InterventionContextMenuContent avec condition d'affichage
- [ ] T031 [US4] Ajouter l'invalidation des queries React Query après la transition pour rafraîchir la vue
- [ ] T032 [US4] Ajouter la gestion d'erreurs avec toast pour les échecs de transition
- [ ] T033 [US4] Tester que l'option n'apparaît pas pour les autres statuts

**Checkpoint**: At this point, User Stories 1, 2, 3, AND 4 should all work independently

---

## Phase 7: User Story 5 - Duplication "Devis supp" (Priority: P1)

**Goal**: Un gestionnaire peut dupliquer une intervention existante pour créer un nouveau devis supplémentaire.

**Independent Test**: Cliquer droit sur une intervention, sélectionner "Devis supp", vérifier qu'une nouvelle intervention est créée avec les bonnes données (contexte et consignes à null), et qu'un commentaire système est créé.

### Implementation for User Story 5

- [ ] T034 [US5] Créer la mutation React Query `duplicateDevisSupp` dans `useInterventionContextMenu` qui appelle l'endpoint `/api/interventions/[id]/duplicate`
- [ ] T035 [US5] Modifier la fonction `duplicateIntervention` dans `src/lib/api/interventions.ts` pour ignorer la vérification de doublons (FR-006 : commenter les lignes 344-348 qui lancent une erreur si doublons détectés)
- [ ] T036 [US5] Modifier l'endpoint `/app/api/interventions/[id]/duplicate/route.ts` pour améliorer la gestion d'erreur avec vérification explicite et message "L'intervention originale n'existe plus" (User Story 5, scénario 5)
- [ ] T037 [US5] Ajouter l'option "Devis supp" dans le composant InterventionContextMenuContent (toujours disponible)
- [ ] T038 [US5] Ajouter la redirection vers la nouvelle intervention après duplication réussie (ouvrir la modale ou mettre à jour la vue)
- [ ] T039 [US5] Ajouter l'invalidation des queries React Query après la duplication pour rafraîchir la vue
- [ ] T040 [US5] Ajouter la gestion d'erreurs avec toast pour les échecs de duplication
- [ ] T041 [US5] Vérifier que le commentaire système est créé avec `entity_type='intervention'`, `comment_type='system'`, `author_id` = utilisateur connecté
- [ ] T042 [US5] Tester que `contexte_intervention` et `consigne_intervention` sont bien null dans la nouvelle intervention
- [ ] T043 [US5] Tester le scénario d'erreur : si l'intervention originale est supprimée pendant la duplication, vérifier que le message d'erreur explicite "L'intervention originale n'existe plus" s'affiche (User Story 5, scénario 5)

**Checkpoint**: At this point, User Stories 1, 2, 3, 4, AND 5 should all work independently

---

## Phase 8: User Story 6 - Menu contextuel "Je gère" pour la vue Market uniquement (Priority: P2)

**Goal**: Un gestionnaire peut s'assigner rapidement une intervention depuis la vue Market (tablevue) via un clic droit. Cette option est disponible UNIQUEMENT dans la vue Market.

**Independent Test**: Vérifier que l'option "Je gère" n'apparaît que dans la vue Market et pas dans les autres vues. Tester l'assignation.

### Implementation for User Story 6

- [ ] T044 [US6] Ajouter le paramètre `viewType` dans `useInterventionContextMenu` pour distinguer la vue Market
- [ ] T045 [US6] Créer la mutation React Query `assignToMe` dans `useInterventionContextMenu` qui appelle l'endpoint `/api/interventions/[id]/assign`
- [ ] T046 [US6] Implémenter l'endpoint `/app/api/interventions/[id]/assign/route.ts` qui met à jour `assigned_user_id` avec l'ID de l'utilisateur connecté
- [ ] T047 [US6] Ajouter la logique conditionnelle pour afficher "Je gère" uniquement si `viewType === 'market'`
- [ ] T048 [US6] Ajouter l'option "Je gère" dans le composant InterventionContextMenuContent avec condition d'affichage basée sur `viewType`
- [ ] T049 [US6] Passer le paramètre `viewType='market'` uniquement dans `MarketView.tsx` lors de l'intégration du menu contextuel
- [ ] T050 [US6] Ajouter l'invalidation des queries React Query après l'assignation pour rafraîchir la vue
- [ ] T051 [US6] Ajouter la gestion d'erreurs avec toast pour les échecs d'assignation
- [ ] T052 [US6] Tester que l'option "Je gère" n'apparaît pas dans les autres vues (liste, carte, tableau standard)

**Checkpoint**: At this point, all user stories should be independently functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T053 [P] Ajouter les icônes Lucide appropriées pour chaque option de menu (FileText, ExternalLink, ArrowRight, CheckCircle, Copy, UserCheck, Archive, Pencil)
- [ ] T054 [P] Vérifier que tous les menus contextuels utilisent les états `isLoading` pour désactiver les options pendant les mutations (FR-014 : disabled sans spinner)
- [ ] T055 [P] Améliorer les messages d'erreur pour qu'ils soient plus explicites et utilisateur-friendly (notamment pour intervention supprimée)
- [ ] T056 [P] Ajouter des séparateurs ContextMenuSeparator pour organiser visuellement les options de menu
- [ ] T057 [P] Vérifier que tous les imports utilisent l'alias `@/` (jamais d'imports relatifs)
- [ ] T058 [P] Vérifier que tous les types sont réutilisés depuis `src/lib/api/v2/common/types.ts`
- [ ] T059 [P] Optimiser les performances en utilisant des mutations optimistes React Query où approprié
- [ ] T060 [P] Vérifier que le menu contextuel s'affiche avec un délai < 100ms (SC-004)
- [ ] T061 [P] Vérifier que la duplication "Devis supp" prend < 2 secondes (SC-002)
- [ ] T062 [P] Tester que les transitions de statut fonctionnent sans erreur dans 100% des cas où prérequis remplis (SC-003)
- [ ] T063 [P] Valider le quickstart.md pour s'assurer que toutes les étapes sont correctes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Depends on User Story 2 (menu contextuel de base)
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Depends on User Story 2 (menu contextuel de base)
- **User Story 5 (P1)**: Can start after Foundational (Phase 2) - Depends on User Story 2 (menu contextuel de base)
- **User Story 6 (P2)**: Can start after Foundational (Phase 2) - Depends on User Story 2 (menu contextuel de base)

### Within Each User Story

- Hooks before components
- API functions before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start in parallel (if team capacity allows)
- User Stories 1, 2, 3, 4, 5 can be worked on in parallel by different team members (with coordination)
- All Polish tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Menus contextuels Artisans)
4. Complete Phase 4: User Story 2 (Menus contextuels Interventions - base)
5. **STOP and VALIDATE**: Test User Stories 1 & 2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP Part 1!)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP Part 2!)
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Add User Story 6 → Test independently → Deploy/Demo
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Artisans)
   - Developer B: User Story 2 (Interventions base)
   - Developer C: User Story 3 (Transition Devis envoyé)
3. Then:
   - Developer A: User Story 4 (Transition Accepté)
   - Developer B: User Story 5 (Duplication)
   - Developer C: User Story 6 (Je gère)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Tous les imports doivent utiliser l'alias `@/` uniquement
- Réutiliser les composants et APIs existants autant que possible
- Respecter les patterns React Query établis dans le projet
- Utiliser `useToast` pour tous les messages d'erreur et de succès

