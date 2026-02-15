/**
 * Freshness Tiers — Stratégie de fraîcheur des données par niveaux
 *
 * Chaque donnée du CRM est assignée à un tier qui détermine comment elle est mise à jour.
 * Le tier n'est pas une propriété fixe du type de donnée mais du CONTEXTE d'utilisation :
 * les commentaires sont T4 (on-demand) en arrière-plan, mais T2 (polling 5s) quand le modal est ouvert.
 *
 * ┌───────┬───────────┬─────────────────────────┬────────────────────────────────────────┐
 * │ Tier  │ Latence   │ Mécanisme               │ Données                                │
 * ├───────┼───────────┼─────────────────────────┼────────────────────────────────────────┤
 * │ T1    │ <1s       │ Realtime channel         │ Interventions, Artisans, Junction      │
 * │ T2    │ 5s        │ Polling modal-scoped     │ Comments, Costs, Documents (modal open)│
 * │ T3    │ 30s       │ Polling background       │ Dashboard stats, Summaries, Counters   │
 * │ T4    │ Manuel    │ Fetch on action          │ Données de référence, Enums, Users     │
 * └───────┴───────────┴─────────────────────────┴────────────────────────────────────────┘
 *
 * Principes :
 * - T1 est géré par Supabase Realtime (realtime-client.ts) — aucun polling
 * - T2 ne poll QUE quand le composant est visible (modal ouvert, onglet actif)
 * - T3 poll en arrière-plan mais respecte `refetchType: 'active'`
 * - T4 ne refetch jamais automatiquement — invalidation manuelle uniquement
 */

import { detectDeviceCapabilities } from '@/lib/device-capabilities'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FreshnessTier = 'T1' | 'T2' | 'T3' | 'T4'

export interface TierConfig {
  /** Identifiant du tier */
  tier: FreshnessTier
  /** Intervalle de polling en ms (false = pas de polling) */
  pollingInterval: number | false
  /** Durée de validité du cache TanStack Query (staleTime) */
  staleTime: number
  /** Durée de conservation en mémoire après démontage (gcTime) */
  gcTime: number
  /** Description humaine */
  label: string
}

// ---------------------------------------------------------------------------
// Configuration par tier
// ---------------------------------------------------------------------------

const BASE_TIERS: Record<FreshnessTier, TierConfig> = {
  /**
   * T1 — Instant : géré par Realtime, pas de polling.
   * staleTime élevé car les mises à jour arrivent via WebSocket.
   * Le cache n'expire que si Realtime est déconnecté (fallback polling 15s dans useCrmRealtime).
   */
  T1: {
    tier: 'T1',
    pollingInterval: false,
    staleTime: 5 * 60 * 1000,   // 5 min — Realtime pousse les updates
    gcTime: 15 * 60 * 1000,     // 15 min
    label: 'Instant (Realtime)',
  },

  /**
   * T2 — Fast : polling quand le composant est monté et visible.
   * Pour les données enfant d'une intervention (comments, costs, documents)
   * quand le modal de détail est ouvert.
   */
  T2: {
    tier: 'T2',
    pollingInterval: 5_000,       // 5s
    staleTime: 3_000,             // 3s — données considérées fraîches 3s après fetch
    gcTime: 2 * 60 * 1000,       // 2 min — nettoyé rapidement après fermeture modal
    label: 'Fast (modal-scoped polling)',
  },

  /**
   * T3 — Background : polling lent pour données agrégées.
   * Dashboard counters, summaries — données qui changent mais dont la latence
   * de 30s est parfaitement acceptable.
   */
  T3: {
    tier: 'T3',
    pollingInterval: 30_000,      // 30s
    staleTime: 15_000,            // 15s
    gcTime: 5 * 60 * 1000,       // 5 min
    label: 'Background (lazy polling)',
  },

  /**
   * T4 — On-demand : jamais de polling automatique.
   * Données de référence (users, agencies, statuts, métiers, enums).
   * Invalidées manuellement après un import ou une modification admin.
   */
  T4: {
    tier: 'T4',
    pollingInterval: false,
    staleTime: 10 * 60 * 1000,   // 10 min
    gcTime: 30 * 60 * 1000,      // 30 min
    label: 'On-demand (manual refresh)',
  },
}

// ---------------------------------------------------------------------------
// Adaptations low-end device
// ---------------------------------------------------------------------------

/**
 * Sur les appareils peu puissants :
 * - T2 poll moins souvent (8s au lieu de 5s)
 * - T3 poll moins souvent (60s au lieu de 30s)
 * - staleTime et gcTime augmentés pour réduire les refetch
 */
const LOW_END_OVERRIDES: Partial<Record<FreshnessTier, Partial<TierConfig>>> = {
  T2: {
    pollingInterval: 8_000,
    staleTime: 5_000,
  },
  T3: {
    pollingInterval: 60_000,
    staleTime: 30_000,
  },
  T4: {
    staleTime: 15 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
  },
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

let cachedConfig: Record<FreshnessTier, TierConfig> | null = null

/**
 * Retourne la configuration des tiers adaptée aux capacités de l'appareil.
 * Le résultat est mis en cache après le premier appel.
 */
export function getFreshnessTiers(): Record<FreshnessTier, TierConfig> {
  if (cachedConfig) return cachedConfig

  const { isLowEnd } = detectDeviceCapabilities()

  if (!isLowEnd) {
    cachedConfig = BASE_TIERS
    return cachedConfig
  }

  // Fusionner les overrides low-end
  cachedConfig = Object.fromEntries(
    (Object.keys(BASE_TIERS) as FreshnessTier[]).map((tier) => [
      tier,
      { ...BASE_TIERS[tier], ...LOW_END_OVERRIDES[tier] },
    ])
  ) as Record<FreshnessTier, TierConfig>

  return cachedConfig
}

/**
 * Raccourci pour obtenir la config d'un tier spécifique.
 */
export function getTierConfig(tier: FreshnessTier): TierConfig {
  return getFreshnessTiers()[tier]
}

/**
 * Retourne les options TanStack Query pour un tier donné.
 * Utilisable directement dans useQuery({ ...getTierQueryOptions('T2'), ... })
 */
export function getTierQueryOptions(tier: FreshnessTier) {
  const config = getTierConfig(tier)
  return {
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    refetchInterval: config.pollingInterval,
    refetchIntervalInBackground: false,     // Jamais poll quand l'onglet est masqué
    refetchOnWindowFocus: tier === 'T3',    // Seul T3 refetch au focus (données agrégées)
    refetchOnMount: tier !== 'T1',          // T1 reçoit via Realtime, pas besoin au mount
  } as const
}