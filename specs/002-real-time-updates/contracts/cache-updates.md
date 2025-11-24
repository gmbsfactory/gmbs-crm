# Contrat: Mise à jour du Cache TanStack Query

**Date**: 2025-01-27  
**Feature**: 002-real-time-updates

## Stratégie de Mise à Jour

### Principe Général

1. **Mise à jour optimiste immédiate** via `setQueryData` (< 500ms)
2. **Invalidation silencieuse** en arrière-plan après 100ms
3. **Conservation du staleTime 30s** pour les chargements initiaux

### Flux de Mise à Jour

```
Événement Realtime reçu
  ↓
Mise à jour optimiste du cache (setQueryData)
  ↓
UI mise à jour immédiatement (< 500ms)
  ↓
Invalidation silencieuse après 100ms (refetchType: 'none')
  ↓
Cache cohérent avec serveur
```

## Query Keys Affectées

### Listes Complètes
```typescript
['interventions', 'list', params]
```

**Mise à jour**:
- `setQueryData` avec intervention modifiée/ajoutée/supprimée
- Invalidation silencieuse après 100ms

### Listes Légères
```typescript
['interventions', 'light', params]
```

**Mise à jour**:
- `setQueryData` avec intervention modifiée/ajoutée/supprimée
- Invalidation silencieuse après 100ms

### Résumés (Compteurs)
```typescript
['interventions', 'summary', params]
```

**Mise à jour**:
- Debounce de 500ms pour regrouper les mises à jour multiples
- Invalidation avec refetch pour recalculer les compteurs via API
- Utilise `getInterventionTotalCount()` pour le total global
- Utilise `getInterventionCounts()` pour les comptages par statut

### Détails
```typescript
['interventions', 'detail', id, include?]
```

**Mise à jour**:
- `setQueryData` avec intervention modifiée
- Invalidation silencieuse après 100ms

## Fonction matchesFilters

**Fichier**: `src/lib/realtime/filter-utils.ts`

Cette fonction détermine si une intervention correspond aux filtres d'une vue donnée. Elle est utilisée pour décider si une intervention doit apparaître/disparaître d'une liste après un événement Realtime.

```typescript
import type { Intervention } from '@/lib/api/v2/common/types'
import type { GetAllParams } from '@/lib/supabase-api-v2'

/**
 * Vérifie si une intervention correspond aux filtres d'une vue
 * 
 * @param intervention - Intervention à vérifier
 * @param filters - Paramètres de filtrage de la vue (GetAllParams)
 * @returns true si l'intervention correspond aux filtres
 */
export function matchesFilters(
  intervention: Intervention,
  filters: GetAllParams | undefined
): boolean {
  if (!filters) return true
  
  // Filtrer les interventions inactives
  if (!intervention.is_active) return false
  
  // Filtre par statut
  if (filters.statut && intervention.statut_id !== filters.statut) {
    return false
  }
  
  // Filtre par utilisateur assigné
  if (filters.user !== undefined) {
    if (filters.user === null) {
      // Market: assigned_user_id doit être null
      if (intervention.assigned_user_id !== null) return false
    } else {
      // Mes demandes: assigned_user_id doit correspondre
      if (intervention.assigned_user_id !== filters.user) return false
    }
  }
  
  // Filtre par artisan
  if (filters.artisan && intervention.artisan_id !== filters.artisan) {
    return false
  }
  
  // Filtre par agence
  if (filters.agence && intervention.agence_id !== filters.agence) {
    return false
  }
  
  // Filtre par métier
  if (filters.metier && intervention.metier_id !== filters.metier) {
    return false
  }
  
  // Filtre par date de début
  if (filters.startDate && intervention.date < filters.startDate) {
    return false
  }
  
  // Filtre par date de fin
  if (filters.endDate && intervention.date > filters.endDate) {
    return false
  }
  
  // Filtre par recherche textuelle (si applicable)
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    const searchableFields = [
      intervention.contexte_intervention,
      intervention.adresse,
      intervention.ville,
      intervention.commentaire_agent,
    ].filter(Boolean).join(' ').toLowerCase()
    
    if (!searchableFields.includes(searchTerm)) {
      return false
    }
  }
  
  return true
}

/**
 * Extrait les paramètres de filtrage depuis une query key
 * 
 * @param queryKey - Query key TanStack Query (ex: ['interventions', 'list', params])
 * @returns Paramètres de filtrage ou undefined
 */
export function extractFiltersFromQueryKey(queryKey: unknown[]): GetAllParams | undefined {
  // Les query keys ont la structure: ['interventions', 'list' | 'light', params]
  if (queryKey.length >= 3 && typeof queryKey[2] === 'object') {
    return queryKey[2] as GetAllParams
  }
  return undefined
}
```

