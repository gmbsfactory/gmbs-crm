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
- Menu contextuel au clic droit

### ArtisanFilterDropdown.tsx

Dropdown de filtrage pour la page artisans. Filtres disponibles :
- Statut artisan (Candidat, Validé, Expert, etc.)
- Métier
- Zone géographique
- Gestionnaire assigné

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

> **Règle :** toute nouvelle saisie/champ dans la modal artisan doit être ajoutée comme composant autonome dans `_components/`, **pas** inlinée dans `NewArtisanModalContent` ou `ArtisanModalContent`. La logique de validation correspondante va dans `src/lib/<domain>-validation.ts` (cf. `iban-validation`, `siret-validation`).

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
| `useArtisanViews` | `src/hooks/useArtisanViews.ts` | Gestion des vues (table/cards) |
| `useSiretVerification` | `src/hooks/useSiretVerification.ts` | Validation SIRET via API INSEE |
