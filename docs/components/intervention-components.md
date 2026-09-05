# Composants Intervention

> Composants dédiés a la gestion des interventions dans GMBS-CRM.

---

## Organisation des fichiers

Les composants d'intervention sont répartis entre deux emplacements suivant le pattern de co-location Next.js App Router :

```
src/components/interventions/           # Composants réutilisables
  ColorPicker.tsx
  ConnectionStatusIndicator.tsx
  DateRangePicker.tsx
  DuplicateInterventionDialog.tsx
  EmailEditModal.tsx
  FiltersBar.tsx
  GestionnaireField.tsx                 # Sélecteur de gestionnaire (factorisé)
  GestionnaireSelector.tsx
  InterventionCard.tsx
  InterventionContextMenu.tsx
  InterventionEditForm.tsx              # Formulaire d'édition (composé de form-sections/)
  InterventionNotifications.tsx
  InterventionRealtimeProvider.tsx
  Interventions.tsx
  InterventionsKanban.tsx
  NewInterventionForm.tsx               # Formulaire de création (composé de form-sections/)
  ReminderMentionInput.tsx
  RemoteEditBadge.tsx
  ResizableTableHeader.tsx
  ScrollableTableCard.tsx
  StatusNode.tsx
  StatusSelector.tsx
  TransitionArrow.tsx
  UnsavedChangesDialog.tsx
  WorkflowAdminModal.tsx
  WorkflowVisualizer.tsx
  filters/                              # Filtres de colonnes (+ SortControls)
  form-sections/                        # Sections de formulaire factorisées
  views/                                # Vues (table, kanban, etc.) + cells/
  history/                              # Historique intervention
  legacy/                               # Composants legacy

app/interventions/_components/          # Composants co-localisés (page-specific)
  InterventionsPlusMenu.tsx
  InterventionsStatusFilter.tsx
  InterventionsViewRenderer.tsx
  types.ts
```

> **Note refacto (avril 2026)** : `InterventionForm.tsx` (monolithique) a été supprimé. `NewInterventionForm` et `InterventionEditForm` partagent désormais l'état via le hook `useInterventionFormState` et composent des sections issues de `form-sections/`.

---

## Composants principaux

### Interventions.tsx

Composant racine de la page interventions. Orchestre :
- Le chargement des données via `useInterventionsQuery`
- Le système de vues via `useInterventionViews`
- Le rendu conditionnel selon le layout sélectionné
- La barre de filtres et la recherche

### InterventionCard.tsx

Carte d'intervention utilisée dans les vues cards, gallery et kanban.

Affiche : statut (couleur), adresse, artisan assigné, date, gestionnaire, métier.

### NewInterventionForm.tsx

Formulaire de **création** d'intervention. C'est un composant fin qui :

1. Initialise l'état partagé via `useInterventionFormState({ mode: "create" })`
2. Compose les sections de `form-sections/` (header, client, owner, détails, artisan, paiement…)
3. Délègue la persistance au hook `useInterventionSubmit`

Fonctionnalités :
- Détection automatique de doublons (adresse + agence)
- Auto-complétion des champs adresse via `useGeocodeSearch`
- Sélecteurs de statut, métier, agence, gestionnaire (factorisés en sous-composants)
- Validation cumulative pilotée par `useInterventionValidation`
- Brouillon persisté dans le store Zustand `interventionDraft`

### InterventionEditForm.tsx

Formulaire d'edition inline, utilise dans la modal d'intervention pour modifier les champs directement. Integre le tracking de presence au niveau des champs via `FieldPresenceContext` et `useFieldPresenceDelegation` — les autres utilisateurs voient en temps reel quel champ est en cours d'edition.

**Pattern de sauvegarde (fire-and-forget avec toast) :**

1. Le modal ferme **immediatement** apres la soumission (`onSuccess?.(null)`)
2. Un toast loading "Enregistrement en cours..." s'affiche
3. La mutation principale (`updateMutation.mutateAsync`) sauvegarde statut, owner, tenant, date prevue, adresse, etc.
4. En cas de succes, toast success avec bouton "Voir"
5. Les taches secondaires (couts, paiements, artisans) s'executent en arriere-plan via `runPostMutationTasks()`
6. Apres completion des taches, le cache intervention detail est invalide → l'UI se met a jour automatiquement

**Gestion des erreurs :**
- En cas d'echec de la mutation : toast error avec bouton "Reessayer"
- Le modal est deja ferme → l'utilisateur est informe uniquement via le toast
- Les erreurs des taches secondaires sont isolees (chaque tache catch ses propres erreurs)

---

## Sections de formulaire (form-sections/)

Depuis le refacto d'avril 2026, la logique des formulaires d'intervention est éclatée en sections autonomes, exportées depuis `form-sections/index.ts` :