**Utilisation dans cache-sync.ts**:
```typescript
import { matchesFilters, extractFiltersFromQueryKey } from '@/lib/realtime/filter-utils'

// Lors de la mise à jour du cache
queryClient.setQueriesData(
  { queryKey: interventionKeys.invalidateLists() },
  (oldData, queryKey) => {
    if (!oldData) return oldData
    
    // Extraire les filtres de la query key
    const filters = extractFiltersFromQueryKey(queryKey)
    
    // Vérifier si l'intervention correspond aux filtres
    if (matchesFilters(newIntervention, filters)) {
      // Ajouter l'intervention à la liste
      // ...
    }
    
    return oldData
  }
)
```

## Implémentation par Type d'Événement

### INSERT (Création)

```typescript
import { matchesFilters, extractFiltersFromQueryKey } from '@/lib/realtime/filter-utils'

// Mise à jour optimiste
queryClient.setQueriesData(
  { queryKey: interventionKeys.invalidateLists() },
  (oldData: PaginatedResponse<Intervention> | undefined, queryKey) => {
    if (!oldData) return oldData
    
    // Extraire les filtres depuis la query key
    const filters = extractFiltersFromQueryKey(queryKey)
    
    // Vérifier si l'intervention correspond aux filtres
    if (matchesFilters(newIntervention, filters)) {
      return {
        ...oldData,
        data: [newIntervention, ...oldData.data],
        pagination: {
          ...oldData.pagination,
          total: oldData.pagination.total + 1
        }
      }
    }
    return oldData
  }
)

// Invalidation silencieuse après 100ms
setTimeout(() => {
  queryClient.invalidateQueries({ 
    queryKey: interventionKeys.invalidateLists(),
    refetchType: 'none' 
  })
}, 100)
```

### UPDATE (Modification)

```typescript
import { matchesFilters, extractFiltersFromQueryKey } from '@/lib/realtime/filter-utils'

// Mise à jour optimiste
queryClient.setQueriesData(
  { queryKey: interventionKeys.invalidateLists() },
  (oldData: PaginatedResponse<Intervention> | undefined, queryKey) => {
    if (!oldData) return oldData
    
    // Extraire les filtres depuis la query key
    const filters = extractFiltersFromQueryKey(queryKey)
    
    const index = oldData.data.findIndex(i => i.id === updatedIntervention.id)
    
    if (index === -1) {
      // Intervention n'était pas dans cette liste
      // Vérifier si elle doit maintenant y apparaître
      if (matchesFilters(updatedIntervention, filters)) {
        return {
          ...oldData,
          data: [updatedIntervention, ...oldData.data],
          pagination: {
            ...oldData.pagination,
            total: oldData.pagination.total + 1
          }
        }
      }
      return oldData
    }
    
    // Intervention était dans cette liste
    if (matchesFilters(updatedIntervention, filters)) {
      // Mettre à jour l'intervention
      return {
        ...oldData,
        data: [
          ...oldData.data.slice(0, index),
          updatedIntervention,
          ...oldData.data.slice(index + 1)
        ]
      }
    } else {
      // Retirer l'intervention (ne correspond plus aux filtres)
      return {
        ...oldData,
        data: oldData.data.filter(i => i.id !== updatedIntervention.id),
        pagination: {
          ...oldData.pagination,
          total: Math.max(0, oldData.pagination.total - 1)
        }
      }
    }
  }
)

// Invalidation silencieuse après 100ms
setTimeout(() => {
  queryClient.invalidateQueries({ 
    queryKey: interventionKeys.invalidateLists(),
    refetchType: 'none' 
  })
}, 100)
```

