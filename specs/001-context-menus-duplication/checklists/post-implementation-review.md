# Checklist de Revue Post-Implémentation : Qualité des Exigences

**Purpose**: Valider la qualité et la complétude des exigences suite aux problèmes d'implémentation identifiés
**Created**: 2025-01-16
**Feature**: [spec.md](../spec.md)

## Problèmes d'Implémentation Identifiés

Les problèmes suivants ont été identifiés lors de l'implémentation et indiquent des lacunes dans les exigences :

1. **Archivage des artisans** : Route complexe créée au lieu de réutiliser le module existant
2. **Bouton archiver** : Disponible pour les artisans déjà archivés
3. **Mise à jour UI** : Changement de statut nécessite un refresh manuel
4. **Authentification** : Erreurs 401 Unauthorized sur duplication et assignation
5. **Modifications BDD** : Toutes les modifications liées à la BDD n'ont pas fonctionné

---

## Requirement Completeness (Complétude des Exigences)

- [ ] CHK001 - Les exigences spécifient-elles explicitement comment l'archivage des artisans doit être implémenté (réutilisation du module existant vs création de nouvelle route) ? [Gap, Spec §FR-013]
- [ ] CHK002 - Les exigences définissent-elles les conditions d'affichage du bouton "Archiver" dans le menu contextuel (doit-il être masqué pour les artisans déjà archivés) ? [Gap, Spec §FR-001]
- [ ] CHK003 - Les exigences spécifient-elles le comportement de mise à jour de l'UI après un changement de statut d'intervention (mise à jour optimiste vs refresh complet) ? [Gap, Spec §FR-008, Spec §FR-015]
- [ ] CHK004 - Les exigences d'authentification/autorisation sont-elles documentées pour les endpoints de duplication (`/api/interventions/[id]/duplicate`) ? [Gap, Spec §FR-006]
- [ ] CHK005 - Les exigences d'authentification/autorisation sont-elles documentées pour les endpoints d'assignation (`/api/interventions/[id]/assign`) ? [Gap, Spec §FR-010]
- [ ] CHK006 - Les exigences spécifient-elles les prérequis d'authentification pour toutes les opérations modifiant la base de données (POST, PUT, PATCH) ? [Gap]
- [ ] CHK007 - Les exigences définissent-elles le comportement attendu en cas d'erreur d'authentification (401 Unauthorized) pour les actions du menu contextuel ? [Gap, Spec §FR-014]

## Requirement Clarity (Clarté des Exigences)

- [ ] CHK008 - Le terme "rafraîchir la vue" dans FR-015 est-il défini avec précision (invalidation de cache React Query, mise à jour optimiste, ou rechargement complet) ? [Clarity, Spec §FR-015]
- [ ] CHK009 - L'exigence FR-013 "utiliser le système d'archivage existant" est-elle suffisamment précise pour indiquer qu'il faut réutiliser le composant StatusReasonModal existant plutôt que créer une nouvelle route ? [Clarity, Spec §FR-013]
- [ ] CHK010 - Les exigences précisent-elles si les mises à jour de statut doivent être synchrones ou asynchrones du point de vue utilisateur ? [Clarity, Spec §FR-008]

## Requirement Consistency (Cohérence des Exigences)

- [ ] CHK011 - Les exigences de mise à jour UI sont-elles cohérentes entre FR-008 (transitions sans modale) et FR-015 (rafraîchir la vue) ? [Consistency, Spec §FR-008, Spec §FR-015]
- [ ] CHK012 - Les exigences d'archivage sont-elles cohérentes entre FR-001 (menu contextuel) et FR-013 (système existant) concernant l'implémentation technique ? [Consistency, Spec §FR-001, Spec §FR-013]

## Acceptance Criteria Quality (Qualité des Critères d'Acceptation)

- [ ] CHK013 - Les critères d'acceptation mesurent-ils la performance de mise à jour UI après changement de statut (délai de mise à jour visible) ? [Measurability, Spec §SC-003]
- [ ] CHK014 - Les critères d'acceptation incluent-ils la vérification que les actions du menu contextuel respectent les règles d'authentification/autorisation ? [Coverage, Gap]
- [ ] CHK015 - Les critères d'acceptation vérifient-ils que les boutons d'action ne sont pas disponibles lorsque l'état de l'entité ne le permet pas (artisan déjà archivé) ? [Coverage, Gap]

