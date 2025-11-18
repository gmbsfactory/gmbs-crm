# Contrat: Événements Supabase Realtime

**Date**: 2025-01-27  
**Feature**: 002-real-time-updates

## Configuration du Channel

### Channel Name
```
interventions-changes
```

### Configuration
```typescript
const channel = supabase
  .channel('interventions-changes')
  .on('postgres_changes', {
    event: '*',                    // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'interventions',
    // ⚠️ IMPORTANT: Pas de filtre is_active ici pour détecter les soft deletes
    // On écoute tous les événements UPDATE pour détecter les changements de is_active
  }, handleRealtimeEvent)
  .subscribe()
```

**Note sur les soft deletes**: 
- Les soft deletes sont détectés via un événement `UPDATE` où `old.is_active === true` et `new.is_active === false`
- Le filtrage par `is_active=eq.true` dans le channel Realtime empêcherait de recevoir ces événements
- Le filtrage des interventions inactives se fait côté client lors de la mise à jour du cache

## Structure des Événements

### Événement INSERT (Création)

**Type**: `INSERT`

**Payload**:
```typescript
{
  eventType: 'INSERT',
  new: {
    id: string                    // UUID
    statut_id: string            // UUID
    assigned_user_id: string | null
    artisan_id: string | null
    agence_id: string
    metier_id: string
    date: string                  // ISO date
    date_prevue: string | null
    is_active: boolean
    updated_at: string            // ISO timestamp
    created_at: string            // ISO timestamp
    // ... autres champs
  },
  old: null,
  timestamp: string               // ISO timestamp de l'événement
}
```

**Comportement**:
- L'intervention apparaît dans les vues correspondant aux filtres
- Les compteurs des vues concernées sont mis à jour
- Badge overlay affiché si modification par autre utilisateur

### Événement UPDATE (Modification)

**Type**: `UPDATE`

**Payload**:
```typescript
{
  eventType: 'UPDATE',
  new: {
    id: string
    statut_id: string            // Peut avoir changé
    assigned_user_id: string | null  // Peut avoir changé
    artisan_id: string | null   // Peut avoir changé
    // ... autres champs (peuvent avoir changé)
    updated_at: string           // Mis à jour automatiquement
  },
  old: {
    id: string
    statut_id: string            // Ancienne valeur
    assigned_user_id: string | null  // Ancienne valeur
    // ... autres champs (anciennes valeurs)
  },
  timestamp: string
}
```

**Comportement selon champ modifié**:

#### Modification de `statut_id`
- Intervention disparaît des vues avec ancien statut
- Intervention apparaît dans les vues avec nouveau statut
- Compteurs des vues concernées mis à jour

#### Modification de `assigned_user_id`
- Si passe de `null` à `user_id`: disparaît de "Market", apparaît dans "Mes demandes" de l'utilisateur
- Si passe de `user_id1` à `user_id2`: disparaît de "Mes demandes" de user1, apparaît dans "Mes demandes" de user2
- Compteurs Market et Mes demandes mis à jour

#### Modification de `artisan_id`
- Intervention apparaît/disparaît des vues filtrées par artisan
- Compteurs des vues concernées mis à jour

#### Modification d'autres champs
- Mise à jour de l'affichage si le champ affecte les filtres
- Sinon, mise à jour silencieuse du cache

### Événement DELETE (Soft Delete)

**Type**: `UPDATE` (champ `is_active` passe à `false`)

**Détection**:
```typescript
// Dans le handler d'événement Realtime
if (eventType === 'UPDATE' && oldRecord?.is_active === true && newRecord?.is_active === false) {
  // Soft delete détecté
  handleSoftDelete(newRecord.id, oldRecord)
}
```

**Payload**:
```typescript
{
  eventType: 'UPDATE',
  new: {
    id: string
    is_active: false             // Changé à false
    updated_at: string
    // ... autres champs
  },
  old: {
    id: string
    is_active: true               // Ancienne valeur
    // ... autres champs
  },
  timestamp: string
}
```

**Comportement**:
- Intervention disparaît immédiatement de toutes les vues (filtrée côté client)
- Notification toast "Intervention supprimée"
- Annulation de toute modification en cours sur cette intervention
- Compteurs des vues concernées mis à jour
- Toutes les queries contenant cette intervention sont invalidées

**Implémentation**:
```typescript
// Dans cache-sync.ts
function isSoftDelete(oldRecord: Intervention | null, newRecord: Intervention | null): boolean {
  return oldRecord?.is_active === true && newRecord?.is_active === false
}

// Dans le handler UPDATE
if (isSoftDelete(oldRecord, newRecord)) {
  // Retirer de toutes les listes
  queryClient.setQueriesData(
    { queryKey: interventionKeys.invalidateLists() },
    (oldData) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        data: oldData.data.filter(i => i.id !== newRecord.id),
        pagination: {
          ...oldData.pagination,
          total: Math.max(0, oldData.pagination.total - 1)
        }
      }
    }
  )
  
  // Notification
  showToast({ title: "Intervention supprimée", variant: "info" })
}
```

## Gestion des Erreurs

### Erreur de Connexion

**Événement**: `error` sur le channel

**Payload**:
```typescript
{
  error: string                  // Message d'erreur
  code: string                   // Code d'erreur Supabase
}
```

**Comportement**:
- Basculement automatique vers polling (5s)
- Tentative de reconnexion toutes les 30s
- Notification utilisateur du mode dégradé

### Déconnexion

**Événement**: `disconnect` sur le channel

**Comportement**:
- Basculement automatique vers polling
- Tentative de reconnexion automatique

### Reconnexion

**Événement**: `reconnect` sur le channel

**Comportement**:
- Arrêt du polling
- Reprise de l'écoute Realtime
- Synchronisation des données manquantes

## Filtrage RLS

**Comportement**:
- Les événements Realtime sont automatiquement filtrés par RLS
- Un utilisateur ne reçoit que les événements d'interventions auxquelles il a accès
- Si un utilisateur perd l'accès (changement RLS), les événements cessent automatiquement

**Impact**:
- Pas de configuration supplémentaire nécessaire
- Sécurité garantie côté serveur
- Conforme aux politiques RLS existantes

## Performance

### Latence Attendue
- Événement Realtime reçu: < 2 secondes après modification
- Mise à jour UI visible: < 500ms après réception événement

### Débit
- Support de 10 utilisateurs simultanés sans dégradation
- Gestion de modifications multiples rapides via debounce

### Optimisations
- Debounce de 500ms pour les mises à jour de compteurs
- Mise à jour optimiste du cache pour réactivité immédiate
- Invalidation silencieuse en arrière-plan pour cohérence

