# Data Model: Menus contextuels et duplication "Devis supp"

**Date**: 2025-01-16  
**Phase**: Phase 1 - Design & Contracts  
**Status**: ✅ Complete

## Overview

Ce document décrit le modèle de données pour les menus contextuels et la duplication "Devis supp". Aucune nouvelle table n'est requise - toutes les entités existent déjà dans le schéma Supabase.

## Entités Existantes Réutilisées

### 1. Intervention

**Table**: `interventions`  
**Référence**: `src/lib/database.types.ts`, `src/lib/api/v2/common/types.ts`

**Champs Utilisés**:

```typescript
interface Intervention {
  id: string;                          // UUID - Identifiant unique
  id_inter: string | null;             // ID intervention valide (pour duplication)
  statut_id: string | null;            // Référence à intervention_statuses
  assigned_user_id: string | null;    // Référence à users (pour "Je gère")
  contexte_intervention: string | null; // Contexte (exclu lors de duplication)
  consigne_intervention: string | null; // Consignes (exclues lors de duplication)
  commentaire_agent: string | null;    // Commentaire agent
  // ... autres champs
}
```

**Règles de Validation**:
- `id_inter` doit être non null et non vide pour afficher "Passer à Devis envoyé"
- `statut_id` détermine les transitions disponibles
- `assigned_user_id` peut être mis à jour via "Je gère"

**Relations**:
- `statut_id` → `intervention_statuses.id`
- `assigned_user_id` → `users.id`
- `id` → `comments.entity_id` (pour commentaires système)

**Transitions de Statut**:
- `DEMANDE` → `DEVIS_ENVOYE` (si `id_inter` renseigné)
- `DEVIS_ENVOYE` → `ACCEPTE`

**Référence**: `src/config/interventions.ts`, `src/lib/api/interventions.ts:231`

---

### 2. Artisan

**Table**: `artisans`  
**Référence**: `src/lib/database.types.ts`, `src/lib/api/v2/common/types.ts`

**Champs Utilisés**:

```typescript
interface Artisan {
  id: string;                    // UUID - Identifiant unique
  statut_id: string | null;      // Référence à artisan_statuses (pour archivage)
  archived_at: string | null;   // Date d'archivage
  archived_by: string | null;    // UUID utilisateur qui a archivé
  archived_reason: string | null; // Motif d'archivage (obligatoire)
  // ... autres champs
}
```

**Règles de Validation**:
- `archived_reason` est obligatoire lors de l'archivage (bloquant)
- `archived_by` est automatiquement rempli avec l'ID de l'utilisateur connecté
- `archived_at` est automatiquement rempli avec la date actuelle

