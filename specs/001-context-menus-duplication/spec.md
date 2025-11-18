# Feature Specification: Menus contextuels et duplication "Devis supp"

**Feature Branch**: `001-context-menus-duplication`  
**Created**: 2025-01-16  
**Status**: Draft  
**Input**: User description: "DUP-001 · « Devis supp » — duplication de dossier et UI-001 · Menus contextuels (clic droit) — Interventions & Artisans"

## Clarifications

### Session 2025-01-16

- Q: Comportement en cas de détection de doublons lors de la duplication → A: Permettre la duplication malgré les doublons détectés (ignorer la vérification)
- Q: Permissions requises pour les actions du menu contextuel → A: Tous les utilisateurs authentifiés peuvent utiliser toutes les actions (duplication, transitions, assignation, archivage)
- Q: Gestion des erreurs réseau et états de chargement → A: Désactiver l'option du menu pendant la mutation (état disabled) + toast d'erreur en cas d'échec (pas de spinner)
- Q: Comportement si l'intervention originale est supprimée pendant la duplication → A: Bloquer la duplication et afficher un message d'erreur explicite "L'intervention originale n'existe plus"
- Q: Comportement du menu contextuel pour les interventions archivées → A: Afficher toutes les options normalement (pas de restriction pour les interventions archivées)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menus contextuels pour Artisans (Priority: P1)

Un gestionnaire peut accéder rapidement aux actions principales sur un artisan via un clic droit sur une ligne du tableau dans la page Artisans.

**Why this priority**: Améliore l'efficacité du workflow quotidien en permettant un accès rapide aux actions fréquentes sans quitter la vue tableau. Réduit le nombre de clics nécessaires pour les opérations courantes.

**Independent Test**: Peut être testé indépendamment en ouvrant la page Artisans, cliquant droit sur une ligne, et vérifiant que le menu s'affiche avec les options correctes. Chaque action peut être testée séparément.

**Acceptance Scenarios**:

1. **Given** un utilisateur authentifié sur la page Artisans, **When** il fait un clic droit sur une ligne du tableau, **Then** un menu contextuel s'affiche avec les options : "Ouvrir fiche artisan", "Modifier fiche artisan", "Archiver"

2. **Given** le menu contextuel affiché, **When** l'utilisateur clique sur "Ouvrir fiche artisan", **Then** la modale de détail de l'artisan s'ouvre 

3. **Given** le menu contextuel affiché, **When** l'utilisateur clique sur "Modifier fiche artisan", **Then** la modale de détail de l'artisan s'ouvre 

4. **Given** le menu contextuel affiché, **When** l'utilisateur clique sur "Archiver", **Then** un pop-up s'affiche demandant le motif d'archivage (bloquant), et après validation, l'artisan est archivé avec le motif enregistré dans les commentaires

---

### User Story 2 - Menus contextuels pour Interventions (Toutes les vues) (Priority: P1)

Un gestionnaire peut accéder aux actions de base sur une intervention via un clic droit depuis n'importe quelle vue (liste general, market, mes demandes etc.).

**Why this priority**: Actions de base essentielles disponibles partout, permettant une navigation cohérente quelle que soit la vue utilisée.

**Independent Test**: Peut être testé indépendamment sur chaque vue (liste, carte, market) en cliquant droit sur une intervention et vérifiant la présence des options de base.

**Acceptance Scenarios**:

1. **Given** un utilisateur authentifié sur n'importe quelle vue des interventions (liste, carte, market, etc.), **When** il fait un clic droit sur une intervention, **Then** un menu contextuel s'affiche avec au minimum les options : "Ouvrir" et "Ouvrir dans un nouvel onglet"

2. **Given** le menu contextuel affiché, **When** l'utilisateur clique sur "Ouvrir", **Then** la modale de détail de l'intervention s'ouvre

3. **Given** le menu contextuel affiché, **When** l'utilisateur clique sur "Ouvrir dans un nouvel onglet" (ou Ctrl/Cmd + clic), **Then** une nouvelle page s'ouvre avec l'intervention 

---

### User Story 3 - Transition "Demandé → Devis envoyé" (Priority: P1)

Un gestionnaire peut passer rapidement une intervention de "Demandé" à "Devis envoyé" depuis le menu contextuel si l'ID devis est renseigné. 

**Why this priority**: Transition fréquente dans le workflow qui doit être accessible rapidement sans ouvrir la modale complète.

**Independent Test**: Peut être testé indépendamment en vérifiant que l'option n'apparaît que pour les interventions avec statut "Demandé" ET ID devis rempli.

**Acceptance Scenarios**:

1. **Given** une intervention avec statut "Demandé" et un ID devis renseigné (`id_inter` non null), **When** l'utilisateur fait un clic droit, **Then** le menu contextuel affiche une ligne sélectionnable "Passer à Devis envoyé"

2. **Given** une intervention avec statut "Demandé" mais sans ID devis renseigné (`id_inter` null ou vide), **When** l'utilisateur fait un clic droit, **Then** le menu contextuel n'affiche PAS la ligne "Passer à Devis envoyé"

