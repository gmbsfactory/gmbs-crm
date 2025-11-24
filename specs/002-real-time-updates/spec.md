# Feature Specification: Mise à jour en temps réel de la table vue des interventions

**Feature Branch**: `002-real-time-updates`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "on doit crée une nouvelle spec: j'ai pas mal de chose qui doivent etre revenu sur le crm surtout sur la tablevue, de la page interventions, actuellement le crm lors de changement dessu effectue des modification mais elle ne prenne effect visuellement que lors d'un refresh forcé de la page. cela est en parti du au données en cache (cache a conservé evidement) mais aussi au fait que les informations ne sont pas actualisée en temps reel apres modification, par exemple si je me situe dans la vue "market" (market = status demandé et assigné a =null) et que je clique sur le clic droit "je gère" on devient alors propriétaire de l'intervention alors l'intervention ne doit plus s'afficher dans market car elle est plus en assigne a ==null elle doit a present s'afficher dans la vue "mes demandes" cela doit prendre effet imédiatement . les pastilles de vues affichant les chiffre doivent aussi se mettre a jour logiquement quand on appuie sur "je gère" market doit perdre -& et mes emandes gagne +1; ceci ne doit pas etre fait de manière mathématique mais via les appell deja en place pour effectuer le count. ceci n'est qu'un exemple mais cela doit aussi etre effectif sur les changement de status (demandé →devis envoyé = doit aussi faire disparaitre l'intervention de mes demandes automatiquement). en fin de compte chaque changement dans le CRM doit verifié si des filtres en place ne sont pas bousculer par ces changement et mettre a jour instantanement l'affichage sans avoir besoin d'attendre que les nouvelle données se reactualise via le cache a 30s"

## Clarifications

### Session 2025-01-27

- Q: Comment les utilisateurs sont-ils authentifiés/autorisés pour recevoir uniquement les modifications auxquelles ils ont accès via Supabase Realtime ? → A: Utiliser Row Level Security (RLS) de Supabase pour filtrer automatiquement les événements Realtime selon les permissions utilisateur
- Q: Quel est le format et la durée d'affichage des indicateurs visuels lorsqu'un autre utilisateur modifie une intervention ? → A: Badge overlay, user-color coded, persists until remote edits complete fully
- Q: Quelle est la stratégie de retry et de gestion des erreurs réseau pour les modifications qui échouent ? → A: Retry avec backoff exponentiel (3 tentatives max : 1s, 2s, 4s), puis mise en file d'attente pour synchronisation différée
- Q: Quel est le format de notification pour les conflits de modification simultanée (dernier écrit gagne) ? → A: Toast notification avec détails : nom utilisateur, champ modifié, et valeur précédente
- Q: Quel est le comportement du basculement vers polling si Supabase Realtime est indisponible (fréquence, reconnexion) ? → A: Polling toutes les 5 secondes, tentative de reconnexion automatique à Realtime toutes les 30 secondes
- Q: Comment les événements Supabase Realtime interagissent-ils avec le cache TanStack Query existant (staleTime 30s) ? → A: Les événements Realtime mettent à jour le cache TanStack Query via setQueryData ET invalident silencieusement en arrière-plan pour garantir la cohérence
- Q: Comment est gérée la file d'attente de synchronisation différée (taille max, ordre de traitement) ? → A: File FIFO limitée à 50 modifications, traitement par batch toutes les 5 secondes
- Q: Comment sont gérés les appels API de comptage lors de modifications multiples rapides (debounce/throttle) ? → A: Debounce de 500ms pour regrouper les mises à jour de compteurs lors de modifications multiples rapides
- Q: Quel est le comportement lors de la perte de session utilisateur (déconnexion, expiration token) avec des modifications en file d'attente ? → A: Sauvegarder les modifications en file d'attente dans localStorage et les restaurer automatiquement à la reconnexion
- Q: Que se passe-t-il si une intervention est supprimée (soft delete) pendant qu'un utilisateur la visualise ou la modifie ? → A: Retirer immédiatement l'intervention de toutes les vues avec notification "Intervention supprimée", annuler toute modification en cours
- Q: Que se passe-t-il si un utilisateur perd l'accès à une intervention (changement de permissions RLS, réassignation) pendant qu'il la visualise ou la modifie ? → A: Retirer immédiatement l'intervention des vues avec notification "Accès retiré", annuler toute modification en cours
- Q: Que se passe-t-il si le localStorage est plein, inaccessible (mode privé), ou désactivé lors de la sauvegarde des modifications en file d'attente ? → A: Détecter l'échec de sauvegarde, afficher une notification d'avertissement, continuer avec la file d'attente en mémoire uniquement

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mise à jour immédiate après assignation "Je gère" (Priority: P1)

