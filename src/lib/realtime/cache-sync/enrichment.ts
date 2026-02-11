/**
 * Enrichissement des enregistrements Realtime avec les donnees de reference
 * Utilise un cache de reference pour eviter les appels API repetitifs
 */

import type { Intervention } from '@/lib/api/v2/common/types'
import { mapInterventionRecord } from '@/lib/api/v2/common/utils'
import { referenceApi } from '@/lib/reference-api'

// Cache de reference pour l'enrichissement (similaire aux autres fichiers)
export interface ReferenceCache {
  data: any
  fetchedAt: number
  usersById: Map<string, any>
  agenciesById: Map<string, any>
  interventionStatusesById: Map<string, any>
  metiersById: Map<string, any>
}

const REFERENCE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
let referenceCache: ReferenceCache | null = null
let referenceCachePromise: Promise<ReferenceCache> | null = null

/**
 * Obtient le cache de reference pour enrichir les donnees
 */
export async function getReferenceCache(): Promise<ReferenceCache> {
  const now = Date.now()
  if (referenceCache && now - referenceCache.fetchedAt < REFERENCE_CACHE_DURATION) {
    return referenceCache
  }

  if (referenceCachePromise) {
    return referenceCachePromise
  }

  referenceCachePromise = (async () => {
    const data = await referenceApi.getAll()
    const cache: ReferenceCache = {
      data,
      fetchedAt: Date.now(),
      usersById: new Map(data.users.map((user: any) => [user.id, user])),
      agenciesById: new Map(data.agencies.map((agency: any) => [agency.id, agency])),
      interventionStatusesById: new Map(
        data.interventionStatuses.map((status: any) => [status.id, status])
      ),
      metiersById: new Map(data.metiers.map((metier: any) => [metier.id, metier])),
    }
    referenceCache = cache
    referenceCachePromise = null
    return cache
  })()

  try {
    return await referenceCachePromise
  } catch (error) {
    referenceCachePromise = null
    throw error
  }
}

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
