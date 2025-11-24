"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VerticalBarChart } from "./VerticalBarChart"
import { useCycleTimeHistory } from "@/hooks/useCycleTimeHistory"
import type { PeriodType } from "@/lib/api/v2"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

interface CycleTimeHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodType: PeriodType
  startDate?: string
  endDate?: string
  agenceId?: string | null
  gestionnaireId?: string | null
  metierId?: string | null
}

export function CycleTimeHistoryModal({
  open,
  onOpenChange,
  periodType,
  startDate,
  endDate,
  agenceId,
  gestionnaireId,
  metierId,
}: CycleTimeHistoryModalProps) {
  const { data, isLoading, error } = useCycleTimeHistory(
    open
      ? {
          periodType,
          startDate,
          endDate,
          agenceId,
          gestionnaireId,
          metierId,
          includeProjection: true,
        }
      : null,
    { enabled: open }
  )

  const chartData = data
    ? [
        ...data.historical.map((d) => ({
          period: d.periodLabel,
          value: d.value,
          isProjection: false,
        })),
        ...(data.projection
          ? [
              {
                period: data.projection.periodLabel,
                value: data.projection.value,
                isProjection: true,
              },
            ]
          : []),
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Évolution du Cycle Moyen</DialogTitle>
          <DialogDescription>
            Historique des 4 dernières périodes et projection de la période suivante
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8">
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-destructive font-semibold mb-1">
              Erreur lors du chargement des données
            </p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Une erreur est survenue"}
            </p>
          </div>
        ) : (
          <VerticalBarChart
            data={chartData}
            title="Évolution du Cycle Moyen"
            valueFormatter={(value) => `${value}j`}
            legendLabels={{
              series1: "Cycle moyen réel",
              projection: "Projection",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