Un gestionnaire visualise la vue "Market" (interventions avec statut "Demandé" et sans assignation). Lorsqu'il clique sur "Je gère" dans le menu contextuel d'une intervention, l'intervention disparaît immédiatement de la vue Market et apparaît dans la vue "Mes demandes". Les compteurs (pastilles) des deux vues se mettent à jour instantanément pour refléter le changement.

**Why this priority**: C'est le cas d'usage principal décrit par l'utilisateur. C'est une action fréquente qui impacte directement la productivité des gestionnaires. Sans cette fonctionnalité, les utilisateurs doivent attendre un refresh forcé ou jusqu'à 30 secondes pour voir les changements, ce qui crée de la confusion et ralentit le workflow.

**Independent Test**: Peut être testé indépendamment en vérifiant que lorsqu'un utilisateur clique sur "Je gère" dans la vue Market, l'intervention disparaît immédiatement de la liste Market et que les compteurs se mettent à jour sans refresh de page.

**Acceptance Scenarios**:

1. **Given** un utilisateur authentifié visualisant la vue "Market" avec des interventions non assignées, **When** il clique sur "Je gère" pour une intervention, **Then** l'intervention disparaît immédiatement de la liste Market (sans refresh de page) et les compteurs de toutes les vues concernées se mettent à jour instantanément via les appels API de comptage existants

2. **Given** un utilisateur ayant assigné une intervention via "Je gère", **When** il visualise la vue "Mes demandes", **Then** l'intervention apparaît immédiatement dans cette vue avec les compteurs mis à jour

3. **Given** une intervention assignée via "Je gère", **When** l'utilisateur reste sur la vue Market, **Then** l'intervention n'apparaît plus dans la liste Market et le compteur Market diminue de 1

---

### User Story 2 - Mise à jour immédiate après changement de statut (Priority: P1)

Un gestionnaire modifie le statut d'une intervention (par exemple de "Demandé" à "Devis envoyé"). L'intervention disparaît immédiatement des vues filtrées par l'ancien statut et apparaît dans les vues correspondant au nouveau statut. Les compteurs de toutes les vues affectées se mettent à jour instantanément.

**Why this priority**: Les changements de statut sont des actions fréquentes dans le CRM. Sans mise à jour immédiate, les utilisateurs peuvent perdre le contexte de leur travail et doivent constamment rafraîchir la page pour voir l'état réel des données.

**Independent Test**: Peut être testé indépendamment en modifiant le statut d'une intervention et en vérifiant que l'intervention apparaît/disparaît immédiatement des vues appropriées selon les filtres de statut.

**Acceptance Scenarios**:

1. **Given** un utilisateur visualisant la vue "Mes demandes" (statut "Demandé"), **When** il modifie le statut d'une intervention de "Demandé" à "Devis envoyé", **Then** l'intervention disparaît immédiatement de la vue "Mes demandes" et les compteurs se mettent à jour sans refresh

2. **Given** une intervention avec un nouveau statut, **When** l'utilisateur visualise une vue filtrée par ce nouveau statut, **Then** l'intervention apparaît immédiatement dans cette vue avec les compteurs mis à jour

3. **Given** une modification de statut, **When** plusieurs vues sont ouvertes simultanément, **Then** toutes les vues concernées se mettent à jour immédiatement selon leurs filtres respectifs

---

### User Story 3 - Mise à jour automatique des compteurs après toute modification (Priority: P2)

Lorsqu'une intervention est modifiée (assignation, changement de statut, ou tout autre changement affectant les filtres), tous les compteurs (pastilles) des vues concernées se mettent à jour automatiquement en appelant les API de comptage existantes, sans calcul mathématique local.

**Why this priority**: Les compteurs doivent toujours refléter l'état réel des données. La mise à jour via les appels API garantit la cohérence et évite les erreurs de calcul local. Cependant, cette fonctionnalité dépend des deux premières user stories pour être complète.

**Independent Test**: Peut être testé indépendamment en vérifiant que les compteurs se mettent à jour après chaque modification d'intervention, en utilisant les appels API de comptage existants plutôt que des calculs locaux.

**Acceptance Scenarios**:

1. **Given** une modification d'intervention affectant les filtres d'une vue, **When** la modification est effectuée, **Then** le compteur de cette vue se met à jour immédiatement via un appel API de comptage (pas de calcul mathématique local)

2. **Given** une modification affectant plusieurs vues simultanément, **When** la modification est effectuée, **Then** tous les compteurs des vues concernées se mettent à jour via leurs appels API respectifs

3. **Given** un utilisateur visualisant plusieurs onglets de vues, **When** une modification est effectuée dans un onglet, **Then** les compteurs de tous les onglets concernés se mettent à jour automatiquement

