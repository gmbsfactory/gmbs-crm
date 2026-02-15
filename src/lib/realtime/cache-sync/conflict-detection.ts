/**
 * Detection de conflits de modification simultanee
 * Detecte quand deux utilisateurs modifient la meme intervention en meme temps
 */

import type { Intervention } from '@/lib/api/v2/common/types'
import { getRemoteEditIndicatorManager } from '@/lib/realtime/remote-edit-indicator'
import { toast } from 'sonner'

// ─── Throttle: max 1 conflict notification per intervention per 2s ──────────
const CONFLICT_THROTTLE_MS = 2_000
const lastConflictNotification = new Map<string, number>()

/**
 * Detecte un conflit de modification simultanee
 * Un conflit existe si :
 * 1. Une modification locale a ete effectuee recemment (dans les 5 dernieres secondes)
 * 2. Le timestamp updated_at distant est plus recent que le timestamp local
 *
 * @param interventionId - ID de l'intervention
 * @param oldUpdatedAt - Ancien timestamp updated_at (depuis le cache local)
 * @param newUpdatedAt - Nouveau timestamp updated_at (depuis Realtime)
 * @param indicatorManager - Gestionnaire d'indicateurs pour verifier les modifications locales
 * @returns true si un conflit est detecte
 */
export function detectConflict(
  interventionId: string,
  oldUpdatedAt: string | null,
  newUpdatedAt: string | null,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
): boolean {
  if (!oldUpdatedAt || !newUpdatedAt) {
    return false
  }

  // Verifier si une modification locale a ete effectuee recemment
  const localUpdatedAt = indicatorManager.getLocalUpdatedAt(interventionId)
  if (!localUpdatedAt) {
    return false // Pas de modification locale recente
  }

  // Comparer les timestamps ISO
  const localTimestamp = new Date(localUpdatedAt).getTime()
  const remoteTimestamp = new Date(newUpdatedAt).getTime()
  const oldTimestamp = new Date(oldUpdatedAt).getTime()

  // Conflit si :
  // 1. La modification distante est plus recente que la modification locale
  // 2. La modification distante est plus recente que l'ancien timestamp
  const isRemoteNewerThanLocal = remoteTimestamp > localTimestamp
  const isRemoteNewerThanOld = remoteTimestamp > oldTimestamp

  return isRemoteNewerThanLocal && isRemoteNewerThanOld
}

/**
 * Affiche une notification toast pour un conflit de modification
 *
 * @param remoteUser - Nom de l'utilisateur distant
 * @param field - Champ modifie (ou description)
 * @param oldRecord - Ancien enregistrement (modification locale ecrasee)
 * @param newRecord - Nouvel enregistrement (modification distante)
 */
export function showConflictNotification(
  remoteUser: string,
  field: string,
  oldRecord: Intervention | null,
  newRecord: Intervention
): void {
  // Throttle: skip if we already showed a conflict notification for this intervention within 2s
  const now = Date.now()
  const lastNotif = lastConflictNotification.get(newRecord.id)
  if (lastNotif && now - lastNotif < CONFLICT_THROTTLE_MS) {
    return
  }
  lastConflictNotification.set(newRecord.id, now)

  // Recuperer les valeurs pour le champ modifie
  let oldValue: string | null = null
  let newValue: string | null = null

  if (oldRecord && newRecord) {
    // Essayer de recuperer les valeurs pour les champs communs
    const fieldMap: Record<string, keyof Intervention> = {
      'statut_id': 'statut_id',
      'assigned_user_id': 'assigned_user_id',
      'artisans': 'artisans',
      'date': 'date',
      'date_prevue': 'date_prevue',
    }

    const fieldKey = fieldMap[field] || field
    if (fieldKey in oldRecord && fieldKey in newRecord) {
      oldValue = String(oldRecord[fieldKey as keyof Intervention] || '')
      newValue = String(newRecord[fieldKey as keyof Intervention] || '')
    }
  }

  // Construire le message de notification
  let message = `${remoteUser} a modifie cette intervention en premier.`
  if (oldValue && newValue && oldValue !== newValue) {
    message += ` Votre modification de "${field}" a ete remplacee.`
  } else {
    message += ` Vos modifications ont ete remplacees.`
  }

  toast.warning('Conflit de modification', {
    description: message,
    duration: 5000,
  })
}
