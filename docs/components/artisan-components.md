# Composants Artisan

> Composants dédiés a la gestion des artisans (sous-traitants) dans GMBS-CRM.

---

## Organisation des fichiers

Les composants artisans suivent le même pattern de co-location que les interventions :

```
src/components/artisans/                # Composants réutilisables
  ArtisanContextMenu.tsx
  ArtisanSearchModal.tsx
  ArtisanViewTabs.tsx
  Avatar.tsx

app/artisans/_components/               # Composants co-localisés (page-specific)
  ArtisanDeleteDialog.tsx
  ArtisanFilterDropdown.tsx
  ArtisanTable.tsx
  ArtisanTableRow.tsx
  HighlightedText.tsx
```

Les composants modaux artisan se trouvent dans `src/components/ui/artisan-modal/` (voir [ui-components.md](./ui-components.md)).

---

## Composants réutilisables (src/)

### ArtisanContextMenu.tsx

Menu contextuel (clic droit) sur un artisan. Actions disponibles :
- Voir le détail (ouvrir modal)
- Archiver / Désarchiver avec confirmation
- Copier les informations de contact

Utilise le hook `useArtisanContextMenu` pour la logique métier.

```tsx
<ArtisanContextMenu artisan={artisan}>
  <ArtisanTableRow artisan={artisan} />
</ArtisanContextMenu>
```

### ArtisanSearchModal.tsx

Modal de recherche d'artisan utilisée lors de l'assignation d'un artisan a une intervention. Fonctionnalités :
- Recherche par nom, raison sociale, SIRET, email, téléphone
- Filtrage par métier et zone
- Affichage du statut et de la disponibilité
- Sélection avec callback

### ArtisanViewTabs.tsx

Onglets de navigation entre les vues de la page artisans (table, cartes). Similaire au `ViewTabs` des interventions mais avec moins de layouts disponibles.

### Avatar.tsx

Composant avatar spécifique aux artisans avec gestion des initiales, couleurs et images de profil depuis Supabase Storage.

### DossierBadge.tsx

Colonne « Dossier » de la page Artisans (lot **L5**, spec §5.4). Deux informations **distinctes**, jamais fusionnées :

- le **badge de statut** historique — `COMPLET` (vert `#10B981`), `INCOMPLET` (orange `#F59E0B`), `À compléter` (rouge `#EF4444`) ;
- la **pastille violette « n à vérifier »** quand `artisans.pieces_a_verifier > 0`, c'est-à-dire quand des pièces déposées depuis le portail attendent une décision.

Le violet est `#9333EA` — **exactement** celui du badge « À vérifier » des rapports (`src/lib/interventions/portal-report-status.ts`) : même geste métier côté gestionnaire, une seule couleur à apprendre. La constante vit dans `src/lib/artisans/document-review.ts` (`PIECES_A_VERIFIER_COLOR`).

Le composant était auparavant inliné dans `ArtisanTableRow.tsx` ; il a été extrait pour être testable. Une valeur négative ou `NaN` n'affiche aucune pastille. Tests : `tests/unit/components/artisans/DossierBadge.test.tsx`.

> **L'objectif 17 se lit dans un seul chiffre** : le nombre de pastilles violettes de la page Artisans. C'est la file de travail du gestionnaire, et elle doit pouvoir tomber à zéro.

### ArtisanPortalLinkButton.tsx

Bouton « Lien portail » (portail artisans, contrat `docs/architecture/portail-demo-contrat-api.md` §3). Rendu dans `ArtisanModalFooter` quand l'artisan existe et que l'utilisateur a `write_artisans`. Au clic : `POST /api/artisans/{id}/portal-link` → boîte de dialogue shadcn avec l'URL en lecture seule, boutons « Copier » (presse-papiers) et « Ouvrir » (nouvel onglet), date d'expiration et rappel « lien personnel de l'artisan, à lui transmettre ». Une réponse `503` (portail non configuré) est traduite en toast explicite ; générer un nouveau lien désactive les précédents (côté serveur). Tests : `tests/unit/components/artisans/ArtisanPortalLinkButton.test.tsx`.

---

## Composants co-localisés (app/)

### ArtisanTable.tsx

Tableau principal de la page artisans. Caractéristiques :
- Colonnes : nom, raison sociale, métiers, zone, statut, gestionnaire, téléphone
- Tri sur toutes les colonnes
- Virtualisation via `@tanstack/react-virtual` pour les grandes listes
- Sélection de lignes