---

### User Story 4 - Transition DEVIS_ENVOYE → ACCEPTE (Priority: P1)

Un gestionnaire modifie le statut d'une intervention de "Devis envoyé" à "Accepté". L'intervention disparaît immédiatement des vues filtrées par "Devis envoyé" et apparaît dans les vues correspondant au statut "Accepté". Les compteurs de toutes les vues affectées se mettent à jour instantanément.

**Why this priority**: Cette transition est une étape critique du workflow qui indique l'acceptation du devis par le client. Les gestionnaires doivent voir immédiatement cette transition pour planifier les interventions.

**Independent Test**: Peut être testé indépendamment en modifiant le statut d'une intervention de "Devis envoyé" à "Accepté" et en vérifiant que l'intervention apparaît/disparaît immédiatement des vues appropriées.

**Acceptance Scenarios**:

1. **Given** un utilisateur visualisant une vue filtrée par "Devis envoyé", **When** il modifie le statut d'une intervention à "Accepté", **Then** l'intervention disparaît immédiatement de cette vue et les compteurs se mettent à jour sans refresh

2. **Given** une intervention avec le statut "Accepté", **When** l'utilisateur visualise une vue filtrée par "Accepté", **Then** l'intervention apparaît immédiatement dans cette vue avec les compteurs mis à jour

---

### User Story 5 - Transition ACCEPTE → EN_COURS (Priority: P1)

Un gestionnaire modifie le statut d'une intervention de "Accepté" à "En cours". L'intervention disparaît immédiatement des vues filtrées par "Accepté" et apparaît dans les vues correspondant au statut "En cours". Les compteurs de toutes les vues affectées se mettent à jour instantanément.

**Why this priority**: Cette transition marque le début de l'intervention sur le terrain. Les gestionnaires doivent voir immédiatement cette transition pour suivre l'avancement des travaux.

**Independent Test**: Peut être testé indépendamment en modifiant le statut d'une intervention de "Accepté" à "En cours" et en vérifiant que l'intervention apparaît/disparaît immédiatement des vues appropriées.

**Acceptance Scenarios**:

1. **Given** un utilisateur visualisant une vue filtrée par "Accepté", **When** il modifie le statut d'une intervention à "En cours", **Then** l'intervention disparaît immédiatement de cette vue et les compteurs se mettent à jour sans refresh

2. **Given** une intervention avec le statut "En cours", **When** l'utilisateur visualise une vue filtrée par "En cours", **Then** l'intervention apparaît immédiatement dans cette vue avec les compteurs mis à jour

---

### User Story 6 - Transition EN_COURS → TERMINE (Priority: P1)

Un gestionnaire modifie le statut d'une intervention de "En cours" à "Terminé". L'intervention disparaît immédiatement des vues filtrées par "En cours" et apparaît dans les vues correspondant au statut "Terminé". Les compteurs de toutes les vues affectées se mettent à jour instantanément.

**Why this priority**: Cette transition marque la fin de l'intervention. Les gestionnaires doivent voir immédiatement cette transition pour suivre la clôture des dossiers et la facturation.

**Independent Test**: Peut être testé indépendamment en modifiant le statut d'une intervention de "En cours" à "Terminé" et en vérifiant que l'intervention apparaît/disparaît immédiatement des vues appropriées.

**Acceptance Scenarios**:

1. **Given** un utilisateur visualisant une vue filtrée par "En cours", **When** il modifie le statut d'une intervention à "Terminé", **Then** l'intervention disparaît immédiatement de cette vue et les compteurs se mettent à jour sans refresh

2. **Given** une intervention avec le statut "Terminé", **When** l'utilisateur visualise une vue filtrée par "Terminé", **Then** l'intervention apparaît immédiatement dans cette vue avec les compteurs mis à jour

---

### User Story 7 - Voir les modifications des autres utilisateurs en temps réel (Priority: P1)

Lorsqu'un utilisateur A modifie une intervention (statut, assignation, ou autre champ), tous les autres utilisateurs visualisant cette intervention ou des vues contenant cette intervention voient la modification apparaître automatiquement en temps réel, sans avoir besoin de rafraîchir leur page.

**Why this priority**: La collaboration en équipe nécessite que tous les membres voient les modifications des autres en temps réel. Sans cette fonctionnalité, les utilisateurs travaillent avec des données obsolètes, ce qui peut causer des conflits et des erreurs.

**Independent Test**: Peut être testé indépendamment avec deux utilisateurs : l'un modifie une intervention et l'autre voit la modification apparaître automatiquement dans son interface.

**Acceptance Scenarios**:

1. **Given** deux utilisateurs A et B visualisant la même intervention ou des vues contenant cette intervention, **When** l'utilisateur A modifie le statut de l'intervention, **Then** l'utilisateur B voit la modification apparaître automatiquement dans son interface en moins de 2 secondes

2. **Given** plusieurs utilisateurs visualisant différentes vues contenant la même intervention, **When** un utilisateur modifie l'intervention, **Then** tous les autres utilisateurs voient la modification apparaître automatiquement dans leurs vues respectives

3. **Given** un utilisateur visualisant une intervention, **When** un autre utilisateur modifie cette intervention, **Then** un badge overlay codé par couleur utilisateur apparaît pour signaler la modification et persiste jusqu'à ce que les modifications distantes soient complètement synchronisées

---

### User Story 8 - Gérer les conflits de modification simultanée (Priority: P2)

Lorsque deux utilisateurs modifient simultanément la même intervention, le système applique une stratégie de résolution de conflit (dernier écrit gagne) et notifie les utilisateurs concernés de la modification conflictuelle.

**Why this priority**: Les conflits de modification simultanée sont inévitables dans un environnement multi-utilisateurs. Le système doit gérer ces conflits de manière prévisible et informer les utilisateurs.

**Independent Test**: Peut être testé indépendamment avec deux utilisateurs modifiant simultanément la même intervention et en vérifiant que le système applique la stratégie de résolution de conflit et notifie les utilisateurs.

**Acceptance Scenarios**:

1. **Given** deux utilisateurs A et B modifiant simultanément la même intervention, **When** les deux modifications sont envoyées au serveur, **Then** le système applique la stratégie "dernier écrit gagne" et notifie l'utilisateur dont la modification a été écrasée via une toast notification contenant le nom de l'utilisateur ayant effectué la modification, le champ modifié, et la valeur précédente

2. **Given** un utilisateur modifiant une intervention, **When** un autre utilisateur modifie la même intervention avant que la première modification ne soit synchronisée, **Then** le système détecte le conflit, applique la stratégie "dernier écrit gagne", et affiche une toast notification avec les détails (nom utilisateur, champ modifié, valeur précédente) à l'utilisateur dont la modification a été écrasée

---

### User Story 9 - Performance avec 10 utilisateurs simultanés (Priority: P2)

Le système maintient des performances acceptables (mise à jour en moins de 2 secondes) même lorsque 10 utilisateurs modifient simultanément différentes interventions dans le système.

**Why this priority**: Le CRM est utilisé par plusieurs gestionnaires simultanément. Le système doit rester performant même sous charge pour garantir une expérience utilisateur fluide.

**Independent Test**: Peut être testé indépendamment avec 10 utilisateurs simultanés effectuant des modifications et en mesurant le temps de synchronisation pour chaque utilisateur.

**Acceptance Scenarios**:

1. **Given** 10 utilisateurs modifiant simultanément différentes interventions, **When** chaque utilisateur effectue une modification, **Then** tous les autres utilisateurs voient les modifications apparaître en moins de 2 secondes

2. **Given** 10 utilisateurs visualisant différentes vues, **When** plusieurs utilisateurs modifient des interventions simultanément, **Then** les compteurs de toutes les vues se mettent à jour correctement sans dégradation de performance

---

### User Story 10 - Création d'intervention en temps réel (Priority: P2)

Lorsqu'un utilisateur crée une nouvelle intervention, tous les autres utilisateurs visualisant des vues où cette intervention devrait apparaître voient la nouvelle intervention apparaître automatiquement en temps réel.

**Why this priority**: Les nouvelles interventions doivent être visibles immédiatement pour tous les membres de l'équipe, notamment pour la vue "Market" où les gestionnaires cherchent de nouvelles opportunités.

**Independent Test**: Peut être testé indépendamment avec deux utilisateurs : l'un crée une intervention et l'autre voit la nouvelle intervention apparaître automatiquement dans les vues appropriées.

**Acceptance Scenarios**:

1. **Given** deux utilisateurs A et B, où A crée une nouvelle intervention et B visualise la vue "Market", **When** l'utilisateur A crée l'intervention, **Then** l'utilisateur B voit la nouvelle intervention apparaître automatiquement dans la vue "Market" en moins de 2 secondes

2. **Given** une nouvelle intervention créée, **When** plusieurs utilisateurs visualisent différentes vues où cette intervention devrait apparaître, **Then** tous les utilisateurs voient la nouvelle intervention apparaître automatiquement dans leurs vues respectives avec les compteurs mis à jour

---

### User Story 11 - Modification de champs autres que statut/assignation (Priority: P2)

Lorsqu'un utilisateur modifie un champ d'intervention autre que le statut ou l'assignation (par exemple, adresse, date, métier, agence), tous les utilisateurs visualisant cette intervention voient la modification apparaître automatiquement en temps réel.