## Scenario Coverage (Couverture des Scénarios)

- [ ] CHK016 - Les exigences couvrent-elles le scénario où un artisan est déjà archivé lors de l'affichage du menu contextuel ? [Coverage, Edge Case, Gap]
- [ ] CHK017 - Les exigences couvrent-elles le scénario d'erreur d'authentification lors des opérations de duplication et assignation ? [Coverage, Exception Flow, Gap]
- [ ] CHK018 - Les exigences couvrent-elles le scénario de mise à jour optimiste de l'UI après changement de statut (affichage immédiat avant confirmation serveur) ? [Coverage, Gap]
- [ ] CHK019 - Les exigences couvrent-elles le scénario où l'utilisateur n'a pas les permissions nécessaires pour effectuer une action du menu contextuel ? [Coverage, Exception Flow, Gap]

## Edge Case Coverage (Couverture des Cas Limites)

- [ ] CHK020 - Les exigences définissent-elles le comportement lorsque l'utilisateur tente d'archiver un artisan déjà archivé ? [Edge Case, Gap]
- [ ] CHK021 - Les exigences définissent-elles le comportement lorsque l'authentification expire pendant une opération du menu contextuel ? [Edge Case, Gap]
- [ ] CHK022 - Les exigences définissent-elles le comportement lorsque plusieurs utilisateurs modifient simultanément la même entité via le menu contextuel ? [Edge Case, Gap]

## Non-Functional Requirements (Exigences Non-Fonctionnelles)

- [ ] CHK023 - Les exigences de sécurité spécifient-elles les mécanismes d'authentification requis pour les endpoints API créés (JWT, cookies, headers) ? [Security, Gap]
- [ ] CHK024 - Les exigences de performance spécifient-elles les délais maximum acceptables pour la mise à jour UI après une action du menu contextuel ? [Performance, Gap]
- [ ] CHK025 - Les exigences de sécurité définissent-elles les règles d'autorisation (qui peut archiver, dupliquer, assigner) ? [Security, Gap]

## Dependencies & Assumptions (Dépendances et Hypothèses)

- [ ] CHK026 - Les exigences documentent-elles l'hypothèse que le système d'authentification existant sera utilisé pour les nouveaux endpoints ? [Assumption, Gap]
- [ ] CHK027 - Les exigences documentent-elles la dépendance sur les composants UI existants (StatusReasonModal, ContextMenu) et leur réutilisation ? [Dependency, Spec §FR-011, Spec §FR-013]
- [ ] CHK028 - Les exigences documentent-elles l'hypothèse que React Query gérera la mise à jour optimiste de l'UI ? [Assumption, Gap]

## Ambiguities & Conflicts (Ambiguïtés et Conflits)

- [ ] CHK029 - Y a-t-il une ambiguïté entre "utiliser le système d'archivage existant" (FR-013) et la création d'une nouvelle route API pour l'archivage ? [Ambiguity, Spec §FR-013]
- [ ] CHK030 - Y a-t-il un conflit entre "rafraîchir la vue" (FR-015) et les attentes de performance (SC-004) concernant les délais d'affichage ? [Conflict, Spec §FR-015, Spec §SC-004]

## Implementation Guidance (Guidance d'Implémentation)

- [ ] CHK031 - Les exigences fournissent-elles des indications sur la réutilisation des composants existants plutôt que la création de nouvelles routes API ? [Implementation Guidance, Gap]
- [ ] CHK032 - Les exigences précisent-elles si les mises à jour doivent utiliser des mutations optimistes React Query pour une meilleure UX ? [Implementation Guidance, Gap]
- [ ] CHK033 - Les exigences documentent-elles les patterns d'authentification à suivre pour les nouveaux endpoints API (réutilisation des middlewares existants) ? [Implementation Guidance, Gap]

## Notes

- Cette checklist identifie les lacunes dans les exigences qui ont causé les problèmes d'implémentation
- Les problèmes d'authentification (401) indiquent que les exigences de sécurité n'étaient pas suffisamment détaillées
- Les problèmes de mise à jour UI indiquent que les exigences de comportement utilisateur n'étaient pas assez précises
- Les problèmes d'archivage indiquent que les exigences de réutilisation de composants existants n'étaient pas claires







