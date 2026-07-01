import type { QueryClient } from "@tanstack/react-query"
import { referenceKeys } from "@/lib/react-query/queryKeys"

/**
 * Invalide et refetch immédiatement tous les caches de données de référence
 * (métiers, agences, statuts d'intervention, statuts artisan).
 *
 * À appeler après une mutation sur les données de référence réalisée hors du
 * flux TanStack Query — typiquement depuis l'écran Paramètres > Enums, où le
 * composant recharge son state local mais ne notifie pas le cache partagé.
 *
 * `refetchType: 'all'` est indispensable ici : le hook partagé
 * `useReferenceDataQuery` est configuré avec `refetchOnMount: false`
 * (voir src/hooks/useReferenceDataQuery.ts). Sans refetch forcé, les écrans
 * non montés au moment de la mutation (ex. la page Artisans) resteraient sur
 * des données périmées jusqu'à un rechargement complet de la page (F5).
 *
 * Les clés `["metiers"]` et `["agences"]` sont les queries isolées utilisées
 * par le FilterBar du dashboard admin, distinctes du cache `referenceKeys`.
 */
export async function invalidateReferenceCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    // Cache partagé : artisans, formulaires interventions, modals, historiques…
    queryClient.invalidateQueries({
      queryKey: referenceKeys.invalidateAll(),
      refetchType: "all",
    }),
    // Clés legacy isolées du FilterBar (src/components/admin-dashboard/FilterBar.tsx)
    queryClient.invalidateQueries({ queryKey: ["metiers"], refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: ["agences"], refetchType: "all" }),
  ])
}