| Section | Fichier | Rôle |
|---------|---------|------|
| `InterventionHeaderFields` | `InterventionHeaderFields.tsx` | Référence, statut, dates principales |
| `InterventionClientSection` | `InterventionClientSection.tsx` | Informations locataire (tenant) |
| `InterventionOwnerSection` | `InterventionOwnerSection.tsx` | Informations propriétaire / facturation |
| `InterventionDetailsSection` | `InterventionDetailsSection.tsx` | Métier, description, consigne |
| `ArtisanPanel` | `ArtisanPanel.tsx` | Sélection de l'artisan principal + carte |
| `SecondArtisanSection` | `SecondArtisanSection.tsx` | Artisan secondaire (optionnel) |
| `PaymentSection` | `PaymentSection.tsx` | Coûts, paiements, acomptes |

| `DocumentSection` | `DocumentSection.tsx` | Documents liés (devis, facture…) |
| `PortalReportSection` | `PortalReportSection.tsx` | Rapport envoyé par l'artisan depuis le portail, forme repliable « un artisan, un rapport » |
| `CustomStatusSection` | `CustomStatusSection.tsx` | Sous-statuts personnalisés |

Chaque section reçoit l'état du formulaire en props depuis `useInterventionFormState` et reste découplée de la mécanique de submit.

#### PortalReportSection : rapport de l'artisan (portail)

> **Depuis le lot L2 (vision portail v2)**, cette section n'est plus montée dans la colonne de
> droite : le rapport vit dans l'onglet « Rapport » du modal, rendu par `ReportsPanel` (voir
> ci-dessous). `PortalReportSection` reste la vue repliable « un artisan, un rapport », et son
> corps (badges, champs métier, décision, visionneuse) est désormais partagé avec `ReportsPanel`
> via `report-panel/report-parts.tsx`. Contrat d'API : `docs/architecture/portail-demo-contrat-api.md`.

- **Données** : hook `usePortalReportQuery(interventionId)` (`src/hooks/usePortalReport.ts`) → `GET /api/interventions/{id}/portal-report` → `{ report | null, photos, artisan }`, clé `interventionKeys.portalReport(id)`.
- **États** : chargement (« Chargement du rapport… ») / aucun rapport (« L'artisan n'a pas encore envoyé de rapport. ») / erreur API / rapport.
- **Rapport** : version, date d'envoi, artisan, badge de statut (`submitted` → « À vérifier » violet, `approved` → « Validé », `rejected` → « Correction demandée » + `review_comment`), champs structurés (travaux réalisés, durée, client présent, matériel, reste à faire + détail, anomalies) et galerie **Photos avant / Photos après** (`intervention_attachments.metadata.phase`), vignettes cliquables ouvrant une visionneuse plein écran.
- **Actions** (statut `submitted` et permission `write_interventions`) : « Valider le rapport » et « Demander une correction » (boîte de dialogue shadcn, commentaire obligatoire) → `usePortalReportReviewMutation` → `POST /api/interventions/{id}/portal-report/review` `{ decision: 'approved' | 'rejected', comment? }`. Après succès : toast, invalidation de `portalReport(id)`, `lists()`, `lightLists()` et `detail(id)`. **Le statut de l'intervention n'est jamais modifié** par cette section.
- La section s'ouvre automatiquement quand un rapport est en attente.

Tests : `tests/unit/components/interventions/PortalReportSection.test.tsx`.

---

### Colonne de droite du modal : deux onglets (`report-panel/`)

Depuis le lot L2, la colonne droite d'`InterventionEditForm` porte **deux onglets** : « Infos »
(les sections de formulaire, inchangées) et « Rapport » (`ReportsPanel`).

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `RightColumnTabs` | `report-panel/RightColumnTabs.tsx` | La bascule Infos / Rapport |
| `ReportsPanel` | `report-panel/ReportsPanel.tsx` | N rapports, N artisans, les sept états |
| briques partagées | `report-panel/report-parts.tsx` | Badges, six champs métier, bandeau de chantier, dialogue de correction |
| `PhotoLightbox` | `src/components/ui/PhotoLightbox.tsx` | Visionneuse plein écran |

#### RightColumnTabs — trois contraintes non négociables

1. **`div role="tab"`, jamais `<button>` ni `TabsTrigger` Radix.** Toute la colonne descend d'un
   `<fieldset disabled={readOnly}>` : `readOnly` vaut vrai dès qu'un **autre utilisateur** est
   l'éditeur actif de l'intervention. Un bouton y devient incliquable, et le gestionnaire en
   lecture seule ne peut plus consulter le rapport.
2. **`pointer-events-auto` explicite sur la barre.** Le fieldset porte *en plus* de `disabled` la
   classe `pointer-events-none`, qui neutralise n'importe quel descendant, `div` compris.