### ArtisanTableRow.tsx

Ligne individuelle du tableau artisan. Gère :
- Affichage condensé des informations
- Badge de statut coloré (`ArtisanStatusBadge`)
- Badges métiers
- Colonne « Dossier » déléguée à `DossierBadge` (statut + pastille « n à vérifier »)
- Menu contextuel au clic droit

### ArtisanFilterDropdown.tsx

Dropdown de filtrage pour la page artisans. Filtres disponibles :
- Statut artisan (Candidat, Validé, Expert, etc.)
- Métier
- Zone géographique
- Gestionnaire assigné

**Deux puces virtuelles** s'ajoutent aux statuts réels, injectées par `useArtisanPageState` (`extendedStatuses`) et comptées par `useArtisanFilterCounts` :

| Puce | Filtre serveur | Couleur |
|---|---|---|
| « Dossier à compléter » | `.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"])` | `#F59E0B` |
| « Pièces à vérifier » (**L5**) | `.gt("pieces_a_verifier", 0)` | `#9333EA` |

Deux règles à ne pas franchir :

1. **La puce L5 s'appuie sur une colonne SCALAIRE d'`artisans`**, jamais sur un embed `artisan_attachments!inner(...)` : une jointure dupliquerait les lignes et fausserait le `count: exact` de la pagination.
2. **Le compteur « Dossier à compléter » ne doit pas bouger.** Son filtre ignore la valeur demandée au profit d'une liste figée — bug connu (précédent « Matera 9 vs 2 »), affiché au client, et qui relève d'un **chantier séparé**. Les deux filtres sont indépendants, cumulables, et ne partagent aucune ligne de code.

### Puces de vue de la page (`useArtisanViews`)

À ne pas confondre avec les puces virtuelles du dropdown ci-dessus : ce sont les
**vues** proposées en tête de page, définies par `DEFAULT_VIEW_PRESETS` dans
`src/hooks/useArtisanViews.ts`.

| Puce | Filtres de la vue | Filtres serveur produits |
|---|---|---|
| « Liste générale » | aucun | aucun |
| « Ma liste artisans » | `gestionnaire_id eq __CURRENT_USER__` | `gestionnaire` |
| « Liste Artisans à compléter » | `statut_dossier eq À compléter` | `statut_dossier` + `exclude_statuts` |
| « Mes Artisans à compléter » | idem + gestionnaire | `gestionnaire`, `statut_dossier`, `exclude_statuts` |
| « Artisans à vérifier » | `pieces_a_verifier is_not_empty` | `pieces_a_verifier: true` |
| « Mes artisans à vérifier » | idem + gestionnaire | `gestionnaire`, `pieces_a_verifier: true` |

**Pourquoi `is_not_empty` et non un opérateur « > 0 ».** `ArtisanViewFilter`
n'admet que `eq | ne | is_empty | is_not_empty`. Plutôt que d'introduire un
opérateur numérique générique — que les deux convertisseurs, le chemin de
comptage et le filtrage client devraient alors tous savoir interpréter — le lot
ajoute une **propriété dédiée**, `pieces_a_verifier`, sur laquelle
`is_not_empty` se lit « il reste au moins une pièce en attente », c'est-à-dire
exactement `artisans.pieces_a_verifier > 0`. Elle est traduite en un seul point
par convertisseur, vers le drapeau serveur déjà posé par **L5**.

**Le compteur d'une puce ne vient pas de la liste.** Il provient d'un appel de
comptage distinct (`artisansApi.getCountWithFilters`) dont les paramètres sont
construits par `convertFiltersToApiParams`, dans
`app/artisans/_lib/useArtisanFilterCounts.ts`. Toute propriété que **ce**
chemin ne sait pas traduire est silencieusement ignorée : la liste paraît juste
et le compteur affiche le total. Les deux nouvelles puces sont donc câblées aux
**deux** endroits :

| Chemin | Fichier | Traduction |
|---|---|---|
| Liste | `src/lib/filter-converter.ts` (`convertArtisanFiltersToServerFilters`) | → `serverFilters.pieces_a_verifier = true` |
| Comptage de la puce | `app/artisans/_lib/useArtisanFilterCounts.ts` (`convertFiltersToApiParams`) | → `params.pieces_a_verifier = true` |

