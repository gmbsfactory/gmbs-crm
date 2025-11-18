/**
 * Gestion des indicateurs visuels pour les modifications distantes
 * Affiche des badges overlay lorsque d'autres utilisateurs modifient des interventions
 */

import type { Intervention } from '@/lib/api/v2/common/types'

/**
 * Interface pour un indicateur de modification distante
 */
export interface RemoteEditIndicator {
  interventionId: string
  userId: string | null // ID de l'utilisateur qui a fait la modification (null si inconnu)
  userName: string | null // Nom de l'utilisateur (si disponible)
  userColor: string | null // Couleur utilisateur pour badge
  fields: string[] // Champs modifiés
  timestamp: number // Timestamp de début modification
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' // Type d'événement
}

/**
 * Gestionnaire des indicateurs de modification distante
 */
class RemoteEditIndicatorManager {
  private indicators: Map<string, RemoteEditIndicator> = new Map()
  private localModifications: Set<string> = new Set() // Set d'IDs d'interventions modifiées localement
  private localModificationTimestamps: Map<string, number> = new Map() // Timestamp des modifications locales

  /**
   * Enregistre une modification locale pour éviter d'afficher un badge pour nos propres modifications
   * 
   * @param interventionId - ID de l'intervention modifiée
   */
  recordLocalModification(interventionId: string): void {
    this.localModifications.add(interventionId)
    this.localModificationTimestamps.set(interventionId, Date.now())
    
    // Nettoyer après 5 secondes (les événements Realtime arrivent généralement en < 2s)
    setTimeout(() => {
      this.localModifications.delete(interventionId)
      this.localModificationTimestamps.delete(interventionId)
    }, 5000)
  }

  /**
   * Vérifie si une modification est locale (faite par l'utilisateur actuel)
   * 
   * @param interventionId - ID de l'intervention
   * @returns true si la modification est locale
   */
  isLocalModification(interventionId: string): boolean {
    return this.localModifications.has(interventionId)
  }

  /**
   * Ajoute un indicateur de modification distante
   * 
   * @param indicator - Indicateur à ajouter
   */
  addIndicator(indicator: RemoteEditIndicator): void {
    // Ne pas ajouter si c'est une modification locale
    if (this.isLocalModification(indicator.interventionId)) {
      return
    }

    this.indicators.set(indicator.interventionId, indicator)
    
    // Nettoyer automatiquement après 10 secondes (synchronisation complète)
    setTimeout(() => {
      this.removeIndicator(indicator.interventionId)
    }, 10000)
  }

  /**
   * Retire un indicateur
   * 
   * @param interventionId - ID de l'intervention
   */
  removeIndicator(interventionId: string): void {
    this.indicators.delete(interventionId)
  }

  /**
   * Récupère un indicateur pour une intervention
   * 
   * @param interventionId - ID de l'intervention
   * @returns Indicateur ou undefined
   */
  getIndicator(interventionId: string): RemoteEditIndicator | undefined {
    return this.indicators.get(interventionId)
  }

  /**
   * Récupère tous les indicateurs actifs
   * 
   * @returns Map des indicateurs actifs
   */
  getAllIndicators(): Map<string, RemoteEditIndicator> {
    return new Map(this.indicators)
  }

  /**
   * Nettoie tous les indicateurs expirés
   */
  cleanupExpired(): void {
    const now = Date.now()
    const maxAge = 10000 // 10 secondes
    
    for (const [interventionId, indicator] of this.indicators.entries()) {
      if (now - indicator.timestamp > maxAge) {
        this.indicators.delete(interventionId)
      }
    }
  }
}

// Instance singleton
let indicatorManager: RemoteEditIndicatorManager | null = null

/**
 * Obtient l'instance singleton du gestionnaire d'indicateurs
 */
export function getRemoteEditIndicatorManager(): RemoteEditIndicatorManager {
  if (!indicatorManager) {
    indicatorManager = new RemoteEditIndicatorManager()
  }
  return indicatorManager
}

/**
 * Génère une couleur pour un utilisateur basée sur son ID
 * Utilise un hash simple pour générer une couleur cohérente
 * 
 * @param userId - ID de l'utilisateur
 * @returns Couleur hexadécimale
 */
export function getUserColor(userId: string | null): string {
  if (!userId) {
    return '#666666' // Gris par défaut
  }

  // Hash simple pour générer une couleur cohérente
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Générer une couleur HSL avec saturation et luminosité fixes pour la lisibilité
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

/**
 * Détermine les champs modifiés entre deux enregistrements
 * 
 * @param oldRecord - Ancien enregistrement
 * @param newRecord - Nouvel enregistrement
 * @returns Liste des noms de champs modifiés
 */
export function getChangedFields(
  oldRecord: Intervention | null,
  newRecord: Intervention | null
): string[] {
  if (!oldRecord || !newRecord) {
    return []
  }

  const changedFields: string[] = []
  const fieldsToCheck: (keyof Intervention)[] = [
    'statut_id',
    'assigned_user_id',
    'artisan_id',
    'agence_id',
    'metier_id',
    'date',
    'date_prevue',
    'contexte_intervention',
    'adresse',
    'ville',
    'code_postal',
    'commentaire_agent',
  ]

  for (const field of fieldsToCheck) {
    if (oldRecord[field] !== newRecord[field]) {
      changedFields.push(field)
    }
  }

  return changedFields
}

