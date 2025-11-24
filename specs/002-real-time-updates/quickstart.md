# Quick Start: Mise à jour en temps réel des interventions

**Date**: 2025-01-27  
**Feature**: 002-real-time-updates

## Vue d'Ensemble

Ce guide fournit les étapes rapides pour comprendre et implémenter la fonctionnalité de mise à jour en temps réel des interventions via Supabase Realtime.

## Architecture

```
┌─────────────────┐
│  Supabase DB    │
│  (PostgreSQL)   │
└────────┬────────┘
         │
         │ Realtime Events
         │ (WebSocket)
         ↓
┌─────────────────┐
│ Realtime Client │
│  (Supabase JS)  │
└────────┬────────┘
         │
         │ Events
         ↓
┌─────────────────┐
│  Realtime Hook  │
│ (useInterventions│
│    Realtime)    │
└────────┬────────┘
         │
         │ Cache Updates
         ↓
┌─────────────────┐
│ TanStack Query  │
│     Cache       │
└────────┬────────┘
         │
         │ UI Updates
         ↓
┌─────────────────┐
│   React UI      │
│  (Components)   │
└─────────────────┘
```

## Étapes d'Implémentation

### 1. Configuration du Client Realtime

**Fichier**: `src/lib/realtime/realtime-client.ts`

```typescript
import { supabase } from '@/lib/supabase-client'

export function createInterventionsChannel() {
  return supabase
    .channel('interventions-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'interventions',
      // ⚠️ Pas de filtre is_active ici pour détecter les soft deletes
      // Le filtrage se fait côté client dans matchesFilters()
    }, handleRealtimeEvent)
    .subscribe()
}
```

### 2. Fonction de Synchronisation du Cache

**Fichier**: `src/lib/realtime/cache-sync.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { PaginatedResponse } from '@/lib/api/v2/common/types'
import { matchesFilters, extractFiltersFromQueryKey } from '@/lib/realtime/filter-utils'
import { createBroadcastSync } from '@/lib/realtime/broadcast-sync'

let broadcastSync: ReturnType<typeof createBroadcastSync> | null = null

/**
 * Initialise la synchronisation BroadcastChannel
 * Doit être appelée une fois au démarrage de l'application
 */
export function initializeCacheSync(queryClient: QueryClient) {
  if (!broadcastSync) {
    broadcastSync = createBroadcastSync(queryClient)
  }
  return broadcastSync
}

/**
 * Détecte si un événement UPDATE est un soft delete
 */
function isSoftDelete(oldRecord: Intervention | null, newRecord: Intervention | null): boolean {
  return oldRecord?.is_active === true && newRecord?.is_active === false
}

/**
 * Synchronise le cache TanStack Query avec un événement Realtime
 * 
 * @param queryClient - Instance QueryClient de TanStack Query
 * @param payload - Payload de l'événement Realtime (INSERT/UPDATE/DELETE)
 */
export function syncCacheWithRealtimeEvent(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Intervention>
) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  // Détecter les soft deletes
  if (eventType === 'UPDATE' && isSoftDelete(oldRecord, newRecord)) {
    // Traiter comme une suppression
    handleSoftDelete(queryClient, newRecord!.id)
    return
  }

  // Mise à jour optimiste immédiate
  queryClient.setQueriesData(
    { queryKey: interventionKeys.invalidateLists() },
    (oldData: PaginatedResponse<Intervention> | undefined, queryKey) => {
      if (!oldData) return oldData

      // Extraire les filtres depuis la query key
      const filters = extractFiltersFromQueryKey(queryKey)

      switch (eventType) {
        case 'INSERT':
          if (newRecord && matchesFilters(newRecord, filters)) {
            const updatedData = {
              ...oldData,
              data: [newRecord, ...oldData.data],
              pagination: {
                ...oldData.pagination,
                total: oldData.pagination.total + 1
              }
            }
            
            // Broadcast aux autres onglets
            if (broadcastSync && newRecord) {
              broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
            }
            
            return updatedData
          }
          return oldData

        case 'UPDATE':
          // Logique complète dans contracts/cache-updates.md
          const index = oldData.data.findIndex(i => i.id === newRecord!.id)
          
          if (index === -1) {
            // Intervention n'était pas dans cette liste
            if (matchesFilters(newRecord!, filters)) {
              const updatedData = {
                ...oldData,
                data: [newRecord!, ...oldData.data],
                pagination: {
                  ...oldData.pagination,
                  total: oldData.pagination.total + 1
                }
              }
              
              if (broadcastSync) {
                broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
              }
              
              return updatedData
            }
            return oldData
          }
          
          // Intervention était dans cette liste
          if (matchesFilters(newRecord!, filters)) {
            const updatedData = {
              ...oldData,
              data: [
                ...oldData.data.slice(0, index),
                newRecord!,
                ...oldData.data.slice(index + 1)
              ]
            }
            
            if (broadcastSync) {
              broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
            }
            
            return updatedData
          } else {
            // Retirer l'intervention (ne correspond plus aux filtres)
            const updatedData = {
              ...oldData,
              data: oldData.data.filter(i => i.id !== newRecord!.id),
              pagination: {
                ...oldData.pagination,
                total: Math.max(0, oldData.pagination.total - 1)
              }
            }
            
            if (broadcastSync) {
              broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
            }
            
            return updatedData
          }

        case 'DELETE':
          if (oldRecord) {
            const updatedData = {
              ...oldData,
              data: oldData.data.filter(i => i.id !== oldRecord.id),
              pagination: {
                ...oldData.pagination,
                total: Math.max(0, oldData.pagination.total - 1)
              }
            }
            
            if (broadcastSync) {
              broadcastSync.broadcastCacheUpdate(queryKey, updatedData)
            }
            
            return updatedData
          }
          return oldData

        default:
          return oldData
      }
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

  // Invalidation silencieuse après 100ms
  setTimeout(() => {
    queryClient.invalidateQueries({ 
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'none' 
    })
    
    // Broadcast l'invalidation aux autres onglets
    if (broadcastSync) {
      broadcastSync.broadcastInvalidation(interventionKeys.invalidateLists())
    }
  }, 100)
}

/**
 * Gère la suppression d'une intervention (soft delete)
 */
function handleSoftDelete(queryClient: QueryClient, interventionId: string) {
  // Retirer de toutes les listes
  queryClient.setQueriesData(
    { queryKey: interventionKeys.invalidateLists() },
    (oldData: PaginatedResponse<Intervention> | undefined) => {
      if (!oldData) return oldData
      
      const updatedData = {
        ...oldData,
        data: oldData.data.filter(i => i.id !== interventionId),
        pagination: {
          ...oldData.pagination,
          total: Math.max(0, oldData.pagination.total - 1)
        }
      }
      
      // Broadcast aux autres onglets
      if (broadcastSync) {
        queryClient.getQueriesData({ queryKey: interventionKeys.invalidateLists() }).forEach(([queryKey]) => {
          broadcastSync!.broadcastCacheUpdate(queryKey, updatedData)
        })
      }
      
      return updatedData
    }
  )
  
  // Invalider le détail de l'intervention
  queryClient.invalidateQueries({ 
    queryKey: interventionKeys.detail(interventionId) 
  })
  
  // Notification (à implémenter avec votre système de toast)
  // showToast({ title: "Intervention supprimée", variant: "info" })
}
```

