/**
 * Enrichissement des enregistrements Realtime avec les donnees de reference
 * Utilise le cache centralisé de common/cache.ts pour eviter la duplication
 */

import type { Intervention } from '@/lib/api/common/types'
import { getReferenceCache, type ReferenceCache } from '@/lib/api/common/cache'
import { mapInterventionRecord } from '@/lib/api/common/utils'

// Re-export from centralized cache for backward compatibility
export { getReferenceCache, type ReferenceCache }

/**
 * Enrichit un enregistrement brut de Supabase Realtime avec les donnees calculees
 * Utilise le meme mapper que les requetes normales pour garantir la coherence
 */
export async function enrichRealtimeRecord(
  rawRecord: Intervention
): Promise<Intervention> {
  try {
    const refs = await getReferenceCache()
    return mapInterventionRecord(rawRecord, refs) as Intervention
  } catch (error) {
    console.error('[cache-sync] Erreur lors de l\'enrichissement:', error)
    // En cas d'erreur, retourner le record brut plutot que de bloquer
    return rawRecord
  }
}