3. **`sticky top-0`, pas `flex-none` seul.** Le responsive du modal repose sur des **container
   queries** (`.if-form-container`, `app/styles/modals-config.css`) : sous 640 px de conteneur,
   `.if-col-right` repasse en `overflow: visible`, où un `flex-none` au-dessus d'un
   `overflow-y-auto` casse.

Le panneau inactif est **masqué (`hidden`), jamais démonté** : un upload en cours dans
`DocumentManagerGmbs`, la position de scroll et l'aperçu ouvert survivent à la bascule.
Le `div.flex.flex-col.gap-2.pb-4.min-h-full` du panneau « Infos » et ses enfants **directs** sont
conservés à l'identique : les trois sections prioritaires remontent par `order-first`, qui ne
fonctionne qu'entre enfants directs d'un flex-col — un wrapper intermédiaire casserait la
priorisation sans erreur ni warning.

Tests : `tests/unit/components/interventions/RightColumnTabs.test.tsx`.

#### ReportsPanel — les sept états, N rapports, N artisans

**Le panneau ne renvoie jamais `null`.** Il affiche **un bloc par artisan affecté**, chacun dans
l'un des sept états du parcours (`resolveAssignmentState`) :

| État | Ce qu'affiche le bloc |
|------|-----------------------|
| `aucun_artisan` | « Aucun artisan sur cette intervention. » + bouton qui bascule sur l'onglet Infos |
| `prix_non_pose` | « Karim B. ne voit pas encore la mission : le coût SST n'est pas renseigné. » |
| `prix_propose` | « Prix de 320 € proposé. En attente de la réponse de Karim B. » |
| `prix_refuse` | Bandeau rouge, motif du refus, bouton « Proposer à un autre artisan » |
| `accepte_non_demarre` | « Accepté le … (application). Chantier non démarré. » + avertissement de dérive du montant |
| `demarre` | « Démarré le … — en cours depuis 5 h 22 » (compteur vivant, rafraîchi chaque minute) ; si le statut est encore `ACCEPTE`, badge **ambre** « Démarré · n champs manquants » et la liste des champs |
| `rapport_recu` | Le rapport, avec son bandeau de chantier |

- **Badge « Démarré · n champs manquants »** : il ne vit **pas** que dans ce panneau. Le libellé et
  la couleur viennent de `src/lib/interventions/portal-work-status.ts`, seule source, partagée avec
  la cellule de statut de la liste (`StatusCell` → `getStatusDisplay`) et la carte de kanban. Il
  paraît dès que `interventions.portal_work_started_at` est posée et que le statut est resté
  `ACCEPTE` : le CRM garde la main sur les statuts (spec §10.1), l'artisan a démarré, la fiche est
  incomplète. Un rapport en attente (« À vérifier », violet) passe devant.

- **Bandeau de chantier** : `Démarré 12 sept. 08:40 · Envoyé 14:02 · Durée réelle 5 h 22 (déclarée : 5 h)`.
  `duree_minutes` est **déclaratif**, `submitted_at − started_at` est le fait : les deux sont
  affichés côte à côte, jamais l'un sans l'autre.
- **Versions** : la version courante est affichée, les antérieures sont **repliées** sous
  « n versions précédentes », chacune avec son verdict et le `review_comment` qui a motivé la
  reprise. Cliquer une version l'affiche, photos comprises.
- **Photos filtrées par version** (`photosByReport`) : sans ce filtrage, une intervention à trois
  versions mélangerait toutes ses photos. Celles rattachées à aucune version sont isolées dans un
  bloc « Photos déposées hors d'un rapport » (clé `_hors_rapport`).
- **Décision** : « Valider » / « Demander une correction » (motif **obligatoire**) visent
  explicitement le rapport affiché (`report_id`) — sans quoi le gestionnaire validerait le rapport
  choisi par le serveur, pas celui qu'il regarde. Sur une intervention `INTER_TERMINEE`, la boîte
  de correction propose de **rouvrir l'intervention** (`reopen_intervention`).
- **Permission** : valider un rapport n'est pas éditer l'intervention — les boutons restent
  ouverts au porteur de `write_interventions` même quand le formulaire est verrouillé.

Tests : `tests/unit/components/interventions/ReportsPanel.test.tsx`.

#### PhotoLightbox

Visionneuse plein écran extraite du bloc inline de `PortalReportSection` :
`fixed inset-0 bg-black/90`, `role="dialog" aria-modal`, fermeture Échap et clic sur le fond,
navigation ← / →, flèches à l'écran, balayage tactile, compteur « 3 / 8 », légende
(`metadata.comment`) et bandeau de contexte « v3 · Karim B. · après ».