### DELETE (Soft Delete)

```typescript
// Mise à jour optimiste
queryClient.setQueriesData(
  { queryKey: interventionKeys.invalidateLists() },
  (oldData: PaginatedResponse<Intervention> | undefined) => {
    if (!oldData) return oldData
    
    return {
      ...oldData,
      data: oldData.data.filter(i => i.id !== deletedInterventionId),
      pagination: {
        ...oldData.pagination,
        total: oldData.pagination.total - 1
      }
    }
  }
)

// Invalidation silencieuse après 100ms
setTimeout(() => {
  queryClient.invalidateQueries({ 
    queryKey: interventionKeys.invalidateLists(),
    refetchType: 'none' 
  })
}, 100)
```

## Mise à Jour des Compteurs

### Debounce

```typescript
import { getInterventionTotalCount, getInterventionCounts } from '@/lib/supabase-api-v2'

const debouncedRefreshCounts = debounce(async (filters: GetAllParams) => {
  // Invalider les résumés pour forcer le recalcul via API
  queryClient.invalidateQueries({ 
    queryKey: interventionKeys.summaries(),
    refetchType: 'active'  // Refetch pour recalculer via API
  })
  
  // Optionnel : précharger les nouveaux compteurs
  await queryClient.prefetchQuery({
    queryKey: interventionKeys.summary(filters),
    queryFn: async () => {
      const total = await getInterventionTotalCount(filters)
      const counts = await getInterventionCounts(filters)
      return { total, counts }
    }
  })
}, 500)
```

### Déclenchement

Les compteurs sont invalidés après chaque événement Realtime qui affecte les filtres :
- Modification de `statut_id`
- Modification de `assigned_user_id`
- Modification de `artisan_id`
- Modification de `agence_id`
- Modification de `metier_id`
- Création d'intervention
- Suppression d'intervention

## Synchronisation Multi-Onglets

### BroadcastChannel

**Fichier**: `src/lib/realtime/broadcast-sync.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

const BROADCAST_CHANNEL_NAME = 'interventions-cache-sync'

export interface CacheSyncMessage {
  type: 'cache-update' | 'invalidation' | 'realtime-event'
  queryKey: QueryKey
  data?: unknown
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  interventionId?: string
  timestamp: number
}

/**
 * Crée et configure un BroadcastChannel pour synchroniser le cache entre onglets
 */
export function createBroadcastSync(queryClient: QueryClient) {
  // Vérifier que BroadcastChannel est disponible (pas disponible en SSR)
  if (typeof window === 'undefined' || !window.BroadcastChannel) {
    console.warn('BroadcastChannel non disponible, synchronisation multi-onglets désactivée')
    return null
  }

  const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)

  // Écouter les messages des autres onglets
  channel.onmessage = (event: MessageEvent<CacheSyncMessage>) => {
    const { type, queryKey, data, eventType, interventionId } = event.data

    // Ignorer les messages émis par cet onglet (éviter les boucles)
    if (event.data.timestamp === window.__lastBroadcastTimestamp) {
      return
    }

    switch (type) {
      case 'cache-update':
        // Mettre à jour le cache directement sans refetch
        if (data) {
          queryClient.setQueryData(queryKey, data)
        }
        break

      case 'invalidation':
        // Invalider les queries correspondantes
        queryClient.invalidateQueries({ queryKey })
        break

      case 'realtime-event':
        // Un autre onglet a reçu un événement Realtime
        // On peut choisir de synchroniser ou d'invalider
        // Pour éviter les doublons, on invalide simplement
        queryClient.invalidateQueries({ queryKey })
        break
    }
  }

  return {
    /**
     * Broadcast une mise à jour de cache aux autres onglets
     */
    broadcastCacheUpdate(queryKey: QueryKey, data: unknown) {
      const message: CacheSyncMessage = {
        type: 'cache-update',
        queryKey,
        data,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Broadcast une invalidation aux autres onglets
     */
    broadcastInvalidation(queryKey: QueryKey) {
      const message: CacheSyncMessage = {
        type: 'invalidation',
        queryKey,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Broadcast un événement Realtime reçu
     */
    broadcastRealtimeEvent(
      queryKey: QueryKey,
      eventType: 'INSERT' | 'UPDATE' | 'DELETE',
      interventionId: string
    ) {
      const message: CacheSyncMessage = {
        type: 'realtime-event',
        queryKey,
        eventType,
        interventionId,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Fermer le channel
     */
    close() {
      channel.close()
    },
  }
}

// Extension du type Window pour stocker le dernier timestamp
declare global {
  interface Window {
    __lastBroadcastTimestamp?: number
  }
}
```

