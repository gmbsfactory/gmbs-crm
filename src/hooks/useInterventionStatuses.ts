import { useCallback, useMemo } from "react";

import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery";
import type { InterventionStatus } from "@/types/intervention";

interface UseInterventionStatusesReturn {
  statuses: InterventionStatus[];
  statusesById: Map<string, InterventionStatus>;
  statusesByCode: Map<string, InterventionStatus>;
  statusesByLabel: Map<string, InterventionStatus>;
  loading: boolean;
  error: Error | null;
  getStatusById: (id: string) => InterventionStatus | undefined;
  getStatusByCode: (code: string) => InterventionStatus | undefined;
  getStatusByLabel: (label: string) => InterventionStatus | undefined;
}

/**
 * Charge et met en cache la liste des statuts d'intervention.
 * Fournit des maps et helpers pour accéder rapidement aux statuts.
 *
 * Dérive les données depuis useReferenceDataQuery (TanStack Query)
 * pour bénéficier de la déduplication automatique des requêtes.
 */
export function useInterventionStatuses(): UseInterventionStatusesReturn {
  const { data, loading, error: queryError } = useReferenceDataQuery();

  const statuses = useMemo(
    () => (data?.interventionStatuses ?? []) as InterventionStatus[],
    [data]
  );

  const error = useMemo(
    () => (queryError ? new Error(queryError) : null),
    [queryError]
  );

  const statusesById = useMemo(() => {
    const map = new Map<string, InterventionStatus>();
    statuses.forEach((status) => {
      map.set(status.id, status);
    });
    return map;
  }, [statuses]);

  const statusesByCode = useMemo(() => {
    const map = new Map<string, InterventionStatus>();
    statuses.forEach((status) => {
      map.set(status.code, status);
    });
    return map;
  }, [statuses]);

  const statusesByLabel = useMemo(() => {
    const map = new Map<string, InterventionStatus>();
    statuses.forEach((status) => {
      map.set(status.label.toLowerCase(), status);
    });
    return map;
  }, [statuses]);

  const getStatusById = useCallback(
    (id: string) => statusesById.get(id),
    [statusesById]
  );
  const getStatusByCode = useCallback(
    (code: string) => statusesByCode.get(code),
    [statusesByCode]
  );
  const getStatusByLabel = useCallback(
    (label: string) => statusesByLabel.get(label.toLowerCase()),
    [statusesByLabel]
  );

  return {
    statuses,
    statusesById,
    statusesByCode,
    statusesByLabel,
    loading,
    error,
    getStatusById,
    getStatusByCode,
    getStatusByLabel,
  };
}