**Relations**:
- `statut_id` → `artisan_statuses.id`
- `archived_by` → `users.id`
- `id` → `comments.entity_id` (pour commentaires d'archivage)

**Référence**: `docs/livrable-2025-11-04/BUSINESS_RULES_2025-11-04.md:617`

---

### 3. Comment (Commentaire Système)

**Table**: `comments`  
**Référence**: `src/lib/database.types.ts:587`, `src/lib/api/v2/common/types.ts`

**Champs Utilisés pour "Devis supp"**:

```typescript
interface Comment {
  id: string;                    // UUID - Identifiant unique
  entity_type: string;           // 'intervention' pour les commentaires d'intervention
  entity_id: string;              // ID de l'intervention dupliquée
  content: string;                 // "devis supp avec l'ancien ID [ID_ORIGINAL]"
  comment_type: string | null;    // 'system' pour les commentaires système
  author_id: string | null;       // ID de l'utilisateur qui a créé le devis supp
  is_internal: boolean | null;    // true pour les commentaires internes
  created_at: string | null;      // Date de création
  // ... autres champs
}
```

**Règles de Validation**:
- `entity_type` = `'intervention'` pour les commentaires d'intervention
- `entity_id` = ID de la nouvelle intervention créée
- `content` = `"devis supp avec l'ancien ID [ID_ORIGINAL]"` où `[ID_ORIGINAL]` est l'ID de l'intervention originale
- `comment_type` = `'system'` pour indiquer un commentaire système
- `author_id` = ID de l'utilisateur connecté qui effectue la duplication
- `is_internal` = `true` par défaut

**Relations**:
- `entity_id` → `interventions.id` (pour commentaires d'intervention)
- `author_id` → `users.id`

**Référence**: `src/lib/api/v2/commentsApi.ts:66`, `supabase/functions/comments/index.ts:204`

---

### 4. InterventionStatus (Statuts d'Intervention)

**Table**: `intervention_statuses`  
**Référence**: `src/config/interventions.ts`

**Statuts Utilisés**:

```typescript
type InterventionStatusValue = 
  | "DEMANDE"           // Statut initial
  | "DEVIS_ENVOYE"      // Devis envoyé au client
  | "ACCEPTE"           // Devis accepté par le client
  | "EN_COURS"          // Intervention en cours
  | "TERMINE"           // Intervention terminée
  | // ... autres statuts
```

**Transitions Autorisées**:
- `DEMANDE` → `DEVIS_ENVOYE` (si `id_inter` renseigné)
- `DEVIS_ENVOYE` → `ACCEPTE`

**Référence**: `src/config/interventions.ts:55`, `src/lib/workflow-engine.ts`

---

### 5. User (Utilisateur)

**Table**: `users`  
**Référence**: `src/lib/database.types.ts`

**Champs Utilisés**:

```typescript
interface User {
  id: string;              // UUID - Identifiant unique
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  // ... autres champs
}
```

**Utilisation**:
- `id` utilisé pour `assigned_user_id` lors de "Je gère"
- `id` utilisé pour `author_id` lors de la création de commentaires système
- `id` utilisé pour `archived_by` lors de l'archivage d'artisan

---

## Modèle de Données pour la Duplication "Devis supp"

### Entrée (Intervention Originale)

```typescript
interface OriginalIntervention {
  id: string;                          // ID original (sera dans le commentaire)
  id_inter: string | null;             // Conservé dans la copie
  statut_id: string | null;            // Conservé dans la copie (ou "DEMANDE" par défaut)
  assigned_user_id: string | null;      // Conservé dans la copie
  contexte_intervention: string | null; // EXCLU (mis à null)
  consigne_intervention: string | null; // EXCLU (mis à null)
  // ... tous les autres champs sont copiés
}
```

### Sortie (Nouvelle Intervention)

```typescript
interface DuplicatedIntervention {
  id: string;                          // NOUVEAU UUID généré
  id_inter: string | null;             // Copié de l'original
  statut_id: string | null;            // Copié de l'original (ou "DEMANDE" par défaut)
  assigned_user_id: string | null;      // Copié de l'original
  contexte_intervention: null;           // FORCÉ à null
  consigne_intervention: null;          // FORCÉ à null
  // ... tous les autres champs copiés de l'original
}
```

### Commentaire Système Créé

```typescript
interface SystemComment {
  entity_type: "intervention";
  entity_id: string;                   // ID de la nouvelle intervention
  content: string;                     // "devis supp avec l'ancien ID [ID_ORIGINAL]"
  comment_type: "system";
  author_id: string;                  // ID de l'utilisateur connecté
  is_internal: true;
}
```

**Référence**: `src/lib/api/interventions.ts:166`, `src/lib/api/v2/commentsApi.ts:66`

---

## Modèle de Données pour les Actions de Menu Contextuel

### Actions Disponibles par Contexte

#### Interventions (Toutes les vues)

```typescript
interface InterventionContextMenuActions {
  // Actions de base (toujours disponibles)
  open: () => void;                    // Ouvrir la modale de détail
  openInNewTab: () => void;            // Ouvrir dans un nouvel onglet
  
  // Actions conditionnelles
  transitionToDevisEnvoye?: () => void; // Si statut = "DEMANDE" ET id_inter renseigné
  transitionToAccepte?: () => void;    // Si statut = "DEVIS_ENVOYE"
  duplicateDevisSupp: () => void;      // Toujours disponible
  
  // Actions spécifiques à la vue Market
  assignToMe?: () => void;             // Uniquement dans la vue Market
}
```

#### Artisans (Page Artisans)

```typescript
interface ArtisanContextMenuActions {
  open: () => void;                    // Ouvrir la modale de détail
  edit: () => void;                    // Ouvrir la modale en mode édition
  archive: (reason: string) => void;  // Archiver avec motif obligatoire
}
```

---

## Validations et Contraintes

### Duplication "Devis supp"

1. **Prérequis**:
   - Intervention originale doit exister
   - Utilisateur doit être authentifié
   - Utilisateur doit avoir les droits de création d'intervention

2. **Règles Métier**:
   - Nouveau UUID généré pour la nouvelle intervention
   - `contexte_intervention` et `consigne_intervention` forcés à `null`
   - Tous les autres champs copiés de l'original
   - Commentaire système créé automatiquement avec référence à l'ID original

3. **Gestion d'Erreurs**:
   - Si l'intervention originale n'existe plus → Erreur
   - Si l'utilisateur n'a pas les droits → Erreur 403
   - Si la création échoue → Rollback, intervention originale inchangée

### Transitions de Statut

1. **"Demandé → Devis envoyé"**:
   - Prérequis: `statut_id` = "DEMANDE" ET `id_inter` non null et non vide
   - Action: Mise à jour `statut_id` vers "DEVIS_ENVOYE"
   - Validation: Vérifier que la transition est autorisée dans le workflow

2. **"Devis envoyé → Accepté"**:
   - Prérequis: `statut_id` = "DEVIS_ENVOYE"
   - Action: Mise à jour `statut_id` vers "ACCEPTE"
   - Validation: Vérifier que la transition est autorisée dans le workflow

### Archivage d'Artisan

1. **Prérequis**:
   - Artisan doit exister
   - Utilisateur doit être authentifié
   - Utilisateur doit avoir les droits d'archivage

2. **Règles Métier**:
   - `archived_reason` est obligatoire (bloquant)
   - `archived_by` = ID utilisateur connecté
   - `archived_at` = Date actuelle
   - Commentaire créé avec `reason_type` = `'archive'`

3. **Gestion d'Erreurs**:
   - Si le motif n'est pas fourni → Erreur de validation
   - Si l'artisan n'existe plus → Erreur 404
   - Si l'utilisateur n'a pas les droits → Erreur 403

### Assignation "Je gère"

1. **Prérequis**:
   - Intervention doit exister
   - Utilisateur doit être authentifié
   - Vue actuelle = Market

2. **Règles Métier**:
   - `assigned_user_id` = ID utilisateur connecté
   - Mise à jour immédiate sans modale

3. **Gestion d'Erreurs**:
   - Si l'intervention n'existe plus → Erreur 404
   - Si l'utilisateur n'a pas les droits → Erreur 403

---

## Relations et Intégrité

### Graphe des Relations

```
interventions
├── statut_id → intervention_statuses.id
├── assigned_user_id → users.id
├── id → comments.entity_id (pour commentaires système)
└── id_inter → interventions.id (auto-référence pour duplication)

artisans
├── statut_id → artisan_statuses.id
├── archived_by → users.id
└── id → comments.entity_id (pour commentaires d'archivage)

comments
├── entity_id → interventions.id (si entity_type = 'intervention')
├── entity_id → artisans.id (si entity_type = 'artisan')
└── author_id → users.id
```

### Contraintes d'Intégrité

1. **Duplication**:
   - La nouvelle intervention doit avoir un UUID unique
   - Le commentaire système doit référencer l'ID original correctement
   - Transaction atomique : si la création du commentaire échoue, rollback de l'intervention

2. **Transitions**:
   - Les transitions doivent respecter le workflow défini
   - Validation des prérequis avant transition

3. **Archivage**:
   - Le motif d'archivage est obligatoire
   - L'artisan archivé reste dans la base mais n'apparaît plus dans les listes actives

---

## Index et Performance

### Index Existants (Réutilisés)

- `interventions.id` (PK) - Index primaire
- `interventions.statut_id` - Index pour filtrage par statut
- `interventions.assigned_user_id` - Index pour filtrage par utilisateur assigné
- `interventions.id_inter` - Index pour validation des prérequis
- `comments.entity_id` + `comments.entity_type` - Index composite pour requêtes de commentaires

### Optimisations

1. **Duplication**:
   - Utiliser une transaction SQL pour garantir l'atomicité
   - Insertion de l'intervention + création du commentaire en une seule transaction

2. **Transitions**:
   - Utiliser les mutations optimistes React Query pour améliorer l'UX
   - Invalidation ciblée des queries concernées

3. **Rafraîchissement**:
   - Invalidation sélective des queries React Query
   - Pas de refetch complet, seulement les données modifiées

---

## Conclusion

Aucune nouvelle table n'est requise. Toutes les entités existent déjà dans le schéma Supabase. Le modèle de données réutilise les tables existantes avec des règles métier spécifiques pour la duplication et les actions de menu contextuel.

**Status**: ✅ **READY FOR IMPLEMENTATION** - Modèle de données complet, aucune migration requise