### 3. Hook Realtime

**Fichier**: `src/hooks/useInterventionsRealtime.ts`

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createInterventionsChannel } from '@/lib/realtime/realtime-client'
import { syncCacheWithRealtimeEvent, initializeCacheSync } from '@/lib/realtime/cache-sync'

export function useInterventionsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Initialiser la synchronisation BroadcastChannel (une seule fois)
    initializeCacheSync(queryClient)
    
    // Créer et configurer le channel Realtime
    const channel = createInterventionsChannel()

    const handleRealtimeEvent = (payload: any) => {
      syncCacheWithRealtimeEvent(queryClient, payload)
    }

    channel.on('postgres_changes', handleRealtimeEvent)

    // Gérer les erreurs de connexion
    channel.on('error', (error) => {
      console.error('Erreur Realtime:', error)
      // Basculement vers polling (voir section Gestion des Erreurs)
    })

    channel.on('disconnect', () => {
      console.warn('Déconnexion Realtime, basculement vers polling')
      // Basculement vers polling
    })

    return () => {
      channel.unsubscribe()
    }
  }, [queryClient])
}
```

### 4. Provider Realtime

**Fichier**: `src/components/interventions/InterventionRealtimeProvider.tsx`

```typescript
'use client'

import { useInterventionsRealtime } from '@/hooks/useInterventionsRealtime'

export function InterventionRealtimeProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  useInterventionsRealtime()
  return <>{children}</>
}
```

### 5. Intégration dans la Page

**Fichier**: `app/interventions/page.tsx`

```typescript
import { InterventionRealtimeProvider } from '@/components/interventions/InterventionRealtimeProvider'