### Intégration dans cache-sync.ts

```typescript
import { createBroadcastSync } from '@/lib/realtime/broadcast-sync'

let broadcastSync: ReturnType<typeof createBroadcastSync> | null = null

export function initializeBroadcastSync(queryClient: QueryClient) {
  if (!broadcastSync) {
    broadcastSync = createBroadcastSync(queryClient)
  }
  return broadcastSync
}

export function syncCacheWithRealtimeEvent(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Intervention>
) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  // Mise à jour optimiste du cache
  queryClient.setQueriesData(
    { queryKey: interventionKeys.invalidateLists() },
    (oldData, queryKey) => {
      // ... logique de mise à jour ...
      const updatedData = /* ... */
      
      // Broadcast aux autres onglets
      if (broadcastSync && newRecord) {
        broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
      }
      
      return updatedData
    }
  )

  // Broadcast l'événement Realtime aux autres onglets
  if (broadcastSync && newRecord) {
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLists(),
      eventType,
      newRecord.id
    )
  }
}
```

### Comportement

1. **Onglet A** reçoit un événement Realtime
2. **Onglet A** met à jour son cache local via `setQueryData`
3. **Onglet A** broadcast la mise à jour aux autres onglets via BroadcastChannel
4. **Onglet B** reçoit le message BroadcastChannel
5. **Onglet B** met à jour son cache directement sans refetch (via `setQueryData`)
6. **Onglet B** ignore les messages qu'il a lui-même émis (vérification du timestamp)

**Avantages**:
- Synchronisation instantanée entre onglets (< 50ms)
- Pas de refetch inutile (mise à jour directe du cache)
- Évite les boucles infinies (vérification du timestamp)
- Fonctionne même si Realtime n'est pas disponible sur un onglet

## Gestion des Conflits

### Détection de Conflit

```typescript
// Comparaison des timestamps updated_at
if (localUpdate.updated_at < remoteUpdate.updated_at) {
  // Conflit détecté : dernier écrit gagne
  // Restaurer la valeur distante
  queryClient.setQueryData(queryKey, remoteData)
  
  // Notification utilisateur
  showToast({
    title: "Modification écrasée",
    description: `${remoteUser.name} a modifié ${field} : ${oldValue} → ${newValue}`
  })
}
```

### Résolution

- Stratégie "dernier écrit gagne" basée sur `updated_at`
- Notification toast à l'utilisateur dont la modification a été écrasée
- Restauration automatique de la valeur distante dans le cache

## Performance

### Optimisations

1. **Mise à jour optimiste**: Réactivité immédiate (< 500ms)
2. **Invalidation silencieuse**: Cohérence garantie sans surcharge
3. **Debounce compteurs**: Réduction des appels API multiples
4. **BroadcastChannel**: Synchronisation efficace entre onglets

### Métriques Attendues

- Mise à jour UI visible: < 500ms après événement Realtime
- Invalidation silencieuse: 100ms après mise à jour optimiste
- Debounce compteurs: 500ms pour regrouper les mises à jour
- Synchronisation multi-onglets: < 50ms via BroadcastChannel