**`z-index` 1400, impératif.** La pile du modal est : overlay `z-[100]`, dialogue « demander une
correction » `!z-[1300]` sur overlay `!z-[1200]`. En dessous, la visionneuse s'ouvrirait *derrière*
la boîte de dialogue.

On conserve la balise `<img>` brute plutôt que `next/image` : `next.config.mjs` n'autorise que le
chemin `/storage/v1/object/public/**` et le bucket `documents` est public. Toute bascule future
vers des URL signées casserait `next/image`.

Tests : `tests/unit/components/ui/PhotoLightbox.test.tsx`.

#### Affichage « À vérifier » (rapport portail en attente)

Quand `interventions.has_portal_report` est vrai (colonne maintenue par trigger à chaque rapport `submitted`) et que le statut est `ACCEPTE`, `INTER_EN_COURS`, `SAV` ou `INTER_TERMINEE`, l'intervention est affichée **« À vérifier »** en violet `#9333EA` partout, sans changement de statut en base :

| Emplacement | Mécanisme |
|-------------|-----------|
| `mapInterventionRecord` (`src/lib/api/common/utils.ts`) | propage `has_portal_report` (`record.has_portal_report ?? false`) et surcharge `statusLabel` / `statusColor` |
| `getStatusDisplay(code, { hasPortalReport })` (`src/lib/interventions/status-display.ts`) | priorité 0, avant `statusFromDb` et `workflow` |
| `StatusCell` (vue Table) | passe `hasPortalReport` à `getStatusDisplay` |
| `InterventionsKanban` (vue Kanban) | badge « À vérifier » sur la carte (la colonne reste celle du statut réel) |
| `InterventionHeaderFields` (modal) | prop `hasPortalReport` → `SearchableBadgeSelect` `selectedDisplay` (le badge sélectionné est surchargé, la liste des options reste intacte) |

Les constantes et la règle vivent dans `src/lib/interventions/portal-report-status.ts` (`PORTAL_REPORT_REVIEW_STATUSES`, `PORTAL_REPORT_REVIEW_LABEL`, `PORTAL_REPORT_REVIEW_COLOR`, `isPortalReportToReview`). Tests : `tests/unit/lib/interventions/status-display.test.ts`, `tests/unit/lib/common-utils.test.ts`.