Les deux aboutissent au même prédicat SQL `is_active = true AND
pieces_a_verifier > 0`, appliqué par `artisans-crud.ts` pour la liste et par
`artisans-counts.ts` pour le comptage : **le nombre de la puce est exactement le
nombre de lignes**.

**Indépendance vis-à-vis de `statut_dossier`.** Ces vues ne posent ni
`statut_dossier` ni `exclude_statuts` — une pièce en attente ne dit rien de la
complétude du dossier. Le compteur « à compléter », affiché au client et porteur
d'un bug connu traité à part, reste donc strictement inchangé (test de
non-régression dans `tests/unit/hooks/useArtisanFilterCounts.test.ts`).

**Périmètre assumé : `ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS` ne s'applique pas
ici.** Les vues « à compléter » écartent les statuts `CANDIDAT`, `POTENTIEL` et
`ARCHIVE` ; les deux vues « à vérifier » ne les écartent pas, et c'est
délibéré : la file de travail est déclenchée par la **présence d'une pièce
déposée**, pas par l'état du dossier. Une pièce déposée par un `CANDIDAT` ou un
`POTENTIEL` est précisément celle qu'il faut vérifier pour faire avancer son
entrée dans le réseau — l'exclure viderait la file de son cas d'usage principal.
Les deux chemins (liste et comptage) sont alignés sur ce périmètre, donc le
nombre de la puce reste égal au nombre de lignes.

*Point ouvert, à trancher avec le client :* un artisan `ARCHIVE` conserve
`is_active = true` (seule la suppression douce met `is_active` à `false`, cf.
`docs/database/`). Une pièce laissée en attente par un artisan sorti du réseau
reste donc indéfiniment dans « Artisans à vérifier ». Si l'on veut pouvoir vider
cette file, il faudra exclure **le seul statut `ARCHIVE`** (et non les trois),
dans les **deux** convertisseurs à la fois (`src/lib/filter-converter.ts` pour la
liste, `app/artisans/_lib/useArtisanFilterCounts.ts` pour le comptage) sous peine
de désaccorder la pastille de sa liste.

### ArtisanDeleteDialog.tsx

Dialogue de confirmation pour la suppression (soft delete) d'un artisan. Affiche un résumé de l'artisan et de ses interventions liées avant confirmation.

### HighlightedText.tsx

Composant utilitaire qui surligne les termes de recherche dans le texte affiché. Utilisé dans le tableau artisans quand un filtre de recherche est actif.

---

## Composants modaux (ui/artisan-modal/)

Les composants modaux artisan suivent la hiérarchie GenericModal :

### ArtisanModal.tsx

Orchestrateur principal. Gère le routing entre les modes :
- Vue détail (`ArtisanModalContent`)
- Création (`NewArtisanModalContent`)

### ArtisanModalContent.tsx

Vue détail d'un artisan avec :
- Informations de contact (nom, téléphone, email, SIRET)
- Adresses (siège social et intervention)
- Métiers et zones d'intervention
- Statut et historique de statuts
- Section finances (`ArtisanFinancesSection`)
- Tableau des interventions liées (`ArtisanInterventionsTable`)
- Section commentaires (`CommentSection`)
- Documents joints

### NewArtisanModalContent.tsx

Formulaire de création d'artisan. Depuis le refacto d'avril 2026, c'est un composant fin qui compose des champs autonomes issus de `artisan-modal/_components/` (voir section suivante) :
- Champs de base (nom, prénom, raison sociale)
- `SiretField` — saisie + vérification SIRET via API INSEE
- `IbanField` — saisie + validation IBAN
- `AddressField` — saisie avec auto-complétion géocodage
- `MetiersPicker` — sélection multi-métiers
- `StatusPicker` — sélection du statut artisan
- `GestionnaireAssignee` — assignation du gestionnaire

---

## Champs factorisés (artisan-modal/_components/)

Le refacto d'avril 2026 a éclaté les anciens formulaires monolithiques en sous-composants autonomes, exportés depuis `src/components/ui/artisan-modal/_components/`. Chaque champ encapsule sa propre validation et son rendu, et est réutilisable entre `NewArtisanModalContent` et `ArtisanModalContent`.

