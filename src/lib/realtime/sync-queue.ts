/**
 * File d'attente pour les modifications d'interventions en cas d'erreur réseau
 * Permet de synchroniser les modifications différées lorsque la connexion est rétablie
 */

import type { Intervention } from '@/lib/api/v2/common/types'
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
      // Gérer gracieusement les erreurs localStorage (plein, inaccessible, mode privé)
      this.queue = []
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
      // Gérer gracieusement les erreurs localStorage
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
          // Ici, on devrait appeler l'API pour synchroniser la modification
          // Pour l'instant, on simule juste le traitement
          // TODO: Intégrer avec l'API réelle
          await this.syncModification(modification)
          
          // Retirer la modification de la file après succès
          this.dequeue(modification.id)
        } catch (error) {
          // En cas d'erreur, incrémenter le compteur de tentatives
          modification.retryCount++
          
          // Si trop de tentatives, retirer de la file
          if (modification.retryCount >= 3) {
            console.error('[SyncQueue] Abandon de la modification après 3 tentatives:', modification.id)
            this.dequeue(modification.id)
          }
        }
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Synchronise une modification avec le serveur
   * 
   * @param modification - Modification à synchroniser
   */
  private async syncModification(modification: QueuedModification): Promise<void> {
    // TODO: Intégrer avec l'API réelle
    // Pour l'instant, on simule juste le traitement
    console.log('[SyncQueue] Synchronisation de la modification:', modification.id)
  }

  /**
   * Restaure les modifications en file d'attente depuis localStorage à la reconnexion
   */
  restoreOnReconnect() {
    this.loadFromStorage()
    if (this.queue.length > 0) {
      console.log(`[SyncQueue] ${this.queue.length} modification(s) en attente de synchronisation`)
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