La **puce « Mes vérifications »** de la page interventions matérialise cette file de travail — voir [Puces de vues par défaut](#puces-de-vues-par-défaut).

#### PaymentSection : acompte client et statut

Les règles d'acompte sont pures et centralisées dans `src/lib/interventions/deposit-helpers.ts`, et partagées à l'identique par l'édition (`InterventionEditForm`) et la création (`NewInterventionForm`) via le hook `useInterventionAccomptes` — voir [workflow-engine.md](../architecture/workflow-engine.md#automatisation-de-lacompte-client) pour les règles de statut.

Côté composant, deux props gouvernent l'accès aux champs :

| Prop | Effet |
|------|-------|
| `canEditAccomptes` | Ouvre montants, checkboxes et dates. `false` hors de `DEVIS_ENVOYE` / `ATT_ACOMPTE` / `ACCEPTE` : toute la section passe en lecture seule. |
| `canMarkAccompteClientRecu` | Autorise la case « Reçu » (acompte client). `false` tant que le montant est vide (**0 compte comme saisi**), et `false` en `DEVIS_ENVOYE` : il faut d'abord enregistrer pour passer en `ATT_ACOMPTE`. |

Vider le montant client retire l'acompte : `useInterventionAccomptes` décoche « Reçu » et efface sa date, sans quoi la case resterait cochée alors qu'elle vient d'être verrouillée — donc indécochable.

**Invariant « Reçu/Envoyé » implique une date.** Cocher « Reçu » (client) ou « Envoyé » (SST) auto-remplit la date de paiement avec **la date du jour (heure locale)** si elle est vide (`applyRecuToggle`) ; décocher la vide. La date reste éditable — mais côté client, la vider **bloque l'enregistrement** (`getDepositValidationError`), ce qui garantit `is_received === true ⟺ payment_date !== null` en base.

#### Carte artisan sélectionné (ArtisanPanel / SecondArtisanSection)

Une fois un artisan choisi, sa carte récapitulative s'affiche au-dessus des boutons d'envoi. Agencement :

- **À gauche** : nom (selon le mode d'affichage nom / RS / tél) + badge `Indisponible` le cas échéant.
- **À droite, dans cet ordre** : badge **statut** → badge **distance** → icône **œil** (`Eye`) qui ouvre la fiche artisan via `handleOpenArtisanModal` — le même raccourci que dans le menu déroulant de sélection.
- **Coin supérieur droit** : bouton **X** de désélection. Sa gouttière est réservée par `pr-7` sur la carte, afin qu'il ne recouvre jamais la distance ni l'œil.
- **Sous la ligne** : le téléphone de l'artisan.

#### Envoi d'email / WhatsApp (boutons Devis & Inter.)

La section d'envoi propose, par artisan, deux boutons (et leurs équivalents WhatsApp) dont les conditions d'activation diffèrent :

| Bouton | Condition d'activation | Logique métier |
|--------|------------------------|----------------|
| **Devis** | Un artisan est sélectionné | Lié aux requirements de `VISITE_TECHNIQUE` (simple demande de devis) |
| **Inter.** | Tous les champs requis pour le dispatch sont remplis | Lié aux requirements de `INTER_EN_COURS` (l'ordre d'intervention implique une fiche complète) |

Les champs requis pour activer **Inter.** sont centralisés dans `getInterventionEmailMissingFields()` (`src/lib/interventions/derivations.ts`) :

1. N° d'intervention (`id_inter`)
2. Coût intervention > 0
3. Coût SST > 0
4. Consigne d'intervention
5. Date prévue
6. Nom / prénom client **et** téléphone client — **sauf** si le logement est marqué vacant (`is_vacant`), auquel cas ces deux champs sont optionnels.

`isInterventionEmailButtonDisabled()` réutilise cette même fonction (`disabled ⇔ aucun artisan sélectionné OU au moins un champ manquant`).

Quand le bouton **Inter.** est désactivé, il est enveloppé par le composant `InterButtonTooltip` (`form-sections/InterButtonTooltip.tsx`) : au survol, un tooltip liste précisément les champs restant à compléter. Le wrapper `<span>` est nécessaire car un `<button disabled>` ne reçoit pas les événements de survol. La liste est calculée une fois au niveau du formulaire (`useMemo`) et passée en prop `interMissingFields` à `ArtisanPanel` et `SecondArtisanSection`.

### GestionnaireField

`GestionnaireField.tsx` est un composant factorisé partagé entre `NewInterventionForm`, `InterventionEditForm` et la modal artisan. Il encapsule la sélection (avec recherche) du gestionnaire assigné et a remplacé plusieurs implémentations dupliquées.

---

## Hooks de formulaire

Le formulaire d'intervention est désormais piloté par trois hooks complémentaires :

| Hook | Rôle |
|------|------|
| `useInterventionFormState` | État partagé : valeurs des champs, dirty tracking, sélection artisan, géocodage, brouillon Zustand. Mode `create` ou `edit`. |
| `useInterventionSubmit` | Pipeline de soumission : mutation principale, owner/tenant find-or-create, post-mutation tasks, gestion d'erreur avec rollback toast. |
| `useInterventionValidation` | Calcule dynamiquement quels champs sont requis en fonction du statut sélectionné (depuis `form-constants.ts`). |

> Le hook historique `useInterventionForm` n'existe plus. Toute nouvelle section de formulaire doit consommer `useInterventionFormState` et déléguer la persistance via `useInterventionSubmit`.

### Logique métier extraite

Les règles de dérivation (artisans avec email, calculs intermédiaires, etc.) ont été extraites de `InterventionEditForm` vers `src/lib/interventions/derivations.ts` — fonctions pures testables en isolation. Suivre ce pattern pour toute nouvelle règle métier : extraire avant d'inclure dans un `useMemo`.

---

## Système de vues (views/)

### Puces de vues par défaut

Les puces affichées au-dessus de la liste sont définies dans
`src/config/intervention-view-presets.ts` (`DEFAULT_VIEW_PRESETS`), **dans l'ordre
du tableau**. Les vues rattachées à l'utilisateur connecté sont listées dans
`USER_SCOPED_VIEW_IDS` : leur filtre `attribueA` est réécrit avec l'ID de
l'utilisateur par `applyUserScopedFilters`.

| Ordre | Vue | Critère |
|-------|-----|---------|
| 1 | Liste générale | aucun filtre |
| 2 | Market | statut `DEMANDE` + non assignée |
| 3 | **Mes vérifications** | `has_portal_report` + statut de revue + assignée à moi |
| 4 | Mes demandes | statut `DEMANDE` + assignée à moi |
| 5 | Ma liste en cours | statut `INTER_EN_COURS` + assignée à moi |
| 6 | Mes visites technique | statut `VISITE_TECHNIQUE` + assignée à moi |
| 7 | Ma liste accepté | statut `ACCEPTE` + assignée à moi |
| 8 | En attente d'acompte | statut `ATT_ACOMPTE` + assignée à moi |
| 9 | Mes Interventions à check | `isCheck` + assignée à moi |

**Mes vérifications** (`mes-verifications`) liste les interventions de
l'utilisateur dont un rapport d'artisan attend d'être vérifié : exactement le
critère du badge violet « À vérifier » (`interventions.has_portal_report` posé
par le trigger sur `artisan_reports`, croisé avec
`PORTAL_REPORT_REVIEW_STATUSES`). Un rapport validé ou rejeté fait retomber le
drapeau, donc sort l'intervention de la liste. La puce porte la couleur violette
du badge (`PORTAL_REPORT_REVIEW_COLOR`).

#### Le compteur d'une puce doit égaler le nombre de lignes

Le nombre affiché sur une puce ne vient **pas** de la liste : `ViewTabs` l'obtient
de `useInterventionViewCounts`, qui appelle `interventionsApi.getTotalCountWithFilters`
avec les seuls **filtres serveur** produits par `convertViewFiltersToServerFilters`.
Un filtre laissé côté client est donc appliqué page par page à la liste mais
**ignoré par le compteur** : la liste paraît juste et la pastille est fausse.

Ajouter un filtre de vue impose donc de le traiter sur toute la chaîne serveur :

| Étape | Fichier |
|-------|---------|
| Preset de la vue | `src/config/intervention-view-presets.ts` |
| Conversion en filtre serveur | `src/lib/filter-converter.ts` |
| Paramètres de l'API | `src/lib/api/common/types.ts`, `crud/_search-params.ts` |
| Liste (Edge Function) | `supabase/functions/interventions-v2/_lib/{list-handler,helpers}.ts` |
| **Comptage de la puce** | `src/lib/api/interventions/interventions-filters.ts` (`getTotalCountWithFilters`) |
| Comptage des puces de filtre internes | RPC `get_intervention_filter_counts` (drapeau dédié) |
| Tri serveur par colonne de coût | RPC `get_sorted_intervention_ids` (drapeau dédié) |

Pour « Mes vérifications », les deux RPC ont reçu leur drapeau dans la migration
`99086_filter_counts_portal_report.sql` (`p_has_portal_report`), sur le modèle de
`p_user_is_null` (migration 99067). Les statuts de revue sont envoyés dans le
paramètre **dédié** `portalReportStatuts` et non dans `statuts`, pour que la puce
de statut choisie par l'utilisateur ne les écrase pas.

**Le filtre est indivisible.** `hasPortalReport` et `portalReportStatuts` sont
posés ensemble ou pas du tout (`src/lib/filter-converter.ts`). Tant que le
référentiel des statuts n'est pas chargé, `statusCodeToId` ne rend rien : le
convertisseur renvoie alors le filtre côté client et **ne pose rien** côté
serveur, et `useInterventionPageState` désactive la requête de liste
(`filtersPending`) — comme le comptage l'était déjà par `allMappersReady`. Poser
`hasPortalReport` seul rouvrait exactement le piège : la liste abandonnait la
restriction de statuts (l'Edge Function n'applique les statuts que s'ils sont
présents) pendant que le compteur appliquait son propre repli, d'où une liste
plus longue que sa pastille au premier rendu.

**Ordre de déploiement.** `p_has_portal_report` n'est ajouté au payload du RPC
`get_intervention_filter_counts` que lorsqu'il vaut `true` : PostgREST résout une
fonction par son jeu de noms d'arguments, et l'envoyer systématiquement rendait
la migration 99086 obligatoire pour **toutes** les vues (sinon PGRST202, et plus
aucune puce de statut/agence/métier sur la page). Omis, l'ancienne signature
reste compatible. La migration doit malgré tout être appliquée **avant** la mise
en ligne du front pour que la vue « Mes vérifications » compte juste.

**Temps réel.** `matchesFilters` (`src/lib/realtime/filter-utils.ts`) teste les
deux champs, tous deux présents dans le payload realtime de `interventions`
(`has_portal_report`, `statut_id`). Sans cela, la validation d'un rapport depuis
la vue laissait la ligne dans la liste patchée en direct — le drapeau retombe
(trigger 99076) mais l'intervention reste assignée à l'utilisateur — pendant que
la pastille, recalculée côté serveur, redescendait : liste et compteur
divergeaient jusqu'au refetch suivant.

### Layouts disponibles

Le projet supporte **6 layouts** différents pour afficher les interventions :

| Vue | Fichier | Description |
|-----|---------|-------------|
| Table | `views/TableView.tsx` | Vue tabulaire avec colonnes redimensionnables et tri |
| Kanban | `views/KanbanView.tsx` | Vue en colonnes par statut avec drag & drop |
| Gallery | `views/GalleryView.tsx` | Vue en cartes grille |
| Calendar | `views/CalendarView.tsx` | Vue calendrier par date |
| Timeline | `views/TimelineView.tsx` | Vue chronologique |
| Tabs | `views/ViewTabs.tsx` | Onglets de navigation entre vues |

```
src/components/interventions/views/
  TableView.tsx
  KanbanView.tsx
  GalleryView.tsx
  CalendarView.tsx
  TimelineView.tsx
  ViewTabs.tsx
  ColumnConfiguration.tsx
  ColumnConfigurationModal.tsx
  ExpandedRowContent.tsx              # Détail dépliable d'une ligne table
  column-alignment-options.ts
  cells/                              # Cellules réutilisables (refacto avril 2026)
    ArtisanCell.tsx
    AssigneeCell.tsx
    ColorBadgeCell.tsx
    StatusCell.tsx
    types.ts
    index.ts
```

### Cellules de table (views/cells/)

Les cellules complexes de la vue Table ont été extraites en composants dédiés et typés :

| Cellule | Description |
|---------|-------------|
| `ArtisanCell` | Affichage de l'artisan assigné avec avatar et fallback |
| `AssigneeCell` | Gestionnaire assigné (réutilise `GestionnaireField` en édition inline) |
| `ColorBadgeCell` | Badge coloré générique (statut, métier, agence…) |
| `StatusCell` | Cellule de statut avec sélecteur inline ; affiche « À vérifier » (violet) quand `has_portal_report` est vrai (voir *Affichage « À vérifier »*) |

Le fichier `cells/types.ts` définit les props partagées (`CellContext<Intervention>`).

### ExpandedRowContent

Contenu affiché lorsqu'une ligne de la `TableView` est dépliée. Présente un résumé enrichi de l'intervention sans ouvrir la modal complète.

**Scroll des textes longs** — Les blocs `Contexte` et `Consigne` sont bornés à `max-h-[320px]` avec leur propre conteneur `overflow-y-auto overscroll-contain` (même hauteur que la colonne commentaires). Deux raisons :

- sans hauteur max, un contexte long rend la ligne dépliée si haute qu'il faut remonter tout le tableau pour revenir à l'intervention ;
- sans `overscroll-contain`, la molette se propage au `.table-scroll-wrapper` dès qu'un scroller interne atteint sa fin (*scroll chaining*).

La même règle s'applique au scroller de `CommentSection`, qui est le second scroller imbriqué dans la ligne. Tout nouveau bloc scrollable ajouté ici doit porter `overscroll-contain`.

### ViewTabs

Barre d'onglets permettant de basculer entre les vues. Chaque onglet est persisté dans `localStorage` via le hook `useInterventionViews`.

### ColumnConfiguration

Modal de configuration des colonnes visibles dans la vue Table. Permet de réordonner, masquer et dimensionner les colonnes.

---

## Filtres (filters/)

Composants de filtrage des colonnes dans la vue Table :

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `ColumnFilter` | `ColumnFilter.tsx` | Dispatcher qui rend le filtre approprié selon le type |
| `TextColumnFilter` | `TextColumnFilter.tsx` | Filtre texte avec recherche |
| `SelectColumnFilter` | `SelectColumnFilter.tsx` | Filtre par sélection (statut, agence, etc.) |
| `CheckboxColumnFilter` | `CheckboxColumnFilter.tsx` | Filtre par cases a cocher multiples |
| `DateColumnFilter` | `DateColumnFilter.tsx` | Filtre par plage de dates |
| `NumberColumnFilter` | `NumberColumnFilter.tsx` | Filtre par plage numérique |
| `UserColumnFilter` | `UserColumnFilter.tsx` | Filtre par utilisateur (gestionnaire) |

```tsx
// Exemple d'utilisation interne dans TableView
<ColumnFilter
  column={column}
  filterType={column.filterType}
  onFilterChange={handleFilterChange}
/>
```

Le fichier `filter-utils.ts` contient les utilitaires de matching et de conversion de filtres, et `types.ts` les types partagés.

---

## Composants de workflow

### WorkflowVisualizer.tsx

Visualisation graphique des transitions de statuts d'intervention utilisant **ReactFlow**. Affiche les noeuds (statuts) et les arêtes (transitions autorisées) avec les couleurs de chaque statut.

### WorkflowAdminModal.tsx

Modal d'administration du workflow permettant de configurer les transitions autorisées, les exigences par statut et les conditions.

### StatusSelector.tsx

Sélecteur de statut avec indicateur visuel de couleur. Affiche uniquement les transitions autorisées depuis le statut courant.

### StatusNode.tsx / TransitionArrow.tsx

Composants ReactFlow pour le rendu des noeuds de statut et des flèches de transition dans le visualiseur.

---

## Composants de communication

### InterventionNotifications.tsx

Gestion des notifications liées aux interventions (rappels, mentions, changements de statut).

### ReminderMentionInput.tsx

Champ de saisie avec support des @mentions pour les rappels d'intervention. Utilise une regex `/@([\p{L}\p{N}_.-]+)/gu` pour détecter les mentions.

### EmailEditModal.tsx

Modal d'édition et d'envoi d'email lié a une intervention (devis, convocation visite technique).

---

## Composants d'état

### ConnectionStatusIndicator.tsx

Indicateur de statut de connexion temps réel (Supabase Realtime). Affiche un point coloré : vert (connecté), orange (reconnexion), rouge (déconnecté).

### RemoteEditBadge.tsx

Badge affiché quand un autre utilisateur est en train de modifier la même intervention. Auto-cleanup après 20 secondes.

### DuplicateInterventionDialog.tsx

Dialogue d'alerte affiché lors de la détection d'un doublon (même adresse + même agence).

### UnsavedChangesDialog.tsx

Dialogue de confirmation affiché quand l'utilisateur tente de quitter un formulaire avec des modifications non sauvegardées.

---

## Presence en temps reel (modal)

Composants d'indicateurs de presence collaborative, affichant qui consulte ou edite la meme intervention.

### PresenceAvatars.tsx

> Source: `src/components/ui/intervention-modal/PresenceAvatars.tsx`

Affiche les avatars des utilisateurs qui consultent actuellement la meme intervention dans le header du modal. Utilise le hook `useInterventionPresence` pour s'abonner au canal Supabase Presence `presence:intervention-{id}`.

### PresenceFieldIndicator.tsx

> Source: `src/components/ui/intervention-modal/PresenceFieldIndicator.tsx`

Indicateur visuel au niveau d'un champ de formulaire, montrant qu'un autre utilisateur est en train d'editer ce champ specifique. Utilise le `FieldPresenceContext` et le hook `useFieldPresenceDelegation`.

### Hooks de Presence

| Hook | Fichier | Role |
|------|---------|------|
| `useInterventionPresence` | `src/hooks/useInterventionPresence.ts` | Gestion canal Presence (subscribe/track/untrack), deduplication multi-onglets |
| `useFieldPresenceDelegation` | `src/hooks/useFieldPresenceDelegation.ts` | Tracking de focus sur les champs du formulaire, whitelist de champs (`TRACKED_FIELD_IDS`) |

### Context

Le `FieldPresenceContext` (`src/contexts/FieldPresenceContext.tsx`) fournit les informations de presence au niveau des champs aux composants enfants du modal.

---

## Composants co-localisés (app/)

### InterventionsViewRenderer.tsx

Composant de rendu qui sélectionne et affiche la vue appropriée (table, kanban, gallery, etc.) selon la configuration active.

### InterventionsStatusFilter.tsx

Barre de filtrage rapide par statut, affichée au-dessus de la liste. Chaque statut affiche un compteur.

### InterventionsPlusMenu.tsx

Menu "+" pour les actions de création rapide : nouvelle intervention, import, etc.

---

## Page Comptabilite

La page comptabilite (`app/comptabilite/page.tsx`) affiche les interventions terminees avec leurs couts, paiements et informations client/facturation.

### Architecture

```
app/comptabilite/
  page.tsx                          # Page principale avec filtres de periode
  _components/
    ComptabiliteTableRow.tsx        # Ligne de tableau memorisee (memo)
src/hooks/useComptabiliteQuery.ts   # Hook TanStack Query dedie
src/lib/comptabilite/formatters.ts  # Formatters (nom client, couts, paiements)
```

### Donnees affichees

La colonne **Client** affiche les informations de facturation (owner/proprietaire) et non le locataire (tenant). L'ordre de priorite est :

1. `nomPrenomFacturation` (champ `plain_nom_facturation` de la table `owners`)
2. `prenomProprietaire` + `nomProprietaire` (champs `owner_firstname`/`owner_lastname`)
3. Fallback : `prenomClient` + `nomClient` (tenant)

Pour que ces donnees soient disponibles, `useComptabiliteQuery` passe `include: ["artisans", "costs", "payments", "owner"]` a l'API, ce qui force l'Edge Function a joindre la table `owners`.

### Style des lignes cochees

Les lignes marquees comme gerees (via "Copier + Check") s'affichent avec un fond vert defini dans `app/styles/tables.css` via la classe CSS `.compta-checked`.

---

## Composants utilitaires

| Composant | Description |
|-----------|-------------|
| `FiltersBar.tsx` | Barre de filtres active avec pills supprimables |
| `ColorPicker.tsx` | Sélecteur de couleur pour sous-statuts personnalisés |
| `DateRangePicker.tsx` | Sélecteur de plage de dates |
| `ResizableTableHeader.tsx` | En-tête de tableau avec colonnes redimensionnables par drag |
| `ScrollableTableCard.tsx` | Conteneur de tableau avec scroll horizontal |
| `InterventionRealtimeProvider.tsx` | Provider qui initialise le channel Supabase Realtime pour les interventions |
| `InterventionsKanban.tsx` | Vue Kanban avec drag & drop via @hello-pangea/dnd |