3. **Given** le menu contextuel avec l'option "Passer à Devis envoyé" affichée, **When** l'utilisateur clique sur cette option, **Then** le statut de l'intervention est mis à jour vers "Devis envoyé" sans ouvrir de modale et la vue se rafraîchit

---

### User Story 4 - Transition "Devis envoyé → Accepté" (Priority: P1)

Un gestionnaire peut passer rapidement une intervention de "Devis envoyé" à "Accepté" depuis le menu contextuel.

**Why this priority**: Transition fréquente dans le workflow qui doit être accessible rapidement sans ouvrir la modale complète.

**Independent Test**: Peut être testé indépendamment en vérifiant que l'option n'apparaît que pour les interventions avec statut "Devis envoyé".

**Acceptance Scenarios**:

1. **Given** une intervention avec statut "Devis envoyé", **When** l'utilisateur fait un clic droit, **Then** le menu contextuel affiche une ligne sélectionnable "Passer à Accepté"

2. **Given** le menu contextuel avec l'option "Passer à Accepté" affichée, **When** l'utilisateur clique sur cette option, **Then** le statut de l'intervention est mis à jour vers "Accepté" sans ouvrir de modale et la vue se rafraîchit

---

### User Story 5 - Duplication "Devis supp" (Priority: P1)

Un gestionnaire peut dupliquer une intervention existante pour créer un nouveau devis supplémentaire

**Why this priority**: Fonctionnalité métier critique permettant de gérer les cas où plusieurs devis sont nécessaires pour une même demande. 

**Acceptance Scenarios**:

1. **Given** l'utilisateur fait un clic droit, **Then** le menu contextuel affiche une ligne sélectionnable "Devis supp"

2. **Given** le menu contextuel avec l'option "Devis supp" affichée, **When** l'utilisateur clique sur cette option, **Then** une nouvelle intervention est créée avec :

   - Toutes les données de l'intervention originale SAUF : ID (nouveau UUID), Contexte (`contexte_intervention` = null), Consignes (`consigne_intervention` = null)

   - Un commentaire automatique créé dans la table `comments` avec le contenu : "devis supp avec l'ancien ID [ID_ORIGINAL]" associé à la nouvelle intervention

   - Le même statut initial que l'intervention originale (ou "DEMANDE" par défaut)

3. **Given** la duplication réussie, **When** la nouvelle intervention est créée, **Then** l'utilisateur est redirigé vers la nouvelle intervention (modale ouverte ou vue mise à jour)

4. **Given** une erreur lors de la duplication, **When** l'opération échoue, **Then** un message d'erreur s'affiche et l'intervention originale reste inchangée

5. **Given** l'intervention originale est supprimée pendant le processus de duplication, **When** la duplication est tentée, **Then** la duplication est bloquée et un message d'erreur explicite "L'intervention originale n'existe plus" s'affiche

---

### User Story 6 - Menu contextuel "Je gère" pour la vue Market uniquement (Priority: P2)

Un gestionnaire peut s'assigner rapidement une intervention depuis la vue Market (tablevue) via un clic droit. Cette option est disponible UNIQUEMENT dans la vue Market.

**Why this priority**: Améliore l'efficacité dans la vue Market en permettant une assignation rapide sans ouvrir la modale complète. Disponible uniquement dans cette vue car c'est le contexte où cette action est la plus pertinente.

**Independent Test**: Peut être testé indépendamment en vérifiant que l'option "Je gère" n'apparaît que dans la vue Market et pas dans les autres vues.

**Acceptance Scenarios**:

1. **Given** un utilisateur authentifié sur la vue Market, **When** il fait un clic droit sur une intervention sur la carte, **Then** un menu contextuel s'affiche avec l'option "Je gère" en plus des options de base ("Ouvrir", "Ouvrir dans un nouvel onglet")

2. **Given** un utilisateur authentifié sur une autre vue que Market (liste, carte standard, etc.), **When** il fait un clic droit sur une intervention, **Then** le menu contextuel n'affiche PAS l'option "Je gère"

3. **Given** le menu contextuel avec l'option "Je gère" affichée dans la vue Market, **When** l'utilisateur clique sur "Je gère", **Then** l'intervention est assignée à l'utilisateur connecté (`assigned_user_id` mis à jour) et la vue se rafraîchit pour refléter le changement 

---

### Edge Cases

- Que se passe-t-il si l'utilisateur clique droit sur une intervention déjà archivée ? Le menu contextuel doit-il afficher des options différentes ? (Clarifié : Afficher toutes les options normalement, sans restriction)
- Comment le système gère-t-il les erreurs réseau lors des transitions de statut depuis le menu contextuel ? (Clarifié : Options désactivées pendant la mutation + toast d'erreur en cas d'échec)
- Que se passe-t-il si plusieurs utilisateurs tentent de dupliquer la même intervention simultanément ? (Clarifié : La duplication est permise même en cas de doublons détectés)
- Comment le système gère-t-il les permissions si un utilisateur n'a pas les droits pour archiver un artisan ? (Clarifié : Tous les utilisateurs authentifiés ont accès à toutes les actions)
- Que se passe-t-il si l'intervention originale est supprimée pendant le processus de duplication ? (Clarifié : Bloquer la duplication et afficher un message d'erreur explicite)
- Comment le système gère-t-il les cas où `id_inter` est présent mais invalide lors de la transition "Demandé → Devis envoyé" ?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST afficher un menu contextuel au clic droit sur les lignes du tableau Artisans avec les options : "Ouvrir fiche artisan", "Modifier fiche artisan", "Archiver"

