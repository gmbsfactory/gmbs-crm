import { interventionsApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import type { QueryClient } from "@tanstack/react-query"
import type { CreateCommentData } from "@/lib/api/v2/common/types"
import { toast } from "sonner"

export interface PostMutationCost {
  cost_type: 'sst' | 'materiel' | 'intervention' | 'marge'
  amount: number
  artisan_order?: 1 | 2 | null
  label?: string | null
}

export interface PostMutationPayment {
  payment_type: string
  amount: number
  currency?: string
  is_received?: boolean
  payment_date?: string | null
}

export interface PostMutationConfig {
  interventionId: string

  /** Artisan assignments — only calls API when current !== next */
  artisans?: {
    primary?: { current: string | null; next: string | null }
    secondary?: { current: string | null; next: string | null }
  }

  /** Costs to upsert in batch (uses upsertCostsBatch) */
  costs?: PostMutationCost[]

  /** Delete secondary artisan costs when 2nd artisan is removed */
  deleteSecondaryCosts?: boolean

  /** Payments to upsert */
  payments?: PostMutationPayment[]

  /** Non-critical comment to create (errors shown via toast) */
  comment?: Omit<CreateCommentData, 'entity_id'>

  /** QueryClient for cache invalidations */
  queryClient?: QueryClient

  /** Invalidate dashboard + podium caches after tasks complete */
  invalidateDashboard?: boolean

  /** Invalidate comments cache after tasks complete */
  invalidateComments?: boolean
}

/**
 * Runs all non-critical post-mutation tasks in parallel (fire-and-forget).
 *
 * This function is NOT awaited — it returns void immediately.
 * Each individual task catches its own errors to prevent cascading failures.
 * Cache invalidations (including intervention detail) run after all tasks settle.
 */
export function runPostMutationTasks(config: PostMutationConfig): void {
  const tasks: Promise<unknown>[] = []

  // Artisan assignments (only if changed)
  const primary = config.artisans?.primary
  if (primary && primary.current !== primary.next) {
    tasks.push(
      interventionsApi.setPrimaryArtisan(config.interventionId, primary.next)
        .catch(e => console.error('[PostMutation] setPrimaryArtisan failed:', e))
    )
  }

  const secondary = config.artisans?.secondary
  if (secondary && secondary.current !== secondary.next) {
    tasks.push(
      interventionsApi.setSecondaryArtisan(config.interventionId, secondary.next)
        .catch(e => console.error('[PostMutation] setSecondaryArtisan failed:', e))
    )
  }

  // Costs batch upsert
  if (config.costs && config.costs.length > 0) {
    tasks.push(
      interventionsApi.upsertCostsBatch(config.interventionId, config.costs)
        .catch(e => console.error('[PostMutation] upsertCostsBatch failed:', e))
    )
  }

  // Delete secondary artisan costs
  if (config.deleteSecondaryCosts) {
    tasks.push(
      Promise.all([
        interventionsApi.deleteCost(config.interventionId, 'sst', 2),
        interventionsApi.deleteCost(config.interventionId, 'materiel', 2),
      ]).catch(() => { /* cost may not exist, safe to ignore */ })
    )
  }

  // Payments in parallel
  if (config.payments) {
    for (const payment of config.payments) {
      tasks.push(
        interventionsApi.upsertPayment(config.interventionId, payment)
          .catch(e => console.error('[PostMutation] upsertPayment failed:', e))
      )
    }
  }

  // Non-critical comment
  if (config.comment) {
    tasks.push(
      commentsApi.create({ entity_id: config.interventionId, ...config.comment })
        .catch(e => {
          console.error('[PostMutation] create comment failed:', e)
          toast.error("Le commentaire n'a pas pu être enregistré.")
        })
    )
  }

  // After all tasks settle, run cache invalidations
  const invalidateCache = () => {
    if (!config.queryClient) return

    // Toujours invalider le cache intervention detail pour que les données
    // enrichies (owner name, tenant name, coûts, paiements) soient visibles.
    // Les données optimistes de onMutate ne contiennent que les IDs (owner_id, tenant_id),
    // pas les noms résolus — ce refetch les récupère.
    config.queryClient.invalidateQueries({ queryKey: ['interventions', 'detail', config.interventionId] })

    if (config.invalidateDashboard) {
      config.queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      config.queryClient.invalidateQueries({ queryKey: ['podium'] })
    }
    if (config.invalidateComments) {
      config.queryClient.invalidateQueries({ queryKey: ['comments', 'intervention', config.interventionId] })
    }
  }

  if (tasks.length > 0) {
    // Attendre que toutes les tâches soient terminées avant d'invalider
    Promise.allSettled(tasks).then(invalidateCache)
  } else {
    // Même sans tâches, invalider le detail pour rafraîchir les données enrichies
    invalidateCache()
  }
}
