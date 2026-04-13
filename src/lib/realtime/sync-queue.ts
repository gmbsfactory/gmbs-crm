/**
 * File d'attente pour les modifications d'interventions en cas d'erreur réseau
 * Permet de synchroniser les modifications différées lorsque la connexion est rétablie
 */

import type { Intervention, CreateInterventionData, UpdateInterventionData } from '@/lib/api/common/types'
import { isNetworkError } from './realtime-client'

export interface QueuedModification {
  id: string // ID unique de la modification
  interventionId: string // ID de l'intervention
  type: 'create' | 'update' | 'delete'
  data: Partial<Intervention> // Données à synchroniser
  timestamp: number // Timestamp de création
  retryCount: number // Nombre de tentatives
}

const STORAGE_KEY = 'interventions-sync-queue'
const MAX_QUEUE_SIZE = 50
const BATCH_SIZE = 10
const BATCH_INTERVAL = 5000 // 5 secondes

/**
 * Classe pour gérer la file d'attente des modifications
 */
export class SyncQueue {
  private queue: QueuedModification[] = []
  private processing = false
  private batchInterval: NodeJS.Timeout | null = null

  constructor() {
    this.loadFromStorage()
    this.startBatchProcessing()
  }

  /**
   * Charge la file d'attente depuis localStorage
   */
  private loadFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('[SyncQueue] Erreur lors du chargement depuis localStorage:', error)
      // T085: Gérer gracieusement les erreurs localStorage (plein, inaccessible, mode privé)
      this.queue = []
      