export default function Page() {
  return (
    <InterventionRealtimeProvider>
      {/* Contenu existant de la page */}
    </InterventionRealtimeProvider>
  )
}
```

## API Utilisée

**Important**: Le projet utilise `interventionsApiV2` depuis `src/lib/supabase-api-v2.ts` (et non `interventionsApi`).

**Fonctions principales**:
- `interventionsApiV2.getAll(params)` - Récupérer les interventions avec pagination
- `interventionsApiV2.update(id, data)` - Mettre à jour une intervention
- `interventionsApiV2.create(data)` - Créer une intervention
- `getInterventionTotalCount(filters)` - Obtenir le total d'interventions correspondant aux filtres
- `getInterventionCounts(filters)` - Obtenir les comptages par statut

**Hooks React Query**:
- `useInterventionsQuery(options)` - Hook pour récupérer les interventions (utilise `interventionsApiV2` en interne)
- `useInterventionsMutations()` - Hook pour les mutations (utilise `interventionsApiV2` en interne)

## Fonctionnalités Clés

### Mise à Jour Immédiate

- Les modifications sont visibles en < 500ms après l'action utilisateur
- Mise à jour optimiste du cache TanStack Query
- Invalidation silencieuse en arrière-plan pour cohérence

### Synchronisation Multi-Utilisateurs

- Les modifications d'autres utilisateurs apparaissent en < 2 secondes
- Badge overlay codé par couleur utilisateur
- Gestion automatique des conflits (dernier écrit gagne)

### Gestion des Erreurs

- Basculement automatique vers polling si Realtime indisponible
- File d'attente pour synchronisation différée (50 modifications max)
- Sauvegarde localStorage pour persistance entre sessions

## Tests

### Test Manuel

1. Ouvrir deux navigateurs avec deux utilisateurs différents
2. Modifier une intervention dans le navigateur 1
3. Vérifier que la modification apparaît dans le navigateur 2 en < 2 secondes
4. Vérifier que les compteurs se mettent à jour automatiquement

### Test Automatisé

```typescript
// tests/integration/realtime-sync.test.ts
import { renderHook } from '@testing-library/react'
import { useInterventionsRealtime } from '@/hooks/useInterventionsRealtime'

test('should sync cache on realtime event', async () => {
  const { result } = renderHook(() => useInterventionsRealtime())
  
  // Simuler un événement Realtime
  const event = {
    eventType: 'UPDATE',
    new: { id: '123', statut_id: 'EN_COURS' },
    old: { id: '123', statut_id: 'DEMANDE' }
  }
  
  // Vérifier que le cache est mis à jour
  // ...
})
```

## Dépannage

### Realtime ne se connecte pas

1. Vérifier que Realtime est activé dans `supabase/config.toml`
2. Vérifier les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Vérifier les politiques RLS sur la table `interventions`

### Les modifications ne s'affichent pas

1. Vérifier que le provider Realtime est bien monté
2. Vérifier les logs de la console pour les erreurs
3. Vérifier que les query keys correspondent dans le cache

### Performance dégradée

1. Vérifier le debounce des compteurs (500ms)
2. Vérifier que l'invalidation silencieuse fonctionne (pas de refetch inutile)
3. Vérifier le nombre de channels Realtime actifs (ne pas créer plusieurs channels)

## Synchronisation Multi-Onglets

**Mécanisme**: BroadcastChannel API pour synchroniser le cache entre onglets

**Implémentation complète**: Voir `contracts/cache-updates.md` section "Synchronisation Multi-Onglets"

**Points clés**:
- La synchronisation BroadcastChannel est initialisée automatiquement dans `useInterventionsRealtime`
- Chaque mise à jour du cache via Realtime est automatiquement broadcastée aux autres onglets
- Les autres onglets mettent à jour leur cache directement sans refetch
- Évite les boucles infinies via vérification du timestamp

**Structure**:
```typescript
interface CacheSyncMessage {
  type: 'cache-update' | 'invalidation' | 'realtime-event'
  queryKey: QueryKey
  data?: unknown
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  interventionId?: string
  timestamp: number
}
```

**Comportement**:
1. Un onglet reçoit un événement Realtime
2. Met à jour son cache local via `setQueryData`
3. Broadcast la mise à jour aux autres onglets via BroadcastChannel
4. Les autres onglets mettent à jour leur cache directement sans refetch
5. Les messages émis par l'onglet lui-même sont ignorés (vérification timestamp)

## File d'Attente pour Synchronisation Différée

**Fichier**: `src/lib/realtime/sync-queue.ts`

La file d'attente permet de gérer les modifications qui échouent à cause d'erreurs réseau, en les mettant en attente pour synchronisation différée.

```typescript
import type { Intervention } from '@/lib/api/v2/common/types'
import { interventionsApiV2 } from '@/lib/supabase-api-v2'

export interface QueuedModification {
  id: string                      // ID unique de la modification
  interventionId: string         // ID de l'intervention
  type: 'create' | 'update' | 'delete'
  data: Partial<Intervention>     // Données à synchroniser
  timestamp: number              // Timestamp de création
  retryCount: number             // Nombre de tentatives
}

const MAX_QUEUE_SIZE = 50
const BATCH_PROCESS_INTERVAL = 5000 // 5 secondes
const MAX_RETRIES = 3

class SyncQueue {
  private queue: QueuedModification[] = []
  private processing = false
  private intervalId: NodeJS.Timeout | null = null