| Composant | Rôle |
|-----------|------|
| `AddressField` | Saisie d'adresse avec autocomplétion via `useGeocodeSearch` |
| `IbanField` | Saisie IBAN avec validation (`src/lib/iban-validation.ts`) |
| `SiretField` | Saisie SIRET avec vérification INSEE et préremplissage |
| `MetiersPicker` | Multi-select des métiers depuis les enums de référence |
| `StatusPicker` | Sélecteur de statut artisan (Candidat / Validé / Expert…) |
| `GestionnaireAssignee` | Sélecteur du gestionnaire assigné (utilise le pattern `GestionnaireField`) |
| `PendingAbsencesSection` | Section d'affichage et gestion des absences en attente |
| `DeletedArtisanDialog` | Dialogue affiché si l'artisan est en soft-delete (recovery) |
| `ArtisanModalFooter` | Pied du modal : bouton « Lien portail » (`ArtisanPortalLinkButton`, permission `write_artisans`), archivage, annuler / enregistrer |
| `DossierVerificationCard` | **Vérification des pièces du dossier (L5)** — voir ci-dessous |

> **Règle :** toute nouvelle saisie/champ dans la modal artisan doit être ajoutée comme composant autonome dans `_components/`, **pas** inlinée dans `NewArtisanModalContent` ou `ArtisanModalContent`. La logique de validation correspondante va dans `src/lib/<domain>-validation.ts` (cf. `iban-validation`, `siret-validation`).

### Hooks partagés (artisan-modal/_hooks/)

Le refacto de mai 2026 a extrait la plomberie dupliquée entre `NewArtisanModalContent` et `ArtisanModalContent` dans des hooks dédiés :

| Hook | Rôle |
|------|------|
| `useArtisanForm` | Plomberie commune : dialogue "modifications non sauvegardées", interception Échap, raccourci Cmd/Ctrl+Enter, notifications au parent. Consommé par les deux modals. |
| `useArtisanCreate` | Logique côté création uniquement : absences en attente, dialogue d'artisan supprimé (détecter / restaurer / écraser), génération du `numero_associe`, statut POTENTIEL par défaut, auto-attribution au gestionnaire connecté. |
| `useArtisanMutations` | Mutations TanStack Query pour la mise à jour artisan + invalidation de cache. |
| `useArtisanStatusTransition` | Transitions de statut nécessitant une raison/un commentaire (ex. archivage). |
| `useArtisanAbsences` | CRUD des absences pour un artisan existant. |
| `useArtisanAddressGeocode` | Autocomplétion d'adresse via géocodage. |
| `useArtisanDossierReview` | **L5** — pièces du dossier avec leur état de vérification, et les deux appels d'écriture (`review` d'une pièce, `validate` du dossier). La clé de cache est `documentKeys.byEntity('artisan', id)`, **celle qu'invalide `usePortalLiveSync`** : une clé propre au hook obligerait le gestionnaire à recharger la page quand une pièce arrive du téléphone. |

Le schéma de formulaire (`ArtisanFormValues`), la valeur par défaut (`buildDefaultFormValues`) et les builders de payload (`buildCreatePayload`, `buildUpdatePayload`) sont exportés depuis `_lib/artisan-form-mapper.ts` — source unique pour la création et l'édition.

### DossierVerificationCard.tsx

Carte « **Vérification des pièces** » de la fiche artisan (lot **L5**, spec §5.5). Repliée par défaut ; le hook `useArtisanDossierReview` ne charge les pièces qu'à l'ouverture.

Ce que la carte apporte, et qui manquait **entièrement** côté CRM avant ce lot :

| Élément | Détail |
|---|---|
| Aperçu | `DocumentPreview` (image ou PDF) + lien « ouvrir dans un nouvel onglet » |
| État | `À vérifier` (violet) · `Refusée` (rouge) · `Validée` (vert). `review_status` `null` se lit **« Validée »** : son DEFAULT est `'approved'` et il protège les milliers de pièces d'avant le portail |
| Valider | `POST /api/artisans/{id}/documents/{attachmentId}/review` avec `decision:'approved'` |
| Refuser | même route avec `decision:'rejected'` — **motif obligatoire** : le bouton de confirmation du dialogue reste désactivé tant que le champ est vide, et le serveur renvoie `400` sans motif. Sans lui, l'artisan redépose exactement la même pièce |
| Date de validité | champ `date` facultatif rangé dans `metadata.valid_until` — **aucune colonne créée** pour elle |
| « Vérifiée le … » | affiché **seulement** si `reviewed_at IS NOT NULL`. C'est le discriminant « une décision humaine a été prise » : sans lui, une pièce héritée du DEFAULT `'approved'` prétendrait avoir été contrôlée |
| « Dossier complet validé le … » | dès que `artisans.dossier_validated_at` est renseignée (posée par `trg_artisan_dossier_sync`) |
| « Valider le dossier » | `POST /api/artisans/{id}/dossier/validate` — actif **seulement** quand les 5 pièces requises sont validées ; pose `dossier_validated_by`, **jamais** `dossier_validated_at` (un seul écrivain : le trigger) |