**Why this priority**: Tous les champs d'une intervention peuvent affecter les filtres des vues. Les modifications doivent être synchronisées pour maintenir la cohérence des données.

**Independent Test**: Peut être testé indépendamment en modifiant différents champs d'une intervention et en vérifiant que les modifications apparaissent automatiquement pour tous les utilisateurs concernés.

**Acceptance Scenarios**:

1. **Given** deux utilisateurs visualisant la même intervention, **When** l'un modifie un champ (adresse, date, métier, agence), **Then** l'autre voit la modification apparaître automatiquement en temps réel

2. **Given** une modification de champ affectant les filtres d'une vue, **When** la modification est effectuée, **Then** l'intervention apparaît/disparaît immédiatement des vues concernées selon les nouveaux filtres

---

### User Story 12 - Changement d'artisan assigné (Priority: P2)

Lorsqu'un utilisateur assigne ou modifie l'artisan assigné à une intervention, tous les utilisateurs visualisant cette intervention ou des vues filtrées par artisan voient la modification apparaître automatiquement en temps réel.

**Why this priority**: L'assignation d'artisan est une action fréquente qui affecte le suivi des interventions. Les modifications doivent être visibles immédiatement pour tous les membres de l'équipe.

**Independent Test**: Peut être testé indépendamment en modifiant l'artisan assigné à une intervention et en vérifiant que la modification apparaît automatiquement pour tous les utilisateurs concernés.

**Acceptance Scenarios**:

1. **Given** deux utilisateurs visualisant la même intervention, **When** l'un modifie l'artisan assigné, **Then** l'autre voit la modification apparaître automatiquement en temps réel

2. **Given** une modification d'artisan assigné, **When** des utilisateurs visualisent des vues filtrées par artisan, **Then** l'intervention apparaît/disparaît immédiatement des vues concernées selon les nouveaux filtres avec les compteurs mis à jour

---

## Toutes les Transitions de Statut

Le système doit gérer en temps réel toutes les transitions de statut autorisées suivantes :

### Transitions depuis DEMANDE
- **DEMANDE → DEVIS_ENVOYE** : L'intervention disparaît des vues "Market" et "Mes demandes", apparaît dans les vues "Devis envoyé"
- **DEMANDE → VISITE_TECHNIQUE** : L'intervention disparaît des vues "Market" et "Mes demandes", apparaît dans les vues "Visite technique"
- **DEMANDE → REFUSE** : L'intervention disparaît de toutes les vues actives, apparaît dans les vues "Refusé"
- **DEMANDE → ANNULE** : L'intervention disparaît de toutes les vues actives, apparaît dans les vues "Annulé"

### Transitions depuis DEVIS_ENVOYE
- **DEVIS_ENVOYE → ACCEPTE** : L'intervention disparaît des vues "Devis envoyé", apparaît dans les vues "Accepté"
- **DEVIS_ENVOYE → REFUSE** : L'intervention disparaît des vues "Devis envoyé", apparaît dans les vues "Refusé"
- **DEVIS_ENVOYE → STAND_BY** : L'intervention disparaît des vues "Devis envoyé", apparaît dans les vues "Stand-by"

### Transitions depuis ACCEPTE
- **ACCEPTE → EN_COURS** : L'intervention disparaît des vues "Accepté", apparaît dans les vues "En cours"
- **ACCEPTE → STAND_BY** : L'intervention disparaît des vues "Accepté", apparaît dans les vues "Stand-by"
- **ACCEPTE → ANNULE** : L'intervention disparaît des vues "Accepté", apparaît dans les vues "Annulé"
- **ACCEPTE → TERMINE** : L'intervention disparaît des vues "Accepté", apparaît dans les vues "Terminé"

### Transitions depuis EN_COURS
- **EN_COURS → TERMINE** : L'intervention disparaît des vues "En cours", apparaît dans les vues "Terminé"
- **EN_COURS → SAV** : L'intervention disparaît des vues "En cours", apparaît dans les vues "SAV"
- **EN_COURS → STAND_BY** : L'intervention disparaît des vues "En cours", apparaît dans les vues "Stand-by"
- **EN_COURS → VISITE_TECHNIQUE** : L'intervention disparaît des vues "En cours", apparaît dans les vues "Visite technique"

### Transitions depuis VISITE_TECHNIQUE
- **VISITE_TECHNIQUE → ACCEPTE** : L'intervention disparaît des vues "Visite technique", apparaît dans les vues "Accepté"
- **VISITE_TECHNIQUE → REFUSE** : L'intervention disparaît des vues "Visite technique", apparaît dans les vues "Refusé"
- **VISITE_TECHNIQUE → STAND_BY** : L'intervention disparaît des vues "Visite technique", apparaît dans les vues "Stand-by"