  constructor() {
    // Restaurer depuis localStorage au démarrage
    this.loadFromLocalStorage()
    
    // Démarrer le traitement par batch
    this.startBatchProcessing()
  }

  /**
   * Ajouter une modification à la file d'attente
   */
  enqueue(modification: Omit<QueuedModification, 'id' | 'timestamp' | 'retryCount'>) {
    // Si la file est pleine, supprimer la plus ancienne (FIFO)
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift()
    }

    const queuedModification: QueuedModification = {
      ...modification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    }

    this.queue.push(queuedModification)
    this.saveToLocalStorage()
  }

  /**
   * Traiter un batch de modifications
   */
  private async processBatch() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    try {
      // Traiter par batch de 10
      const batch = this.queue.splice(0, 10)
      
      await Promise.allSettled(
        batch.map(mod => this.syncModification(mod))
      )

      // Sauvegarder l'état après traitement
      this.saveToLocalStorage()
    } finally {
      this.processing = false
    }
  }

  /**
   * Synchroniser une modification avec le serveur
   */
  private async syncModification(mod: QueuedModification): Promise<void> {
    try {
      switch (mod.type) {
        case 'create':
          await interventionsApiV2.create(mod.data as any)
          break
        case 'update':
          await interventionsApiV2.update(mod.interventionId, mod.data)
          break
        case 'delete':
          await interventionsApiV2.delete(mod.interventionId)
          break
      }

      // Succès : la modification est retirée de la file
      // (déjà retirée dans processBatch)
    } catch (error) {
      // Échec : réessayer si pas dépassé le max de tentatives
      if (mod.retryCount < MAX_RETRIES) {
        mod.retryCount++
        this.queue.push(mod) // Remettre en file
      } else {
        // Trop de tentatives : notifier l'utilisateur
        console.error(`Échec de synchronisation après ${MAX_RETRIES} tentatives:`, mod)
        // showToast({ title: "Erreur de synchronisation", description: "Certaines modifications n'ont pas pu être synchronisées" })
      }
    }
  }

  /**
   * Démarrer le traitement par batch
   */
  private startBatchProcessing() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.processBatch()
    }, BATCH_PROCESS_INTERVAL)
  }

  /**
   * Arrêter le traitement par batch
   */
  stopBatchProcessing() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Sauvegarder la file dans localStorage
   */
  private saveToLocalStorage() {
    try {
      localStorage.setItem('interventions-sync-queue', JSON.stringify(this.queue))
    } catch (error) {
      // localStorage peut être plein ou inaccessible (mode privé)
      console.warn('Impossible de sauvegarder la file d\'attente dans localStorage:', error)
    }
  }

  /**
   * Charger la file depuis localStorage
   */
  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('interventions-sync-queue')
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Impossible de charger la file d\'attente depuis localStorage:', error)
    }
  }

  /**
   * Obtenir le nombre de modifications en attente
   */
  getPendingCount(): number {
    return this.queue.length
  }

  /**
   * Vider la file d'attente
   */
  clear() {
    this.queue = []
    this.saveToLocalStorage()
  }
}

// Singleton
export const syncQueue = new SyncQueue()
```

### Intégration avec useInterventionsMutations

**Fichier**: `src/hooks/useInterventionsMutations.ts` (modification)

```typescript
import { syncQueue } from '@/lib/realtime/sync-queue'

/**
 * Vérifie si une erreur est une erreur réseau (connexion perdue, timeout, etc.)
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    // Erreurs de connexion réseau
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    )
  }
  return false
}

// Dans la mutation update
const updateMutation = useMutation({
  mutationFn: async (variables: { id: string; data: UpdateInterventionData }) => {
    try {
      return await interventionsApiV2.update(variables.id, variables.data)
    } catch (error) {
      // En cas d'erreur réseau, mettre en file d'attente
      if (isNetworkError(error)) {
        syncQueue.enqueue({
          interventionId: variables.id,
          type: 'update',
          data: variables.data,
        })
        throw error // Re-throw pour que React Query gère l'erreur
      }
      throw error
    }
  },
  // ... reste de la configuration
})
```

### Utilisation dans les Composants

```typescript
import { syncQueue } from '@/lib/realtime/sync-queue'

function InterventionActions() {
  const pendingCount = syncQueue.getPendingCount()
  
  return (
    <div>
      {pendingCount > 0 && (
        <Badge variant="warning">
          {pendingCount} modification(s) en attente de synchronisation
        </Badge>
      )}
      {/* ... */}
    </div>
  )
}
```

## Références

- [Spec complète](./spec.md)
- [Research](./research.md)
- [Data Model](./data-model.md)
- [Contrats Realtime](./contracts/realtime-events.md)
- [Contrats Cache](./contracts/cache-updates.md)