Les pièces `pending` remontent en tête de liste : c'est la file de travail. `readOnly` (permission `write_artisans` absente, ou fiche verrouillée par un autre gestionnaire) masque toutes les actions et ne laisse que la lecture.

Tests : `tests/unit/components/artisan-modal/DossierVerificationCard.test.tsx`.

### ArtisanFinancesSection.tsx

Section financière dans la modal artisan affichant :
- Total des interventions réalisées
- Chiffre d'affaires généré
- Marge moyenne par intervention
- Historique des paiements

### ArtisanInterventionsTable.tsx

Tableau des interventions associées a un artisan. Affiche statut, date, adresse, métier et montants. Clic sur une ligne ouvre la modal intervention correspondante.

---

## Badges artisan (ui/)

### ArtisanStatusBadge

Badge affichant le statut d'un artisan avec la couleur correspondante :

| Statut | Couleur |
|--------|---------|
| Candidat | Bleu |
| En cours de validation | Jaune |
| Validé | Vert |
| Expert | Violet |
| One Shot | Orange |
| Inactif | Gris |
| Archivé | Rouge |

```tsx
import { ArtisanStatusBadge } from "@/components/ui/ArtisanStatusBadge"

<ArtisanStatusBadge status={artisan.status} />
```

### ArtisanDossierStatusIcon

Icone indiquant le statut du dossier administratif :
- `COMPLET` : check vert
- `A completer` : warning orange
- `INCOMPLET` : croix rouge

---

## Hooks associés

| Hook | Fichier | Rôle |
|------|---------|------|
| `useArtisansQuery` | `src/hooks/useArtisansQuery.ts` | Fetching paginé avec filtres |
| `useArtisanModal` | `src/hooks/useArtisanModal.ts` | State et navigation modal |
| `useArtisanContextMenu` | `src/hooks/useArtisanContextMenu.ts` | Actions du menu contextuel |
| `useArtisanViews` | `src/hooks/useArtisanViews.ts` | Presets des puces de vue (six vues, dont « Artisans à vérifier » et « Mes artisans à vérifier »), fusion avec le `localStorage` et substitution de `__CURRENT_USER__` |
| `useSiretVerification` | `src/hooks/useSiretVerification.ts` | Validation SIRET via API INSEE |
| `usePortalLiveSync` | `src/hooks/usePortalLiveSync.ts` | Canal temps réel `portail-live`. **L5** y a ajouté l'invalidation de `artisanKeys.lists()` : sans elle, la pastille « n à vérifier » et le compteur de la puce ne bougeaient qu'au rechargement de la page. |

---

## Modules et routes du lot L5 (vérification des pièces)

| Fichier | Rôle |
|---|---|
| `src/lib/artisans/document-review.ts` | Module **pur** partagé serveur / client : `parseReviewBody` (motif obligatoire au refus, date de validité au format `AAAA-MM-JJ` réellement existante), `reviewLabel`, `estVerifiee`, `mergeValidUntil` (conserve `metadata.source`), `PIECES_A_VERIFIER_COLOR` |
| `src/lib/artisans/artisan-action-log.ts` | Écriture dans le journal append-only `artisan_portal_actions` (99079). Une action `source='crm'` **doit** porter son acteur (`actor_user_id` **et** `payload.actor`) : c'est un CHECK, pas une convention, et c'est ce qui fait survivre l'attribution à la suppression du compte. L'échec du journal ne fait jamais échouer le geste métier. |
| `app/api/artisans/[id]/documents/[attachmentId]/review/route.ts` | `write_artisans` — voir le contrat d'API §8.2 |
| `app/api/artisans/[id]/dossier/validate/route.ts` | `write_artisans` — pose `dossier_validated_by` |
| `app/api/portal-external/me/profile-photo/route.ts` | Photo de profil envoyée par l'artisan ; `process-avatar` attendu, échec non fatal |