### Transitions depuis TERMINE
- **TERMINE → SAV** : L'intervention disparaît des vues "Terminé", apparaît dans les vues "SAV"

### Transitions depuis STAND_BY
- **STAND_BY → ACCEPTE** : L'intervention disparaît des vues "Stand-by", apparaît dans les vues "Accepté"
- **STAND_BY → EN_COURS** : L'intervention disparaît des vues "Stand-by", apparaît dans les vues "En cours"
- **STAND_BY → ANNULE** : L'intervention disparaît des vues "Stand-by", apparaît dans les vues "Annulé"

### Transitions depuis SAV
- **SAV → TERMINE** : L'intervention disparaît des vues "SAV", apparaît dans les vues "Terminé"

**Note** : Pour chaque transition, les compteurs de toutes les vues concernées doivent se mettre à jour automatiquement via les appels API de comptage existants.

---

### Edge Cases

- Que se passe-t-il si une modification échoue côté serveur mais que l'interface a déjà été mise à jour de manière optimiste ? Le système doit restaurer l'état précédent et afficher un message d'erreur approprié.

- Comment le système gère-t-il les modifications simultanées de plusieurs utilisateurs sur la même intervention ? Les modifications doivent être synchronisées via Supabase Realtime et les utilisateurs doivent voir les changements des autres utilisateurs après un court délai (moins de 2 secondes).

- Que se passe-t-il si l'utilisateur effectue une modification alors que la connexion réseau est instable ? Le système doit gérer les erreurs réseau gracieusement avec un retry automatique utilisant un backoff exponentiel (3 tentatives : 1s, 2s, 4s). Si toutes les tentatives échouent, la modification est mise en file d'attente FIFO limitée à 50 modifications pour synchronisation différée. La file est traitée par batch toutes les 5 secondes dès que la connexion est rétablie. Si la file est pleine, les modifications les plus anciennes sont supprimées pour faire place aux nouvelles. Un indicateur de statut de connexion doit être affiché pour informer l'utilisateur.

- Que se passe-t-il si l'utilisateur perd sa session (déconnexion, expiration du token) alors qu'il a des modifications en file d'attente ? Les modifications en file d'attente doivent être sauvegardées dans localStorage avec un timestamp. À la reconnexion, le système doit restaurer automatiquement ces modifications et les traiter dans l'ordre (FIFO) dès que la connexion est rétablie. Les modifications sauvegardées doivent être supprimées du localStorage une fois synchronisées avec succès.

- Que se passe-t-il si le localStorage est plein, inaccessible (mode privé), ou désactivé lors de la sauvegarde des modifications en file d'attente ? Le système doit détecter l'échec de sauvegarde (try/catch) et afficher une notification d'avertissement à l'utilisateur indiquant que les modifications ne seront pas conservées en cas de perte de session. Le système doit continuer à fonctionner avec la file d'attente en mémoire uniquement. Si le localStorage devient disponible plus tard, le système doit tenter de sauvegarder les modifications restantes en file d'attente.

- Comment le système gère-t-il les modifications lorsque l'utilisateur a plusieurs onglets ouverts avec différentes vues ? Tous les onglets doivent se mettre à jour de manière cohérente via Supabase Realtime, avec synchronisation du cache TanStack Query entre les onglets.

- Comment le système gère-t-il la cohérence entre le cache TanStack Query et les événements Realtime ? Les événements Realtime mettent à jour immédiatement le cache via `setQueryData` pour la réactivité, puis invalident silencieusement les queries en arrière-plan pour garantir que les données affichées correspondent exactement aux données serveur, même si d'autres modifications ont eu lieu entre-temps.

- Que se passe-t-il si une vue est filtrée par plusieurs critères et qu'une modification affecte seulement certains de ces critères ? L'intervention doit rester visible si elle correspond toujours aux filtres, ou disparaître si elle ne correspond plus.

- Comment le système gère-t-il toutes les transitions de statut possibles (DEMANDE → DEVIS_ENVOYE, DEVIS_ENVOYE → ACCEPTE, ACCEPTE → EN_COURS, EN_COURS → TERMINE, etc.) ? Chaque transition doit déclencher une mise à jour immédiate de toutes les vues concernées.

- Que se passe-t-il si Supabase Realtime est temporairement indisponible ? Le système doit basculer gracieusement vers un mode de synchronisation par polling (toutes les 5 secondes) avec notification à l'utilisateur. Le système doit tenter de se reconnecter automatiquement à Realtime toutes les 30 secondes et revenir au mode Realtime dès que la connexion est rétablie.

