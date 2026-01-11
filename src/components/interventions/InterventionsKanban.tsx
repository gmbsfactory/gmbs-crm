"use client"

import * as React from "react"
import { Mail, Phone, MapPin, Calendar, User } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
  type DragEndEvent,
} from "@/components/ui/kanban"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionView } from "@/types/intervention-view"
import { mapStatusToDb } from "@/lib/interventions/mappers"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { getInterventionStatusColor } from "@/config/status-colors"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"

const DEFAULT_STATUS_COLOR = "#6B7280"

type KanbanColumn = {
  id: InterventionStatusValue
  name: string
  color: string
}

type KanbanItem = {
  id: string
  name: string
  column: InterventionStatusValue
  intervention: InterventionView
}

type InterventionsKanbanProps = {
  interventions: InterventionView[]
  statuses: InterventionStatusValue[]
  loading: boolean
  error: string | null
  onStatusChange: (id: string, status: InterventionStatusValue) => void
  onInterventionClick?: (id: string, options?: InterventionModalOpenOptions) => void
  orderedIds?: string[]
}

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number") return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
}

const formatDate = (input?: string | null) => {
  if (!input) return "—"
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR")
}

const initials = (value?: string | null) =>
  (value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

export default function InterventionsKanban({
  interventions,
  statuses,
  loading,
  error,
  onStatusChange,
  onInterventionClick,
  orderedIds = [],
}: InterventionsKanbanProps) {

  const columns = React.useMemo<KanbanColumn[]>(
    () =>
      statuses.map((status) => ({
        id: status,
        name: INTERVENTION_STATUS[status]?.label ?? mapStatusToDb(status),
        color: getInterventionStatusColor(INTERVENTION_STATUS[status]?.label, status) || DEFAULT_STATUS_COLOR,
      })),
    [statuses],
  )

  const [items, setItems] = React.useState<KanbanItem[]>([])

  React.useEffect(() => {
    setItems(
      interventions.map((intervention) => ({
        id: intervention.id,
        name: intervention.contexteIntervention || intervention.commentaireAgent || "Intervention",
        column: intervention.statusValue,
        intervention,
      })),
    )
  }, [interventions])

  const counts = React.useMemo(() => {
    const result = new Map<InterventionStatusValue, number>()
    interventions.forEach((intervention) => {
      result.set(intervention.statusValue, (result.get(intervention.statusValue) ?? 0) + 1)
    })
    return result
  }, [interventions])

  const handleDataChange = React.useCallback((nextItems: KanbanItem[]) => {
    setItems(nextItems)
  }, [])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeIntervention = interventions.find((intervention) => intervention.id === active.id)
      if (!activeIntervention) return

      const overColumn =
        columns.find((column) => column.id === over.id)?.id ??
        items.find((item) => item.id === over.id)?.column ??
        null

      if (!overColumn || activeIntervention.statusValue === overColumn) {
        return
      }

      onStatusChange(activeIntervention.id, overColumn)
    },
    [columns, interventions, items, onStatusChange],
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!columns.length) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        Aucun statut disponible pour l’instant.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <KanbanProvider<KanbanItem, KanbanColumn>
        columns={columns}
        data={items}
        onDataChange={handleDataChange}
        onDragEnd={handleDragEnd}
        autoScroll
      >
        {(column) => (
          <KanbanBoard id={column.id} key={column.id}>
            <KanbanHeader className="flex items-center gap-2 bg-secondary/40">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
              <span>{column.name}</span>
              <Badge variant="secondary" className="ml-auto">
                {counts.get(column.id) ?? 0}
              </Badge>
            </KanbanHeader>
            <KanbanCards<KanbanItem> id={column.id} className="min-h-[160px]">
              {(item) => {
                const intervention = item.intervention
                return (
                  <KanbanCard id={item.id} name={item.name} column={item.column} key={item.id}>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-1 items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(intervention.nomClient || intervention.prenomClient)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="truncate text-muted-foreground">
                              {(intervention.prenomClient || "") + " " + (intervention.nomClient || "") || "Client inconnu"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            onInterventionClick?.(intervention.id, {
                              layoutId: `kanban-card-${intervention.id}`,
                              orderedIds,
                              index: Math.max(0, orderedIds.indexOf(intervention.id)),
                            })
                          }
                        >
                          ↗
                        </Button>
                      </div>

                      <div className="space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">
                            {intervention.adresse || "—"}
                            {intervention.ville ? `, ${intervention.ville}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(intervention.dateIntervention || intervention.date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{intervention.assignedUserCode ?? intervention.attribueA ?? "Non assigné"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2 text-muted-foreground">
                        <div className="space-x-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" type="button">
                            <Mail className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" type="button">
                            <Phone className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right text-sm font-semibold text-foreground">
                          {formatCurrency(intervention.marge || intervention.coutIntervention)}
                        </div>
                      </div>
                    </div>
                  </KanbanCard>
                )
              }}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  )
}