      // Afficher une notification d'avertissement si localStorage est inaccessible
      if (error instanceof DOMException) {
        if (error.code === DOMException.QUOTA_EXCEEDED_ERR) {
          console.warn('[SyncQueue] localStorage plein - les modifications en file d\'attente ne seront pas persistées')
        } else if (error.code === DOMException.SECURITY_ERR) {
          console.warn('[SyncQueue] localStorage inaccessible (mode privé) - les modifications en file d\'attente ne seront pas persistées')
        }
      }
    }
  }

  /**
   * Sauvegarde la file d'attente dans localStorage
   */
  private saveToStorage() {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch (error) {
      console.warn('[SyncQueue] Erreur lors de la sauvegarde dans localStorage:', error)
      // T085: Gérer gracieusement les erreurs localStorage (plein, inaccessible, mode privé)
      if (error instanceof DOMException) {
        if (error.code === DOMException.QUOTA_EXCEEDED_ERR) {
          console.warn('[SyncQueue] localStorage plein - tentative de nettoyage de la file d\'attente')
          // Retirer les modifications les plus anciennes pour libérer de l'espace
          if (this.queue.length > 10) {
            this.queue = this.queue.slice(-10) // Garder seulement les 10 dernières modifications
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
            } catch (retryError) {
              console.error('[SyncQueue] Impossible de sauvegarder même après nettoyage:', retryError)
            }
          }
        } else if (error.code === DOMException.SECURITY_ERR) {
          console.warn('[SyncQueue] localStorage inaccessible (mode privé) - les modifications ne seront pas persistées')
        }
      }
    }
  }

  /**
   * Ajoute une modification à la file d'attente
   * 
   * @param modification - Modification à ajouter
   */
  enqueue(modification: Omit<QueuedModification, 'id' | 'timestamp' | 'retryCount'>) {
    // Si la file est pleine, retirer la plus ancienne
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift()
    }

    const queuedModification: QueuedModification = {
      ...modification,
      id: `${modification.interventionId}-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    }

    this.queue.push(queuedModification)
    this.saveToStorage()
  }

  /**
   * Retire une modification de la file d'attente
   * 
   * @param id - ID de la modification à retirer
   */
  dequeue(id: string) {
    this.queue = this.queue.filter((m) => m.id !== id)
    this.saveToStorage()
  }

  /**
   * Retire toutes les modifications d'une intervention
   * 
   * @param interventionId - ID de l'intervention
   */
  dequeueByInterventionId(interventionId: string) {
    this.queue = this.queue.filter((m) => m.interventionId !== interventionId)
    this.saveToStorage()
  }

  /**
   * Récupère les modifications en attente
   */
  getPending(): QueuedModification[] {
    return [...this.queue]
  }

  /**
   * Vide la file d'attente
   */
  clear() {
    this.queue = []
    this.saveToStorage()
  }

  /**
   * Démarre le traitement par batch
   */
  private startBatchProcessing() {
    if (this.batchInterval) return

    this.batchInterval = setInterval(() => {
      this.processBatch()
    }, BATCH_INTERVAL)
  }

  /**
   * Arrête le traitement par batch
   */
  stopBatchProcessing() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval)
      this.batchInterval = null
    }
  }

  /**
   * Traite un batch de modifications
   */
  private async processBatch() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    try {
      const batch = this.queue.slice(0, BATCH_SIZE)
      
      // Traiter chaque modification du batch
      for (const modification of batch) {
        try {
          // T089: Retry avec backoff exponentiel (3 tentatives: 1s, 2s, 4s) avant mise en file d'attente
          const success = await this.syncModificationWithRetry(modification)
          
          if (success) {
            // Retirer la modification de la file après succès
            this.dequeue(modification.id)
          } else {
            // Si toutes les tentatives ont échoué, incrémenter le compteur de tentatives
            modification.retryCount++
            
            // Si trop de tentatives, retirer de la file
            if (modification.retryCount >= 3) {
              console.error('[SyncQueue] Abandon de la modification après 3 tentatives:', modification.id)
              this.dequeue(modification.id)
            } else {
              // Sauvegarder l'état mis à jour
              this.saveToStorage()
            }
          }
        } catch (error) {
          console.error('[SyncQueue] Erreur lors du traitement de la modification:', error)
          modification.retryCount++
          
          // Si trop de tentatives, retirer de la file
          if (modification.retryCount >= 3) {
            console.error('[SyncQueue] Abandon de la modification après 3 tentatives:', modification.id)
            this.dequeue(modification.id)
          } else {
            this.saveToStorage()
          }
        }
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Synchronise une modification avec retry et backoff exponentiel
   * T089: Retry avec backoff exponentiel (3 tentatives: 1s, 2s, 4s)
   * 
   * @param modification - Modification à synchroniser
   * @returns true si la synchronisation a réussi, false sinon
   */
  private async syncModificationWithRetry(modification: QueuedModification): Promise<boolean> {
    const maxRetries = 3
    const delays = [1000, 2000, 4000] // 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.syncModification(modification)
        return true // Succès
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1
        
        if (isLastAttempt) {
          console.error(`[SyncQueue] Échec après ${maxRetries} tentatives pour ${modification.id}:`, error)
          return false
        }

        // Attendre avant la prochaine tentative (backoff exponentiel)
        const delay = delays[attempt] || delays[delays.length - 1]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return false
  }

  /**
   * Synchronise une modification avec le serveur
   * 
   * @param modification - Modification à synchroniser
   */
  private async syncModification(modification: QueuedModification): Promise<void> {
    const { interventionsApi } = await import('@/lib/api')

    switch (modification.type) {
      case 'create':
        await interventionsApi.create(modification.data as CreateInterventionData)
        break
      case 'update':
        await interventionsApi.update(modification.interventionId, modification.data as UpdateInterventionData)
        break
      case 'delete':
        await interventionsApi.delete(modification.interventionId)
        break
      default:
        throw new Error(`Unknown modification type: ${(modification as { type: string }).type}`)
    }
  }

  /**
   * Restaure les modifications en file d'attente depuis localStorage à la reconnexion
   * T086: Restauration automatique des modifications en file d'attente depuis localStorage
   */
  restoreOnReconnect() {
    this.loadFromStorage()
    if (this.queue.length > 0) {
      // Redémarrer le traitement par batch si nécessaire
      this.startBatchProcessing()
    }
  }
}

// Instance singleton
let syncQueueInstance: SyncQueue | null = null

/**
 * Obtient l'instance singleton de la file d'attente
 */
export function getSyncQueue(): SyncQueue {
  if (!syncQueueInstance) {
    syncQueueInstance = new SyncQueue()
  }
  return syncQueueInstance
}