- Comment le système gère-t-il les indicateurs visuels lorsque plusieurs utilisateurs modifient simultanément différentes interventions ? Chaque modification doit avoir son propre badge overlay codé par couleur utilisateur, permettant d'identifier visuellement qui a effectué chaque modification. Les badges persistent jusqu'à ce que les modifications distantes soient complètement synchronisées.

- Que se passe-t-il si une intervention est supprimée (soft delete) pendant qu'un utilisateur la visualise ou la modifie ? Le système doit retirer immédiatement l'intervention de toutes les vues où elle apparaît et afficher une notification toast "Intervention supprimée". Si l'utilisateur était en train de modifier cette intervention, toute modification en cours doit être annulée et l'interface doit revenir à l'état précédent. Les compteurs des vues concernées doivent être mis à jour immédiatement.

- Que se passe-t-il si un utilisateur perd l'accès à une intervention (changement de permissions RLS, réassignation à un autre utilisateur) pendant qu'il la visualise ou la modifie ? Le système doit retirer immédiatement l'intervention de toutes les vues où elle apparaît et afficher une notification toast "Accès retiré". Si l'utilisateur était en train de modifier cette intervention, toute modification en cours doit être annulée et l'interface doit revenir à l'état précédent. Les événements Realtime filtrés par RLS ne seront plus reçus pour cette intervention, et les compteurs des vues concernées doivent être mis à jour immédiatement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST mettre à jour immédiatement l'affichage de la table vue après toute modification d'intervention (assignation, changement de statut, etc.) sans nécessiter de refresh forcé de la page

- **FR-002**: Le système MUST faire disparaître immédiatement une intervention d'une vue lorsque la modification effectuée fait que l'intervention ne correspond plus aux filtres de cette vue

- **FR-003**: Le système MUST faire apparaître immédiatement une intervention dans une vue lorsque la modification effectuée fait que l'intervention correspond maintenant aux filtres de cette vue

- **FR-004**: Le système MUST mettre à jour automatiquement tous les compteurs (pastilles) des vues concernées après chaque modification d'intervention via les appels API de comptage existants (pas de calcul mathématique local). Les appels API de comptage doivent être debouncés avec un délai de 500ms pour regrouper les mises à jour lors de modifications multiples rapides et éviter une surcharge du serveur

- **FR-005**: Le système MUST vérifier automatiquement si les filtres actifs d'une vue sont affectés par une modification et mettre à jour l'affichage en conséquence

- **FR-006**: Le système MUST conserver le système de cache TanStack Query existant (staleTime 30s) tout en permettant les mises à jour en temps réel. Les événements Supabase Realtime doivent mettre à jour le cache TanStack Query via `setQueryData` pour une réactivité immédiate, ET invalider silencieusement les queries en arrière-plan pour garantir la cohérence des données avec le serveur

- **FR-007**: Le système MUST mettre à jour toutes les vues ouvertes simultanément lorsqu'une modification affecte plusieurs vues

- **FR-008**: Le système MUST gérer les erreurs de modification de manière gracieuse en restaurant l'état précédent et en affichant un message d'erreur approprié si une modification échoue côté serveur. En cas d'erreur réseau, le système doit effectuer un retry avec backoff exponentiel (3 tentatives maximum : 1s, 2s, 4s), puis mettre la modification en file d'attente FIFO limitée à 50 modifications pour synchronisation différée. La file est traitée par batch toutes les 5 secondes dès que la connexion est rétablie. Les modifications en file d'attente doivent être sauvegardées dans localStorage et restaurées automatiquement en cas de perte de session (déconnexion, expiration du token)

- **FR-009**: Le système MUST synchroniser les modifications entre plusieurs onglets ouverts par le même utilisateur

- **FR-010**: Le système MUST utiliser Supabase Realtime pour synchroniser les modifications entre utilisateurs, avec Row Level Security (RLS) activé pour filtrer automatiquement les événements selon les permissions utilisateur

- **FR-011**: Le système MUST afficher un badge overlay codé par couleur utilisateur lorsqu'un autre utilisateur modifie une intervention, ce badge persiste jusqu'à ce que les modifications distantes soient complètement synchronisées

- **FR-012**: Le système MUST gérer les conflits de modification avec une stratégie définie (dernier écrit gagne) et notifier l'utilisateur dont la modification a été écrasée via une toast notification contenant le nom de l'utilisateur ayant effectué la modification, le champ modifié, et la valeur précédente

### Key Entities *(include if feature involves data)*

- **Intervention**: Représente une intervention dans le CRM avec ses attributs (statut, assignation, dates, artisan, agence, métier, etc.). Les modifications de ces attributs déclenchent les mises à jour en temps réel via Supabase Realtime.