- **FR-002**: Le système MUST afficher un menu contextuel au clic droit sur les interventions dans TOUTES les vues avec au minimum les options : "Ouvrir" et "Ouvrir dans un nouvel onglet"

- **FR-003**: Le système MUST afficher l'option "Passer à Devis envoyé" dans le menu contextuel UNIQUEMENT pour les interventions avec statut "Demandé" ET `id_inter` renseigné (non null et non vide)

- **FR-004**: Le système MUST afficher l'option "Passer à Accepté" dans le menu contextuel UNIQUEMENT pour les interventions avec statut "Devis envoyé"

- **FR-005**: Le système MUST afficher l'option "Devis supp" dans le menu contextuel pour toutes les interventions

- **FR-006**: Le système MUST permettre la duplication d'une intervention via l'option "Devis supp" qui crée une nouvelle intervention avec les données copiées sauf ID (nouveau UUID), Contexte (`contexte_intervention` = null), Consignes (`consigne_intervention` = null). La vérification de doublons est ignorée lors de la duplication "Devis supp" pour permettre la création de plusieurs devis supplémentaires pour une même demande.

- **FR-007**: Le système MUST créer automatiquement un commentaire dans la table `comments` avec `entity_type` = 'intervention', `entity_id` = ID de la nouvelle intervention, `content` = "devis supp avec l'ancien ID [ID_ORIGINAL]", `comment_type` = 'system', et `author_id` = ID de l'utilisateur qui effectue la duplication (pour tracer qui a créé le devis supplémentaire) 

- **FR-008**: Le système MUST permettre les transitions de statut depuis le menu contextuel sans ouvrir de modale

- **FR-009**: Le système MUST afficher l'option "Je gère" dans le menu contextuel UNIQUEMENT dans la vue Market

- **FR-010**: Le système MUST permettre l'assignation "Je gère" depuis le menu contextuel de la vue Market qui assigne l'intervention à l'utilisateur connecté (`assigned_user_id` mis à jour)

- **FR-011**: Le système MUST utiliser le composant ContextMenu existant (`@/components/ui/context-menu`) basé sur Radix UI

- **FR-012**: Le système MUST respecter les règles de workflow existantes pour les transitions de statut

- **FR-013**: Le système MUST utiliser le système d'archivage existant avec StatusReasonModal pour l'archivage des artisans

- **FR-014**: Le système MUST gérer les erreurs de manière appropriée lors des opérations du menu contextuel et afficher des messages d'erreur clairs à l'utilisateur via des toasts. Les options du menu contextuel doivent être désactivées (état disabled) pendant l'exécution des mutations pour éviter les clics multiples, sans afficher de spinner ou indicateur de chargement supplémentaire.

- **FR-015**: Le système MUST rafraîchir la vue après chaque action du menu contextuel pour refléter les changements

- **FR-016**: Le système MUST permettre l'accès à toutes les actions du menu contextuel (duplication, transitions de statut, assignation, archivage) à tous les utilisateurs authentifiés, sans restriction basée sur les rôles

### Key Entities *(include if feature involves data)*

- **Intervention**: Entité principale avec champs `id`, `id_inter` (ID intervention valide pour duplication), `contexte_intervention`, `consigne_intervention`, `commentaire_agent`, `statut_id`, `assigned_user_id`

- **Artisan**: Entité avec champs `id`, `statut_id` pour l'archivage

- **InterventionStatus**: Statuts possibles incluant "DEMANDE", "DEVIS_ENVOYE", "ACCEPTE"

- **ContextMenuAction**: Actions disponibles selon le contexte (intervention/artisan), le statut, la vue (Market vs autres), et les conditions métier (`id_inter`, `statut_id`)

- **Comment**: Entité de la table `comments` avec champs `entity_type` ('intervention'), `entity_id` (ID de l'intervention), `content` (texte du commentaire), `comment_type` ('system'), `author_id` (ID de l'utilisateur qui effectue l'action), `is_internal` (boolean)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les utilisateurs peuvent accéder aux actions principales (ouvrir, modifier, archiver) en moins de 2 clics depuis la vue tableau

- **SC-002**: La duplication "Devis supp" crée une nouvelle intervention en moins de 2 secondes

- **SC-003**: Les transitions de statut depuis le menu contextuel fonctionnent sans erreur dans 100% des cas où les prérequis sont remplis

- **SC-004**: Le menu contextuel s'affiche avec un délai de moins de 100ms après le clic droit

- **SC-005**: 90% des utilisateurs réussissent à utiliser le menu contextuel sans formation supplémentaire

- **SC-006**: Les options conditionnelles (transitions, duplication) n'apparaissent que lorsque les conditions sont remplies (0% de faux positifs)
