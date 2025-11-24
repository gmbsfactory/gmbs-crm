# Data Model: Mise à jour en temps réel des interventions

**Date**: 2025-01-27  
**Feature**: 002-real-time-updates

## Entités Principales

### Intervention

**Table**: `interventions` (existant)

**Champs pertinents pour Realtime**:
- `id` (UUID, PK) - Identifiant unique
- `statut_id` (UUID, FK) - Statut actuel (déclenche transitions de vue)
- `assigned_user_id` (UUID, FK, nullable) - Utilisateur assigné (déclenche filtres "Market" vs "Mes demandes")
- `artisan_id` (UUID, FK, nullable) - Artisan assigné
- `agence_id` (UUID, FK) - Agence
- `metier_id` (UUID, FK) - Métier
- `date` (DATE) - Date de l'intervention
- `date_prevue` (DATE, nullable) - Date prévue
- `is_active` (BOOLEAN) - Soft delete flag
- `updated_at` (TIMESTAMP) - Timestamp de dernière modification (pour détection conflits)
- `created_at` (TIMESTAMP) - Timestamp de création

**Relations**:
- `interventions.statut_id` → `intervention_statuses.id`
- `interventions.assigned_user_id` → `users.id`
- `interventions.artisan_id` → `artisans.id`
- `interventions.agence_id` → `agencies.id`
- `interventions.metier_id` → `metiers.id`

**Règles de validation**:
- `is_active` doit être `true` pour apparaître dans les vues actives
- `statut_id` doit correspondre à un statut valide dans `intervention_statuses`
- `updated_at` est mis à jour automatiquement par trigger PostgreSQL

**Transitions de statut autorisées**:
Voir `spec.md` section "Toutes les Transitions de Statut" pour la liste complète.

### Vue (View)

**Concept**: Configuration d'affichage avec filtres (pas de table dédiée)

**Filtres possibles**:
- `statut_id` (UUID) - Filtre par statut
- `assigned_user_id` (UUID | null) - Filtre par utilisateur assigné (null = Market)
- `artisan_id` (UUID) - Filtre par artisan
- `agence_id` (UUID) - Filtre par agence
- `metier_id` (UUID) - Filtre par métier
- `startDate` (DATE) - Date de début
- `endDate` (DATE) - Date de fin
- `search` (STRING) - Recherche textuelle

**Logique de filtrage**:
Une intervention apparaît dans une vue si elle correspond à TOUS les filtres actifs de cette vue.

**Exemples de vues**:
- **Market**: `statut_id = 'DEMANDE'` AND `assigned_user_id IS NULL`
- **Mes demandes**: `statut_id = 'DEMANDE'` AND `assigned_user_id = current_user_id`
- **En cours**: `statut_id = 'EN_COURS'`
- **Terminé**: `statut_id = 'TERMINE'`

### Compteur (Badge)

**Concept**: Nombre total d'interventions correspondant aux filtres d'une vue

**Calcul**: Via API de comptage existante (pas de calcul local)

**Mise à jour**: 
- Déclenchée par événement Realtime
- Debounce de 500ms pour regrouper les mises à jour multiples
- Appel API via `getInterventionTotalCount(filters)` pour le total global
- Appel API via `getInterventionCounts(filters)` pour les comptages par statut
- Fonctions disponibles dans `src/lib/supabase-api-v2.ts`

### Événement Realtime

**Type**: `postgres_changes` (Supabase Realtime)

**Schéma**:
```typescript
interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Intervention | null        // Nouvelle valeur (INSERT/UPDATE)
  old: Intervention | null       // Ancienne valeur (UPDATE/DELETE)
  timestamp: string               // Timestamp de l'événement
}
```

**Filtrage**:
- RLS filtre automatiquement selon les permissions utilisateur
- Seules les interventions avec `is_active = true` sont écoutées

### Modification en File d'Attente

**Structure**:
```typescript
interface QueuedModification {
  id: string                      // ID unique de la modification
  interventionId: string           // ID de l'intervention
  type: 'create' | 'update' | 'delete'
  data: Partial<Intervention>      // Données à synchroniser
  timestamp: number               // Timestamp de création
  retryCount: number              // Nombre de tentatives
}
```