- **Vue (View)**: Représente une configuration d'affichage avec des filtres spécifiques (statut, assignation, dates, etc.). Chaque vue doit vérifier si ses filtres sont affectés par une modification et mettre à jour son affichage en conséquence.

- **Compteur (Badge)**: Représente le nombre total d'interventions correspondant aux filtres d'une vue. Les compteurs doivent être recalculés via les API existantes après chaque modification.

- **Filtre (Filter)**: Représente un critère de filtrage appliqué à une vue (par exemple, statut="Demandé", assignation=null). Les modifications d'interventions doivent être évaluées contre ces filtres pour déterminer si l'affichage doit être mis à jour.

- **Transition de Statut**: Représente un changement de statut autorisé d'une intervention (par exemple, DEMANDE → DEVIS_ENVOYE). Chaque transition doit déclencher une mise à jour immédiate de toutes les vues concernées.

- **Indicateur Visuel de Modification**: Représente un badge overlay codé par couleur utilisateur affiché lorsqu'un autre utilisateur modifie une intervention. Ce badge persiste jusqu'à ce que les modifications distantes soient complètement synchronisées, permettant aux utilisateurs d'identifier visuellement qui a effectué la modification et quand elle est terminée.

## Architecture Temps Réel Multi-Utilisateurs

Le système utilise Supabase Realtime pour synchroniser les modifications entre utilisateurs. Cette architecture permet :

- **Synchronisation bidirectionnelle** : Les modifications effectuées par un utilisateur sont immédiatement propagées à tous les autres utilisateurs concernés
- **Sécurité** : Row Level Security (RLS) de Supabase filtre automatiquement les événements Realtime selon les permissions utilisateur, garantissant que chaque utilisateur ne reçoit que les modifications d'interventions auxquelles il a accès
- **Intégration avec le cache TanStack Query** : Les événements Realtime mettent à jour immédiatement le cache TanStack Query via `setQueryData` pour une réactivité optimale (< 500ms), tout en invalidant silencieusement les queries en arrière-plan pour garantir la cohérence avec le serveur. Le cache existant (staleTime 30s) est conservé et utilisé pour les chargements initiaux et la résilience réseau
- **Gestion des conflits** : Stratégie "dernier écrit gagne" avec notification aux utilisateurs concernés
- **Performance** : Mise à jour en moins de 2 secondes même avec 10 utilisateurs simultanés
- **Résilience** : Basculement automatique vers un mode de synchronisation par polling (toutes les 5 secondes) si Supabase Realtime est indisponible, avec tentative de reconnexion automatique à Realtime toutes les 30 secondes

Les modifications suivantes déclenchent des événements Supabase Realtime :
- Création d'intervention
- Modification de statut (toutes les transitions autorisées)
- Modification d'assignation utilisateur ("Je gère")
- Modification d'artisan assigné
- Modification de tout autre champ (adresse, date, métier, agence, etc.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les modifications d'interventions sont visibles dans l'interface utilisateur en moins de 500 millisecondes après l'action utilisateur, sans nécessiter de refresh de page

- **SC-002**: Les compteurs des vues se mettent à jour automatiquement dans 100% des cas après une modification d'intervention, sans erreur de synchronisation

- **SC-003**: Les utilisateurs peuvent effectuer des modifications successives sans attendre de refresh de page, avec un taux de succès de 99% ou plus pour la synchronisation des données

- **SC-004**: Le système maintient la cohérence des données entre toutes les vues ouvertes simultanément, avec une synchronisation réussie dans 100% des cas

- **SC-005**: Les utilisateurs n'ont plus besoin de rafraîchir manuellement la page pour voir les modifications, réduisant le temps d'attente de 30 secondes (durée du cache) à moins d'une seconde

- **SC-006**: Le système gère correctement les erreurs de modification en restaurant l'état précédent dans 100% des cas d'échec de synchronisation serveur

- **SC-007**: Les modifications effectuées par d'autres utilisateurs sont visibles pour tous les utilisateurs concernés en moins de 2 secondes via Supabase Realtime

- **SC-008**: Le système maintient des performances acceptables (mise à jour en moins de 2 secondes) même avec 10 utilisateurs simultanés modifiant différentes interventions

- **SC-009**: Toutes les transitions de statut autorisées (DEMANDE → DEVIS_ENVOYE, DEVIS_ENVOYE → ACCEPTE, ACCEPTE → EN_COURS, EN_COURS → TERMINE, etc.) déclenchent une mise à jour immédiate dans 100% des cas

- **SC-010**: Les indicateurs visuels de modification apparaissent pour 100% des modifications effectuées par d'autres utilisateurs, sans faux positifs ni faux négatifs
