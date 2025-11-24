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
  private localModificationTimestamps: Map<string, number> = new Map() // Timestamp des modifications locales (Date.now())
  private localUpdatedAtTimestamps: Map<string, string> = new Map() // Timestamp updated_at des modifications locales (ISO string)

  /**
   * Enregistre une modification locale pour éviter d'afficher un badge pour nos propres modifications
   * 
   * @param interventionId - ID de l'intervention modifiée
   * @param updatedAt - Timestamp updated_at de la modification locale (ISO string)
   */
  recordLocalModification(interventionId: string, updatedAt?: string | null): void {
    this.localModifications.add(interventionId)
    this.localModificationTimestamps.set(interventionId, Date.now())
    if (updatedAt) {
      this.localUpdatedAtTimestamps.set(interventionId, updatedAt)
    }
    
    // Nettoyer après 5 secondes (les événements Realtime arrivent généralement en < 2s)
    setTimeout(() => {
      this.localModifications.delete(interventionId)
      this.localModificationTimestamps.delete(interventionId)
      this.localUpdatedAtTimestamps.delete(interventionId)
    }, 5000)
  }

  /**
   * Récupère le timestamp updated_at d'une modification locale
   * 
   * @param interventionId - ID de l'intervention
   * @returns Timestamp updated_at ou undefined
   */
  getLocalUpdatedAt(interventionId: string): string | undefined {
    return this.localUpdatedAtTimestamps.get(interventionId)
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
      console.log(`[RemoteEditIndicator] ⏭️ Indicateur ignoré pour ${indicator.interventionId} (modification locale)`)
      return
    }

    this.indicators.set(indicator.interventionId, indicator)
    
    // Nettoyer automatiquement après 20 secondes (synchronisation complète)
    setTimeout(() => {
      console.log(`[RemoteEditIndicator] 🗑️ Nettoyage automatique de l'indicateur pour ${indicator.interventionId}`)
      this.removeIndicator(indicator.interventionId)
    }, 20000)
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
    const maxAge = 20000 // 20 secondes
    
    for (const [interventionId, indicator] of this.indicators.entries()) {
      if (now - indicator.timestamp > maxAge) {
        this.indicators.delete(interventionId)
      }
    }
  }

  /**
   * Récupère la liste des modifications locales (pour debug)
   */
  getLocalModifications(): string[] {
    return Array.from(this.localModifications)
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
 * Si un cache de référence est fourni, récupère la couleur depuis la table users (colonne color)
 * Sinon, utilise un hash simple pour générer une couleur cohérente
 * 
 * @param userId - ID de l'utilisateur
 * @param referenceCache - Cache de référence optionnel contenant les données utilisateur
 * @returns Couleur hexadécimale ou HSL
 */
export function getUserColor(userId: string | null, referenceCache?: { usersById?: Map<string, any> }): string {
  if (!userId) {
    console.log(`[getUserColor] ⚠️ Pas d'userId, retour du gris par défaut`)
    return '#666666' // Gris par défaut
  }

  console.log(`[getUserColor] 🔍 Recherche couleur pour userId: ${userId}`, {
    hasCache: !!referenceCache,
    hasUsersById: !!referenceCache?.usersById,
    cacheSize: referenceCache?.usersById?.size || 0,
  })

  // Si un cache de référence est fourni, essayer de récupérer la couleur depuis la table users
  if (referenceCache?.usersById) {
    const user = referenceCache.usersById.get(userId)
    console.log(`[getUserColor] 👤 Utilisateur trouvé dans le cache:`, {
      userId,
      found: !!user,
      userColor: user?.color,
      userData: user,
    })
    if (user?.color) {
      console.log(`[getUserColor] ✅ Couleur récupérée depuis la table: ${user.color}`)
      return user.color
    } else {
      console.log(`[getUserColor] ⚠️ Utilisateur trouvé mais pas de couleur, utilisation du fallback HSL`)
    }
  } else {
    console.log(`[getUserColor] ⚠️ Pas de cache de référence, utilisation du fallback HSL`)
  }

  // Fallback : Hash simple pour générer une couleur cohérente si pas de couleur dans la table
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Générer une couleur HSL avec saturation et luminosité fixes pour la lisibilité
  const hue = Math.abs(hash) % 360
  const hslColor = `hsl(${hue}, 70%, 50%)`
  console.log(`[getUserColor] 🎨 Couleur HSL générée: ${hslColor}`)
  return hslColor
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