**Contraintes**:
- File FIFO limitée à 50 modifications
- Traitement par batch de 10 toutes les 5 secondes
- Sauvegarde localStorage pour persistance

### Indicateur Visuel de Modification

**Structure**:
```typescript
interface RemoteEditIndicator {
  interventionId: string          // ID de l'intervention modifiée
  userId: string                  // ID de l'utilisateur distant
  userName: string                // Nom de l'utilisateur distant
  userColor: string               // Couleur utilisateur pour badge
  fields: string[]                // Champs modifiés
  timestamp: number               // Timestamp de début modification
}
```

**Persistance**: Jusqu'à synchronisation complète de la modification

## Modifications Déclenchant des Événements Realtime

### Création d'intervention
- **Événement**: `INSERT`
- **Impact**: Apparition dans les vues correspondant aux filtres

### Modification de statut
- **Événement**: `UPDATE` (champ `statut_id`)
- **Impact**: 
  - Disparition des vues avec ancien statut
  - Apparition dans les vues avec nouveau statut
  - Mise à jour des compteurs concernés

### Assignation utilisateur ("Je gère")
- **Événement**: `UPDATE` (champ `assigned_user_id`)
- **Impact**:
  - Disparition de la vue "Market" (si `assigned_user_id` passe de `null` à `user_id`)
  - Apparition dans la vue "Mes demandes" de l'utilisateur assigné
  - Mise à jour des compteurs Market et Mes demandes

### Modification d'artisan assigné
- **Événement**: `UPDATE` (champ `artisan_id`)
- **Impact**: Mise à jour des vues filtrées par artisan

### Modification d'autres champs
- **Événement**: `UPDATE` (autres champs)
- **Impact**: Mise à jour de l'affichage si le champ affecte les filtres

### Suppression (soft delete)
- **Événement**: `UPDATE` (champ `is_active` passe à `false`)
- **Impact**: Disparition immédiate de toutes les vues

## État du Cache TanStack Query

### Structure des Query Keys

**Listes complètes**:
```typescript
['interventions', 'list', params]
```

**Listes légères**:
```typescript
['interventions', 'light', params]
```

**Résumés (compteurs)**:
```typescript
['interventions', 'summary', params]
```

**Détails**:
```typescript
['interventions', 'detail', id, include?]
```

### Mise à Jour du Cache

**Stratégie**:
1. Mise à jour optimiste immédiate via `setQueryData` (< 500ms)
2. Invalidation silencieuse en arrière-plan après 100ms
3. Conservation du staleTime 30s pour les chargements initiaux

**Queries affectées par événement Realtime**:
- Toutes les listes (`['interventions', 'list', ...]`)
- Toutes les listes légères (`['interventions', 'light', ...]`)
- Tous les résumés (`['interventions', 'summary', ...]`)
- Détail de l'intervention modifiée (`['interventions', 'detail', id]`)

## Synchronisation Multi-Onglets

**Mécanisme**: BroadcastChannel API pour synchroniser le cache entre onglets

**Structure**:
```typescript
interface CacheSyncMessage {
  type: 'cache-update' | 'invalidation'
  queryKey: QueryKey
  data?: unknown
  timestamp: number
}
```

**Comportement**:
- Un onglet reçoit un événement Realtime
- Met à jour son cache local
- Broadcast aux autres onglets via BroadcastChannel
- Les autres onglets mettent à jour leur cache sans refetch

## Sécurité et Permissions

### Row Level Security (RLS)

**Politiques existantes**:
- Les utilisateurs ne peuvent voir que les interventions auxquelles ils ont accès
- Les admins ont accès à toutes les interventions
- RLS filtre automatiquement les événements Realtime

**Impact Realtime**:
- Les événements Realtime respectent automatiquement les politiques RLS
- Un utilisateur ne reçoit que les événements d'interventions auxquelles il a accès
- Si un utilisateur perd l'accès (changement RLS), les événements cessent automatiquement

### Authentification

**Mécanisme**: Supabase Auth avec JWT

**Validation**: Token JWT vérifié sur chaque connexion Realtime

**Expiration**: Reconnexion automatique si token expiré

