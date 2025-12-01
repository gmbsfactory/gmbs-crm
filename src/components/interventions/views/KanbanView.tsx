"use client"

import { useMemo } from "react"

import InterventionsKanban from "@/components/interventions/InterventionsKanban"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { runQuery } from "@/lib/query-engine"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type { InterventionViewByLayout } from "@/types/intervention-views"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"

const DEFAULT_STATUS_PIPELINE: InterventionStatusValue[] = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "SAV",
  "STAND_BY",
  "REFUSE",
  "ANNULE",
]

type KanbanViewProps = {
  view: InterventionViewByLayout<"kanban">
  interventions: InterventionEntity[]
  loading: boolean
  error: string | null
  onStatusChange: (id: string, status: InterventionStatusValue) => void
  onInterventionClick?: (id: string, options?: InterventionModalOpenOptions) => void
}

export function KanbanView({
  view,
  interventions,
  loading,
  error,
  onStatusChange,
  onInterventionClick,
}: KanbanViewProps) {
  const dataset = useMemo(
    () => runQuery(interventions, view.filters, view.sorts),
    [interventions, view.filters, view.sorts],
  )
  const orderedIds = useMemo(() => dataset.map((item) => item.id), [dataset])

  const statuses = useMemo(() => {
    if (view.layoutOptions.groupProperty !== "statusValue") {
      return DEFAULT_STATUS_PIPELINE
    }

    const ordered = view.layoutOptions.columnOrder?.length
      ? view.layoutOptions.columnOrder.filter((status): status is InterventionStatusValue =>
          typeof status === "string" && status in INTERVENTION_STATUS,
        )
      : []

    const seen = new Set<InterventionStatusValue>(ordered)
    dataset.forEach((item) => {
      const status = item.statusValue
      if (!seen.has(status)) {
        seen.add(status)
        ordered.push(status)
      }
    })

    return ordered.length ? ordered : DEFAULT_STATUS_PIPELINE
  }, [dataset, view.layoutOptions])

  return (
    <InterventionsKanban
      interventions={dataset}
      statuses={statuses}
      loading={loading}
      error={error}
      onStatusChange={onStatusChange}
      onInterventionClick={onInterventionClick}
      orderedIds={orderedIds}
    />
  )
}

export default KanbanView
